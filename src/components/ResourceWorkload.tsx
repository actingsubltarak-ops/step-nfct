import React, { useMemo, useState } from 'react';
import { Task, TeamMember } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { Users, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import { cn } from '../lib/utils';

interface ResourceWorkloadProps {
  tasks: Task[];
  teamMembers: TeamMember[];
}

function getWorkloadLevel(activeTasks: number): {
  label: string; color: string; bg: string;
} {
  if (activeTasks === 0) return { label: 'ว่าง',        color: 'text-slate-400',  bg: 'bg-slate-500/10'  };
  if (activeTasks <= 2)  return { label: 'ปกติ',        color: 'text-green-400',  bg: 'bg-green-500/10'  };
  if (activeTasks <= 4)  return { label: 'หนัก',        color: 'text-orange-400', bg: 'bg-orange-500/10' };
  return                         { label: 'หนักมาก ⚠', color: 'text-red-400',    bg: 'bg-red-500/10'    };
}

export function ResourceWorkload({ tasks, teamMembers }: ResourceWorkloadProps) {
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  type SortKey = 'name' | 'total' | 'active' | 'completed' | 'workload';
  const [sortKey, setSortKey] = useState<SortKey>('workload');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  // Helper to get tasks for a member
  const getMemberTasks = (memberId: string) => {
    return tasks.filter(t => t.assigneeId === memberId || (t.assigneeIds && t.assigneeIds.includes(memberId)));
  };

  // Compute summary stats
  const membersWithTasks = teamMembers.filter(m => {
    const memberTasks = getMemberTasks(m.id);
    return memberTasks.length > 0;
  });

  const overloadedMembers = teamMembers.filter(m => {
    const active = getMemberTasks(m.id).filter(t =>
      t.status !== 'Completed'
    ).length;
    return active >= 3; // threshold: 3+ active tasks = overloaded
  });

  const idleMembers = teamMembers.filter(m => {
    return getMemberTasks(m.id).filter(t =>
      t.status !== 'Completed'
    ).length === 0;
  });

  const chartData = useMemo(() => {
    return teamMembers
      .map(member => {
        const memberTasks = getMemberTasks(member.id);
        const activeTasks = memberTasks.filter(t => t.status !== 'Completed').length;
        const completedTasks = memberTasks.filter(t => t.status === 'Completed').length;
        return {
          name: member.name.split(' ')[0], // First name only for readability
          fullName: member.name,
          active: activeTasks,
          completed: completedTasks,
          total: memberTasks.length,
        };
      })
      .filter(d => d.total > 0) // Only show members with tasks
      .sort((a, b) => b.active - a.active); // Sort by active tasks descending
  }, [tasks, teamMembers]);

  const displayedMembers = useMemo(() => {
    return showActiveOnly
      ? teamMembers.filter(m => tasks.some(t => t.assigneeId === m.id || (t.assigneeIds && t.assigneeIds.includes(m.id))))
      : teamMembers;
  }, [showActiveOnly, teamMembers, tasks]);

  const sortedMembers = useMemo(() => {
    return [...displayedMembers].sort((a, b) => {
      const getVal = (m: TeamMember) => {
        const mt = getMemberTasks(m.id);
        if (sortKey === 'name')      return m.name;
        if (sortKey === 'total')     return mt.length;
        if (sortKey === 'active')    return mt.filter(t => t.status !== 'Completed').length;
        if (sortKey === 'completed') return mt.filter(t => t.status === 'Completed').length;
        if (sortKey === 'workload')  return mt.filter(t => t.status !== 'Completed').length;
        return 0;
      };
      const aVal = getVal(a), bVal = getVal(b);
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal as string)
                                           : (aVal as number) - (bVal as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [displayedMembers, tasks, sortKey, sortDir]);

  const alertMembers = teamMembers.filter(m => {
    const active = getMemberTasks(m.id).filter(
      t => t.status !== 'Completed'
    ).length;
    return active >= 3;
  });

  const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="mb-8">
        <h2 className="text-4xl font-black text-white tracking-tight">Resource Workload Analysis</h2>
        <p className="text-slate-400 text-lg font-bold mt-1">วิเคราะห์ภาระงานและความพร้อมของบุคลากรรายบุคคล</p>
      </header>

      {/* Summary Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'บุคลากรทั้งหมด',   value: teamMembers.length,       color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
          { label: 'มีงานดำเนินการ',   value: membersWithTasks.length,  color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
          { label: 'ภาระงานหนัก (3+)', value: overloadedMembers.length, color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
          { label: 'ไม่มีงานที่รับมอบ', value: idleMembers.length,       color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20'  },
        ].map(stat => (
          <div key={stat.label}
            className={`${stat.bg} border ${stat.border} rounded-2xl px-5 py-4 space-y-1`}>
            <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-sm text-slate-400 font-bold">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Workload Chart */}
        <div className="lg:col-span-2 bg-navy-surface p-10 rounded-[3rem] border border-border-navy shadow-xl shadow-navy-base/50">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-2xl font-black text-white tracking-tight">ภาระงานรายบุคคล (งานที่กำลังดำเนินการ)</h3>
            <div className="flex items-center gap-3 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
              <Clock size={16} />
              Active Tasks
            </div>
          </div>
          <div className="h-auto min-h-[120px]">
            <ResponsiveContainer width="100%" height={Math.max(120, chartData.length * 48)} minWidth={0} minHeight={0} debounce={50}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 60 }}>
                <defs>
                  <linearGradient id="barGradientBlue" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="barGradientOrange" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="barGradientRed" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border-navy)" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 14, fill: '#ffffff', fontWeight: 'bold' }}
                  width={140}
                />
                <Tooltip 
                  cursor={{ fill: 'var(--navy-elevated)', opacity: 1 }}
                  contentStyle={{ backgroundColor: 'var(--navy-surface)', border: '2px solid var(--border-navy)', borderRadius: '24px', color: '#fff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#3b82f6', fontSize: '14px', fontWeight: '900' }}
                />
                <Bar 
                  dataKey="active" 
                  name="งานที่กำลังดำเนินการ" 
                  radius={[0, 18, 18, 0]} 
                  barSize={40}
                  animationDuration={2500}
                  animationEasing="ease-in-out"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        entry.active >= 5 ? 'url(#barGradientRed)' : 
                        entry.active >= 3 ? 'url(#barGradientOrange)' : 
                        entry.active >= 1 ? 'url(#barGradientBlue)' : 
                        '#374151'
                      } 
                    />
                  ))}
                  <LabelList
                    dataKey="active"
                    position="right"
                    style={{ fill: '#ffffff', fontSize: 16, fontWeight: 900 }}
                    formatter={(v: number) => v > 0 ? v : ''}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* High Workload Alerts */}
        <div className="bg-navy-surface p-10 rounded-[3rem] border border-border-navy shadow-xl shadow-navy-base/50 flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <AlertTriangle className="text-amber-500" size={28} />
            <h3 className="text-2xl font-black text-white tracking-tight">Workload Alerts</h3>
            {alertMembers.length > 0 && (
              <span className="ml-auto bg-red-500/20 text-red-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-red-500/30">
                {alertMembers.length} คน
              </span>
            )}
          </div>

          <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {alertMembers.length === 0 ? (
              // Compact empty state
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-10">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center text-emerald-500 shadow-inner">
                  <CheckCircle2 size={40} />
                </div>
                <p className="text-sm text-slate-600 font-black uppercase tracking-widest">ภาระงานสมดุล ไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              // Alert cards for overloaded members
              <div className="space-y-4">
                {alertMembers.map(m => {
                  const active = getMemberTasks(m.id).filter(
                    t => t.status !== 'Completed'
                  ).length;
                  return (
                    <div key={m.id}
                      className="p-6 bg-red-500/5 border-2 border-red-500/20 rounded-[2rem] space-y-4 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-lg font-black text-white tracking-tight">{m.name}</p>
                          <p className="text-[10px] text-red-400 font-black uppercase tracking-[0.2em] mt-0.5">{m.role}</p>
                        </div>
                        <span className="px-3 py-1 bg-red-500 text-white text-[9px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-red-500/20">
                          High Load
                        </span>
                      </div>
                      <div className="pt-4 border-t border-red-500/10">
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Active Tasks</p>
                        <p className="text-2xl font-black text-white font-mono">{active}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-navy-surface rounded-[3rem] border border-border-navy shadow-xl shadow-navy-base/50 overflow-hidden">
        <div className="p-10 border-b border-border-navy bg-navy-base/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-4">
              <Users size={28} className="text-brand-primary" />
              สรุปภาระงานบุคลากร
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-slate-400 font-bold">แสดงเฉพาะผู้มีงาน</span>
              <div
                onClick={() => setShowActiveOnly(prev => !prev)}
                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                  showActiveOnly ? 'bg-blue-600' : 'bg-slate-700'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  showActiveOnly ? 'left-5' : 'left-0.5'
                }`} />
              </div>
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-navy-base/50">
                <th 
                  onClick={() => handleSort('name')}
                  className="p-8 text-xs font-black text-slate-300 uppercase tracking-[0.2em] border-b border-border-navy cursor-pointer hover:text-white select-none"
                >
                  Team Member {sortKey === 'name' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                </th>
                <th 
                  onClick={() => handleSort('total')}
                  className="p-8 text-xs font-black text-slate-300 uppercase tracking-[0.2em] border-b border-border-navy cursor-pointer hover:text-white select-none"
                >
                  Total Tasks {sortKey === 'total' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                </th>
                <th 
                  onClick={() => handleSort('active')}
                  className="p-8 text-xs font-black text-slate-300 uppercase tracking-[0.2em] border-b border-border-navy cursor-pointer hover:text-white select-none"
                >
                  In Progress {sortKey === 'active' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                </th>
                <th 
                  onClick={() => handleSort('completed')}
                  className="p-8 text-xs font-black text-slate-300 uppercase tracking-[0.2em] border-b border-border-navy cursor-pointer hover:text-white select-none"
                >
                  Completed {sortKey === 'completed' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                </th>
                <th 
                  onClick={() => handleSort('workload')}
                  className="p-8 text-xs font-black text-slate-300 uppercase tracking-[0.2em] border-b border-border-navy cursor-pointer hover:text-white select-none"
                >
                  Workload Level {sortKey === 'workload' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-navy">
              {sortedMembers.map((member) => {
                const memberTasks = getMemberTasks(member.id);
                const activeTasks = memberTasks.filter(t => t.status !== 'Completed').length;
                const completedTasks = memberTasks.filter(t => t.status === 'Completed').length;
                const level = getWorkloadLevel(activeTasks);

                return (
                  <tr key={member.id || member.name} className="hover:bg-navy-elevated transition-colors group">
                    <td className="p-8">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-navy-base border border-border-navy flex items-center justify-center text-brand-primary font-black group-hover:scale-110 transition-transform shadow-inner">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-base font-black text-white tracking-tight">{member.name}</p>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-0.5">{member.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-8 text-2xl font-black text-white font-mono">{memberTasks.length}</td>
                    <td className="p-8">
                      <span className="w-12 h-12 flex items-center justify-center bg-blue-500/10 text-blue-400 text-xl font-black rounded-2xl border border-blue-500/20 uppercase tracking-widest shadow-sm">
                        {activeTasks}
                      </span>
                    </td>
                    <td className="p-8">
                      <span className="w-12 h-12 flex items-center justify-center bg-emerald-500/10 text-emerald-400 text-xl font-black rounded-2xl border border-emerald-500/20 uppercase tracking-widest shadow-sm">
                        {completedTasks}
                      </span>
                    </td>
                    <td className="p-8">
                      <div className="flex items-center gap-3">
                        {/* Progress bar */}
                        <div className="flex-1 h-1.5 bg-navy-base rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-1000 shadow-sm",
                              activeTasks >= 5 ? 'bg-red-500' :
                              activeTasks >= 3 ? 'bg-orange-500' :
                              activeTasks >= 1 ? 'bg-blue-500' : 'bg-slate-700'
                            )}
                            style={{ width: `${Math.min((activeTasks / 5) * 100, 100)}%` }}
                          />
                        </div>
                        {/* Numeric label */}
                        <span className="text-lg font-black text-white w-8 text-right flex-shrink-0">
                          {activeTasks}
                        </span>
                        {/* Level badge */}
                        <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap", level.bg, level.color)}>
                          {level.label}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
