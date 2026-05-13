import React, { useState, useEffect } from 'react';
import { User, Building2, UserCheck, Plus, Trash2, X, Edit2, Search, ShieldCheck, UserPlus, LogIn, Users } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, setDoc, doc, deleteDoc, updateDoc, Timestamp, getCountFromServer, where } from 'firebase/firestore';
import { cn, getRoleDisplayName } from '../lib/utils';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

import { auditService } from '../services/auditService';
import { formatThaiDate } from '../lib/utils';
import { History, Info } from 'lucide-react';

type MasterSubTab = 'team' | 'owners' | 'departments' | 'settings' | 'audit';

interface MasterDataProps {
  teamMembers: any[];
  userProfile: any;
  initialSubTab?: MasterSubTab;
}

export function MasterData({ teamMembers, userProfile, initialSubTab = 'team' }: MasterDataProps) {
  const isAdmin = userProfile?.role === 'Administrator' || userProfile?.role === 'Admin';
  const [activeSubTab, setActiveSubTab] = useState<MasterSubTab>(initialSubTab as MasterSubTab);
  const [taskOwners, setTaskOwners] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncDashboardStats = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('กำลังคำนวณสถิติใหม่...');
    try {
      const tasksRef = collection(db, 'tasks');
      
      // Total Tasks
      const totalSnapshot = await getCountFromServer(tasksRef);
      const totalCount = totalSnapshot.data().count;
      
      // Completed Tasks
      const completedQuery = query(tasksRef, where('status', '==', 'Completed'));
      const completedSnapshot = await getCountFromServer(completedQuery);
      const completedCount = completedSnapshot.data().count;
      
      const statsRef = doc(db, 'stats', 'dashboard');
      await setDoc(statsRef, {
        total: totalCount,
        completed: completedCount,
        updatedAt: Timestamp.now(),
        lastSyncedBy: userProfile?.name || 'System'
      });
      
      toast.success('ปรับปรุงสถิติแดชบอร์ดเรียบร้อยแล้ว', { id: toastId });
    } catch (error) {
      console.error("Error syncing stats:", error);
      toast.error('ล้มเหลวในการปรับปรุงสถิติ', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, name: string } | null>(null);
  
  // Entity states
  const [name, setName] = useState('');
  const [role, setRole] = useState('Staff');
  const [dept, setDept] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deptId, setDeptId] = useState('');
  const [isManualUser, setIsManualUser] = useState(false);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    const unsubscribeOwners = onSnapshot(query(collection(db, 'taskOwners')), (snapshot) => {
      setTaskOwners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'taskOwners'));

    const unsubscribeDepts = onSnapshot(query(collection(db, 'departments')), (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'departments'));

    return () => {
      unsubscribeOwners();
      unsubscribeDepts();
    };
  }, []);

  const resetForm = () => {
    setName('');
    setRole('Staff');
    setDept('');
    setJobTitle('');
    setEmail('');
    setOwnerId('');
    setDeptId('');
    setIsAdding(false);
    setEditingId(null);
    setIsManualUser(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const collectionName = activeSubTab === 'team' ? 'users' : (activeSubTab === 'owners' ? 'taskOwners' : 'departments');
      if (activeSubTab === 'team') {
        const cleanedEmail = email.trim().toLowerCase();
        // Use email as ID for new manual users, or use existing ID if editing
        const id = editingId || cleanedEmail || `user_${Date.now()}`;
        const now = Timestamp.now();
        
        // Construct clean data object omitting empty optional fields
        const data: any = {
          id,
          uid: id,
          name: name.trim(),
          role,
          department: dept,
          status: editingId ? (teamMembers.find(m => m.id === editingId)?.status || 'Inactive') : 'Inactive',
          updatedAt: now
        };
        
        if (jobTitle.trim()) data.jobTitle = jobTitle.trim();
        if (email.trim()) data.email = email.trim().toLowerCase();
        if (ownerId) data.ownerId = ownerId;
        
        if (!editingId) {
          data.createdAt = now;
          data.isManual = true;
          data.provider = 'system';
          data.status = 'Inactive'; // Ensure new manual users are Inactive until they register or are explicitly activated
        } else if (isManualUser) {
          // Keep manual flag if editing a manual user
          data.isManual = true;
        }

        await setDoc(doc(db, 'users', id), data, { merge: true });
        toast.success(editingId ? 'แก้ไขข้อมูลทีมงานสำเร็จ' : 'บันทึกข้อมูลเตรียมการสมัครสมาชิกสำเร็จ', {
          description: !editingId ? 'ผู้ใช้งานต้องใช้ตัวเลือก "ลงทะเบียนใหม่" ด้วยอีเมลนี้เพื่อตั้งรหัสผ่าน' : undefined
        });
      } else if (activeSubTab === 'owners') {
        const id = editingId || `owner_${Date.now()}`;
        await setDoc(doc(db, 'taskOwners', id), {
          id,
          name,
          departmentId: deptId,
          updatedAt: Timestamp.now()
        }, { merge: true });
        toast.success(editingId ? 'แก้ไขข้อมูลส่วนงานสำเร็จ' : 'เพิ่มส่วนงานใหม่สำเร็จ');
      } else if (activeSubTab === 'departments') {
        const id = editingId || `dept_${Date.now()}`;
        await setDoc(doc(db, 'departments', id), {
          id,
          name,
          updatedAt: Timestamp.now()
        }, { merge: true });
        toast.success(editingId ? 'แก้ไขข้อมูลหน่วยงานสำเร็จ' : 'เพิ่มหน่วยงานใหม่สำเร็จ');
      }
      resetForm();
    } catch (error) {
      const collectionName = activeSubTab === 'team' ? 'users' : (activeSubTab === 'owners' ? 'taskOwners' : 'departments');
      handleFirestoreError(error, OperationType.WRITE, collectionName);
    }
  };

  const handleDelete = async (id: string) => {
    const collectionName = activeSubTab === 'team' ? 'users' : (activeSubTab === 'owners' ? 'taskOwners' : 'departments');
    try {
      await deleteDoc(doc(db, collectionName, id));
      setConfirmDelete(null);
      toast.success('ลบข้อมูลสำเร็จ');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, collectionName);
    }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setName(item.name);
    if (activeSubTab === 'team') {
      setRole(item.role || 'Staff');
      setDept(item.department || '');
      setJobTitle(item.jobTitle || '');
      setEmail(item.email || '');
      setOwnerId(item.ownerId || '');
      // Store if it's a manual user to allow name editing
      setIsManualUser(!!item.isManual);
    } else if (activeSubTab === 'owners') {
      setDeptId(item.departmentId || '');
    }
    setIsAdding(true);
  };

  return (
    <div className="animate-in fade-in duration-500 min-h-[calc(100vh-12rem)]">
      {/* Main Content Area */}
      <div className="space-y-8">
        {activeSubTab === 'settings' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h2 className="text-3xl font-black text-white tracking-tight">ตั้งค่าระบบจัดการ</h2>
              <p className="text-slate-400">จัดการการตั้งค่าพื้นฐานและสิทธิ์การเข้าถึงข้อมูลหลัก</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-navy-surface p-8 rounded-[2.5rem] border border-border-navy space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                    <UserPlus size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">จัดการผู้รับผิดชอบ</h3>
                    <p className="text-xs text-slate-500">เพิ่ม ลบ หรือแก้ไขข้อมูลพนักงาน</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveSubTab('team')}
                  className="w-full py-3 bg-navy-elevated hover:bg-navy-base text-white text-sm font-bold rounded-xl transition-all border border-border-navy"
                >
                  ไปที่หน้าจัดการ
                </button>
              </div>

              <div className="bg-navy-surface p-8 rounded-[2.5rem] border border-border-navy space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">จัดการหน่วยงาน</h3>
                    <p className="text-xs text-slate-500">กำหนดโครงสร้างหน่วยงานและส่วนงาน</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setActiveSubTab('departments')}
                    className="flex-1 py-3 bg-navy-elevated hover:bg-navy-base text-white text-sm font-bold rounded-xl transition-all border border-border-navy"
                  >
                    หน่วยงาน
                  </button>
                  <button 
                    onClick={() => setActiveSubTab('owners')}
                    className="flex-1 py-3 bg-navy-elevated hover:bg-navy-base text-white text-sm font-bold rounded-xl transition-all border border-border-navy"
                  >
                    ส่วนงาน
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-[2rem] flex items-start gap-4">
              <ShieldCheck className="text-amber-400 shrink-0" size={24} />
              <div>
                <h4 className="font-bold text-amber-400 text-sm">คำแนะนำการใช้งาน</h4>
                <p className="text-xs text-amber-400/70 mt-1 leading-relaxed">
                  การแก้ไขข้อมูลในส่วนนี้จะส่งผลต่อการเลือกข้อมูลในหน้า "ติดตามงาน" และ "ปฏิทิน" กรุณาตรวจสอบความถูกต้องของข้อมูลก่อนบันทึกทุกครั้ง
                </p>
              </div>
            </div>

            <div className="bg-navy-surface/50 p-12 rounded-[3rem] border border-border-navy text-center space-y-8">
              <div className="w-20 h-20 bg-brand-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto border border-brand-primary/20 shadow-xl shadow-brand-primary/5">
                <RefreshCw size={40} className={cn("text-brand-primary", isSyncing && "animate-spin")} />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-white tracking-tight">ปรับปรุงสถิติแดชบอร์ด</h3>
                <p className="text-slate-500 leading-relaxed max-w-sm mx-auto text-sm">
                  หากตัวเลขบนหน้าแรกสรุปงานไม่ตรงกับข้อมูลจริงในระบบ คุณสามารถสั่งให้ระบบคำนวณสถิติทั้งหมดใหม่ได้จากตรงนี้
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={syncDashboardStats}
                  disabled={isSyncing}
                  className={cn(
                    "group relative px-10 py-5 bg-brand-primary text-white font-black rounded-[2rem] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-2xl shadow-brand-primary/20 flex items-center gap-3 mx-auto uppercase tracking-widest text-sm",
                    isSyncing && "animate-pulse"
                  )}
                >
                  <RefreshCw size={20} className={cn(isSyncing && "animate-spin")} />
                  {isSyncing ? 'กำลังคำนวณ...' : 'เริ่มการปรับปรุงสถิติตอนนี้'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <h2 className="text-4xl font-black text-white tracking-tight">จัดการข้อมูลหลัก</h2>
              
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-primary transition-colors" size={18} />
                  <input 
                    type="text"
                    placeholder="ค้นหาชื่อ, บทบาท..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-64 pl-12 pr-4 py-3 bg-navy-surface border border-border-navy rounded-2xl text-white focus:outline-none focus:border-brand-primary/50 transition-all shadow-sm"
                  />
                </div>
                <button 
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-brand-primary/80 text-white font-bold rounded-2xl transition-all shadow-lg shadow-brand-primary/20 active:scale-95"
                >
                  <Plus size={20} />
                  เพิ่มข้อมูลใหม่
                </button>
              </div>
            </header>

        <div className="bg-navy-surface/30 rounded-[3rem] p-8 md:p-12 border border-border-navy shadow-xl backdrop-blur-sm space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h3 className="text-4xl font-black text-white tracking-tight mb-2">
                {activeSubTab === 'team' ? 'ผู้รับผิดชอบ (ทีมงาน)' : activeSubTab === 'owners' ? 'ส่วนงาน' : 'หน่วยงาน/สำนัก'}
              </h3>
              <p className="text-slate-500 text-lg font-medium">ตั้งค่ารายชื่อผู้รับผิดชอบ ส่วนงาน และหน่วยงาน/สำนัก</p>
            </div>
            
            <div className="flex gap-4">
              <div className="bg-navy-base/50 px-6 py-3 rounded-2xl border border-border-navy flex flex-col items-center min-w-[100px]">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">ทั้งหมด</span>
                <span className="text-2xl font-black text-white font-mono">
                  {activeSubTab === 'team' ? teamMembers.length : activeSubTab === 'owners' ? taskOwners.length : departments.length}
                </span>
              </div>
              <div className="bg-navy-base/50 px-6 py-3 rounded-2xl border border-border-navy flex flex-col items-center min-w-[100px]">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">ระบบ</span>
                <span className="text-2xl font-black text-white font-mono">
                  {activeSubTab === 'team' ? teamMembers.filter(m => !m.isManual).length : 0}
                </span>
              </div>
            </div>
          </div>

          {/* Sub Tabs inside content */}
          <div className="flex gap-2 p-1.5 bg-navy-base/50 border border-border-navy rounded-[1.5rem] w-fit flex-wrap">
            <TabButton active={(activeSubTab as any) === 'team'} onClick={() => setActiveSubTab('team')} label="ผู้รับผิดชอบ (ทีมงาน)" />
            <TabButton active={(activeSubTab as any) === 'owners'} onClick={() => setActiveSubTab('owners')} label="ส่วนงาน" />
            <TabButton active={(activeSubTab as any) === 'departments'} onClick={() => setActiveSubTab('departments')} label="หน่วยงาน/สำนัก" />
            <TabButton active={(activeSubTab as any) === 'audit'} onClick={() => setActiveSubTab('audit')} label="ประวัติการใช้งาน (Audit Log)" />
            <TabButton active={(activeSubTab as any) === 'settings'} onClick={() => setActiveSubTab('settings')} label="รวมสถิติ" />
          </div>

          {/* List View - Wide Cards */}
          <div className="space-y-10">
            {activeSubTab === 'team' && (() => {
              const filteredTeam = teamMembers.filter(m => {
                const search = searchTerm.toLowerCase();
                return (
                  (m.name?.toLowerCase() || '').includes(search) ||
                  (m.role?.toLowerCase() || '').includes(search) ||
                  (m.department?.toLowerCase() || '').includes(search)
                );
              });

              const googleUsers = filteredTeam.filter(m => m.provider === 'google');
              const registeredUsers = filteredTeam.filter(m => m.provider === 'email');
              const manualUsers = filteredTeam.filter(m => m.provider === 'system' || m.isManual);
              
              // Catch-all for any users missing provider field (e.g. from older versions)
              const otherUsers = filteredTeam.filter(m => 
                !googleUsers.find(u => u.id === m.id) && 
                !registeredUsers.find(u => u.id === m.id) && 
                !manualUsers.find(u => u.id === m.id)
              );

              return (
                <div className="space-y-12">
                  {googleUsers.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 px-4">
                        <div className="w-12 h-12 rounded-[1.25rem] bg-white/5 border border-white/10 flex items-center justify-center shadow-lg transform -rotate-3 group-hover:rotate-0 transition-transform">
                          <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-white tracking-tight">ผู้ใช้งานผ่าน Gmail (Google Login)</h4>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ล็อคอินด้วยระบบความปลอดภัยของ Google</p>
                        </div>
                        <span className="ml-auto px-3 py-1 rounded-full bg-white/5 text-xs font-black text-slate-400 border border-white/10">
                          {googleUsers.length} ราย
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {googleUsers.map(member => (
                          <WideCard 
                            key={member.id}
                            icon={member.photoURL ? <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={24} />}
                            title={member.name}
                            subtitle={member.email || 'no-email@org.th'}
                            status={member.status === 'Active' ? 'online' : 'offline'}
                            tags={[
                              { label: member.provider === 'google' ? 'GMAIL LOGIN' : 'AUTH', color: 'blue' },
                              { label: getRoleDisplayName(member.role), color: member.role === 'Administrator' ? 'purple' : member.role === 'Supervisor' ? 'blue' : 'indigo' },
                              { label: member.status === 'Active' ? 'ACTIVE' : 'INACTIVE', color: member.status === 'Active' ? 'green' : 'slate' },
                              { label: member.jobTitle || 'ไม่ระบุตำแหน่ง', color: 'slate' },
                              { label: taskOwners.find(o => o.id === member.ownerId)?.name || 'ไม่ระบุส่วนงาน', color: 'orange' },
                              { label: member.department || 'ทั่วไป', color: 'green' }
                            ]}
                            onEdit={() => startEdit(member)}
                            onDelete={() => setConfirmDelete({ id: member.id, name: member.name })}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {registeredUsers.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 px-4">
                        <div className="w-12 h-12 rounded-[1.25rem] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-lg transform rotate-3">
                          <LogIn size={24} className="text-blue-500" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-white tracking-tight">ผู้ใช้งานที่ลงทะเบียนเอง (Email/Password)</h4>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ลงทะเบียนผ่านแบบฟอร์มของระบบ</p>
                        </div>
                        <span className="ml-auto px-3 py-1 rounded-full bg-blue-500/5 text-xs font-black text-blue-400 border border-blue-500/10">
                          {registeredUsers.length} ราย
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {registeredUsers.map(member => (
                          <WideCard 
                            key={member.id}
                            icon={member.photoURL ? <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={24} />}
                            title={member.name}
                            subtitle={member.email || 'no-email@org.th'}
                            status={member.status === 'Active' ? 'online' : 'offline'}
                            tags={[
                              { label: 'REGISTERED', color: 'slate' },
                              { label: getRoleDisplayName(member.role), color: member.role === 'Administrator' ? 'purple' : member.role === 'Supervisor' ? 'blue' : 'indigo' },
                              { label: member.status === 'Active' ? 'ACTIVE' : 'INACTIVE', color: member.status === 'Active' ? 'green' : 'slate' },
                              { label: member.jobTitle || 'ไม่ระบุตำแหน่ง', color: 'slate' },
                              { label: taskOwners.find(o => o.id === member.ownerId)?.name || 'ไม่ระบุส่วนงาน', color: 'orange' },
                              { label: member.department || 'ทั่วไป', color: 'green' }
                            ]}
                            onEdit={() => startEdit(member)}
                            onDelete={() => setConfirmDelete({ id: member.id, name: member.name })}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {manualUsers.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 px-4">
                        <div className="w-12 h-12 rounded-[1.25rem] bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shadow-lg">
                          <User size={24} className="text-orange-500" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-white tracking-tight">ผู้ใช้งานที่เพิ่มโดยระบบ (Manual Add)</h4>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">สร้างโดยผู้ดูแลระบบโดยตรง</p>
                        </div>
                        <span className="ml-auto px-3 py-1 rounded-full bg-orange-500/5 text-xs font-black text-orange-400 border border-orange-500/10">
                          {manualUsers.length} ราย
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {manualUsers.map(member => (
                          <WideCard 
                            key={member.id}
                            icon={member.photoURL ? <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={24} />}
                            title={member.name}
                            subtitle={member.email || 'no-email@org.th'}
                            status={member.status === 'Active' ? 'online' : 'offline'}
                            tags={[
                              { label: 'MANUAL ADD', color: 'orange' },
                              { label: getRoleDisplayName(member.role), color: member.role === 'Administrator' ? 'purple' : member.role === 'Supervisor' ? 'blue' : 'indigo' },
                              { label: member.status === 'Active' ? 'ACTIVE' : 'INACTIVE', color: member.status === 'Active' ? 'green' : 'slate' },
                              { label: member.jobTitle || 'ไม่ระบุตำแหน่ง', color: 'slate' },
                              { label: taskOwners.find(o => o.id === member.ownerId)?.name || 'ไม่ระบุส่วนงาน', color: 'orange' },
                              { label: member.department || 'ทั่วไป', color: 'green' }
                            ]}
                            onEdit={() => startEdit(member)}
                            onDelete={() => setConfirmDelete({ id: member.id, name: member.name })}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {otherUsers.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 px-4">
                        <div className="w-12 h-12 rounded-[1.25rem] bg-slate-500/10 border border-slate-500/20 flex items-center justify-center shadow-lg">
                          <Users size={24} className="text-slate-500" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-white tracking-tight">ผู้ใช้งานอื่นๆ (Uncategorized)</h4>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ข้อมูลผู้ใช้งานที่ไม่อยู่ในกลุ่มระบุข้างต้น</p>
                        </div>
                        <span className="ml-auto px-3 py-1 rounded-full bg-slate-500/5 text-xs font-black text-slate-400 border border-slate-500/10">
                          {otherUsers.length} ราย
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {otherUsers.map(member => (
                          <WideCard 
                            key={member.id}
                            icon={member.photoURL ? <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={24} />}
                            title={member.name}
                            subtitle={member.email || 'no-email@org.th'}
                            status="online"
                            tags={[
                              { label: 'OTHER', color: 'slate' },
                              { label: getRoleDisplayName(member.role), color: 'slate' },
                              { label: member.jobTitle || 'ไม่ระบุตำแหน่ง', color: 'slate' },
                              { label: taskOwners.find(o => o.id === member.ownerId)?.name || 'ไม่ระบุส่วนงาน', color: 'orange' },
                              { label: member.department || 'ทั่วไป', color: 'green' }
                            ]}
                            onEdit={() => startEdit(member)}
                            onDelete={() => setConfirmDelete({ id: member.id, name: member.name })}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredTeam.length === 0 && (
                    <div className="bg-navy-surface/50 p-20 rounded-[3rem] border border-border-navy border-dashed text-center">
                      <Users size={48} className="mx-auto text-slate-700 mb-4" />
                      <p className="text-slate-500 font-black text-xl">ไม่พบข้อมูลผู้ใช้งาน</p>
                      <p className="text-slate-600 text-sm mt-2">ลองพิมพ์ชื่อหรือหน่วยงานอื่นที่ต้องการค้นหา</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {activeSubTab === 'owners' && taskOwners.map(owner => (
              <WideCard 
                key={owner.id}
                icon={<UserCheck size={24} />}
                title={owner.name}
                subtitle={departments.find(d => d.id === owner.departmentId)?.name || 'ไม่ระบุหน่วยงาน'}
                tags={[
                  { label: 'OWNER', color: 'orange' },
                  { label: 'ส่วนงาน', color: 'slate' }
                ]}
                onEdit={() => startEdit(owner)}
                onDelete={() => setConfirmDelete({ id: owner.id, name: owner.name })}
              />
            ))}

            {activeSubTab === 'departments' && departments.map(dept => (
              <WideCard 
                key={dept.id}
                icon={<Building2 size={24} />}
                title={dept.name}
                subtitle="หน่วยงาน / สำนัก"
                tags={[
                  { label: 'DEPT', color: 'green' },
                  { label: 'หน่วยงาน', color: 'slate' }
                ]}
                onEdit={() => startEdit(dept)}
                onDelete={() => setConfirmDelete({ id: dept.id, name: dept.name })}
              />
            ))}
            
            {activeSubTab === 'audit' && (
              <AuditLogView />
            )}

            {((activeSubTab === 'team' && teamMembers.length === 0) || 
              (activeSubTab === 'owners' && taskOwners.length === 0) || 
              (activeSubTab === 'departments' && departments.length === 0)) && (
              <div className="text-center py-20 bg-navy-base/20 rounded-[2rem] border border-dashed border-border-navy">
                <div className="w-20 h-20 bg-navy-elevated rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search size={32} className="text-slate-600" />
                </div>
                <p className="text-xl font-bold text-slate-500">ไม่พบข้อมูลที่ต้องการ</p>
                <button 
                  onClick={() => setIsAdding(true)}
                  className="mt-4 text-brand-primary font-black uppercase tracking-widest text-sm hover:underline"
                >
                  เพิ่มข้อมูลใหม่ตอนนี้
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    )}
  </div>

      {/* Form Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-navy-surface border border-border-navy w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border-navy flex justify-between items-center bg-navy-base/50">
              <h3 className="text-xl font-bold text-white tracking-tight">
                {editingId ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูลใหม่'}
              </h3>
              <button onClick={resetForm} className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-navy-elevated rounded-lg">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-6">
              {activeSubTab === 'team' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-500 uppercase font-bold tracking-widest">
                      {editingId ? (isManualUser ? 'ชื่อ-นามสกุล (แก้ไขได้)' : 'ชื่อ-นามสกุล (อ่านอย่างเดียว)') : 'ชื่อ-นามสกุล (เพิ่มใหม่)'}
                    </label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!!editingId && !isManualUser}
                      className={cn(
                        "w-full bg-navy-input border border-border-navy rounded-2xl p-4 text-white outline-none focus:border-brand-primary/50 transition-all",
                        (editingId && !isManualUser) && "text-slate-500 cursor-not-allowed"
                      )}
                      placeholder="ระบุชื่อ-นามสกุล..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-500 uppercase font-bold tracking-widest">
                      ระดับสิทธิ์ {isAdmin ? '(Admin สามารถแก้ไขได้)' : '(ล็อคเฉพาะเจ้าหน้าที่)'}
                    </label>
                    <select 
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={!isAdmin}
                      className={cn(
                        "w-full bg-navy-input border border-border-navy rounded-2xl p-4 text-white outline-none focus:border-brand-primary/50 appearance-none cursor-pointer",
                        !isAdmin && "opacity-60 cursor-not-allowed bg-navy-base"
                      )}
                    >
                      <option value="Staff">{getRoleDisplayName('Staff')}</option>
                      <option value="Supervisor">{getRoleDisplayName('Supervisor')}</option>
                      <option value="Administrator">{getRoleDisplayName('Administrator')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-500 uppercase font-bold tracking-widest">ตำแหน่ง</label>
                    <input 
                      type="text" 
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full bg-navy-input border border-border-navy rounded-2xl p-4 text-white outline-none focus:border-brand-primary/50 transition-all"
                      placeholder="ระบุตำแหน่ง..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-500 uppercase font-bold tracking-widest">อีเมล</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-navy-input border border-border-navy rounded-2xl p-4 text-white outline-none focus:border-brand-primary/50 transition-all"
                      placeholder="example@nfc.go.th"
                    />
                    {!editingId && (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                          <ShieldCheck size={12} /> ความปลอดภัยของบัญชี
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          คุณไม่จำเป็นต้องตั้งรหัสผ่านให้สมาชิก ระบบจะใช้อีเมลนี้ในการ "จับคู่ข้อมูล" เมื่อสมาชิกเข้ามาทำการ <b>"ลงทะเบียนใหม่"</b> ด้วยตนเองในภายหลัง
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-500 uppercase font-bold tracking-widest">หน่วยงาน / สำนัก</label>
                    {departments.length === 0 ? (
                      <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-400 text-xs">
                        กรุณาเพิ่มข้อมูล "หน่วยงาน/สำนัก" ก่อนจัดการทีมงาน
                      </div>
                    ) : (
                      <select 
                        value={dept}
                        onChange={(e) => setDept(e.target.value)}
                        className="w-full bg-navy-input border border-border-navy rounded-2xl p-4 text-white outline-none focus:border-brand-primary/50 appearance-none cursor-pointer"
                        required
                      >
                        <option value="">เลือกหน่วยงาน/สำนัก...</option>
                        {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-500 uppercase font-bold tracking-widest">ส่วนงาน</label>
                    {taskOwners.length === 0 ? (
                      <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-400 text-xs">
                        กรุณาเพิ่มข้อมูล "ส่วนงาน" ก่อนจัดการทีมงาน
                      </div>
                    ) : (
                      <select 
                        value={ownerId}
                        onChange={(e) => setOwnerId(e.target.value)}
                        className="w-full bg-navy-input border border-border-navy rounded-2xl p-4 text-white outline-none focus:border-brand-primary/50 appearance-none cursor-pointer"
                      >
                        <option value="">เลือกส่วนงาน...</option>
                        {taskOwners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-500 uppercase font-bold tracking-widest">
                      {activeSubTab === 'departments' ? 'ชื่อหน่วยงาน/สำนัก' : (activeSubTab === 'owners' ? 'ชื่อส่วนงาน' : 'ชื่อ-นามสกุล')}
                    </label>
                    <input 
                      autoFocus
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-navy-input border border-border-navy rounded-2xl p-4 text-white outline-none focus:border-brand-primary/50 transition-all"
                      placeholder={activeSubTab === 'owners' ? "ระบุชื่อส่วนงาน..." : "ระบุชื่อ..."}
                      required
                    />
                  </div>

                  {activeSubTab === 'owners' && (
                    <div className="space-y-2">
                      <label className="text-[11px] text-slate-500 uppercase font-bold tracking-widest">หน่วยงาน / สำนัก</label>
                      {departments.length === 0 ? (
                        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-400 text-xs">
                          กรุณาเพิ่มข้อมูล "หน่วยงาน/สำนัก" ก่อนจัดการส่วนงาน
                        </div>
                      ) : (
                        <select 
                          value={deptId}
                          onChange={(e) => setDeptId(e.target.value)}
                          className="w-full bg-navy-input border border-border-navy rounded-2xl p-4 text-white outline-none focus:border-brand-primary/50 appearance-none cursor-pointer"
                          required
                        >
                          <option value="">เลือกหน่วยงาน/สำนัก...</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-4 bg-navy-elevated text-white font-bold rounded-2xl hover:bg-navy-elevated/80 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-brand-primary text-white font-bold rounded-2xl hover:bg-brand-primary/80 transition-all shadow-lg shadow-brand-primary/20 active:scale-95"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-navy-surface border border-border-navy w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
                <Trash2 className="text-red-500" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white tracking-tight">ยืนยันการลบข้อมูล?</h3>
                <p className="text-slate-500 text-sm">คุณต้องการลบข้อมูลของ <span className="text-white font-bold">{confirmDelete.name}</span> ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-4 bg-navy-elevated text-white font-bold rounded-2xl hover:bg-navy-elevated/80 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => handleDelete(confirmDelete.id)}
                  className="flex-1 py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-500 transition-all shadow-lg shadow-red-500/20 active:scale-95"
                >
                  ลบข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-6 py-2.5 rounded-[1rem] text-sm font-black transition-all uppercase tracking-wider",
        active ? "bg-brand-primary text-white shadow-md" : "text-slate-500 hover:text-white"
      )}
    >
      {label}
    </button>
  );
}

function WideCard({ icon, title, subtitle, status, tags, onEdit, onDelete }: { 
  icon: React.ReactNode, 
  title: string, 
  subtitle: string, 
  status?: 'online' | 'offline',
  tags: { label: string, color: string }[],
  onEdit: () => void,
  onDelete: () => void
}) {
  return (
    <div className="bg-navy-surface/50 p-6 rounded-[2rem] border border-border-navy flex items-center gap-6 group hover:border-brand-primary/30 transition-all shadow-sm hover:shadow-xl backdrop-blur-sm">
      <div className="w-16 h-16 rounded-2xl bg-navy-base border border-border-navy flex items-center justify-center overflow-hidden shadow-inner group-hover:scale-105 transition-transform duration-300 shrink-0">
        {icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <h4 className="text-xl font-black text-white truncate tracking-tight group-hover:text-brand-primary transition-colors">{title}</h4>
          {status && (
            <div className={cn(
              "w-2 h-2 rounded-full",
              status === 'online' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-slate-600"
            )} />
          )}
        </div>
        <p className="text-slate-500 font-medium text-sm truncate mb-3">{subtitle}</p>
        
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, idx) => (
            <span key={idx} className={cn(
              "text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg border",
              tag.color === 'purple' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
              tag.color === 'blue' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
              tag.color === 'green' ? "bg-green-500/10 text-green-400 border-green-500/20" :
              tag.color === 'orange' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
              tag.color === 'indigo' ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
              "bg-slate-500/10 text-slate-400 border-slate-500/20"
            )}>
              {tag.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {status === 'offline' && tags.some(t => t.label === 'INACTIVE' || t.label === 'WAITING') && (
          <button 
            onClick={() => {
              // Quick activation function would be passed here
              onEdit(); // Fallback to edit for now, but UI shows intent
            }}
            className="px-4 py-2 bg-green-600/20 text-green-400 border border-green-600/30 rounded-xl text-[10px] font-black uppercase hover:bg-green-600/40 transition-all active:scale-95"
          >
            อนุมัติ
          </button>
        )}
        <button onClick={onEdit} className="p-3 text-slate-500 hover:text-brand-primary hover:bg-brand-primary/10 rounded-2xl transition-all active:scale-90 border border-transparent hover:border-brand-primary/20">
          <Edit2 size={20} />
        </button>
        <button onClick={onDelete} className="p-3 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all active:scale-90 border border-transparent hover:border-red-500/20">
          <Trash2 size={20} />
        </button>
      </div>
    </div>
  );
}

function AuditLogView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const recentLogs = await auditService.getRecentLogs(50);
        setLogs(recentLogs);
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCw size={32} className="animate-spin text-brand-primary" />
        <p className="text-slate-500 font-bold">กำลังโหลดประวัติการใช้งาน...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {logs.length === 0 ? (
        <div className="text-center py-20 bg-navy-base/20 rounded-[2rem] border border-dashed border-border-navy">
           <History size={48} className="mx-auto text-slate-700 mb-4" />
           <p className="text-slate-500 font-bold">ไม่พบประวัติการใช้งานในระบบ</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-border-navy bg-navy-surface/50">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-navy-base/50 border-b border-border-navy">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">ผู้กระทำ</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">กิจกรรม</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">รายละเอียด</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">วันที่และเวลา</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-navy">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-navy-elevated/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-navy-elevated flex items-center justify-center text-[10px] font-black text-white border border-white/5">
                        {log.userName?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white leading-none">{log.userName}</p>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-black">{getRoleDisplayName(log.userRole)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      log.action === 'CREATE_TASK' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                      log.action === 'UPDATE_TASK' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      log.action === 'DELETE_TASK' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      "bg-slate-500/10 text-slate-400 border-slate-500/20"
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2 max-w-md">
                      <p className="text-sm text-slate-400 font-medium line-clamp-2">{log.details}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-slate-300 font-mono">
                      {log.timestamp ? 
                        `${formatThaiDate(log.timestamp)} ${new Date(log.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` 
                        : '-'
                      }
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
