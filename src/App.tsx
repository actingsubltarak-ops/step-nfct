import React, { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { Home } from './components/Home';
import { NotificationBell } from './components/NotificationBell';
import { auth, logout, loginWithGoogle, loginWithEmail, registerWithEmail, db, handleFirestoreError, OperationType, requestFCMToken, onForegroundMessage, getAuthRedirectResult } from './firebase';
import { doc, updateDoc, deleteDoc, writeBatch, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { Toaster, toast } from 'sonner';
import { parseISO, isWithinInterval, addDays, startOfToday, isValid } from 'date-fns';
import { LogOut, Loader2, UserCircle, Shield, UserCheck, Building2 } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useFirestoreData } from './hooks/useFirestoreData';
import { isSystemAdmin } from './lib/utils';
import { taskService } from './services/taskService';
import { userService } from './services/userService';
import { LoginScreen } from './components/LoginScreen';
import { CompleteProfile } from './components/CompleteProfile';

// Lazy load components for better performance
const TeamStructure = lazy(() => import('./components/TeamStructure').then(m => ({ default: m.TeamStructure })));
const Calendar = lazy(() => import('./components/Calendar').then(m => ({ default: m.Calendar })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TaskList = lazy(() => import('./components/TaskList').then(m => ({ default: m.TaskList })));
const MasterData = lazy(() => import('./components/MasterData').then(m => ({ default: m.MasterData })));
const Reports = lazy(() => import('./components/Reports').then(m => ({ default: m.Reports })));
const UserManagement = lazy(() => import('./components/UserManagement').then(m => ({ default: m.UserManagement })));
const GanttChart = lazy(() => import('./components/GanttChart').then(m => ({ default: m.GanttChart })));
const ResourceWorkload = lazy(() => import('./components/ResourceWorkload').then(m => ({ default: m.ResourceWorkload })));
const DocumentCenter = lazy(() => import('./components/DocumentCenter').then(m => ({ default: m.DocumentCenter })));
const AIInsights = lazy(() => import('./components/AIInsights').then(m => ({ default: m.AIInsights })));

import { DashboardSkeleton, TaskListSkeleton, Skeleton } from './components/Skeleton';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  const { user, userProfile, loading } = useAuth();
  const { tasks, teamMembers, taskOwners, departments, notifications } = useFirestoreData(user, userProfile);

  // Auto-heal stats if admin
  useEffect(() => {
    const isAdmin = userProfile?.role === 'Administrator';
    if (!isAdmin || !userProfile || userProfile.status !== 'Active') return;

    const checkStatsDiscrepancy = async () => {
      try {
        const statsRef = doc(db, 'stats', 'dashboard');
        const statsSnap = await getDoc(statsRef);
        
        let actualTotal = tasks.length;
        let actualCompleted = tasks.filter(t => t.status === 'Completed').length;

        let mismatch = false;
        if (statsSnap.exists()) {
          const data = statsSnap.data();
          // Detect mismatch - only if we have less than the limit (500) to avoid false positives 
          // or if the discrepancy is significant. 
          // Better: just trigger a recalculate if mismatch is found and tasks.length < 500
          if (tasks.length < 500 && (data.total !== actualTotal || data.completed !== actualCompleted)) {
            mismatch = true;
          }
        } else {
          mismatch = true;
        }

        if (mismatch) {
          console.log("[Stats] Auto-triggering recalculation due to mismatch or missing data");
          await taskService.recalculateStats();
        }
      } catch (e) {
        console.warn("Stats auto-heal check skipped:", e);
      }
    };

    const timer = setTimeout(checkStatsDiscrepancy, 5000);
    return () => clearTimeout(timer);
  }, [tasks.length, userProfile]);
  
  // Memoize filtered tasks to prevent re-filtering on every render
  const filteredTasks = React.useMemo(() => {
    return selectedDepartment === 'all' 
      ? tasks 
      : tasks.filter(t => t.ownerDepartment === selectedDepartment);
  }, [tasks, selectedDepartment]);

  const notifiedTasksRef = React.useRef<Set<string>>(new Set());

  // Handle Auth Redirect Result
  useEffect(() => {
    getAuthRedirectResult().then((result) => {
      if (result?.user) {
        toast.success(`เข้าสู่ระบบสำเร็จ: ${result.user.displayName || result.user.email}`);
      }
    }).catch((error) => {
      if (error.code !== 'auth/no-current-user') {
        console.error('Redirect result error:', error);
        // Special handling for browser security issues
        if (error.message?.includes('cross-origin') || error.message?.includes('storage')) {
          toast.error('ข้อจำกัดทางความปลอดภัยของเบราว์เซอร์', {
            description: 'กรุณาคลิกปุ่ม "เปิดในหน้าต่างใหม่" ที่มุมขวาบนเพื่อเข้าสู่ระบบ'
          });
        }
      }
    });
  }, []);

  // Setup FCM
  useEffect(() => {
    if (user && userProfile?.status === 'Active') {
      const setupFCM = async () => {
        const token = await requestFCMToken();
        if (token) {
          // Save token to user profile
          await updateDoc(doc(db, 'users', user.uid), {
            fcmToken: token,
            updatedAt: new Date().toISOString()
          });
        }
      };
      
      setupFCM();

      // Listen for foreground messages
      const unsubscribe = onForegroundMessage((payload) => {
        console.log('Foreground message received:', payload);
        if (payload.notification) {
          toast.info(payload.notification.title, {
            description: payload.notification.body,
            duration: 8000,
          });
        }
      });

      return () => {
        unsubscribe.then(unsub => unsub());
      };
    }
  }, [user, userProfile?.status]);

  // Persistent notification tracking across sessions (optional enhancement)
  useEffect(() => {
    const stored = localStorage.getItem('notified_tasks');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          notifiedTasksRef.current = new Set(parsed);
        }
      } catch (e) {
        console.error("Error loading notified tasks from localStorage");
      }
    }
  }, []);

  useEffect(() => {
    if (tasks.length === 0) return;

    const today = startOfToday();
    const tomorrow = addDays(today, 1);
    let updated = false;

    tasks.forEach(task => {
      if (task.status !== 'Completed' && task.endDate && !notifiedTasksRef.current.has(task.id)) {
        try {
          const dueDate = parseISO(task.endDate);
          if (isValid(dueDate)) {
            if (isWithinInterval(dueDate, { start: today, end: tomorrow })) {
              toast.warning(`งานใกล้ครบกำหนด: ${task.title}`, {
                description: `กำหนดส่ง: ${task.endDate}`,
                duration: 5000,
              });
              notifiedTasksRef.current.add(task.id);
              updated = true;
            }
          }
        } catch (e) {
          console.error("Invalid date format for task:", task.title);
        }
      }
    });

    if (updated) {
      const activeTaskIds = new Set(
        tasks.filter(t => t.status !== 'Completed').map(t => t.id)
      );
      const filtered = Array.from(notifiedTasksRef.current)
        .filter(id => activeTaskIds.has(id));
      notifiedTasksRef.current = new Set(filtered);
      localStorage.setItem('notified_tasks', JSON.stringify(filtered));
    }
  }, [tasks]);

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, { isRead: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      const promises = unreadNotifications.map(n => 
        updateDoc(doc(db, 'notifications', n.id), { isRead: true })
      );
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await deleteDoc(notifRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${notificationId}`);
    }
  };

  const handleClearAllUsers = async () => {
    try {
      const batch = writeBatch(db);
      
      // Delete all team members except the current admin
      const usersToDelete = teamMembers.filter(member => !isSystemAdmin(member.email));
      
      if (usersToDelete.length === 0) {
        toast.info('ไม่มีข้อมูลผู้ใช้ให้ออก');
        return;
      }

      usersToDelete.forEach(member => {
        batch.delete(doc(db, 'users', member.id));
      });

      await batch.commit();
      toast.success(`ล้างข้อมูลผู้ใช้สำเร็จ (${usersToDelete.length} รายการ)`);
    } catch (error) {
      console.error('Clear users error:', error);
      toast.error('ไม่สามารถล้างข้อมูลผู้ใช้ได้');
    }
  };

  const [showRefresh, setShowRefresh] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setShowRefresh(true);
    }, 8000); // Show refresh button after 8 seconds of loading
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-base flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-sm w-full">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full scale-150 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">กำลังโหลดข้อมูลระบบ...</h2>
            <p className="text-slate-500 text-sm">กรุณารอสักครู่ ระบบกำลังเตรียมความพร้อม</p>
          </div>
          
          {showRefresh && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-4 space-y-4"
            >
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <p className="text-amber-500 text-[11px] font-bold uppercase tracking-widest mb-1">ใช้เวลานานผิดปกติ?</p>
                <p className="text-amber-200/70 text-[11px] leading-relaxed">
                  หากหน้านี้ไม่หายไปภายใน 10 วินาที อาจเกิดจากปัญหาการเชื่อมต่อ หรือข้อจำกัดของเบราว์เซอร์
                </p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-navy-surface border border-border-navy text-white text-xs font-bold rounded-xl hover:bg-navy-elevated transition-all"
              >
                กดเพื่อรีเฟรชหน้าจอ
              </button>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen departments={departments} taskOwners={taskOwners} />;
  }

  if (userProfile?.status === 'Inactive') {
    // Check if profile is incomplete (e.g. from Google Login)
    const isIncomplete = userProfile.department === 'กรุณาระบุหน่วยงาน' || !userProfile.ownerId || !userProfile.jobTitle;

    if (isIncomplete) {
      return (
        <CompleteProfile 
          user={user} 
          userProfile={userProfile} 
          departments={departments} 
          taskOwners={taskOwners} 
        />
      );
    }

    return (
      <div className="min-h-screen bg-navy-base flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-navy-surface p-12 rounded-[3rem] border border-border-navy shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-orange-600" />
          
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20 shadow-lg shadow-amber-500/5">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tight">รอการอนุมัติ</h2>
            <div className="px-4 py-2 bg-navy-base/50 rounded-2xl border border-border-navy inline-block">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Account Logged In</p>
              <p className="text-sm font-bold text-white mt-1">{userProfile?.name || user?.displayName}</p>
              <p className="text-[10px] text-slate-500">{user?.email}</p>
            </div>
          </div>

          <p className="text-slate-400 leading-relaxed text-sm">
            บัญชีของคุณลงทะเบียนสำเร็จแล้ว แต่ยังไม่เปิดใช้งาน<br />
            กรุณารอผู้ดูแลระบบตรวจสอบและอนุมัติการเข้าใช้งาน
          </p>

          <div className="pt-4 flex flex-col gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-navy-base border border-border-navy text-white font-bold rounded-2xl hover:bg-navy-elevated transition-all"
            >
              ตรวจสอบสถานะอีกครั้ง
            </button>
            <button 
              onClick={logout}
              className="w-full py-4 text-slate-500 font-bold hover:text-red-400 transition-all text-sm"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    const getFallback = (tab: string) => {
      switch (tab) {
        case 'dashboard': return <DashboardSkeleton />;
        case 'tasks': return <TaskListSkeleton />;
        case 'reports': return <DashboardSkeleton />;
        default: return (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <Skeleton className="h-4 w-32" />
          </div>
        );
      }
    };

    return (
      <Suspense fallback={getFallback(activeTab)}>
        {(() => {
          switch (activeTab) {
            case 'home':
              return <Home tasks={filteredTasks} teamMembers={teamMembers} userProfile={userProfile} onViewReports={() => setActiveTab('reports')} />;
            case 'reports':
              return <Reports tasks={filteredTasks} teamMembers={teamMembers} />;
            case 'users':
              return <UserManagement 
                users={teamMembers} 
                departments={departments} 
                onUpdateUser={userService.updateUser} 
                onDeleteUser={userService.deleteUser}
                onClearAllUsers={handleClearAllUsers}
                currentUser={user}
              />;
            case 'team':
              return <TeamStructure teamMembers={teamMembers} />;
            case 'calendar':
              return <Calendar 
                tasks={filteredTasks} 
                teamMembers={teamMembers} 
                taskOwners={taskOwners}
                departments={departments}
                userProfile={userProfile}
                addTask={async (newTask: any) => { await taskService.addTask(newTask, user, userProfile, teamMembers); }} 
                updateTask={(taskId: string, data: any, existing: any) => taskService.updateTask(taskId, data, user, userProfile, teamMembers, existing)} 
                deleteTask={(taskId: string, existing: any) => taskService.deleteTask(taskId, user, userProfile, existing)} 
              />;
            case 'gantt':
              return <GanttChart tasks={filteredTasks} teamMembers={teamMembers} updateTask={(taskId: string, data: any, existing: any) => taskService.updateTask(taskId, data, user, userProfile, teamMembers, existing)} />;
            case 'workload':
              return <ResourceWorkload tasks={filteredTasks} teamMembers={teamMembers} />;
            case 'documents':
              return <DocumentCenter tasks={filteredTasks} />;
            case 'ai-insights':
              return <AIInsights tasks={filteredTasks} teamMembers={teamMembers} />;
            case 'dashboard':
              return <Dashboard 
                tasks={filteredTasks} 
                teamMembers={teamMembers} 
                userProfile={userProfile} 
                onViewReports={() => setActiveTab('reports')} 
              />;
            case 'tasks':
              return <TaskList 
                tasks={filteredTasks} 
                teamMembers={teamMembers} 
                taskOwners={taskOwners}
                departments={departments}
                userProfile={userProfile}
                updateTask={(taskId: string, data: any, existing: any) => taskService.updateTask(taskId, data, user, userProfile, teamMembers, existing)} 
                deleteTask={(taskId: string, existing: any) => taskService.deleteTask(taskId, user, userProfile, existing)} 
              />;
            case 'supervisors':
              return <SupervisorList teamMembers={teamMembers} />;
            case 'master-data':
            case 'master-team':
            case 'master-owners':
            case 'master-depts':
            case 'master-settings':
              return <MasterData 
                teamMembers={teamMembers} 
                userProfile={userProfile}
                initialSubTab={
                  activeTab === 'master-team' ? 'team' :
                  activeTab === 'master-owners' ? 'owners' :
                  activeTab === 'master-depts' ? 'departments' :
                  activeTab === 'master-settings' ? 'settings' : 'team'
                }
              />;
            case 'owners':
              return <OwnerList tasks={filteredTasks} />;
            default:
              return <Home tasks={filteredTasks} teamMembers={teamMembers} userProfile={userProfile} />;
          }
        })()}
      </Suspense>
    );
  };

  return (
    <div className="flex min-h-screen bg-navy-base font-sans text-slate-200">
      <Toaster position="top-right" theme="dark" richColors />
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
        userProfile={userProfile} 
        departments={departments}
        selectedDepartment={selectedDepartment}
        setSelectedDepartment={setSelectedDepartment}
      />
      
      <main className="flex-1 h-screen overflow-y-auto p-6 md:p-10 scrollbar-hide">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex justify-end items-center gap-4 mb-6">
            <NotificationBell 
              notifications={notifications} 
              onMarkAsRead={markNotificationAsRead}
              onMarkAllAsRead={markAllNotificationsAsRead}
              onDeleteNotification={deleteNotification}
              onViewTask={(taskId) => {
                setActiveTab('tasks');
              }}
            />
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-surface border border-border-navy text-slate-400 hover:text-white hover:border-slate-500 transition-all text-sm shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              ออกจากระบบ
            </button>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function SupervisorList({ teamMembers }: { teamMembers: any[] }) {
  const supervisors = teamMembers.filter(m => m.role === 'Administrator' || m.role === 'Supervisor');
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-2xl font-bold text-white tracking-tight">รายชื่อผู้ควบคุมงาน</h2>
        <p className="text-slate-400">ผู้รับผิดชอบในการตรวจสอบและควบคุมคุณภาพการปฏิบัติงาน</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {supervisors.map(s => (
          <div key={s.id} className="bg-navy-surface p-8 rounded-[2rem] border border-border-navy shadow-sm flex items-center gap-5 hover:border-blue-500/30 transition-all group hover:shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-inner group-hover:scale-110 transition-transform duration-300">
              <UserCheck className="text-blue-400" size={24} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">{s.name}</h4>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">{s.role} - {s.jobTitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerList({ tasks }: { tasks: any[] }) {
  const seen = new Map<string, { name: string; dept: string }>();
  tasks.forEach(t => {
    const key = `${(t.ownerName || '').trim()}__${(t.ownerDepartment || '').trim()}`;
    if (!seen.has(key)) {
      seen.set(key, { name: t.ownerName || 'ไม่ระบุ', dept: t.ownerDepartment || 'ไม่ระบุ' });
    }
  });
  const owners = Array.from(seen.values());

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-2xl font-bold text-white tracking-tight">รายชื่อส่วนงาน และหน่วยงาน/สำนักที่สังกัด</h2>
        <p className="text-slate-400">ข้อมูลผู้ประสานงานและหน่วยงาน/สำนักเจ้าของโครงการ</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {owners.map((o, i) => (
          <div key={`${o.name}-${o.dept}-${i}`} className="bg-navy-surface p-8 rounded-[2rem] border border-border-navy shadow-sm flex items-center gap-5 hover:border-orange-500/30 transition-all group hover:shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-inner group-hover:scale-110 transition-transform duration-300">
              <Building2 className="text-orange-400" size={24} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white tracking-tight group-hover:text-orange-400 transition-colors">{o.name}</h4>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">{o.dept}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
