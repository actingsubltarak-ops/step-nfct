import React, { useState } from 'react';
import { X, Lock, ShieldCheck, AlertCircle } from 'lucide-react';
import { auth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from '../firebase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isGoogleUser = auth.currentUser?.providerData.some(p => p.providerId === 'google.com');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isGoogleUser) {
      toast.error('บัญชี Google ไม่สามารถเปลี่ยนรหัสผ่านที่นี่ได้', {
        description: 'กรุณาเปลี่ยนผ่านหน้าตั้งค่าของ Google Direct'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('ไม่พบข้อมูลผู้ใช้งาน');

      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      onClose();
      // Clear fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error("Change Password Error:", error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('รหัสปัจจุบันไม่ถูกต้อง', {
          description: 'กรุณาตรวจสอบรหัสผ่านเดิมที่คุณใช้อยู่'
        });
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('คุณพยายามบ่อยเกินไป กรุณารักครู่แล้วลองใหม่');
      } else if (error.code === 'auth/requires-recent-login') {
        toast.error('เซสชันหมดอายุ', {
          description: 'กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่ก่อนการเปลี่ยนรหัสผ่าน'
        });
      } else {
        toast.error('ไม่สามารถเปลี่ยนรหัสผ่านได้', {
          description: error.message || 'เกิดข้อผิดพลาดทางเทคนิค'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-navy-surface w-full max-w-md rounded-[2.5rem] border border-border-navy shadow-2xl overflow-hidden relative"
          >
            <div className="p-8 border-b border-border-navy bg-navy-base/30 relative">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary shadow-inner">
                  <Lock size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">เปลี่ยนรหัสผ่าน</h2>
                  <p className="text-slate-400 text-sm font-medium mt-0.5">เปลี่ยนรหัสผ่านเพื่อความปลอดภัย</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="absolute top-8 right-8 p-2 text-slate-500 hover:text-white hover:bg-navy-elevated rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {isGoogleUser ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-4 items-start">
                  <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                  <div className="space-y-1">
                    <p className="text-amber-200 font-bold text-sm">การเข้าสู่ระบบผ่าน Google</p>
                    <p className="text-amber-200/70 text-xs leading-relaxed">
                      คุณเข้าสู่ระบบด้วยบัญชี Google หากต้องการเปลี่ยนรหัสผ่าน กรุณาจัดการผ่านทาง Google Account
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">รหัสผ่านปัจจุบัน</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-5 py-4 bg-navy-base border border-border-navy rounded-2xl text-white placeholder:text-slate-700 focus:border-brand-primary outline-none transition-all shadow-sm"
                      required
                    />
                  </div>

                  <div className="h-px bg-border-navy" />

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">รหัสผ่านใหม่</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-5 py-4 bg-navy-base border border-border-navy rounded-2xl text-white placeholder:text-slate-700 focus:border-brand-primary outline-none transition-all shadow-sm"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">ยืนยันรหัสผ่านใหม่</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-5 py-4 bg-navy-base border border-border-navy rounded-2xl text-white placeholder:text-slate-700 focus:border-brand-primary outline-none transition-all shadow-sm"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 bg-navy-elevated text-white font-bold rounded-2xl hover:bg-navy-input border border-border-navy transition-all active:scale-[0.98]"
                >
                  ยกเลิก
                </button>
                {!isGoogleUser && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-brand-primary text-white font-bold rounded-2xl hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck size={18} />
                        บันทึกการเปลี่ยน
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
