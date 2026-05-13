import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  LabelList,
  Sector
} from 'recharts';

// ... existing imports ...

// Helper component for Gauge Meter
function GaugeMeter({ value, color, label }: { value: number, color: string, label: string }) {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  const data = [
    { value: displayValue, fill: color },
    { value: 100 - displayValue, fill: 'rgba(255,255,255,0.05)' }
  ];

  // Rotate: 0% -> -90deg, 100% -> 90deg
  const needleAngle = (displayValue / 100) * 180 - 90;

  return (
    <div className="relative w-full h-32 flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <RechartsPieChart>
          <defs>
            <filter id={`glow-${label.replace(/\s+/g, '-')}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={65}
            outerRadius={85}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
            animationDuration={1500}
            style={{ filter: `url(#glow-${label.replace(/\s+/g, '-')})` }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
        </RechartsPieChart>
      </ResponsiveContainer>
      
      {/* Needle */}
      <div 
        className="absolute bottom-0 left-1/2 w-1.5 h-[80px] origin-bottom transition-all duration-[1500ms] cubic-bezier(0.34, 1.56, 0.64, 1) z-10"
        style={{ 
          transform: `translateX(-50%) rotate(${needleAngle}deg)`, 
          background: 'linear-gradient(to top, #ffffff, #e2e8f0)',
          clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
          filter: `drop-shadow(0 0 5px ${color})`
        }}
      />
      
      {/* Center Pin */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-navy-base z-20 translate-y-1/2 shadow-[0_0_15px_rgba(255,255,255,0.3)]" />

      {/* Label outside the meter */}
      <div className="absolute -bottom-6 flex flex-col items-center">
        <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">{label}</span>
      </div>
    </div>
  );
}
import { taskService } from '../services/taskService';
import { Task, TeamMember } from '../types';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileSpreadsheet,
  Zap,
  User,
  PieChart as PieChartIcon,
  Building2,
  TrendingUp,
  Activity,
  Sparkles,
  ShieldAlert,
  Coins,
  BarChart3,
  Target,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';

interface DashboardProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  userProfile?: TeamMember | null;
  onViewReports?: () => void;
}

type DashboardView = 'strategic' | 'operational' | 'financial-risk';

function getTrendIndicator(value: number, baseline: number = 50) {
  const diff = value - baseline;
  if (diff > 10) return { icon: '↑', color: 'text-green-400', label: `+${diff}pts` };
  if (diff < -10) return { icon: '↓', color: 'text-red-400', label: `${diff}pts` };
  return { icon: '→', color: 'text-yellow-400', label: 'คงที่' };
}

export function Dashboard({ tasks, teamMembers, userProfile, onViewReports }: DashboardProps) {
  const [activeView, setActiveView] = useState<DashboardView>('strategic');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'all'>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncStats = async () => {
    setIsSyncing(true);
    try {
      await taskService.recalculateStats();
    } catch (e) {
      console.error("Sync stats error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const isAdmin = userProfile?.role === 'Administrator';

  // Filter tasks based on dateRange
  const filteredTasks = React.useMemo(() => {
    if (dateRange === 'all') return tasks;
    const now = new Date();
    const cutoff = new Date();
    if (dateRange === 'week')    cutoff.setDate(now.getDate() - 7);
    if (dateRange === 'month')   cutoff.setMonth(now.getMonth() - 1);
    if (dateRange === 'quarter') cutoff.setMonth(now.getMonth() - 3);
    
    return tasks.filter(t => {
      if (!t.createdAt) return true;
      const createdDate = (t.createdAt as any).seconds 
        ? new Date((t.createdAt as any).seconds * 1000) 
        : new Date(t.createdAt as any);
      return createdDate >= cutoff;
    });
  }, [tasks, dateRange]);

  // KPI Metric Calculations
  const stats = React.useMemo(() => {
    const completedTasks = filteredTasks.filter(t => t.status === 'Completed');
    const totalTasks = filteredTasks.length;

    // Success Rate: % of completed tasks
    const successRate = totalTasks > 0
      ? Math.round((completedTasks.length / totalTasks) * 100)
      : 0;

    // KPI Score: average kpiScore of completed tasks (fallback to successRate)
    const kpiScore = completedTasks.length > 0
      ? Math.round(
          completedTasks.reduce((sum, t) => sum + (t.kpiScore ?? 100), 0) /
          completedTasks.length
        )
      : 0;

    // Quality Score: average qualityScore of completed tasks
    const qualityScore = completedTasks.length > 0
      ? Math.round(
          completedTasks.reduce((sum, t) => sum + (t.qualityScore ?? 90), 0) /
          completedTasks.length
        )
      : 0;

    // Workload: total active (non-completed) tasks
    const workload = filteredTasks.filter(t => t.status !== 'Completed').length;

    // Overdue tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueTasks = filteredTasks.filter(t =>
      t.status !== 'Completed' && t.endDate && new Date(t.endDate) < today
    ).length;

    return { completedTasks, totalTasks, successRate, kpiScore, qualityScore, workload, overdueTasks };
  }, [filteredTasks]);

  const { completedTasks, totalTasks, successRate, kpiScore, qualityScore, workload, overdueTasks } = stats;

  const statusCounts = React.useMemo(() => ({
    'Pending': filteredTasks.filter(t => t.status === 'Pending').length,
    'In Progress': filteredTasks.filter(t => t.status === 'In Progress').length,
    'Review': filteredTasks.filter(t => t.status === 'Review').length,
    'Completed': filteredTasks.filter(t => t.status === 'Completed').length,
    'On Hold': filteredTasks.filter(t => t.status === 'On Hold').length,
    'Overdue': overdueTasks,
  }), [filteredTasks, overdueTasks]);

  const pieData = React.useMemo(() => [
    { name: 'รอดำเนินการ', value: statusCounts['Pending'], color: '#f59e0b' },
    { name: 'กำลังดำเนินการ', value: statusCounts['In Progress'], color: '#3b82f6' },
    { name: 'รอตรวจสอบ', value: statusCounts['Review'], color: '#8b5cf6' },
    { name: 'เสร็จแล้ว', value: statusCounts['Completed'], color: '#22c55e' },
    { name: 'ระงับชั่วคราว', value: statusCounts['On Hold'], color: '#ef4444' },
    { name: 'เลยกำหนด', value: statusCounts['Overdue'], color: '#71717a' },
  ].filter(d => d.value > 0), [statusCounts]);

  const COLORS = React.useMemo(() => pieData.length > 0 ? pieData.map(d => d.color) : ['#3b82f6'], [pieData]);

  const projectData = React.useMemo(() => {
    // Change grouping from project to title (งาน/กิจกรรม/โครงการ)
    const projectNames = Array.from(new Set(filteredTasks.map(t => t.title || 'ไม่ระบุชื่อภารกิจ')));
    const data = projectNames.map(projectName => {
      const projectTasks = filteredTasks.filter(t => (t.title || 'ไม่ระบุชื่อภารกิจ') === projectName);
      
      // Accuracy Fix: Only average scores for tasks that actually HAVE scores
      const kpiTasks = projectTasks.filter(t => t.kpiScore !== undefined && typeof t.kpiScore === 'number');
      const qualityTasks = projectTasks.filter(t => t.qualityScore !== undefined && typeof t.qualityScore === 'number');
      
      const avgKpi = kpiTasks.length > 0 
        ? Math.round(kpiTasks.reduce((sum, t) => sum + (t.kpiScore || 0), 0) / kpiTasks.length) 
        : 0;
        
      const avgQuality = qualityTasks.length > 0 
        ? Math.round(qualityTasks.reduce((sum, t) => sum + (t.qualityScore || 0), 0) / qualityTasks.length) 
        : 0;

      return {
        name: projectName,
        count: projectTasks.length,
        kpi: avgKpi,
        quality: avgQuality
      };
    });
    // Sort by count or name to make it consistent
    return data.sort((a, b) => b.count - a.count);
  }, [filteredTasks]);

  const chartData = React.useMemo(() => {
    return projectData.map(p => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + '…' : p.name,
      fullName: p.name,
      kpi: p.kpi / 100,
      quality: p.quality / 100,
      count: p.count,
    }));
  }, [projectData]);

  // Workload Heatmap Data
  const workloadData = React.useMemo(() => teamMembers.map(member => {
    const activeTasks = filteredTasks.filter(t => 
      (t.assigneeId === member.id || (t.assigneeIds && t.assigneeIds.includes(member.id))) && 
      t.status !== 'Completed'
    ).length;
    const completedTasks = filteredTasks.filter(t => 
      (t.assigneeId === member.id || (t.assigneeIds && t.assigneeIds.includes(member.id))) && 
      t.status === 'Completed'
    ).length;
    return {
      name: member.name,
      active: activeTasks,
      completed: completedTasks,
      total: activeTasks + completedTasks
    };
  }).sort((a, b) => b.active - a.active).slice(0, 10), [teamMembers, filteredTasks]);

  const financialStats = React.useMemo(() => {
    const totalBudget = filteredTasks.reduce((sum, t) => {
      const val = Number(t.budget);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
    const totalActualCost = filteredTasks.reduce((sum, t) => {
      const val = Number(t.actualCost);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
    const budgetUtilization = totalBudget > 0 ? Math.round((totalActualCost / totalBudget) * 100) : 0;
    
    const highRiskTasks = filteredTasks.filter(t => (t.delayProbability || 0) > 70).length;

    const financialData = [
      { name: 'Budget', amount: totalBudget },
      { name: 'Actual Cost', amount: totalActualCost }
    ];

    return { totalBudget, totalActualCost, budgetUtilization, highRiskTasks, financialData };
  }, [filteredTasks]);

  const { totalBudget, totalActualCost, budgetUtilization, highRiskTasks, financialData } = financialStats;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight">Dashboard วิเคราะห์ผลการปฏิบัติงาน</h2>
          <p className="text-slate-500 font-medium mt-1">Strategic Insights & Performance Metrics</p>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <button
              onClick={handleSyncStats}
              disabled={isSyncing}
              title="คำนวณสถิติใหม่ (Sync Stats)"
              className="flex items-center gap-2 p-3 bg-navy-surface border border-border-navy text-slate-400 rounded-2xl hover:text-white hover:border-brand-primary/50 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
            </button>
          )}
          {onViewReports && (
            <button
              onClick={onViewReports}
              className="flex items-center gap-3 px-6 py-3 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-bold rounded-2xl hover:bg-brand-primary/20 transition-all active:scale-95 shadow-lg shadow-brand-primary/5 text-sm"
            >
              <FileSpreadsheet size={18} />
              รายงานละเอียด
            </button>
          )}
        </div>
      </header>

      {/* Executive Report Categories Navigation */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-navy-elevated border border-border-navy rounded-[2rem] w-fit shadow-inner">
        <button 
          onClick={() => setActiveView('strategic')}
          className={cn(
            "flex items-center gap-3 px-6 py-3.5 rounded-[1.5rem] text-sm font-bold transition-all duration-300",
            activeView === 'strategic' 
              ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
              : "text-slate-500 hover:text-white hover:bg-navy-base/50"
          )}
        >
          <Target size={18} />
          ภาพรวมเชิงกลยุทธ์
        </button>
        <button 
          onClick={() => setActiveView('operational')}
          className={cn(
            "flex items-center gap-3 px-6 py-3.5 rounded-[1.5rem] text-sm font-bold transition-all duration-300",
            activeView === 'operational' 
              ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
              : "text-slate-500 hover:text-white hover:bg-navy-base/50"
          )}
        >
          <BarChart3 size={18} />
          ประสิทธิภาพการดำเนินงาน
        </button>
        <button 
          onClick={() => setActiveView('financial-risk')}
          className={cn(
            "flex items-center gap-3 px-6 py-3.5 rounded-[1.5rem] text-sm font-bold transition-all duration-300",
            activeView === 'financial-risk' 
              ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
              : "text-slate-500 hover:text-white hover:bg-navy-base/50"
          )}
        >
          <ShieldAlert size={18} />
          งบประมาณและความเสี่ยง
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 font-bold">ช่วงเวลา:</span>
          {(['week', 'month', 'quarter', 'all'] as const).map(range => {
            const labels = { week: 'สัปดาห์นี้', month: 'เดือนนี้', quarter: 'ไตรมาสนี้', all: 'ทั้งหมด' };
            return (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
                  dateRange === range
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-navy-surface text-slate-400 hover:text-white border border-border-navy'
                }`}
              >
                {labels[range]}
              </button>
            );
          })}
        </div>

        {/* Overdue Alert Banner */}
        {overdueTasks > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 bg-red-500/10 border border-red-500/30 
            rounded-2xl animate-in fade-in duration-500">
            <span className="text-red-400 text-lg">⚠</span>
            <div className="flex-1">
              <p className="text-sm font-black text-red-300">
                มีงานเกินกำหนด {overdueTasks} รายการ
              </p>
              <p className="text-xs text-red-400/70">กรุณาตรวจสอบและดำเนินการโดยด่วน</p>
            </div>
            {onViewReports && (
              <button
                onClick={() => onViewReports()}
                className="text-xs font-black text-red-300 hover:text-white border border-red-500/40 
                  px-3 py-1 rounded-lg hover:bg-red-500/20 transition-all"
              >
                ดูรายละเอียด →
              </button>
            )}
          </div>
        )}
      </div>

      {activeView === 'strategic' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              label="อัตราสำเร็จ (Success Rate)" 
              value={`${successRate}%`} 
              icon={<CheckCircle2 className="text-[#00ffcc]" size={28} />} 
              color="bg-[#00ffcc]/10 border-[#00ffcc]/20"
              trendIndicator={(() => {
                const trend = getTrendIndicator(successRate, 65);
                return (
                  <span className={`text-sm font-black ${trend.color} flex items-center gap-1`}>
                    {trend.icon} {trend.label}
                  </span>
                );
              })()}
            >
              <div className="mt-6">
                <GaugeMeter value={successRate} color="#00ffcc" label="ความสำเร็จ" />
              </div>
            </StatCard>
            <StatCard 
              label="KPI Score เฉลี่ย" 
              value={`${kpiScore}%`} 
              icon={<Activity className="text-[#00d4ff]" size={28} />} 
              color="bg-[#00d4ff]/10 border-[#00d4ff]/20"
              trend="Performance Index"
              trendIndicator={(() => {
                const trend = getTrendIndicator(kpiScore);
                return (
                  <span className={`text-sm font-black ${trend.color} flex items-center gap-1`}>
                    {trend.icon} {trend.label}
                  </span>
                );
              })()}
            >
              <div className="mt-6">
                <GaugeMeter value={kpiScore} color="#00d4ff" label="KPI SCORE" />
              </div>
            </StatCard>
            <StatCard 
              label="Quality Score เฉลี่ย" 
              value={`${qualityScore}%`} 
              icon={<Sparkles className="text-[#ff00ff]" size={28} />} 
              color="bg-[#ff00ff]/10 border-[#ff00ff]/20"
              trend="Quality Index"
              trendIndicator={(() => {
                const trend = getTrendIndicator(qualityScore, 85);
                return (
                  <span className={`text-sm font-black ${trend.color} flex items-center gap-1`}>
                    {trend.icon} {trend.label}
                  </span>
                );
              })()}
            >
              <div className="mt-6">
                <GaugeMeter value={qualityScore} color="#ff00ff" label="QUALITY" />
              </div>
            </StatCard>
            <StatCard 
              label="จำนวนงานทั้งหมด" 
              value={totalTasks} 
              icon={<Zap className="text-amber-400" size={28} />} 
              color="bg-amber-500/10 border-amber-500/20"
              trend="All Tasks Summary"
            >
              <div className="space-y-6 mt-6">
                {[
                  { label: 'In Progress', count: statusCounts['In Progress'], color: 'bg-blue-500', barColor: 'from-blue-600 to-blue-400' },
                  { label: 'Completed', count: statusCounts['Completed'], color: 'bg-green-500', barColor: 'from-green-600 to-green-400' },
                ].map(s => (
                  <div key={s.label} className="group/item">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] animate-pulse", s.color.replace('bg-', 'bg-'))} />
                        <span className="text-sm font-black text-slate-400 group-hover/item:text-white transition-colors">{s.label}</span>
                      </div>
                      <span className="text-xl font-black text-white group-hover:scale-110 transition-transform">{s.count}</span>
                    </div>
                    {/* Mini Sparkline-style Bar Graph */}
                    <div className="relative h-4 bg-white/5 rounded-full overflow-hidden p-[1px] border border-white/5 shadow-inner">
                      <motion.div 
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: `${(s.count / Math.max(1, totalTasks)) * 100}%`, opacity: 1 }}
                        transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                        className={cn("h-full rounded-full bg-gradient-to-r relative", s.barColor)}
                      >
                        {/* Glow effect on the bar */}
                        <div className="absolute inset-x-0 bottom-0 h-[100%] bg-white/20 blur-[2px] opacity-0 group-hover/item:opacity-100 transition-opacity" />
                      </motion.div>
                    </div>
                  </div>
                ))}
                
                {overdueTasks > 0 && (
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-rose-500 animate-bounce" />
                        <span className="text-xs font-black text-rose-500 uppercase tracking-widest">Overdue Alert</span>
                      </div>
                      <span className="text-sm font-black text-rose-400">{overdueTasks}</span>
                    </div>
                  </div>
                )}
              </div>
            </StatCard>
          </div>

          {/* Project Analytics */}
          <div className="bg-navy-surface p-10 rounded-[3rem] border border-border-navy shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">ผลการวิเคราะห์รายภารกิจ/โครงการ</h3>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">เปรียบเทียบ KPI และ Quality Score แยกตามงาน/กิจกรรม/โครงการ</p>
              </div>
            </div>
              <div className="h-[400px] min-h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                  <BarChart data={chartData} margin={{ bottom: 40, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600, angle: -30, textAnchor: 'end' }} 
                    height={60}
                    interval={0}
                  />
                  <YAxis 
                    yAxisId="left"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#f1f5f9',
                    }}
                    labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                    cursor={{ fill: 'rgba(99,102,241,0.1)' }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0) {
                        return payload[0].payload.fullName || label;
                      }
                      return label;
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === "จำนวนงาน") return [value, name];
                      return [`${Math.round(value * 100)}%`, name];
                    }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8' }} />
                  <Bar yAxisId="right" dataKey="count" name="จำนวนงาน" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={25} />
                  <Bar yAxisId="left" dataKey="kpi" name="KPI Score (%)" fill="#10b981" radius={[8, 8, 0, 0]} barSize={25} />
                  <Bar yAxisId="left" dataKey="quality" name="Quality Score (%)" fill="#ff00ff" radius={[8, 8, 0, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
              {chartData.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-navy-surface/50 backdrop-blur-sm">
                  <p className="text-slate-400 font-bold">ไม่พบข้อมูลงาน/กิจกรรมในช่วงเวลาที่เลือก</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeView === 'operational' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Task Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* In Progress vs Completed Comparison */}
            <div className="col-span-full bg-navy-surface p-12 rounded-[3.5rem] border border-border-navy shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6 relative z-10">
                <div>
                  <h3 className="text-3xl font-black text-white tracking-tight flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20">
                      <Activity size={24} />
                    </div>
                    การเปรียบเทียบการดำเนินงาน
                  </h3>
                  <p className="text-slate-400 font-bold mt-2">สัดส่วนระหว่างงานที่กำลังดำเนินการ (In Progress) และงานที่เสร็จสิ้น (Completed)</p>
                </div>
                <div className="flex items-center gap-8 bg-navy-base/50 p-6 rounded-3xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                    <span className="text-sm font-black text-slate-300">In Progress</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                    <span className="text-sm font-black text-slate-300">Completed</span>
                  </div>
                </div>
              </div>

              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'กำลังดำเนินการ', value: statusCounts['In Progress'], color: '#3b82f6' },
                      { name: 'เสร็จสิ้นแล้ว', value: statusCounts['Completed'], color: '#10b981' }
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    barGap={40}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 14, fontWeight: 800 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 13, fontWeight: 800 }} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-navy-elevated/95 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl">
                              <p className="text-slate-400 font-black text-xs uppercase tracking-widest mb-3">{payload[0].payload.name}</p>
                              <p className="text-4xl font-black text-white flex items-baseline gap-2">
                                {payload[0].value}
                                <span className="text-lg text-slate-500">งาน</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[12, 12, 4, 4]} 
                      barSize={120}
                    >
                      { [0, 1].map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#10b981'} />
                      ))}
                      <LabelList 
                        dataKey="value" 
                        position="top" 
                        fill="#fff" 
                        fontSize={18} 
                        fontWeight={900} 
                        offset={15}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <StatusCard label="รอดำเนินการ" value={statusCounts['Pending']} color="bg-amber-500/10 border-amber-500/20 text-amber-400" />
            <StatusCard label="กำลังดำเนินการ" value={statusCounts['In Progress']} color="bg-blue-500/10 border-blue-500/20 text-blue-400" />
            <StatusCard label="รอตรวจสอบ" value={statusCounts['Review']} color="bg-purple-500/10 border-purple-500/20 text-purple-400" />
            <StatusCard label="เสร็จแล้ว" value={statusCounts['Completed']} color="bg-emerald-500/10 border-emerald-500/20 text-emerald-400" />
            <StatusCard label="ระงับชั่วคราว" value={statusCounts['On Hold']} color="bg-rose-500/10 border-rose-500/20 text-rose-400" />
            <StatusCard label="เลยกำหนด" value={statusCounts['Overdue']} color="bg-gray-500/10 border-gray-500/20 text-gray-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Status Distribution */}
            <div className="bg-navy-surface p-10 rounded-[3rem] border border-border-navy shadow-2xl shadow-black/50 relative overflow-hidden">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Status Distribution</h3>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">สัดส่วนสถานะงานทั้งหมด</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <PieChartIcon size={20} />
                </div>
              </div>

              <div className="h-[320px] min-h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                  <RechartsPieChart>
                    <Pie 
                      data={pieData.length > 0 ? pieData : [{ name: 'ไม่มีข้อมูล', value: 1, color: '#334155' }]} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={80} 
                      outerRadius={120} 
                      paddingAngle={5} 
                      dataKey="value" 
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '20px', color: '#fff' }} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-10">
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-3 p-4 bg-navy-base/30 rounded-2xl border border-border-navy">
                    <div className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ backgroundColor: COLORS[i] }} />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">{item.name}</p>
                      <p className="text-xl font-black text-white">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Workload Heatmap */}
            <div className="bg-navy-surface p-10 rounded-[3rem] border border-border-navy shadow-2xl shadow-black/50 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Team Workload Heatmap</h3>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">ภาระงานรายบุคคล (งานที่ยังไม่เสร็จ)</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary border border-brand-primary/20">
                  <User size={20} />
                </div>
              </div>
              <div className="h-[400px] min-h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                  <BarChart data={workloadData} layout="vertical" margin={{ left: 40, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 14, fill: '#ffffff', fontWeight: 'bold' }} width={120} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        border: '1px solid #1e293b', 
                        borderRadius: '16px', 
                        color: '#fff',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }} 
                      itemStyle={{ fontWeight: 'bold' }}
                      formatter={(value: any, name: string) => {
                        if (name === "active") return [value, "งานที่กำลังทำ"];
                        if (name === "completed") return [value, "งานที่เสร็จสิ้น"];
                        return [value, name];
                      }}
                    />
                    <Bar dataKey="active" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={24} name="active">
                      <LabelList
                        dataKey="active"
                        position="right"
                        style={{ fill: '#ffffff', fontSize: 13, fontWeight: 900 }}
                        formatter={(v: number) => v > 0 ? v : ''}
                      />
                    </Bar>
                    <Bar dataKey="completed" fill="#10b981" radius={[0, 10, 10, 0]} barSize={24} name="completed" hide />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'financial-risk' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Financial & Risk Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              label="งบประมาณรวม" 
              value={`฿${totalBudget.toLocaleString()}`} 
              icon={<Coins className="text-blue-400" size={28} />} 
              color="bg-blue-500/10 border-blue-500/20"
              trend={`Utilization: ${budgetUtilization}%`}
            />
            <StatCard 
              label="ค่าใช้จ่ายจริง" 
              value={`฿${totalActualCost.toLocaleString()}`} 
              icon={<TrendingUp className="text-rose-400" size={28} />} 
              color="bg-rose-500/10 border-rose-500/20"
              trend={totalActualCost > totalBudget ? "เกินงบประมาณ" : "อยู่ในงบประมาณ"}
            />
            <StatCard 
              label="งานความเสี่ยงสูง" 
              value={highRiskTasks} 
              icon={<AlertCircle className="text-amber-400" size={28} />} 
              color="bg-amber-500/10 border-amber-500/20"
              trend="Delay Prob > 70%"
            />
            <StatCard 
              label="งานเลยกำหนด" 
              value={overdueTasks} 
              icon={<Clock className="text-rose-400" size={28} />} 
              color="bg-rose-500/10 border-rose-500/20"
              trend="Overdue Tasks"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Financial Analytics */}
            <div className="bg-navy-surface p-10 rounded-[3rem] border border-border-navy shadow-2xl shadow-black/50 relative overflow-hidden">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">วิเคราะห์ด้านการเงิน</h3>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">งบประมาณเทียบกับค่าใช้จ่ายจริง</p>
                </div>
              </div>
              <div className="h-[350px] min-h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                  <BarChart data={financialData} margin={{ top: 20, right: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} tickFormatter={(v) => v === 'Budget' ? 'งบประมาณ' : 'ค่าใช้จ่ายจริง'} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                      formatter={(value: number) => [`฿${value.toLocaleString()}`, 'จำนวนเงิน']}
                    />
                    <Bar dataKey="amount" radius={[10, 10, 0, 0]} barSize={60}>
                      {financialData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : (totalActualCost > totalBudget ? '#ef4444' : '#22c55e')} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Risk Analysis */}
            <div className="bg-navy-surface p-10 rounded-[3rem] border border-border-navy shadow-2xl shadow-black/50 relative overflow-hidden">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">วิเคราะห์ความเสี่ยงรายภารกิจ</h3>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">สัดส่วนงานที่มีความเสี่ยงสูงแยกตามกิจกรรม</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                  <ShieldAlert size={20} />
                </div>
              </div>
              <div className="space-y-6">
                {projectData.map((project, idx) => {
                  const riskTasks = filteredTasks.filter(t => (t.title || 'ไม่ระบุชื่อภารกิจ') === project.name && (t.delayProbability || 0) > 50).length;
                  const riskPercent = project.count > 0 ? Math.round((riskTasks / project.count) * 100) : 0;
                  
                  return (
                    <div key={project.name} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-200">{project.name}</span>
                        <span className={cn("text-xs font-bold", riskPercent > 50 ? "text-rose-400" : "text-amber-400")}>
                          {riskPercent}% ความเสี่ยง
                        </span>
                      </div>
                      <div className="h-4 bg-navy-base rounded-full overflow-hidden p-1 shadow-inner">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-1000 bg-gradient-to-r", riskPercent > 50 ? "from-rose-600 to-rose-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "from-amber-600 to-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]")} 
                          style={{ width: `${riskPercent}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className={cn("p-10 rounded-[3rem] border border-white/10 flex flex-col items-center justify-center gap-6 transition-all hover:scale-105 shadow-2xl bg-navy-surface/50 backdrop-blur-xl relative overflow-hidden group", color.replace('bg-', 'text-'))}>
      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 group-hover:text-current transition-colors leading-none">{label}</p>
      <p className="text-8xl font-black tracking-tighter drop-shadow-[0_4px_30px_rgba(255,255,255,0.1)] text-white group-hover:scale-110 transition-transform leading-none">{value}</p>
      <div className={cn("absolute bottom-0 left-0 right-0 h-1.5 opacity-30", color)} />
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon, 
  color, 
  trend, 
  children, 
  trendIndicator 
}: { 
  label: string, 
  value: string | number, 
  icon: React.ReactNode, 
  color: string, 
  trend?: string,
  children?: React.ReactNode,
  trendIndicator?: React.ReactNode
}) {
  return (
    <div className="bg-[#0c0f1a]/80 backdrop-blur-xl p-10 rounded-[3rem] border border-white/15 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] flex flex-col gap-8 hover:border-brand-primary/50 transition-all group relative overflow-hidden">
      <div className="flex items-center justify-between relative z-10 w-full mb-2">
        <div className={cn("w-20 h-20 rounded-[2rem] flex items-center justify-center border shadow-xl transition-all group-hover:scale-110 group-hover:-rotate-3 duration-500", color)}>
          <div className="scale-125 drop-shadow-lg">
            {icon}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          {trendIndicator}
          {trend && (
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-navy-base/80 px-4 py-2 rounded-full border border-white/5 shadow-inner">
              {trend}
            </span>
          )}
        </div>
      </div>
      <div className="relative z-10 flex flex-col items-center xl:items-start">
        <p className="text-sm text-slate-500 font-black uppercase tracking-[0.3em] mb-4 text-center xl:text-left">{label}</p>
        <div className="text-8xl font-black text-white tracking-tighter drop-shadow-[0_4px_30px_rgba(255,255,255,0.15)] leading-none mb-6 flex items-baseline justify-center xl:justify-start gap-2 group-hover:scale-105 transition-transform duration-700">
          {String(value).includes('%') ? (
            <>
              <span>{String(value).replace('%', '')}</span>
              <span className="text-[0.45em] font-black opacity-30 translate-y-[-0.15em] tracking-normal">%</span>
            </>
          ) : (
            <span>{value}</span>
          )}
        </div>
        <div className="w-full">
          {children}
        </div>
      </div>
      
      {/* Decorative accent lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-brand-primary/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
      
      {/* Decorative background glow */}
      <div className={cn("absolute -bottom-20 -right-20 w-48 h-48 blur-[80px] opacity-10 rounded-full transition-all duration-700 group-hover:opacity-30", color.split(' ')[0])} />
    </div>
  );
}

