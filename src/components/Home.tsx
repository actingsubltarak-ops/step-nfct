import React from 'react';
import { CheckCircle2, Clock, AlertCircle, ListTodo, Activity, History, TrendingUp, Briefcase, GraduationCap, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { formatThaiDate, cn } from '../lib/utils';
import { Task, TeamMember } from '../types';

interface HomeProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  userProfile: TeamMember | null;
  onViewReports?: () => void;
}

const MINI_CHART_DATA = [
  { value: 40 }, { value: 60 }, { value: 45 }, { value: 80 }, { value: 70 }, { value: 90 },
];

export function Home({ tasks, teamMembers, userProfile, onViewReports }: HomeProps) {
  const performanceTrend = React.useMemo(() => {
    const trend = [];
    const now = new Date();
    
    for (let i = 9; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - (i * 7));
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 7);
      
      const weekName = `W${10 - i}`;
      
      const tasksInWeek = tasks.filter(t => {
        if (!t.completedAt) return false;
        const compDate = new Date(t.completedAt);
        return compDate >= weekStart && compDate <= weekEnd;
      });

      const dueInWeek = tasks.filter(t => {
        const dueDate = new Date(t.endDate);
        return dueDate >= weekStart && dueDate <= weekEnd;
      });

      // Throughput: Number of completed tasks (scaled for visibility if low)
      const throughput = tasksInWeek.length * 10; 
      
      // Efficiency: Completion vs Deadlines ratio
      let efficiency = 0;
      if (dueInWeek.length > 0) {
        const completedOnTime = dueInWeek.filter(t => t.status === 'Completed' && new Date(t.completedAt!) <= new Date(t.endDate)).length;
        efficiency = Math.round((completedOnTime / dueInWeek.length) * 100);
      } else if (tasksInWeek.length > 0) {
        // Fallback for weeks without deadlines but with completions
        efficiency = 50 + (tasksInWeek.length * 5); 
      } else {
        efficiency = trend.length > 0 ? trend[trend.length - 1].efficiency * 0.8 : 0;
      }

      trend.push({
        name: weekName,
        throughput: Math.min(100, throughput),
        efficiency: Math.min(100, Math.max(10, efficiency))
      });
    }
    return trend;
  }, [tasks]);

  const stats = React.useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const pending = tasks.filter(t => t.status === 'Pending').length;
    
    const today = new Date();
    const overdue = tasks.filter(t => {
      if (t.status === 'Completed') return false;
      const endDate = new Date(t.endDate);
      return endDate < today;
    }).length;

    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Derived Metrics for Bars
    const workloadRate = total > 0 ? Math.round(((total - pending) / total) * 100) : 0;
    const inProgressRate = total > 0 ? Math.round((inProgress / total) * 100) : 0;
    
    // Performance Index Calculation (Simple formula based on completion and timeliness)
    // Scale 0-4
    const indexValue = total > 0 
      ? ((completed * 4 + inProgress * 2) / (total * 4) * 4).toFixed(2)
      : "0.00";
    
    // Score Calculation (Scale 0-10)
    const scoreValue = (progress / 10).toFixed(2);

    // Staff Engagement (Percentage of team with active tasks)
    const engagedStaff = teamMembers.length > 0
      ? Math.round((teamMembers.filter(m => 
          tasks.some(t => t.assigneeId === m.id || (t.assigneeIds && t.assigneeIds.includes(m.id)))
        ).length / teamMembers.length) * 100)
      : 0;

    return { 
      total, 
      completed, 
      inProgress, 
      pending, 
      overdue, 
      progress,
      workloadRate,
      inProgressRate,
      indexValue,
      scoreValue,
      engagedStaff
    };
  }, [tasks, teamMembers]);

  const { 
    total: totalTasks, 
    progress, 
    workloadRate, 
    inProgressRate, 
    indexValue, 
    scoreValue, 
    engagedStaff,
    completed: completedTasks,
    inProgress: inProgressTasks,
    pending: pendingTasks,
    overdue: overdueTasks
  } = stats;

  const allActivities = React.useMemo(() => tasks
    .flatMap(task => (task.activities || []).map(activity => ({ ...activity, taskTitle: task.title })))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5), [tasks]);

  const recentTasks = React.useMemo(() => tasks.slice(0, 4), [tasks]);

  return (
    <div className="space-y-12 animate-in pb-10">
      <header className="relative bg-[#07090f] rounded-[3.5rem] p-10 md:p-16 border border-white/5 shadow-2xl shadow-black/80 overflow-hidden">
        {/* Strategic glow background */}
        <div className="absolute top-0 right-0 w-3/4 h-full bg-gradient-to-l from-blue-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-12 items-start">
          {/* Left Column: Branding & Large Gauge */}
          <div className="xl:col-span-6 flex flex-col items-center justify-center text-center xl:items-start xl:text-left h-full gap-16">
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-4 tracking-tighter leading-none text-white whitespace-nowrap">
                ระบบติดตามเชิงกลยุทธ์ และประเมินผลสัมฤทธิ์
              </h2>
              <p className="text-sm md:text-base font-bold text-zinc-500 tracking-tight uppercase leading-relaxed max-w-xl">
                Strategic Tracking of Employment & Performance (STEP)
              </p>
            </div>

            <div className="flex flex-col items-center justify-center w-full py-2 gap-12 mt-10">
              <CircularGauge value={progress} />
              
              {/* Organizational Status Info - Moved outside the circle frame */}
              <div className="flex items-center gap-6 bg-[#0c0f1a]/80 px-10 py-4 rounded-full border border-blue-500/20 shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
                <div className="flex gap-1.5">
                  {[1,2,3].map(i => <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}
                </div>
                <p className="text-[15px] font-black text-white uppercase tracking-[0.35em] drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">ภาพรวมองค์กร</p>
                <div className="flex gap-1.5">
                  {[1,2,3].map(i => <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Analytics Matrix - Reduced width */}
          <div className="xl:col-span-6 flex flex-col gap-6">
            {/* Main Area Chart - High Tech Analytics */}
            <div className="bg-[#0c0f1a]/80 border border-white/10 rounded-[3rem] p-10 relative overflow-hidden backdrop-blur-xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] group/chart">
              <div className="flex justify-between items-center mb-8 relative z-10 px-2">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-white/5 shadow-xl group-hover/chart:border-blue-500/30 transition-all duration-500">
                    <TrendingUp className="text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight leading-none group-hover:text-blue-400 transition-colors">Efficiency & Throughput Velocity</h3>
                    <p className="text-[11px] font-black text-white/30 uppercase tracking-[0.25em] mt-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      Decision-centric performance tracking
                    </p>
                  </div>
                </div>
                <div className="bg-blue-600/10 px-5 py-3 rounded-2xl border border-white/5 backdrop-blur-md shadow-2xl flex items-center gap-3 group-hover/chart:border-blue-500/30 transition-all">
                  <div className="flex gap-1">
                    <div className="w-1 h-3 bg-blue-500/50 rounded-full animate-[bounce_1s_infinite]" />
                    <div className="w-1 h-3 bg-blue-500/80 rounded-full animate-[bounce_1.2s_infinite]" />
                    <div className="w-1 h-3 bg-blue-500 rounded-full animate-[bounce_0.8s_infinite]" />
                  </div>
                  <span className="text-xs font-black text-blue-400 tracking-wider uppercase">Live: {progress}%</span>
                </div>
              </div>
              
              <div className="h-[180px] w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={performanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValueHero" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.2}/>
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="name" 
                      hide={true}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0c0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,0.8)', padding: '16px' }}
                      itemStyle={{ color: '#fff', fontWeight: '900', fontSize: '14px' }}
                      labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em' }}
                      cursor={{ stroke: 'rgba(59,130,246,0.3)', strokeWidth: 2, strokeDasharray: '4 4' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="efficiency" 
                      stroke="#3b82f6" 
                      strokeWidth={5}
                      fillOpacity={1} 
                      fill="url(#colorValueHero)" 
                      dot={{ r: 4, fill: '#60a5fa', strokeWidth: 3, stroke: '#0c0f1a' }}
                      activeDot={{ r: 8, fill: '#fff', strokeWidth: 0 }}
                      isAnimationActive={true}
                      animationDuration={2500}
                      animationEasing="ease-in-out"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="throughput" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      fillOpacity={0.15} 
                      fill="url(#colorThroughput)" 
                      className="opacity-40"
                      isAnimationActive={true}
                      animationDuration={3500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* High-tech accent lines */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent scale-x-0 group-hover/chart:scale-x-100 transition-transform duration-700" />
              
              {/* Background glow */}
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
            </div>

            {/* Sub-metrics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Progress/Stat Grid: Strategic KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 bg-[#0c0f1a]/40 p-6 rounded-[2.5rem] border border-white/5 h-full backdrop-blur-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] relative group/progress">
              <HorizontalProgress 
                label="ปริมาณงานทั้งหมด" 
                value={100} 
                rawCount={totalTasks} 
                color="bg-orange-500" 
                glowColor="shadow-orange-500/40"
              />
              <HorizontalProgress 
                label="งานที่เสร็จสิ้นแล้ว" 
                value={progress} 
                rawCount={completedTasks} 
                color="bg-emerald-500" 
                glowColor="shadow-emerald-500/40"
              />
              <HorizontalProgress 
                label="งานที่รอดำเนินการ" 
                value={100 - progress} 
                rawCount={totalTasks - completedTasks} 
                color="bg-blue-500" 
                glowColor="shadow-blue-500/40"
              />
              <HorizontalProgress 
                label="ทีมงานมีส่วนร่วม" 
                value={engagedStaff} 
                rawCount={teamMembers.filter(m => tasks.some(t => t.assigneeId === m.id || (t.assigneeIds && t.assigneeIds.includes(m.id)))).length} 
                color="bg-indigo-500" 
                glowColor="shadow-indigo-500/40"
              />
              
              {/* Decorative glow for the container */}
              <div className="absolute inset-0 rounded-[2.5rem] border border-white/5 pointer-events-none group-hover/progress:border-blue-500/10 transition-colors" />
            </div>

              {/* Stat Cards 2x2 Grid */}
              <div className="grid grid-cols-2 gap-5">
                <MiniStatCard label={totalTasks.toString()} title="Overall" />
                <MiniStatCard label={`${progress}%`} title="Success" />
                <MiniStatCard label={indexValue} title="Index" />
                <MiniStatCard label={scoreValue} title="Score" />
              </div>
            </div>
          </div>
        </div>
      </header>


      {/* Quick Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
        <StatWidget 
          label="งานทั้งหมด" 
          value={totalTasks} 
          icon={<ListTodo size={28} className="text-brand-primary" />} 
          color="bg-brand-primary/10"
          borderColor="border-brand-primary/20"
        />
        <StatWidget 
          label="เสร็จสิ้นแล้ว" 
          value={completedTasks} 
          icon={<CheckCircle2 size={28} className="text-status-complete" />} 
          color="bg-status-complete/10"
          borderColor="border-status-complete/20"
        />
        <StatWidget 
          label="กำลังดำเนินการ" 
          value={inProgressTasks + pendingTasks} 
          icon={<Clock size={28} className="text-status-pending" />} 
          color="bg-status-pending/10"
          borderColor="border-status-pending/20"
        />
        <StatWidget 
          label="ล่าช้ากว่ากำหนด" 
          value={overdueTasks} 
          icon={<AlertCircle size={28} className="text-status-hold" />} 
          color="bg-status-hold/10"
          borderColor="border-status-hold/20"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-4xl font-black text-white tracking-tight">สรุปสถานะงานล่าสุด</h3>
            <button 
              onClick={onViewReports}
              className="text-base font-black text-brand-primary uppercase tracking-wider hover:text-blue-400 transition-colors"
            >
              ดูรายงานทั้งหมด
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recentTasks.map((task) => (
              <div key={task.id} className={cn(
                "bg-navy-surface p-8 rounded-2xl border border-border-navy shadow-sm flex items-start gap-6 group hover:border-brand-primary/50 transition-all"
              )}>
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105",
                  task.status === 'Completed' 
                    ? "bg-status-complete/10 text-status-complete border border-status-complete/20" 
                    : "bg-brand-primary/10 text-brand-primary border border-brand-primary/20"
                )}>
                  {task.status === 'Completed' ? <CheckCircle2 size={28} /> : <Clock size={28} />}
                </div>
                <div className="min-w-0">
                  <h4 className="text-2xl font-black text-white truncate tracking-tight group-hover:text-brand-primary transition-colors">{task.title}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm font-black text-slate-500 uppercase tracking-wider">กำหนดส่ง</span>
                    <p className="text-base font-bold text-slate-300">{formatThaiDate(task.endDate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="space-y-8">
          <h3 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <History className="text-brand-primary" size={32} />
            ความเคลื่อนไหวล่าสุด
          </h3>
          <div className="bg-navy-surface p-8 rounded-2xl border border-border-navy shadow-sm space-y-6">
            {allActivities.length > 0 ? (
              allActivities.map((activity, idx) => (
                <div key={idx} className="flex gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-navy-base border border-border-navy flex items-center justify-center shrink-0 group-hover:bg-brand-primary/10 transition-colors">
                    <Activity size={22} className="text-slate-500 group-hover:text-brand-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-white leading-snug group-hover:text-brand-primary transition-colors">
                      {activity.description}
                    </p>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mt-1">
                      {activity.taskTitle}
                    </p>
                    <p className="text-xs font-bold text-slate-600 mt-0.5">
                      {formatThaiDate(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10">
                <History size={64} className="mx-auto text-slate-700 mb-4" />
                <p className="text-slate-500 font-black text-lg">ยังไม่มีความเคลื่อนไหว</p>
              </div>
            )}
            <button className="w-full py-5 text-base font-black uppercase tracking-wider text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 rounded-2xl transition-all active:scale-[0.98] mt-4">
              ดูความเคลื่อนไหวทั้งหมด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CircularGauge({ value }: { value: number }) {
  const radius = 200; // Increased size for high-impact visual
  const stroke = 32;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center group scale-100 sm:scale-125 xl:scale-140 transition-transform duration-1000">
      {/* 
          HIGH-TECH BACKGROUND EFFECTS 
      */}
      {/* Primary Pulse Glow */}
      <div className="absolute inset-4 bg-blue-600/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      
      {/* Decorative Rotating Tech Ring (Outer) */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute w-[420px] h-[420px] rounded-full border border-blue-500/40 border-dashed opacity-60 pointer-events-none"
      />

      {/* Static Tech Accents */}
      <div className="absolute w-[380px] h-[380px] rounded-full border-[1px] border-blue-400/30 pointer-events-none" />
      <div className="absolute w-[340px] h-[340px] rounded-full border-[1px] border-white/5 pointer-events-none" />
      
      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90 drop-shadow-[0_0_45px_rgba(59,130,246,0.5)]">
        {/* Background Track - Deep Navy */}
        <circle
          stroke="#0c111c"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        
        {/* Gradient Progress */}
        <motion.circle
          stroke="url(#highTechGradient)"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 2.5, ease: [0.16, 1, 0.3, 1] }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="relative z-10"
        />

        {/* Glow Layer (Inner) */}
        <circle
          stroke="#3b82f6"
          fill="transparent"
          strokeWidth={1.5}
          strokeDasharray={circumference + ' ' + circumference}
          strokeDashoffset={strokeDashoffset}
          r={normalizedRadius - stroke/2 - 2}
          cx={radius}
          cy={radius}
          className="opacity-70 blur-[1px]"
        />

        <defs>
          <linearGradient id="highTechGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="40%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          
          {/* Subtle glow filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
      </svg>
      
      {/* Center Digital Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-20">
        <div className="relative">
          {/* Text Glow */}
          <span className="text-6xl font-black text-white leading-none tracking-tighter drop-shadow-[0_2px_15px_rgba(0,0,0,0.5)] flex items-baseline gap-1">
            <span>{value}</span>
            <span className="text-[0.45em] font-black opacity-40 translate-y-[-0.15em] tracking-normal">%</span>
          </span>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute -inset-2 bg-blue-400/10 blur-xl rounded-full -z-10"
          />
        </div>
        <span className="text-2xl font-black text-white mt-1 uppercase tracking-tighter opacity-90">ครบถ้วน</span>
      </div>

      {/* Decorative corners for tech look */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-500/80 rounded-tl-xl shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-500/80 rounded-tr-xl shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-500/80 rounded-bl-xl shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-500/80 rounded-br-xl shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
    </div>
  );
}

function HorizontalProgress({ label, value, rawCount, color, glowColor }: { label: string, value: number, rawCount?: number | string, color: string, glowColor: string }) {
  return (
    <div className="space-y-4 group/item max-w-[180px] mx-auto">
      <div className="flex flex-col gap-1 items-start">
        {rawCount !== undefined && (
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-black text-white tracking-tighter drop-shadow-[0_4px_10px_rgba(255,255,255,0.1)] group-hover/item:scale-105 transition-transform origin-left duration-300">
              {rawCount}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <div className={cn("w-2 h-2 rounded-full", color.replace('bg-', 'bg-'), "shadow-[0_0_8px_currentColor]", color.replace('bg-', 'text-'))} />
          <span className="text-[12px] font-black text-white truncate tracking-normal drop-shadow-sm">{label}</span>
        </div>
      </div>
      
      {/* Pip-style indicators */}
      <div className="flex gap-1.5 mt-2">
        {[1, 2, 3, 4, 5, 6].map((i) => {
          const threshold = (i / 6) * 100;
          const isActive = value >= (threshold - 5); // Slight buffer
          return (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "h-2.5 w-4 rounded-[4px] transition-all duration-500",
                isActive 
                  ? cn(color, glowColor, "opacity-100 shadow-[0_0_12px_rgba(0,0,0,0.5)]") 
                  : "bg-white/5 shadow-inner"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function MiniStatCard({ label, title, trend = "+2.4%" }: { label: string, title: string, trend?: string }) {
  const gradId = React.useMemo(() => `grad-${title.toLowerCase().replace(/\s+/g, '-')}`, [title]);
  
  return (
    <div className="bg-[#0c0f1a]/80 border border-white/15 rounded-[2rem] p-7 hover:border-blue-500/50 transition-all group shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative overflow-hidden h-full flex flex-col backdrop-blur-md">
      <div className="relative z-10 w-full mb-6">
        <p className="text-[11px] font-black text-white/50 uppercase tracking-[0.25em] leading-none group-hover:text-blue-400 transition-colors whitespace-nowrap">
          {title}
        </p>
      </div>

      <div className="flex items-start justify-between flex-1">
        <div className="flex flex-col">
          <span className="text-6xl font-black text-white group-hover:text-white transition-colors tracking-tighter drop-shadow-[0_4px_15px_rgba(255,255,255,0.1)] flex items-baseline gap-1">
            {label.includes('%') ? (
              <>
                <span>{label.replace('%', '')}</span>
                <span className="text-[0.45em] font-black opacity-30 translate-y-[-0.2em] tracking-normal">%</span>
              </>
            ) : (
              <span>{label}</span>
            )}
          </span>
          <div className="flex items-center gap-1.5 mt-4">
            <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp size={10} className="text-emerald-400" />
            </div>
            <span className="text-[10px] font-black text-emerald-400 leading-none tracking-widest">{trend}</span>
          </div>
        </div>
        
        <div className="w-24 h-12 opacity-80 group-hover:opacity-100 transition-all transform group-hover:scale-110 translate-y-2">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={MINI_CHART_DATA}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#60a5fa" 
                strokeWidth={3} 
                fill={`url(#${gradId})`}
                dot={false} 
                isAnimationActive={true}
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* High-tech accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
      
      {/* Subtle background glow */}
      <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-blue-500/5 blur-3xl group-hover:bg-blue-400/10 transition-all rounded-full" />
    </div>
  );
}

function StatWidget({ label, value, icon, color, borderColor }: { label: string, value: number, icon: React.ReactNode, color: string, borderColor: string }) {
  return (
    <div className={cn("p-6 md:p-8 rounded-[2.5rem] border shadow-2xl shadow-black/40 flex flex-col items-center justify-center bg-[#0c0f1a]/80 backdrop-blur-xl hover:border-brand-primary transition-all group active:scale-[0.98] relative overflow-hidden", borderColor.replace('border-', 'border-white/10 hover:border-'))}>
      <div className="flex items-center gap-4 md:gap-8 mb-4 relative z-10 w-full justify-between px-2">
        <div className={cn("w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] flex items-center justify-center shrink-0 group-hover:scale-110 transition-all duration-500 shadow-xl border border-white/5", color)}>
          <div className="scale-[1.2] md:scale-[1.5] drop-shadow-lg">
            {icon}
          </div>
        </div>
        <p className="text-6xl md:text-7xl font-black text-white tracking-tighter leading-none drop-shadow-[0_4px_30px_rgba(255,255,255,0.1)]">{value}</p>
      </div>
      <div className="text-center relative z-10 w-full">
        <div className="h-px w-full bg-white/5 mb-4 opacity-50" />
        <p className="text-xs md:text-sm font-black text-white uppercase tracking-[0.25em] opacity-80 group-hover:opacity-100 transition-opacity">{label}</p>
      </div>
      
      {/* Gloss reflection */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className={cn("absolute bottom-0 left-0 right-0 h-1.5 opacity-60 bg-gradient-to-r from-transparent via-current to-transparent", color.replace('bg-', 'text-'))} />
    </div>
  );
}
