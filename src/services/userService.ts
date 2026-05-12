import { doc, updateDoc, deleteDoc, Timestamp, setDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';

export const userService = {
  async createUser(userId: string, data: any) {
    try {
      const userRef = doc(db, 'users', userId);
      // Use setDoc with merge: true to handle cases where useAuth might have already created a basic profile
      await setDoc(userRef, {
        ...data,
        uid: userId,
        id: userId,
        createdAt: data.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now()
      }, { merge: true });
      
      // Auto-notify admins if the user is Inactive (new registration)
      if (data.status === 'Inactive') {
        // Run in background, don't await to avoid blocking user creation if permissions for query are missing
        this.notifyAdminsAboutNewUser(data.name || 'ผู้ใช้งานใหม่', data.email || 'ไม่ระบุอีเมล').catch(err => {
          console.warn("Could not notify admins (likely permission restriction for new users):", err);
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${userId}`);
      throw error;
    }
  },

  async notifyAdminsAboutNewUser(name: string, email: string) {
    try {
      // Find all managers
      const managersQuery = query(collection(db, 'users'), where('role', '==', 'Administrator'), where('status', '==', 'Active'));
      const managersSnapshot = await getDocs(managersQuery);
      
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || '';
      
      const notificationPromises = managersSnapshot.docs.map(adminDoc => {
        const notifRef = doc(collection(db, 'notifications'));
        return setDoc(notifRef, {
          id: notifRef.id,
          userId: adminDoc.id,
          title: 'มีผู้ใช้งานใหม่รอการอนุมัติ',
          message: `ผู้ใช้งาน: ${name} (${email}) ได้ลงทะเบียนเข้าสู่ระบบและกำลังรอการตรวจสอบจากคุณ`,
          type: 'Alert',
          isRead: false,
          timestamp: new Date().toISOString()
        });
      });
      
      await Promise.all(notificationPromises);
    } catch (error) {
      console.error("Error notifying admins:", error);
    }
  },

  async updateUser(userId: string, data: any) {
    const toastId = toast.loading('กำลังอัปเดตข้อมูลผู้ใช้...');
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        ...data,
        updatedAt: Timestamp.now()
      });
      toast.success('อัปเดตข้อมูลผู้ใช้สำเร็จ', { id: toastId });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      toast.error('ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้', { id: toastId });
      throw error;
    }
  },

  async deleteUser(userId: string) {
    const toastId = toast.loading('กำลังลบผู้ใช้...');
    try {
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
      toast.success('ลบผู้ใช้สำเร็จ', { id: toastId });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
      toast.error('ไม่สามารถลบผู้ใช้ได้', { id: toastId });
      throw error;
    }
  }
};
