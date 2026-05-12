import { doc, collection, setDoc, updateDoc, deleteDoc, Timestamp, addDoc, increment, getDoc, getDocs, getCountFromServer, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Task, TeamMember, Notification } from '../types';
import { calculateKpiScore, generateId, cleanFirestoreData } from '../lib/utils';
import { sendExternalNotification } from './notificationService';
import { auditService } from './auditService';
import { toast } from 'sonner';

// Helper to update dashboard stats
const updateDashboardStats = async (totalDelta: number, completedDelta: number) => {
  try {
    const statsRef = doc(db, 'stats', 'dashboard');
    const statsSnap = await getDoc(statsRef);
    
    if (!statsSnap.exists()) {
      await setDoc(statsRef, {
        total: Math.max(0, totalDelta),
        completed: Math.max(0, completedDelta),
        updatedAt: Timestamp.now()
      });
    } else {
      await updateDoc(statsRef, {
        total: increment(totalDelta),
        completed: increment(completedDelta),
        updatedAt: Timestamp.now()
      });
    }
  } catch (error) {
    console.error("Error updating dashboard stats:", error);
  }
};

export const taskService = {
  async addTask(newTask: Partial<Task>, user: any, userProfile: TeamMember | null, teamMembers: TeamMember[]) {
    const toastId = toast.loading('กำลังเพิ่มงาน...');
    try {
      const taskRef = doc(collection(db, 'tasks'));
      const { id, ...taskData } = newTask;
      const now = Timestamp.now();
      
      const cleanData = cleanFirestoreData(taskData);

      const creationActivity = {
        id: generateId(),
        type: 'Creation',
        description: 'สร้างงานใหม่',
        userId: user?.uid || '',
        userName: userProfile?.name || 'Unknown User',
        timestamp: new Date().toISOString(),
      };

      await setDoc(taskRef, {
        ...cleanData,
        id: taskRef.id,
        createdAt: now,
        createdBy: user?.uid,
        updatedAt: now,
      });

      // Audit Log
      await auditService.logAction(
        { uid: user?.uid || '', name: userProfile?.name || 'Unknown User' },
        'CREATE_TASK',
        `สร้างงานใหม่: ${taskData.title}`,
        'Task',
        taskRef.id,
        { title: taskData.title }
      );

      // Update global stats
      await updateDashboardStats(1, taskData.status === 'Completed' ? 1 : 0);

      // Add activity to subcollection
      const activityRef = doc(collection(db, `tasks/${taskRef.id}/activities`), creationActivity.id);
      await setDoc(activityRef, creationActivity);

      // Create notifications for all assignees if not the creator
      const allAssigneeIds = new Set<string>();
      if (taskData.assigneeId) allAssigneeIds.add(taskData.assigneeId);
      if (taskData.assigneeIds && Array.isArray(taskData.assigneeIds)) {
        taskData.assigneeIds.forEach((id: string) => allAssigneeIds.add(id));
      }

      for (const assigneeId of allAssigneeIds) {
        if (assigneeId !== user?.uid) {
          await this.createNotification({
            userId: assigneeId,
            title: 'ได้รับมอบหมายงานใหม่',
            message: `คุณได้รับมอบหมายงาน: ${taskData.title}`,
            type: 'Task Assigned',
            taskId: taskRef.id
          }, teamMembers);
        }
      }

      toast.success('เพิ่มงานสำเร็จ', { id: toastId });
      return taskRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
      toast.error('ไม่สามารถเพิ่มงานได้', { id: toastId });
      throw error;
    }
  },

  async addActivity(taskId: string, activity: any) {
    try {
      const activityId = activity.id || generateId();
      const activityRef = doc(db, `tasks/${taskId}/activities`, activityId);
      await setDoc(activityRef, cleanFirestoreData({
        ...activity,
        id: activityId,
        timestamp: activity.timestamp || new Date().toISOString()
      }));
      
      // Update task's updatedAt
      await updateDoc(doc(db, 'tasks', taskId), {
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error("Error adding activity:", error);
    }
  },

  async addComment(taskId: string, comment: any) {
    try {
      const commentId = comment.id || generateId();
      const commentRef = doc(db, `tasks/${taskId}/comments`, commentId);
      await setDoc(commentRef, cleanFirestoreData({
        ...comment,
        id: commentId,
        timestamp: comment.timestamp || new Date().toISOString()
      }));
      
      // Update task's updatedAt
      await updateDoc(doc(db, 'tasks', taskId), {
        updatedAt: Timestamp.now()
      });

      // Register activity for the comment
      await this.addActivity(taskId, {
        type: 'Comment',
        description: 'เพิ่มความคิดเห็นใหม่',
        userId: comment.userId,
        userName: comment.userName,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tasks/${taskId}/comments`);
      throw error;
    }
  },

  async updateTask(taskId: string, updatedData: Partial<Task>, user: any, userProfile: TeamMember | null, teamMembers: TeamMember[], existingTask?: Task) {
    const toastId = toast.loading('กำลังบันทึกข้อมูล...');
    
    // Stats tracking logic
    let completedDelta = 0;
    if (existingTask && updatedData.status && updatedData.status !== existingTask.status) {
      if (updatedData.status === 'Completed') {
        completedDelta = 1;
      } else if (existingTask.status === 'Completed') {
        completedDelta = -1;
      }
    }
    
    // Automated KPI Calculation
    if (updatedData.status === 'Completed' && existingTask && existingTask.status !== 'Completed') {
      const completedAt = new Date().toISOString();
      const kpiScore = calculateKpiScore(
        existingTask.startDate, 
        existingTask.endDate || existingTask.startDate, 
        completedAt
      );
      updatedData.completedAt = completedAt;
      updatedData.kpiScore = kpiScore;
      
      if (updatedData.qualityScore === undefined) {
        updatedData.qualityScore = 90;
      }
    }

    try {
      const taskRef = doc(db, 'tasks', taskId);
      
      // Sanitization: Recursively clean data for Firestore compatibility
      const cleanData = cleanFirestoreData(updatedData);
      // Remove restricted fields
      delete (cleanData as any).activities;
      delete (cleanData as any).comments;
      delete (cleanData as any).id;

      const currentTask = existingTask;

      if (!currentTask) {
        await updateDoc(taskRef, {
          ...cleanData,
          updatedAt: Timestamp.now(),
        });
        toast.success('บันทึกข้อมูลสำเร็จ', { id: toastId });
        return;
      }

      const newActivity: any = {
        id: generateId(),
        userId: user?.uid || '',
        userName: userProfile?.name || 'Unknown User',
        timestamp: new Date().toISOString(),
      };

      // Determine activity type
      let shouldAddActivity = true;
      if (updatedData.status && updatedData.status !== currentTask.status) {
        newActivity.type = 'Status Change';
        newActivity.description = `เปลี่ยนสถานะจาก "${currentTask.status}" เป็น "${updatedData.status}"`;
      } else if (updatedData.attachments && updatedData.attachments.length > (currentTask.attachments?.length || 0)) {
        newActivity.type = 'Attachment';
        newActivity.description = 'เพิ่มไฟล์แนบใหม่';
      } else if (Object.keys(updatedData).length > 0) {
        newActivity.type = 'Update';
        newActivity.description = 'แก้ไขข้อมูลงาน';
      } else {
        shouldAddActivity = false;
      }

      // Update Task in Firestore
      await updateDoc(taskRef, {
        ...cleanData,
        updatedAt: Timestamp.now(),
      });

      // Update global stats if needed
      if (completedDelta !== 0) {
        await updateDashboardStats(0, completedDelta);
      }

      if (shouldAddActivity) {
        await this.addActivity(taskId, newActivity);
      }

      // Audit Log
      await auditService.logAction(
        { uid: user?.uid || '', name: userProfile?.name || 'Unknown User' },
        'UPDATE_TASK',
        `แก้ไขงาน: ${currentTask.title} (${newActivity.description})`,
        'Task',
        taskId,
        { changes: updatedData, activityType: newActivity.type }
      );

      // Notifications
      if (newActivity.type === 'Status Change') {
        const allAssigneeIds = new Set<string>();
        if (currentTask.assigneeId) allAssigneeIds.add(currentTask.assigneeId);
        if (currentTask.assigneeIds && Array.isArray(currentTask.assigneeIds)) {
          currentTask.assigneeIds.forEach((id: string) => allAssigneeIds.add(id));
        }
        // Also check if new assignees were added and notify them? 
        // For now, focus on status change for existing/new assignees.

        for (const assigneeId of allAssigneeIds) {
          if (assigneeId !== user?.uid) {
            await this.createNotification({
              userId: assigneeId,
              title: 'สถานะงานเปลี่ยนไป',
              message: `งาน "${currentTask.title}" เปลี่ยนสถานะเป็น ${updatedData.status}`,
              type: 'Status Change',
              taskId: taskId
            }, teamMembers);
          }
        }
      }

      toast.success('บันทึกข้อมูลสำเร็จ', { id: toastId });
    } catch (error) {
      toast.error('ไม่สามารถบันทึกข้อมูลได้', { id: toastId });
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
      throw error;
    }
  },

  async deleteTask(taskId: string, user: any, userProfile: TeamMember | null, existingTask?: Task) {
    const toastId = toast.loading('กำลังลบงาน...');
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await deleteDoc(taskRef);
      
      // Audit Log
      await auditService.logAction(
        { uid: user?.uid || '', name: userProfile?.name || 'Unknown User' },
        'DELETE_TASK',
        `ลบงาน: ${existingTask?.title || taskId}`,
        'Task',
        taskId,
        { taskTitle: existingTask?.title }
      );

      // Update global stats
      if (existingTask) {
        await updateDashboardStats(-1, existingTask.status === 'Completed' ? -1 : 0);
      } else {
        await updateDashboardStats(-1, 0); 
      }

      toast.success('ลบงานสำเร็จ', { id: toastId });
    } catch (error) {
      toast.error('ไม่สามารถลบงานได้', { id: toastId });
      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
      throw error;
    }
  },

  async recalculateStats() {
    const toastId = toast.loading('กำลังคำนวณสถิติใหม่...');
    try {
      // Use getCountFromServer for efficiency and overcoming UI limits
      const totalCol = collection(db, 'tasks');
      const completedQuery = query(totalCol, where('status', '==', 'Completed'));
      
      const [totalSnap, completedSnap] = await Promise.all([
        getCountFromServer(totalCol),
        getCountFromServer(completedQuery)
      ]);
      
      const total = totalSnap.data().count;
      const completed = completedSnap.data().count;
      
      const statsRef = doc(db, 'stats', 'dashboard');
      await setDoc(statsRef, {
        total,
        completed,
        updatedAt: Timestamp.now()
      });
      
      toast.success(`คำนวณสำเร็จ: พบงานทั้งหมด ${total} รายการ`, { id: toastId });
      return { total, completed };
    } catch (error) {
      console.error("Recalculate error:", error);
      toast.error('ไม่สามารถคำนวณสถิติใหม่ได้', { id: toastId });
      throw error;
    }
  },

  async createNotification(notifData: Partial<Notification>, teamMembers: TeamMember[]) {
    try {
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, cleanFirestoreData({
        ...notifData,
        id: notifRef.id,
        isRead: false,
        timestamp: new Date().toISOString()
      }));

      const recipient = teamMembers.find(m => m.id === notifData.userId);
      if (recipient) {
        await sendExternalNotification({
          title: notifData.title || 'Notification',
          message: notifData.message || '',
          type: (notifData.type as any) || 'Alert',
          taskId: notifData.taskId,
          recipientEmail: recipient.email
        });
      }
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  }
};
