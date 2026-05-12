import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { GoogleGenAI } from "@google/genai";
import { Task } from '../types';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

interface AIChatSidebarProps {
  tasks: Task[];
  isOpen: boolean;
  onClose: () => void;
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export function AIChatSidebar({ tasks, isOpen, onClose }: AIChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: 'สวัสดีครับ! ผมคือผู้ช่วย AI ของระบบ STEP มีอะไรให้ผมช่วยสรุปหรือวิเคราะห์งานในระบบไหมครับ?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const context = `
        You are an AI assistant for a task management system called STEP.
        Current tasks in the system: ${JSON.stringify(tasks.map(t => ({ title: t.title, status: t.status, endDate: t.endDate, project: t.project })))}
        User's question: ${userMessage}
        Please provide a helpful summary or answer based on the tasks. Answer in Thai.
      `;

      const response = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: context,
      });

      const text = response.text || 'ขออภัยครับ ไม่สามารถประมวลผลคำตอบได้';

      setMessages(prev => [...prev, { role: 'ai', content: text }]);
    } catch (error) {
      console.error("AI Chat Error:", error);
      setMessages(prev => [...prev, { role: 'ai', content: 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-navy-surface shadow-2xl z-[101] flex flex-col border-l border-border-navy"
          >
            {/* Header */}
            <div className="p-8 border-b border-border-navy flex items-center justify-between bg-navy-surface">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-primary flex items-center justify-center shadow-lg shadow-brand-primary/20">
                  <Sparkles size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-2xl text-white tracking-tight">STEP AI Assistant</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-xs text-slate-500 font-black uppercase tracking-widest">Online & Ready</p>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2.5 hover:bg-navy-elevated text-slate-500 hover:text-white rounded-xl transition-all active:scale-90">
                <X size={24} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-navy-base/30">
              {messages.map((msg, idx) => (
                <div key={idx} className={cn(
                  "flex gap-4",
                  msg.role === 'user' ? "flex-row-reverse" : ""
                )}>
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
                    msg.role === 'ai' ? "bg-navy-elevated text-brand-primary border-border-navy" : "bg-brand-primary text-white border-brand-primary/50"
                  )}>
                    {msg.role === 'ai' ? <Bot size={20} /> : <User size={20} />}
                  </div>
                  <div className={cn(
                    "max-w-[85%] p-5 rounded-[1.5rem] text-base font-bold leading-relaxed shadow-sm",
                    msg.role === 'ai' 
                      ? "bg-navy-elevated text-white rounded-tl-none border border-border-navy" 
                      : "bg-brand-primary text-white rounded-tr-none"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-navy-elevated text-brand-primary flex items-center justify-center shrink-0 border border-border-navy shadow-sm">
                    <Bot size={20} />
                  </div>
                  <div className="bg-navy-elevated p-5 rounded-[1.5rem] rounded-tl-none flex items-center gap-3 border border-border-navy shadow-sm">
                    <Loader2 size={18} className="animate-spin text-brand-primary" />
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">AI กำลังประมวลผล...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 border-t border-border-navy bg-navy-base/30">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="ถาม AI เกี่ยวกับงานของคุณ..." 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="w-full pl-4 pr-12 py-4 bg-navy-input border border-border-navy rounded-2xl text-white font-bold focus:outline-none focus:border-brand-primary/50 transition-all shadow-sm placeholder:text-slate-600"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-brand-primary text-white rounded-xl hover:bg-brand-primary/80 transition-all disabled:opacity-50 disabled:hover:bg-brand-primary active:scale-90"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-xs text-center text-slate-500 mt-4 font-black uppercase tracking-widest">
                Powered by Gemini 2.0 Flash
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
