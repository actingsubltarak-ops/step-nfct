import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Task } from '../types';
import { 
  Brain, 
  TrendingUp, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getIdToken } from '../firebase';

interface AIInsightsProps {
  tasks: Task[];
  teamMembers: any[];
}

export function AIInsights({ tasks, teamMembers }: AIInsightsProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    setInsight(null);
    try {
      const prompt = `
        คุณคือผู้เชี่ยวชาญด้านการบริหารโครงการ (Project Management Expert) 
        วิเคราะห์ข้อมูลงานและบุคลากรต่อไปนี้ และสรุปข้อมูลเชิงลึก (Insights) พร้อมข้อเสนอแนะในการปรับปรุงประสิทธิภาพงาน

        ข้อมูลงาน (Tasks):
        ${JSON.stringify(tasks.slice(0, 50).map(t => ({ title: t.title, status: t.status, project: t.project, startDate: t.startDate, endDate: t.endDate })), null, 2)}

        ข้อมูลทีมงาน (Team):
        ${JSON.stringify(teamMembers.map(m => ({ name: m.name, role: m.role })), null, 2)}

        กรุณาสรุปในหัวข้อดังนี้:
        1. ภาพรวมความคืบหน้าโครงการ (Project Overview)
        2. การวิเคราะห์ภาระงานและคอขวด (Workload & Bottleneck Analysis)
        3. ข้อเสนอแนะเชิงกลยุทธ์ (Strategic Recommendations)
        4. การประเมินความเสี่ยง (Risk Assessment)

        ตอบเป็นภาษาไทย โดยใช้รูปแบบ Markdown ที่สวยงามและอ่านง่าย
      `;

      const token = await getIdToken();
      const response = await fetch("/api/ai/generic", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          prompt,
          systemInstruction: "คุณคือผู้เชี่ยวชาญด้านการบริหารจัดการโครงการที่วิเคราะห์ข้อมูลระดับองค์กร"
        }),
      });

      if (!response.ok) throw new Error("API responded with error");
      const data = await response.json();
      setInsight(data.text || "ไม่สามารถสร้างข้อมูลเชิงลึกได้ในขณะนี้");
    } catch (error) {
      console.error("AI Insight Error:", error);
      setInsight("เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight">AI Strategic Insights</h2>
          <p className="text-slate-400 text-lg font-bold mt-1">วิเคราะห์ข้อมูลและสรุปแนวทางการทำงานด้วย Gemini AI</p>
        </div>
        
        <button
          onClick={generateInsights}
          disabled={loading}
          className="flex items-center gap-4 px-8 py-4 bg-brand-primary text-white font-black rounded-2xl hover:bg-brand-primary/80 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-brand-primary/20 text-xs uppercase tracking-[0.2em]"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
          {insight ? 'อัปเดตการวิเคราะห์' : 'เริ่มการวิเคราะห์เชิงลึก'}
        </button>
      </header>

      {!insight && !loading && (
        <div className="p-20 text-center space-y-8 bg-navy-surface rounded-[3rem] border-2 border-dashed border-border-navy shadow-sm">
          <div className="w-24 h-24 bg-brand-primary/10 rounded-[2rem] flex items-center justify-center mx-auto text-brand-primary shadow-inner">
            <Brain size={48} />
          </div>
          <div className="max-w-xl mx-auto space-y-4">
            <h3 className="text-3xl font-black text-white tracking-tight">พร้อมวิเคราะห์ข้อมูลเชิงกลยุทธ์</h3>
            <p className="text-lg text-slate-400 leading-relaxed font-bold">
              กดปุ่มด้านบนเพื่อให้ AI วิเคราะห์ภาระงาน ความคืบหน้า และข้อเสนอแนะในการปรับปรุงประสิทธิภาพของทีมอย่างเป็นระบบ
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="p-20 text-center space-y-8 bg-navy-surface rounded-[3rem] border border-border-navy shadow-xl shadow-black/50">
          <div className="flex justify-center gap-3">
            <div className="w-4 h-4 bg-brand-primary rounded-full animate-bounce [animation-delay:-0.3s] shadow-sm" />
            <div className="w-4 h-4 bg-brand-primary rounded-full animate-bounce [animation-delay:-0.15s] shadow-sm" />
            <div className="w-4 h-4 bg-brand-primary rounded-full animate-bounce shadow-sm" />
          </div>
          <p className="text-2xl font-black text-white tracking-tight">กำลังประมวลผลข้อมูลด้วย Gemini AI...</p>
        </div>
      )}

      {insight && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-3 space-y-8">
            <div className="bg-navy-surface p-12 rounded-[3rem] border border-border-navy shadow-xl shadow-black/50 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-80 h-80 bg-brand-primary/5 blur-[100px] rounded-full -mr-40 -mt-40" />
              
              <div className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-black prose-headings:tracking-tight prose-p:text-slate-300 prose-p:text-lg prose-p:leading-relaxed prose-strong:text-brand-primary prose-li:text-slate-300 prose-li:text-lg whitespace-pre-wrap">
                <ReactMarkdown>
                  {insight}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <InsightCard 
              icon={<TrendingUp className="text-emerald-400" />}
              title="ประสิทธิภาพ"
              value="ดีเยี่ยม"
              desc="ทีมงานสามารถดำเนินการได้ตามแผนงานที่วางไว้"
            />
            <InsightCard 
              icon={<AlertCircle className="text-amber-400" />}
              title="ความเสี่ยง"
              value="ต่ำ"
              desc="ไม่พบสัญญาณของความล่าช้าที่รุนแรงในขณะนี้"
            />
            <InsightCard 
              icon={<MessageSquare className="text-blue-400" />}
              title="การสื่อสาร"
              value="สม่ำเสมอ"
              desc="มีการอัปเดตความคืบหน้าและแสดงความคิดเห็นอย่างต่อเนื่อง"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InsightCard({ icon, title, value, desc }: { icon: React.ReactNode, title: string, value: string, desc: string }) {
  return (
    <div className="bg-navy-surface p-8 rounded-[2rem] border border-border-navy shadow-sm space-y-6 group hover:scale-[1.02] hover:shadow-xl hover:border-brand-primary/50 transition-all duration-500 active:scale-[0.98]">
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-navy-base border border-border-navy flex items-center justify-center group-hover:scale-110 group-hover:bg-brand-primary/10 transition-all shadow-inner">
          {icon}
        </div>
        <div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{title}</p>
          <p className="text-2xl font-black text-white mt-1 tracking-tight">{value}</p>
        </div>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed font-bold">{desc}</p>
    </div>
  );
}
