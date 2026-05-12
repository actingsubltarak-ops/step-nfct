import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  auth, 
  db, 
  doc, 
  getDocs, 
  collection, 
  query, 
  where, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  limit, 
  Timestamp
} from '../firebase';
import { TeamMember } from '../types';
import { getDoc, DocumentReference } from 'firebase/firestore';
import { isSystemAdmin } from '../lib/utils';

/**
 * Ensures user profile exists and is synchronized with manual records if needed.
 */
async function initializeUserProfile(currentUser: FirebaseUser): Promise<TeamMember | null> {
  const userRef = doc(db, 'users', currentUser.uid) as DocumentReference<TeamMember>;
  
  // Retry getDoc a few times if registration just happened
  let userDoc = await getDoc(userRef);
  const creationTime = new Date(currentUser.metadata.creationTime || '').getTime();
  const now = new Date().getTime();
  const isPossiblyNew = now - creationTime < 15000; // 15s window

  if (!userDoc.exists() && isPossiblyNew) {
    console.log("Profile not found but user is new, retrying...");
    // Wait 2 seconds and try once more
    await new Promise(resolve => setTimeout(resolve, 2000));
    userDoc = await getDoc(userRef);
  }

  const currentUserEmail = currentUser.email?.toLowerCase().trim() || '';
  const isDefaultAdmin = isSystemAdmin(currentUserEmail);

  if (!userDoc.exists()) {
    // New user or missing profile
    return await createNewProfile(currentUser, userRef, isDefaultAdmin);
  }

  const existingData = userDoc.data() as TeamMember;
  return await syncExistingProfile(currentUser, userRef, existingData, isDefaultAdmin);
}

/**
 * Creates a new profile for a newly authenticated user.
 */
async function createNewProfile(currentUser: FirebaseUser, userRef: DocumentReference<TeamMember>, isDefaultAdmin: boolean): Promise<TeamMember | null> {
  const currentUserEmail = currentUser.email?.toLowerCase().trim() || '';
  
  // Check if there's a manually added user with this email to merge data
  let manualUser: any = null;
  let manualDocId: string | null = null;
  const emailToQuery = currentUserEmail;

  try {
    // 1. Try direct lookup by email (ID) - the new MasterData pattern
    const emailRef = doc(db, 'users', emailToQuery);
    const emailDoc = await getDoc(emailRef);
    
    if (emailDoc.exists() && emailDoc.id !== currentUser.uid) {
      manualUser = emailDoc.data();
      manualDocId = emailDoc.id;
      console.log("Found manual profile to merge (via direct ID):", manualDocId);
    } else {
      // 2. Fallback to query
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', emailToQuery));
      const querySnapshot = await getDocs(q);
      
      const matchedDoc = querySnapshot.docs.find(doc => doc.id !== currentUser.uid);
      if (matchedDoc) {
        manualUser = matchedDoc.data();
        manualDocId = matchedDoc.id;
        console.log("Found manual profile to merge (via query):", manualDocId);
      }
    }
  } catch (error) {
    console.warn("Could not check for manual user profile:", error);
  }

  // Blocker #1 Fix: If we don't find a doc, check if we're in the middle of a signup
  if (!manualUser && !manualDocId) {
    const creationTime = new Date(currentUser.metadata.creationTime || '').getTime();
    const now = new Date().getTime();
    if (now - creationTime < 10000) {
      console.log("New user detected, skipping default profile creation to avoid race condition");
      return null; 
    }
  }

  const newProfile: TeamMember = {
    id: currentUser.uid,
    uid: currentUser.uid,
    name: manualUser?.name || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
    email: currentUserEmail,
    role: isDefaultAdmin ? 'Administrator' : (manualUser?.role || 'Staff'),
    department: isDefaultAdmin ? 'สำนักบริหารกลาง' : (manualUser?.department || 'กรุณาระบุหน่วยงาน'),
    jobTitle: isDefaultAdmin ? 'หัวหน้าส่วนสารสนเทศ' : (manualUser?.jobTitle || 'Staff'),
    status: (isDefaultAdmin || manualUser?.status === 'Active') ? 'Active' : 'Inactive',
    lastActive: Timestamp.now(),
    createdAt: manualUser?.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now(),
    photoURL: currentUser.photoURL || manualUser?.photoURL || null,
    provider: (currentUser.providerData[0]?.providerId as any) || 'google',
    isManual: false 
  };

  const batch = writeBatch(db);
  batch.set(userRef, newProfile, { merge: true });
  
  if (manualDocId && manualDocId !== currentUser.uid) {
    batch.delete(doc(db, 'users', manualDocId));
  }

  await batch.commit();
  return newProfile;
}

/**
 * Synchronizes an existing profile with auth data and enforces admin roles.
 */
async function syncExistingProfile(currentUser: FirebaseUser, userRef: DocumentReference<TeamMember>, data: TeamMember, isDefaultAdmin: boolean): Promise<TeamMember> {
  const updates: Partial<TeamMember> = {};
  const currentUserEmail = currentUser.email?.toLowerCase().trim() || '';
  
  // Sync provider if missing
  const isGoogleProvider = currentUser.providerData.some(p => p.providerId === 'google.com');
  if (isGoogleProvider && data.provider !== 'google') {
    updates.provider = 'google';
    data.provider = 'google';
  }

  // Update last active if more than 5 minutes have passed
  const fiveMinutes = 5 * 60 * 1000;
  let lastActiveMillis = 0;
  if (data.lastActive) {
    if (typeof data.lastActive.toMillis === 'function') {
      lastActiveMillis = data.lastActive.toMillis();
    } else if (typeof data.lastActive === 'string') {
      lastActiveMillis = new Date(data.lastActive).getTime();
    }
  }

  if (Date.now() - lastActiveMillis > fiveMinutes) {
    const now = Timestamp.now();
    updates.lastActive = now;
    data.lastActive = now;
    updates.updatedAt = now;
    data.updatedAt = now;
  }

  // Enforce admin role for system admins
  if (isDefaultAdmin && (data.role !== 'Administrator' || data.status !== 'Active')) {
    updates.role = 'Administrator';
    data.role = 'Administrator';
    updates.status = 'Active';
    data.status = 'Active';
    
    if (!data.name || data.name === 'User' || data.name === currentUser.email?.split('@')[0]) {
      updates.name = currentUser.displayName || 'Administrator';
      data.name = updates.name;
    }
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(userRef, updates);
  }

  return data;
}

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          const profile = await initializeUserProfile(currentUser);
          setUserProfile(profile);
        } else {
          setUserProfile(null);
        }
      } catch (error: any) {
        console.error("Auth state change error:", error?.message || error);
      } finally {
        setUser(currentUser);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, userProfile, loading };
}
