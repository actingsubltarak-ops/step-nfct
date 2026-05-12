import React, { useMemo, useState, useRef } from 'react';
import { Task } from '../types';
import { 
  format, 
  addDays, 
  startOfToday, 
  differenceInDays, 
  parseISO, 
  isValid, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachYearOfInterval,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from 'date-fns';
import { th } from 'date-fns/locale';
import { formatThaiDate, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Target } from 'lucide-react';

interface GanttChartProps {
  tasks: Task[];
  teamMembers: any[];
  updateTask?: (taskId: string, updatedData: any, existingTask?: any) => Promise<void>;
}

interface ProcessedTask extends Task {
  parsedStart: Date;
  parsedEnd: Date;
  isValid: boolean;
}

type ViewScale = 'day' | 'week' | 'month' | 'year';

export function GanttChart({ tasks, teamMembers, updateTask }: GanttChartProps) {
  const [scale, setScale] = useState<ViewScale>('week');
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const today = startOfToday();
  
  const processedTasks = useMemo((): ProcessedTask[] => {
    return tasks
      .map(t => {
        const start = parseISO(t.startDate);
        const end = t.endDate ? parseISO(t.endDate) : start;
        return {
          ...t,
          parsedStart: start,
          parsedEnd: end,
          isValid: isValid(start)
        };
      })
      .filter(t => t.isValid)
      .sort((a, b) => a.parsedStart.getTime() - b.parsedStart.getTime());
  }, [tasks]);

  const { startDate, endDate } = useMemo(() => {
    if (processedTasks.length === 0) {
      return { startDate: startOfMonth(today), endDate: endOfMonth(addDays(today, 60)) };
    }
    const startDates = processedTasks.map(t => t.parsedStart.getTime());
    const endDates = processedTasks.map(t => t.parsedEnd.getTime());
    
    const minDate = new Date(Math.min(...startDates, today.getTime()));
    const maxDate = new Date(Math.max(...endDates, addDays(today, 30).getTime()));
    
    return {
      startDate: startOfMonth(minDate),
      endDate: endOfMonth(maxDate)
    };
  }, [processedTasks, today]);

  const timeMarkers = useMemo(() => {
    switch (scale) {
      case 'day':
        return eachDayOfInterval({ start: startDate, end: endDate }).map(date => ({
          date,
          label: format(date, 'd'),
          subLabel: format(date, 'EEE', { locale: th }),
          isToday: format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
        }));
      case 'week':
        return eachWeekOfInterval({ start: startDate, end: endDate }).map(date => ({
          date,
          label: `สัปดาห์ที่ ${format(date, 'w')}`,
          subLabel: format(date, 'd MMM', { locale: th }),
          isToday: isWithinInterval(today, { start: startOfWeek(date), end: endOfWeek(date) })
        }));
      case 'month':
        return eachMonthOfInterval({ start: startDate, end: endDate }).map(date => ({
          date,
          label: format(date, 'MMM', { locale: th }),
          subLabel: (date.getFullYear() + 543).toString(),
          isToday: format(date, 'yyyy-MM') === format(today, 'yyyy-MM')
        }));
      case 'year':
        return eachYearOfInterval({ start: startDate, end: endDate }).map(date => ({
          date,
          label: (date.getFullYear() + 543).toString(),
          subLabel: 'ปี',
          isToday: format(date, 'yyyy') === format(today, 'yyyy')
        }));
    }
  }, [scale, startDate, endDate, today]);

  const getPosition = (date: Date) => {
    const total = differenceInDays(endDate, startDate) + 1;
    const offset = differenceInDays(date, startDate);
    return (offset / total) * 100;
  };

  const getWidth = (start: Date, end: Date) => {
    const total = differenceInDays(endDate, startDate) + 1;
    const duration = Math.max(1, differenceInDays(end, start) + 1);
    return (duration / total) * 100;
  };

  const resourceOverloads = useMemo(() => {
    const overloads: Record<string, number> = {}; // date_assigneeId -> count
    processedTasks.forEach(task => {
      const ids = task.assigneeIds && task.assigneeIds.length > 0 ? task.assigneeIds : (task.assigneeId ? [task.assigneeId] : []);
      ids.forEach(id => {
        eachDayOfInterval({ start: task.parsedStart, end: task.parsedEnd }).forEach(day => {
          const key = `${format(day, 'yyyy-MM-dd')}_${id}`;
          overloads[key] = (overloads[key] || 0) + 1;
        });
      });
    });
    return overloads;
  }, [processedTasks]);

  const getTaskOverload = (task: ProcessedTask) => {
    const ids = task.assigneeIds && task.assigneeIds.length > 0 ? task.assigneeIds : (task.assigneeId ? [task.assigneeId] : []);
    if (ids.length === 0) return false;
    
    // Ensure start is before or equal to end to prevent eachDayOfInterval from throwing
    const start = task.parsedStart;
    const end = task.parsedEnd < start ? start : task.parsedEnd;
    
    return ids.some(id => 
      eachDayOfInterval({ start, end }).some(day => {
        const key = `${format(day, 'yyyy-MM-dd')}_${id}`;
        return resourceOverloads[key] > 2; // More than 2 tasks per day is overload
      })
    );
  };

  const handleDragEnd = async (task: ProcessedTask, info: any) => {
    if (!updateTask) return;
    
    const container = document.getElementById('gantt-timeline-body');
    if (!container) return;
    
    const { width } = container.getBoundingClientRect();
    const totalDays = differenceInDays(endDate, startDate) + 1;
    const pixelsPerDay = width / totalDays;
    
    const daysMoved = Math.round(info.offset.x / pixelsPerDay);
    if (daysMoved === 0) return;
    
    const newStart = addDays(task.parsedStart, daysMoved);
    const newEnd = addDays(task.parsedEnd, daysMoved);
    
    await updateTask(task.id, {
      startDate: format(newStart, 'yyyy-MM-dd'),
      endDate: format(newEnd, 'yyyy-MM-dd')
    }, task);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-500';
      case 'In Progress': return 'bg-blue-500';
      case 'Pending': return 'bg-amber-500';
      case 'On Hold': return 'bg-rose-500';
      default: return 'bg-zinc-500';
    }
  };

  const handleResizeEnd = async (task: ProcessedTask, info: any, side: 'left' | 'right') => {
    const deltaX = info.offset.x;
    const container = document.getElementById('gantt-timeline-body');
    if (!container) return;
    
    const containerWidth = container.scrollWidth;
    const totalDays = differenceInDays(endDate, startDate) + 1;
    const daysShift = Math.round((deltaX / containerWidth) * totalDays);
    
    if (daysShift !== 0) {
      if (side === 'left') {
        const newStart = addDays(task.parsedStart, daysShift);
        if (newStart <= task.parsedEnd) {
          await updateTask?.(task.id, { startDate: format(newStart, 'yyyy-MM-dd') }, task);
        }
      } else {
        const newEnd = addDays(task.parsedEnd, daysShift);
        if (newEnd >= task.parsedStart) {
          await updateTask?.(task.id, { endDate: format(newEnd, 'yyyy-MM-dd') }, task);
        }
      }
    }
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollToToday = () => {
    if (scrollContainerRef.current) {
      const totalDays = differenceInDays(endDate, startDate) + 1;
      const todayOffset = differenceInDays(today, startDate);
      const scrollWidth = scrollContainerRef.current.scrollWidth;
      const targetScroll = (todayOffset / totalDays) * scrollWidth;
      
      scrollContainerRef.current.scrollTo({
        left: targetScroll - (scrollContainerRef.current.clientWidth / 2),
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Project Timeline (Gantt)</h2>
          <p className="text-slate-400 text-sm sm:text-lg font-bold mt-1">มุมมองแผนงานสำหรับการบริหารจัดการเชิงกลยุทธ์</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Timeline Navigation Controls */}
          <div className="hidden lg:flex items-center gap-2 bg-navy-input p-1 rounded-2xl border border-border-navy overflow-hidden">
            <button
              onClick={() => scroll('left')}
              className="p-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-navy-elevated transition-all"
              title="เลื่อนไปทางซ้าย"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={scrollToToday}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-brand-primary hover:bg-brand-primary/10 transition-all group"
              title="ไปที่วันนี้"
            >
              <Target size={16} className="group-hover:scale-110 transition-transform" />
              <span>TODAY</span>
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-navy-elevated transition-all"
              title="เลื่อนไปทางขวา"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2 bg-navy-input p-1 md:p-1.5 rounded-2xl border border-border-navy shadow-inner overflow-x-auto no-scrollbar">
          {(['day', 'week', 'month', 'year'] as ViewScale[]).map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={cn(
                "px-3 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap",
                scale === s 
                  ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
                  : "text-slate-500 hover:text-white hover:bg-navy-elevated"
              )}
            >
              {s === 'day' ? 'Day' : s === 'week' ? 'Week' : s === 'month' ? 'Month' : 'Year'}
            </button>
          ))}
        </div>
      </div>
    </header>

      {/* Desktop Chart View */}
      <div className="hidden lg:flex bg-navy-surface border border-border-navy rounded-[2rem] overflow-hidden flex-col h-[700px] shadow-xl shadow-black/50">
        <div className="flex flex-1 overflow-hidden">
          {/* Task Table (Left Side) */}
          <div className="w-[400px] shrink-0 flex flex-col border-r border-border-navy bg-navy-base/30">
            <div className="h-16 border-b border-border-navy flex items-center bg-navy-surface sticky top-0 z-40">
              <div className="w-12 shrink-0 px-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center">ID</div>
              <div className="flex-1 px-4 text-xs font-black text-slate-500 uppercase tracking-widest">Task Name</div>
              <div className="w-20 shrink-0 px-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Staff</div>
              <div className="w-20 shrink-0 px-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Start</div>
              <div className="w-20 shrink-0 px-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Finish</div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-border-navy">
              {processedTasks.map((task, idx) => (
                <div key={task.id} className="h-14 flex items-center hover:bg-navy-elevated transition-colors group">
                  <div className="w-12 shrink-0 px-2 text-xs font-black text-slate-600 text-center font-mono">{idx + 1}</div>
                  <div className="flex-1 px-4 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-black text-white truncate group-hover:text-brand-primary transition-colors">{task.title}</p>
                      {getTaskOverload(task) && (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-sm shadow-rose-500/20" title="Resource Overload" />
                      )}
                    </div>
                  </div>
                  <div className="w-20 shrink-0 px-2 flex justify-center">
                    <div className="flex -space-x-2">
                       {(task.assigneeIds && task.assigneeIds.length > 0) ? (
                         task.assigneeIds.slice(0, 3).map(id => {
                           const member = teamMembers.find(m => m.id === id);
                           return (
                             <div key={id} className="w-5 h-5 rounded-md bg-navy-base border border-border-navy flex items-center justify-center text-[8px] font-black text-slate-500 shadow-sm overflow-hidden" title={member?.name}>
                               {member?.photoURL ? (
                                 <img src={member.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                               ) : (
                                 member?.name?.charAt(0) || '?'
                               )}
                             </div>
                           );
                         })
                       ) : (
                         <div className="w-5 h-5 rounded-md bg-navy-base border border-border-navy flex items-center justify-center text-[8px] font-black text-slate-500 shadow-sm overflow-hidden" title={teamMembers.find(m => m.id === task.assigneeId)?.name}>
                           {teamMembers.find(m => m.id === task.assigneeId)?.photoURL ? (
                             <img src={teamMembers.find(m => m.id === task.assigneeId)?.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                           ) : (
                             teamMembers.find(m => m.id === task.assigneeId)?.name?.charAt(0) || 'U'
                           )}
                         </div>
                       )}
                       {task.assigneeIds && task.assigneeIds.length > 3 && (
                         <div className="w-5 h-5 rounded-md bg-navy-base border border-border-navy flex items-center justify-center text-[7px] font-black text-slate-400">
                           +{task.assigneeIds.length - 3}
                         </div>
                       )}
                    </div>
                  </div>
                  <div className="w-20 shrink-0 px-2 text-[10px] font-bold text-slate-400 text-center">{formatThaiDate(task.parsedStart).split(' ')[0]}</div>
                  <div className="w-20 shrink-0 px-2 text-[10px] font-bold text-slate-400 text-center">{formatThaiDate(task.parsedEnd).split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline (Right Side) */}
          <div ref={scrollContainerRef} className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar relative bg-navy-surface group/timeline">
            <div className="min-w-[1200px] h-full flex flex-col relative">
              {/* Timeline Header */}
              <div className="h-16 border-b border-border-navy flex bg-navy-surface sticky top-0 z-40">
                {timeMarkers.map((marker, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex-1 border-r border-border-navy flex flex-col items-center justify-center min-w-[100px]",
                      marker.isToday && "bg-brand-primary/5"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-black uppercase tracking-widest",
                      marker.isToday ? "text-brand-primary" : "text-slate-600"
                    )}>
                      {marker.subLabel}
                    </span>
                    <span className={cn(
                      "text-base font-black mt-0.5",
                      marker.isToday ? "text-white" : "text-slate-400"
                    )}>
                      {marker.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Timeline Body */}
              <div id="gantt-timeline-body" className="flex-1 relative overflow-y-auto custom-scrollbar no-scrollbar-y">
                {/* Background Grid */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {timeMarkers.map((_, i) => (
                    <div key={i} className="flex-1 border-r border-border-navy/50 min-w-[100px]" />
                  ))}
                </div>

                {/* Today Line */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-brand-primary/30 z-20 pointer-events-none"
                  style={{ left: `${getPosition(today)}%` }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 px-2 py-1 bg-brand-primary text-white text-[8px] font-black rounded-b-lg uppercase tracking-widest shadow-lg">Today</div>
                </div>

                {/* Task Dependencies (SVG Layer) */}
                <svg className="absolute inset-0 pointer-events-none z-0 overflow-visible">
                  <defs>
                    <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orientation="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="#6366f1" fillOpacity="0.5" />
                    </marker>
                  </defs>
                  {processedTasks.map((task, taskIdx) => {
                    if (!task.dependencies || task.dependencies.length === 0) return null;
                    return task.dependencies.map(depId => {
                      const depTaskIdx = processedTasks.findIndex(t => t.id === depId);
                      if (depTaskIdx === -1) return null;
                      const depTask = processedTasks[depTaskIdx];
                      const startX = getPosition(depTask.parsedEnd);
                      const startY = (depTaskIdx * 48) + 24; 
                      const endX = getPosition(task.parsedStart);
                      const endY = (taskIdx * 48) + 24; 
                      const midX = startX + (endX - startX) / 2;
                      return (
                        <path
                          key={`${task.id}-${depId}`}
                          d={`M ${startX}% ${startY} L ${midX}% ${startY} L ${midX}% ${endY} L ${endX}% ${endY}`}
                          fill="none" stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.3" markerEnd="url(#arrowhead)"
                        />
                      );
                    });
                  })}
                </svg>

                {/* Task Bars */}
                <div className="relative z-10">
                  {processedTasks.map((task) => {
                    const left = getPosition(task.parsedStart);
                    const width = getWidth(task.parsedStart, task.parsedEnd);
                    return (
                      <div key={task.id} className="h-12 flex items-center relative group">
                        <motion.div 
                          drag="x" dragMomentum={false} dragConstraints={{ left: 0, right: 0 }}
                          onDragStart={() => setDraggingTaskId(task.id)}
                          onDragEnd={(_, info) => { setDraggingTaskId(null); handleDragEnd(task, info); }}
                          className={cn("absolute h-6 flex items-center z-30", draggingTaskId === task.id ? "cursor-grabbing" : "cursor-grab")}
                          style={{ left: `${left}%`, width: `${width}%`, minWidth: '20px' }}
                        >
                          <div className={cn("w-full h-full rounded-md flex items-center px-1 relative shadow-sm", getStatusColor(task.status))}>
                            <motion.div drag="x" dragMomentum={false} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(e, info) => { e.stopPropagation(); handleResizeEnd(task, info, 'left'); }} className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-40" />
                            <motion.div drag="x" dragMomentum={false} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(e, info) => { e.stopPropagation(); handleResizeEnd(task, info, 'right'); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-40" />
                            <span className="relative z-10 text-[8px] font-black text-white uppercase truncate px-1">{task.title}</span>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Floating Navigation Controls */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 bg-navy-elevated/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 opacity-0 group-hover/timeline:opacity-100 transition-all duration-500 translate-y-4 group-hover/timeline:translate-y-0 scale-95 group-hover/timeline:scale-100">
              <button
                onClick={() => scroll('left')}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-navy-base border border-white/5 text-slate-400 hover:text-white hover:border-brand-primary/50 transition-all active:scale-95"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="h-6 w-px bg-white/10 mx-1" />
              
              <button
                onClick={scrollToToday}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all"
              >
                <Target size={16} />
                <span>Jump to Today</span>
              </button>

              <div className="h-6 w-px bg-white/10 mx-1" />

              <button
                onClick={() => scroll('right')}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-navy-base border border-white/5 text-slate-400 hover:text-white hover:border-brand-primary/50 transition-all active:scale-95"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Stacked View */}
      <div className="lg:hidden space-y-4">
        {processedTasks.map((task) => (
          <div key={task.id} className="bg-navy-surface p-6 rounded-3xl border border-border-navy space-y-4 shadow-lg shadow-black/30">
            <div className="flex justify-between items-start gap-3">
              <h4 className="font-black text-white tracking-tight leading-tight text-lg">{task.title}</h4>
              <span className={cn("px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest shrink-0", getStatusColor(task.status), "bg-opacity-20 border border-opacity-30", 
                 task.status === 'Completed' ? 'border-emerald-500/30' : 
                 task.status === 'In Progress' ? 'border-blue-500/30' : 
                 task.status === 'Pending' ? 'border-amber-500/30' : 'border-rose-500/30'
              )}>
                {task.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">เริ่ม</span>
                <p className="text-base font-bold text-slate-300">{formatThaiDate(task.parsedStart)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">สิ้นสุด</span>
                <p className="text-base font-bold text-slate-300">{formatThaiDate(task.parsedEnd)}</p>
              </div>
            </div>

            <div className="relative h-2 bg-navy-base rounded-full overflow-hidden">
               <div className={cn("absolute h-full rounded-full transition-all duration-1000", getStatusColor(task.status))} style={{ width: task.status === 'Completed' ? '100%' : task.status === 'In Progress' ? '50%' : '10%' }} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">
                ระยะเวลา: {differenceInDays(task.parsedEnd, task.parsedStart) + 1} วัน
              </span>
              <div className="flex -space-x-2">
                 {(task.assigneeIds && task.assigneeIds.length > 0) ? (
                   task.assigneeIds.map(id => (
                     <div key={id} className="w-6 h-6 rounded-lg bg-navy-elevated flex items-center justify-center text-[10px] font-black text-slate-500 border border-white/5 shadow-sm overflow-hidden">
                       {teamMembers.find(m => m.id === id)?.photoURL ? (
                         <img src={teamMembers.find(m => m.id === id)?.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                       ) : (
                         teamMembers.find(m => m.id === id)?.name?.charAt(0) || '?'
                       )}
                     </div>
                   ))
                 ) : (
                   <div className="w-6 h-6 rounded-lg bg-navy-elevated flex items-center justify-center text-[10px] font-black text-slate-500 border border-white/5 shadow-sm overflow-hidden">
                     {teamMembers.find(m => m.id === task.assigneeId)?.photoURL ? (
                       <img src={teamMembers.find(m => m.id === task.assigneeId)?.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     ) : (
                       teamMembers.find(m => m.id === task.assigneeId)?.name?.charAt(0) || 'U'
                     )}
                   </div>
                 )}
              </div>
            </div>
          </div>
        ))}
        {processedTasks.length === 0 && (
          <div className="text-center py-20 bg-navy-surface/50 border border-border-navy border-dashed rounded-[2rem]">
             <p className="text-slate-500 font-bold">ไม่พบแผนงานภารกิจ</p>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-6 pb-4">
        <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500" /> Pending
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500" /> In Progress
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500" /> Completed
          </div>
        </div>
        
        <div className="text-xs sm:text-sm font-black text-white uppercase tracking-widest bg-navy-input px-5 py-3 rounded-xl border border-border-navy shadow-inner">
          Total Duration: <span className="text-brand-primary ml-1">{differenceInDays(endDate, startDate)} Days</span>
        </div>
      </footer>
    </div>
  );
}



