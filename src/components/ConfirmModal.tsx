import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  variant = 'danger'
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-[2rem] shadow-2xl overflow-hidden"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  variant === 'danger' ? "bg-red-500/10 text-red-500" :
                  variant === 'warning' ? "bg-amber-500/10 text-amber-500" :
                  "bg-blue-500/10 text-blue-500"
                )}>
                  <AlertTriangle size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">{title}</h3>
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">{message}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="ml-auto p-2 text-[#52525b] hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold text-[#a1a1aa] hover:text-white hover:bg-white/5 border border-[#27272a] transition-all"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={cn(
                    "flex-1 px-4 py-3 rounded-2xl text-sm font-bold text-white shadow-lg transition-all active:scale-[0.98]",
                    variant === 'danger' ? "bg-red-600 hover:bg-red-500 shadow-red-500/20" :
                    variant === 'warning' ? "bg-amber-600 hover:bg-amber-500 shadow-amber-500/20" :
                    "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20"
                  )}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
