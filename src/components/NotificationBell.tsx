import React, { useState } from 'react';
import { Bell, Check, Trash2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Notification } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface NotificationBellProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onViewTask?: (taskId: string) => void;
}

export function NotificationBell({ notifications, onMarkAsRead, onMarkAllAsRead, onDeleteNotification, onViewTask }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-white hover:bg-navy-elevated rounded-xl transition-all active:scale-95 group"
      >
        <Bell size={20} className={cn(unreadCount > 0 && "animate-bounce-slow")} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-navy-base shadow-lg shadow-red-900/20">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-80 bg-navy-surface border border-border-navy rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-50 origin-top-right"
            >
              <div className="p-5 border-b border-border-navy bg-navy-base/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Bell size={14} className="text-blue-500" />
                    การแจ้งเตือน
                  </h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                      {unreadCount} ใหม่
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button 
                    onClick={onMarkAllAsRead}
                    className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors font-bold"
                  >
                    อ่านทั้งหมด
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <div className="w-12 h-12 bg-navy-elevated rounded-2xl flex items-center justify-center mx-auto text-slate-600">
                      <Bell size={24} />
                    </div>
                    <p className="text-xs text-slate-500">ไม่มีการแจ้งเตือนในขณะนี้</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-navy">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        className={cn(
                          "p-4 transition-colors hover:bg-navy-elevated/50 relative group",
                          !notification.isRead && "bg-blue-500/5"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                            notification.isRead ? "bg-slate-600" : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                          )} />
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-xs font-bold text-white truncate">{notification.title}</p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{notification.message}</p>
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[9px] text-slate-600">
                                {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true, locale: th })}
                              </span>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!notification.isRead && (
                                  <button 
                                    onClick={() => onMarkAsRead(notification.id)}
                                    className="p-1 text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                                    title="ทำเป็นอ่านแล้ว"
                                  >
                                    <Check size={12} />
                                  </button>
                                )}
                                {notification.taskId && onViewTask && (
                                  <button 
                                    onClick={() => {
                                      onViewTask(notification.taskId!);
                                      onMarkAsRead(notification.id);
                                      setIsOpen(false);
                                    }}
                                    className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
                                    title="ดูงาน"
                                  >
                                    <ExternalLink size={12} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => onDeleteNotification(notification.id)}
                                  className="p-1 text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                  title="ลบ"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
