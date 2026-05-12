import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#18181b] border border-[#27272a] rounded-[2.5rem] p-10 text-center space-y-6 shadow-2xl">
            <div className="w-20 h-20 bg-rose-500/10 rounded-[2rem] flex items-center justify-center mx-auto text-rose-500">
              <AlertTriangle size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Oops! Something went wrong</h2>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                เกิดข้อผิดพลาดที่ไม่คาดคิดในระบบ กรุณาลองรีเฟรชหน้าจอใหม่อีกครั้ง
              </p>
            </div>
            {this.state.error && (
              <div className="p-4 bg-black/40 rounded-2xl text-left overflow-auto max-h-32 custom-scrollbar">
                <code className="text-[10px] text-rose-400/80 font-mono break-all">
                  {this.state.error.toString()}
                </code>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-brand-primary text-white font-black rounded-2xl hover:bg-brand-primary/80 transition-all active:scale-95 shadow-lg shadow-brand-primary/20"
            >
              <RefreshCw size={20} />
              รีเฟรชหน้าจอ
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
