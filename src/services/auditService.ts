import { collection, doc, setDoc, query, orderBy, limit, getDocs, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { AuditLog } from '../types';
import { generateId, cleanFirestoreData } from '../lib/utils';

export const auditService = {
  async logAction(
    user: { uid: string; name: string },
    action: string,
    details: string,
    targetType: 'Task' | 'User' | 'Department' | 'System',
    targetId?: string,
    metadata?: any
  ) {
    try {
      const logId = generateId();
      const logRef = doc(collection(db, 'audit_logs'), logId);
      
      const log = cleanFirestoreData({
        id: logId,
        userId: user.uid,
        userName: user.name,
        action,
        details,
        targetType,
        targetId,
        timestamp: new Date().toISOString(),
        metadata
      });

      await setDoc(logRef, {
        ...log,
        // Also store as Timestamp for easier Firestore native ordering
        _timestamp: Timestamp.now()
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
    }
  },

  async getRecentLogs(maxLogs: number = 50) {
    try {
      const logsRef = collection(db, 'audit_logs');
      const q = query(logsRef, orderBy('_timestamp', 'desc'), limit(maxLogs));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        const { _timestamp, ...log } = data;
        return log as AuditLog;
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return [];
    }
  }
};
