import React, { useState } from 'react';
import { UserCircle, User, Shield, Building2, Briefcase, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logout } from '../firebase';
import { userService } from '../services/userService';

interface CompleteProfileProps {
  user: any;
  userProfile: any;
  departments: any[];
  taskOwners: any[];
}

export function CompleteProfile({ user, userProfile, departments, taskOwners }: CompleteProfileProps) {
  const [name, setName] = useState(userProfile?.name || '');
  const [department, setDepartment] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !department || !ownerId) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    try {
      await userService.updateUser(user.uid, {
        name,
        department,
        ownerId,
        jobTitle,
        status: 'Inactive', // Still inactive until admin approves
        updatedAt: new Date().toISOString()
      });
      
      await userService.notifyAdminsAboutNewUser(name, user.email || 'ไม่ระบุอีเมล');
      
      toast.success('บันทึกข้อมูลสำเร็จ กรุณารอผู้ดูแลระบบอนุมัติการใช้งาน');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-base flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-navy-surface p-10 rounded-[3rem] border border-border-navy shadow-2xl space-y-8">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto border border-blue-500/20 mb-4">
            <UserCircle className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-2xl font-black text-white">ระบุข้อมูลเพิ่มเติม</h2>
          <p className="text-slate-400 text-sm">กรุณาระบุหน่วยงานและส่วนงานของคุณเพื่อขออนุมัติเข้าใช้งาน</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">ชื่อ-นามสกุล</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อ-นามสกุล"
                className="w-full pl-12 pr-4 py-4 bg-navy-base border border-border-navy rounded-2xl text-white placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">ตำแหน่ง</label>
            <div className="relative">
              <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="ตำแหน่งงาน"
                className="w-full pl-12 pr-4 py-4 bg-navy-base border border-border-navy rounded-2xl text-white placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">หน่วยงาน / สำนัก</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-navy-base border border-border-navy rounded-2xl text-white focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                required
              >
                <option value="">เลือกหน่วยงาน/สำนัก...</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">ส่วนงาน</label>
            <div className="relative">
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-navy-base border border-border-navy rounded-2xl text-white focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                required
              >
                <option value="">เลือกส่วนงาน...</option>
                {taskOwners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20 active:scale-95 disabled:opacity-50 mt-4"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'บันทึกข้อมูล'}
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full py-4 bg-transparent text-slate-500 font-bold hover:text-white transition-all"
          >
            ออกจากระบบ
          </button>
        </form>
      </div>
    </div>
  );
}
