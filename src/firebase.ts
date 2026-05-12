import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDocFromServer, writeBatch, runTransaction, getDocs, collection, query, where, updateDoc, deleteDoc, orderBy, limit, Timestamp, arrayUnion } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

import firebaseAppConfig from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.FIREBASE_PROJECT_ID || firebaseAppConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppConfig.appId
};

// Validate config
if (import.meta.env.DEV) {
  const missingKeys = Object.entries(firebaseConfig)
    .filter(([_, value]) => !value)
    .map(([key]) => key);
  
  if (missingKeys.length > 0) {
    console.warn("⚠️ Firebase Configuration is incomplete!", {
      missingKeys,
      hint: "Check your .env file or firebase-applet-config.json"
    });
  }
}

// Get Database ID with robust fallback
const getDbId = () => {
  const envId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
  if (envId && envId !== 'default' && envId !== '(default)') return envId;
  return firebaseAppConfig.firestoreDatabaseId;
};

const databaseId = getDbId();

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, databaseId);
if (import.meta.env.DEV) {
  console.log("Firestore initialized with Database ID:", databaseId);
}
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(err => {
  if (import.meta.env.DEV) console.error("Persistence error:", err);
});

export const storage = getStorage(app);
export const messaging = async () => {
  const supported = await isSupported();
  return supported ? getMessaging(app) : null;
};
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// FCM Helpers
export const requestFCMToken = async () => {
  try {
    const msg = await messaging();
    if (!msg) return null;
    
    // Check if permission is granted
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;
    }

    // Register Service Worker manually to send config
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      
      // Wait for the service worker to be ready
      const sw = registration.active || registration.installing || registration.waiting;
      if (sw) {
        sw.postMessage({
          type: 'INIT_FIREBASE',
          config: firebaseConfig
        });
      }
    }

    const vapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY || import.meta.env.VITE_FIREBASE_VAPID)?.trim();
    if (!vapidKey) {
      if (import.meta.env.DEV) {
        console.warn("FCM: VITE_FIREBASE_VAPID_KEY or VITE_FIREBASE_VAPID is missing. Skipping token request.");
      }
      return null;
    }

    try {
      const token = await getToken(msg, { vapidKey });
      return token;
    } catch (getTokenError: any) {
      if (getTokenError.message?.includes('applicationServerKey')) {
        console.error("FCM Error: The VAPID key provided is invalid.");
        console.info("Target Variable: VITE_FIREBASE_VAPID_KEY or VITE_FIREBASE_VAPID");
        console.info("Please verify the key matches 'Public Key' in Firebase Console -> Cloud Messaging.");
      } else {
        console.error("FCM Error requesting token:", getTokenError);
      }
      return null;
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("Error requesting FCM token:", error);
    }
    return null;
  }
};

export const onForegroundMessage = async (callback: (payload: any) => void) => {
  const msg = await messaging();
  if (!msg) return () => {};
  return onMessage(msg, (payload) => {
    callback(payload);
  });
};

// Auth Helpers
export const loginWithGoogle = async () => {
  try {
    // We prefer signInWithPopup even in iframes because signInWithRedirect
    // often hits 403 Forbidden or storage blocking issues in AI Studio/Preview.
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error: any) {
    const isBlocked = error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user';
    
    if (import.meta.env.DEV) {
      console.group("Firebase Login detailed diagnostic info:");
      if (isBlocked) {
        console.warn("Code:", error.code);
        console.warn("Message:", error.message);
        console.warn("Popup blocked. This is expected in some browsers. Try clicking the login button again or enabling popups.");
      } else {
        console.error("Code:", error.code);
        console.error("Message:", error.message);
      }
      
      if (!isBlocked && error.code === 'auth/internal-error' && error.message?.includes('403')) {
        console.warn("403 Forbidden detected. Please verify:");
        console.warn("1. Authorized Domains in Firebase console (e.g., stackblitz.io, webcontainer.io)");
        console.warn("2. Authorized Redirect URIs in Google Cloud Console");
        console.warn("3. Third-party cookie settings in your browser.");
      }
      console.groupEnd();
    }
    throw error;
  }
};

export const loginWithGoogleRedirect = async () => {
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error: any) {
    console.error("Redirect Login Error:", error);
    throw error;
  }
};
export const getAuthRedirectResult = () => getRedirectResult(auth);
export const loginWithEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const registerWithEmail = (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export const logout = () => signOut(auth);

/**
 * Gets the current user's Firebase ID Token for authenticating server-side requests.
 * @returns Promise with ID token string or null if not authenticated
 */
export const getIdToken = async (): Promise<string | null> => {
  if (!auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(true);
  } catch (error) {
    console.error("Error getting ID token:", error);
    return null;
  }
};

export { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  writeBatch, 
  runTransaction, 
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  limit,
  Timestamp,
  arrayUnion
};

// Firestore Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  if (import.meta.env.DEV) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

// Connection Test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      if (import.meta.env.DEV) {
        console.error("Please check your Firebase configuration. The client is offline.");
      }
    }
  }
}

// testConnection(); // Commented out to prevent blocking module load
