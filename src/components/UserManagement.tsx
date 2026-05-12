import React, { useState, useMemo } from 'react';
import { TeamMember } from '../types';
import { 
  Users, 
  Search, 
  Shield, 
  Building2, 
  Edit3,
  Trash2,
  Save,
  X,
  Power,
  Trash
} from 'lucide-react';
import { cn, getRoleDisplayName, isSystemAdmin } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmModal } from './ConfirmModal';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { toast } from 'sonner';

interface UserManagementProps {
  users: TeamMember[];
  departments: any[];
  onUpdateUser: (userId: string, data: Partial<TeamMember>) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onClearAllUsers: () => Promise<void>;
  currentUser: any;
}

export function UserManagement({ users, departments, onUpdateUser, onDeleteUser, onClearAllUsers, currentUser }: UserManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(10);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<TeamMember>>({});
  const [isClearing, setIsClearing] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; userId: string | null; userName: string }>({
    isOpen: false,
    userId: null,
    userName: ''
  });
  const [clearModalOpen, setClearModalOpen] = useState(false);

  const isAdmin = isSystemAdmin(currentUser?.email);

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await onClearAllUsers();
      setClearModalOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsClearing(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesDept = deptFilter === 'all' || user.department === deptFilter;
      const matchesStatus = statusFilter === 'all' || (user.status || 'Active') === statusFilter;
      return matchesSearch && matchesRole && matchesDept && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, deptFilter, statusFilter]);

  const pagedUsers = useMemo(() => {
    return filteredUsers.slice(0, visibleCount);
  }, [filteredUsers, visibleCount]);

  const handleStartEdit = (user: TeamMember) => {
    setEditingUserId(user.id);
    setEditData({
      role: user.role,
      department: user.department,
      name: user.name,
      jobTitle: user.jobTitle || ''
    });
  };

  const handleSaveEdit = async (userId: string) => {
    try {
      await onUpdateUser(userId, editData);
      setEditingUserId(null);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const roles = ['Administrator', 'Supervisor', 'Staff'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight">จัดการผู้ใช้งานและสิทธิ์เข้าถึง</h2>
          <p className="text-[#a1a1aa]">กำหนดบทบาทและหน่วยงานให้กับพนักงานในระบบ</p>
        </div>
        <div className="flex items-center gap-3 bg-[#18181b] p-1.5 rounded-2xl border border-[#27272a]">
          {isAdmin && (
            <button 
              onClick={() => setClearModalOpen(true)}
              className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl text-xs font-black flex items-center gap-2 transition-all border border-red-500/20"
            >
              <Trash size={14} />
              ล้างข้อมูลผู้ใช้ทั้งหมด
            </button>
          )}
          <div className="px-4 py-2 bg-blue-500/10 text-blue-400 rounded-xl text-xs font-bold flex items-center gap-2">
            <Shield size={14} />
            Admin Mode
          </div>
        </div>
      </header>

      <div className="bg-[#18181b] p-6 rounded-[2rem] border border-[#27272a] shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" size={18} />
            <input
              type="text"
              placeholder="ค้นหาชื่อหรืออีเมล..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[#09090b] border border-[#27272a] rounded-xl text-base text-white placeholder:text-[#71717a] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-4 py-3 bg-[#09090b] border border-[#27272a] rounded-xl text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
          >
            <option value="all">ทุกบทบาท</option>
            {roles.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full px-4 py-3 bg-[#09090b] border border-[#27272a] rounded-xl text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
          >
            <option value="all">ทุกหน่วยงาน</option>
            {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-3 bg-[#09090b] border border-[#27272a] rounded-xl text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#18181b] rounded-[2rem] border border-[#27272a] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#09090b]/50 border-b border-[#27272a]">
                <th className="px-6 py-5 text-base font-bold text-white uppercase tracking-widest">ผู้ใช้งาน</th>
                <th className="px-6 py-5 text-base font-bold text-white uppercase tracking-widest">บทบาท (Role)</th>
                <th className="px-6 py-5 text-base font-bold text-white uppercase tracking-widest">หน่วยงาน (Department)</th>
                <th className="px-6 py-5 text-base font-bold text-white uppercase tracking-widest">เข้าใช้งานล่าสุด</th>
                <th className="px-6 py-5 text-base font-bold text-white uppercase tracking-widest">สถานะ</th>
                <th className="px-6 py-5 text-base font-bold text-white uppercase tracking-widest text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {pagedUsers.map((user) => (
                <tr key={user.id} className={cn(
                  "hover:bg-[#27272a]/30 transition-colors group",
                  editingUserId === user.id && "bg-blue-500/5"
                )}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#27272a] border border-[#3f3f46] flex items-center justify-center overflow-hidden shadow-inner">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-sm font-bold text-white">{user.name[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        {editingUserId === user.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editData.name}
                              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                              className="bg-[#09090b] border border-[#27272a] rounded-lg px-2 py-1 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="ชื่อ-นามสกุล"
                            />
                            <input
                              type="text"
                              value={editData.jobTitle}
                              onChange={(e) => setEditData({ ...editData, jobTitle: e.target.value })}
                              className="bg-[#09090b] border border-[#27272a] rounded-lg px-2 py-1 text-[10px] text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="ตำแหน่งงาน"
                            />
                          </div>
                        ) : (
                          <>
                            <p className="text-base font-bold text-white truncate">{user.name}</p>
                            <p className="text-xs text-blue-400/80 font-black uppercase tracking-widest truncate">{user.jobTitle || 'ไม่ระบุตำแหน่ง'}</p>
                          </>
                        )}
                        <p className="text-xs text-[#71717a] font-bold truncate flex items-center gap-1.5 mt-0.5">
                          {user.provider === 'google' && <img src="https://www.google.com/favicon.ico" className="w-3 h-3" alt="" />}
                          {user.email || 'No email'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {editingUserId === user.id ? (
                      <select
                        value={editData.role}
                        onChange={(e) => setEditData({ ...editData, role: e.target.value as "Administrator" | "Supervisor" | "Staff" })}
                        className="bg-[#09090b] border border-[#27272a] rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {roles.map(role => <option key={role} value={role}>{getRoleDisplayName(role)}</option>)}
                      </select>
                    ) : (
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border",
                        user.role === 'Administrator' ? "bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]" :
                        user.role === 'Supervisor' ? "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]" :
                        "bg-gray-500/10 text-gray-400 border-gray-500/20"
                      )}>
                        <Shield size={12} />
                        {getRoleDisplayName(user.role)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingUserId === user.id ? (
                      <select
                        value={editData.department}
                        onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                        className="bg-[#09090b] border border-[#27272a] rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2.5 text-sm text-[#a1a1aa] font-bold">
                        <Building2 size={14} className="text-[#52525b]" />
                        {user.department}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-[#71717a]">
                    <div className="flex items-center gap-2">
                      {(() => {
                        if (!user.lastActive) return 'ไม่เคยเข้าใช้งาน';
                        try {
                          // Handle Firestore Timestamp if it exists
                          const date = typeof user.lastActive?.toDate === 'function' 
                            ? user.lastActive.toDate() 
                            : new Date(user.lastActive);
                          
                          if (isNaN(date.getTime())) return 'ไม่เคยเข้าใช้งาน';
                          
                          return formatDistanceToNow(date, { addSuffix: true, locale: th });
                        } catch (err) {
                          return 'ไม่เคยเข้าใช้งาน';
                        }
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]",
                        (user.status || 'Active') === 'Active' ? "bg-green-500" : "bg-red-500 shadow-red-500/50"
                      )} />
                      <span className={cn(
                        "text-xs font-black uppercase tracking-[0.2em]",
                        (user.status || 'Active') === 'Active' ? "text-green-400" : "text-red-400"
                      )}>
                        {user.status || 'Active'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editingUserId === user.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(user.id)}
                            className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all"
                            title="บันทึก"
                          >
                            <Save size={18} />
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                            title="ยกเลิก"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => onUpdateUser(user.id, { status: (user.status || 'Active') === 'Active' ? 'Inactive' : 'Active' })}
                            className={cn(
                              "px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold",
                              (user.status || 'Active') === 'Active' 
                                ? "opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-500/10" 
                                : "opacity-100 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 shadow-lg shadow-emerald-500/10"
                            )}
                            title={(user.status || 'Active') === 'Active' ? "ปิดใช้งาน" : "เปิดใช้งาน (อนุมัติ)"}
                          >
                            <Power size={14} />
                            {(user.status || 'Active') !== 'Active' && <span>อนุมัติ</span>}
                          </button>
                          <button
                            onClick={() => handleStartEdit(user)}
                            className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            title="แก้ไข"
                          >
                            <Edit3 size={18} />
                          </button>
                          {user.id !== currentUser?.uid && (
                            <button
                              onClick={() => setDeleteModal({ isOpen: true, userId: user.id, userName: user.name })}
                              className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                              title="ลบ"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredUsers.length > visibleCount && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setVisibleCount(prev => prev + 10)}
            className="px-6 py-2.5 bg-[#18181b] border border-[#27272a] rounded-xl text-sm font-bold text-white hover:bg-[#27272a] transition-all"
          >
            โหลดข้อมูลเพิ่ม ({filteredUsers.length - visibleCount} รายการที่เหลือ)
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={() => deleteModal.userId && onDeleteUser(deleteModal.userId)}
        title="ยืนยันการลบผู้ใช้งาน"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งาน "${deleteModal.userName}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
        confirmText="ลบผู้ใช้งาน"
        variant="danger"
      />

      <ConfirmModal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        onConfirm={handleClearAll}
        title="ยืนยันการล้างข้อมูลผู้ใช้ทั้งหมด"
        message="คุณกำลังจะลบข้อมูลผู้ใช้ทั้งหมดที่ไม่ได้เป็นผู้ดูแลระบบ (ยกเว้นตัวคุณเอง) ข้อมูลนี้จะไม่สามารถกู้คืนได้ ยืนยันหรือไม่?"
        confirmText={isClearing ? "กำลังลบ..." : "ยืนยันการล้างข้อมูล"}
        variant="danger"
      />
    </div>
  );
}
