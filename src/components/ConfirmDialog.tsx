import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  type = 'danger'
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          iconBg: 'bg-rose-50',
          iconBorder: 'border-rose-100',
          iconColor: 'text-rose-600',
          confirmBg: 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-50',
          iconBorder: 'border-amber-100',
          iconColor: 'text-amber-600',
          confirmBg: 'bg-amber-600 hover:bg-amber-700 shadow-amber-100'
        };
      default:
        return {
          iconBg: 'bg-blue-50',
          iconBorder: 'border-blue-100',
          iconColor: 'text-blue-600',
          confirmBg: 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white w-full max-w-md overflow-hidden shadow-2xl rounded-[3rem] border-2 border-slate-100"
        >
          <div className="p-10 text-center space-y-8 relative">
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900 transition-colors hover:bg-slate-100 rounded-xl"
            >
              <X size={24} />
            </button>

            <div className={`w-24 h-24 ${styles.iconBg} rounded-[2rem] flex items-center justify-center mx-auto border-2 ${styles.iconBorder} shadow-inner`}>
              <AlertTriangle size={48} className={styles.iconColor} />
            </div>
            
            <div className="space-y-3">
              <h3 className="text-3xl font-black text-slate-950 tracking-tight">{title}</h3>
              <p className="text-slate-500 text-base font-bold leading-relaxed">{message}</p>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                onClick={onClose}
                className="flex-1 py-5 bg-slate-50 hover:bg-slate-100 text-slate-500 font-black rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-[0.2em] border-2 border-slate-100"
              >
                {cancelText}
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 py-5 ${styles.confirmBg} text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 text-xs uppercase tracking-[0.2em]`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
