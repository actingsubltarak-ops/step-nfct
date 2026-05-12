import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Task, TeamMember, Notification } from '../types';
import { toast } from 'sonner';

export function useFirestoreData(user: FirebaseUser | null, userProfile?: TeamMember | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [taskOwners, setTaskOwners] = useState<{ id: string; name: string; departmentId: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Fetch departments and taskOwners regardless of auth status for registration
    const ownersQuery = query(collection(db, 'taskOwners'));
    const unsubscribeOwners = onSnapshot(ownersQuery, (snapshot) => {
      const ownersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as { id: string; name: string; departmentId: string }[];
      setTaskOwners(ownersData);
    }, (error) => {
      console.error('[Firestore] taskOwners listener error:', error);
    });

    const deptsQuery = query(collection(db, 'departments'));
    const unsubscribeDepts = onSnapshot(deptsQuery, (snapshot) => {
      const deptsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as { id: string; name: string }[];
      setDepartments(deptsData);
    }, (error) => {
      console.error('[Firestore] departments listener error:', error);
    });

    if (!user || userProfile?.status !== 'Active') {
      setTasks([]);
      setTeamMembers([]);
      setNotifications([]);
      return () => {
        unsubscribeOwners();
        unsubscribeDepts();
      };
    }

    const tasksQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(500));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
      setTasks(tasksData);
    }, (error: any) => {
      console.error('[Firestore] tasks listener error:', error);
      if (error.message?.includes('index')) {
        toast.error('ต้องการการตั้งค่า Index ใน Firebase สำหรับหน้าติดตามงาน', {
          description: 'กรุณาตรวจสอบ Console Log และคลิกที่ลิงก์ใน Error เพื่อสร้าง Query Index ครับ'
        });
      }
    });

    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(500));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TeamMember[];
      setTeamMembers(usersData);
    }, (error: any) => {
      console.error('[Firestore] users listener error:', error);
    });

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      const notificationsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
      setNotifications(notificationsData);
    }, (error: any) => {
      console.warn("Notifications listener error (possibly missing index):", error);
      if (error.message?.includes('index')) {
        console.info("%c[Firebase Index Required]%c คุณต้องสร้า่ง Index สำหรับการแจ้งเตือน โดยคลิกที่ลิงก์ใน Error ด้านบนครับ", "color: white; background: #ef4444; padding: 2px 4px; border-radius: 4px;", "color: #ef4444;");
      }
    });

    return () => {
      unsubscribeTasks();
      unsubscribeUsers();
      unsubscribeOwners();
      unsubscribeDepts();
      unsubscribeNotifications();
    };
  }, [user?.uid]);

  return { tasks, teamMembers, taskOwners, departments, notifications };
}
