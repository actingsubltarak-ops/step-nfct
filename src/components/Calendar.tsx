import React, { useState, useEffect } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  eachDayOfInterval,
  parseISO,
  isValid
} from 'date-fns';
import { th } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, User, Building2, Tag, UserCheck, Calendar as CalendarIcon, Paperclip, File as FileIcon, Image as ImageIcon, Trash, Download, MessageSquare, History, Send, TrendingUp, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatThaiDate, cn, getThaiYear, getRoleDisplayName, generateId, isSystemAdmin } from '../lib/utils';
import { ConfirmDialog } from './ConfirmDialog';
import { Task, TaskStatus, Attachment, TeamMember, Comment } from '../types';

const TASK_STATUS_CHIP: Record<string, { bg: string; text: string; dot: string }> = {
  'Pending':     { bg: 'bg-slate-700/60',  text: 'text-slate-300',  dot: 'bg-slate-400'  },
  'In Progress': { bg: 'bg-blue-900/60',   text: 'text-blue-300',   dot: 'bg-blue-400'   },
  'Review':      { bg: 'bg-amber-900/60',  text: 'text-amber-300',  dot: 'bg-amber-400'  },
  'Completed':   { bg: 'bg-green-900/60',  text: 'text-green-300',  dot: 'bg-green-400'  },
  'On Hold':     { bg: 'bg-red-900/60',    text: 'text-red-300',    dot: 'bg-red-400'    },
};

function isOverdue(task: Task): boolean {
  if (!task.endDate || task.status === 'Completed') return false;
  return new Date(task.endDate) < new Date(new Date().toDateString());
}

interface CalendarProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  taskOwners: { id: string; name: string; departmentId: string }[];
  departments: { id: string; name: string }[];
  userProfile: TeamMember | null;
  addTask: (task: Partial<Task>) => Promise<void>;
  updateTask: (taskId: string, updatedData: Partial<Task>, existingTask?: Task) => Promise<void>;
  deleteTask: (taskId: string, user: any, userProfile: any, existingTask?: Task) => Promise<void>;
}

export function Calendar({ tasks, teamMembers, taskOwners, departments, userProfile, addTask, updateTask, deleteTask }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDayTasks, setSelectedDayTasks] = useState<{date: Date, tasks: Task[]} | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerDepartment, setOwnerDepartment] = useState('');
  const [project, setProject] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Pending');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [activeModalTab, setActiveModalTab] = useState<'details' | 'activity'>('details');
  const [newComment, setNewComment] = useState('');
  const [budget, setBudget] = useState<number>(0);
  const [actualCost, setActualCost] = useState<number>(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (viewingTask) {
      const updatedTask = tasks.find(t => t.id === viewingTask.id);
      if (updatedTask) {
        // Only update if the task data has actually changed from Firestore
        // and we don't have a more recent local comment update
        const localCommentsCount = viewingTask.comments?.length || 0;
        const remoteCommentsCount = updatedTask.comments?.length || 0;
        
        if (remoteCommentsCount >= localCommentsCount) {
          setViewingTask(updatedTask);
        }
      }
    }
  }, [tasks, viewingTask?.id]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const toDateString = (date: Date) => {
    const year = date.getFullYear();
    const gregorianYear = year > 2400 ? year - 543 : year;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${gregorianYear}-${month}-${day}`;
  };

  const normalizeDateString = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    let year = parseInt(parts[0]);
    if (year > 2400) year -= 543;
    return `${year}-${parts[1]}-${parts[2]}`;
  };

  const getTasksForDay = (day: Date) => {
    const dayStr = toDateString(day);
    return tasks.filter(task => {
      const start = normalizeDateString(task.startDate);
      const end = normalizeDateString(task.endDate || task.startDate);
      if (!start) return false;
      return dayStr >= start && dayStr <= end;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const { storageService } = await import('../services/storageService');
    const toastId = toast.loading('กำลังอัปโหลดไฟล์...');

    try {
      const uploadPromises = Array.from(files).map(async (file: File) => {
        if (file.size > 2 * 1024 * 1024) {
          toast.error(`ไฟล์ ${file.name} มีขนาดใหญ่เกินไป (จำกัด 2MB)`);
          return null;
        }

        const path = `tasks/${Date.now()}_${file.name}`;
        const url = await storageService.uploadFile(file, path);
        
        return {
          id: generateId(),
          name: file.name,
          type: file.type,
          url: url,
          size: file.size
        } as Attachment;
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter((r): r is Attachment => r !== null);
      
      if (successfulUploads.length > 0) {
        setAttachments(prev => [...prev, ...successfulUploads]);
        toast.success(`อัปโหลดสำเร็จ ${successfulUploads.length} ไฟล์`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (error) {
      console.error('Upload Error:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปโหลด', { id: toastId });
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !viewingTask || !userProfile) return;

    // Get the latest task data from the tasks prop to avoid stale state
    const latestTask = tasks.find(t => t.id === viewingTask.id) || viewingTask;

    const comment: Comment = {
      id: generateId(),
      userId: userProfile.id || '',
      userName: userProfile.name || 'Unknown User',
      userAvatar: userProfile.photoURL,
      text: newComment.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedComments = [...(latestTask.comments || []), comment];
    
    // Update local state immediately for responsive UI
    setViewingTask({ ...latestTask, comments: updatedComments });
    setNewComment('');
    
    try {
      // Update Firestore and wait for it
      await updateTask(viewingTask.id, { comments: updatedComments }, latestTask);
    } catch (error) {
      console.error("Error submitting comment:", error);
      // Revert local state if update fails
      setViewingTask(latestTask);
      setNewComment(comment.text);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('กรุณาระบุชื่องาน');
      return;
    }

    if (!assigneeIds || assigneeIds.length === 0) {
      toast.error('กรุณาเลือกผู้รับผิดชอบ');
      return;
    }

    if (!ownerName) {
      toast.error('กรุณาระบุส่วนงาน');
      return;
    }

    if (budget < 0 || actualCost < 0) {
      toast.error('งบประมาณและค่าใช้จ่ายจริงต้องไม่ติดลบ');
      return;
    }

    const startStr = normalizeDateString(startDateStr || toDateString(selectedDate));
    const endStr = normalizeDateString(endDateStr || startStr);
    
    const taskData = {
      title,
      description,
      status,
      assigneeId: assigneeIds[0] || '',
      assigneeIds,
      supervisorId,
      supervisorName,
      ownerName,
      ownerDepartment,
      startDate: startStr,
      endDate: endStr,
      project,
      attachments,
      dependencies,
      budget,
      actualCost
    };

    try {
      if (isEditing && viewingTask) {
        await updateTask(viewingTask.id, taskData, viewingTask);
      } else {
        await addTask(taskData as any);
      }

      setIsModalOpen(false);
      setIsEditing(false);
      setViewingTask(null);
      setActiveModalTab('details');
      // Reset form
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setAssigneeIds([]);
      setSupervisorName('');
      setOwnerName('');
      setOwnerDepartment('');
      setProject('');
      setStartDateStr('');
      setEndDateStr('');
      setStatus('Pending');
      setBudget(0);
      setActualCost(0);
      setAttachments([]);
      setDependencies([]);
    } catch (error) {
      console.error("Error saving task:", error);
      // Don't close modal, let user try again
    }
  };

  const handleDeleteTask = () => {
    if (viewingTask) {
      setIsDeleteDialogOpen(true);
    }
  };

  const confirmDelete = () => {
    if (viewingTask) {
      deleteTask(viewingTask.id, null, userProfile, viewingTask);
      setViewingTask(null);
    }
  };

  const handleEditTask = () => {
    if (viewingTask) {
      setTitle(viewingTask.title);
      setDescription(viewingTask.description);
      setAssigneeId(viewingTask.assigneeId);
      setAssigneeIds(viewingTask.assigneeIds || (viewingTask.assigneeId ? [viewingTask.assigneeId] : []));
      setSupervisorId(viewingTask.supervisorId || '');
      setSupervisorName(viewingTask.supervisorName || '');
      setOwnerName(viewingTask.ownerName);
      setOwnerDepartment(viewingTask.ownerDepartment);
      setProject(viewingTask.project);
      setBudget(viewingTask.budget || 0);
      setActualCost(viewingTask.actualCost || 0);
      setStatus(viewingTask.status);
      setStartDateStr(viewingTask.startDate);
      setEndDateStr(viewingTask.endDate || '');
      const start = parseISO(viewingTask.startDate);
      if (isValid(start)) {
        setSelectedDate(start);
      }
      setAttachments(viewingTask.attachments || []);
      setDependencies(viewingTask.dependencies || []);
      setIsEditing(true);
      setIsModalOpen(true);
      // We don't setViewingTask(null) here, we'll do it after the update
    }
  };

  const getStatusBgColor = (status: TaskStatus) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100';
      case 'In Progress': return 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100';
      case 'Pending': return 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100';
      case 'On Hold': return 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-100';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'Completed': return 'text-emerald-600';
      case 'In Progress': return 'text-blue-600';
      case 'Pending': return 'text-amber-600';
      case 'On Hold': return 'text-rose-600';
      default: return 'text-slate-600';
    }
  };

  const getStatusDotColor = (status: TaskStatus) => {
    switch (status) {
      case 'Completed': return 'bg-green-500';
      case 'In Progress': return 'bg-blue-500';
      case 'Pending': return 'bg-amber-500';
      case 'On Hold': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const handleMonthChange = (monthIdx: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(monthIdx);
    setCurrentMonth(newDate);
  };

  const handleYearChange = (year: number) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(year);
    setCurrentMonth(newDate);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight">ปฏิทินงานและการนัดหมาย</h2>
          <p className="text-slate-400 text-lg font-bold mt-1">จัดการตารางเวลาและกำหนดส่งงานอย่างเป็นระบบ</p>
        </div>
        <button 
          onClick={() => {
            // If the selected date is not in the current month, default to the first day of the current month
            if (!isSameMonth(selectedDate, currentMonth)) {
              setSelectedDate(startOfMonth(currentMonth));
            }
            setIsModalOpen(true);
            setStartDateStr(toDateString(selectedDate));
            setIsEditing(false);
            setViewingTask(null);
            // Reset other fields for new task
            setTitle('');
            setDescription('');
            setProject('');
            setBudget(0);
            setActualCost(0);
            setAttachments([]);
          }}
          className="flex items-center gap-3 bg-blue-500/10 text-blue-400 border-2 border-blue-500/20 px-8 py-4 rounded-2xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95 shadow-[0_20px_50px_rgba(59,130,246,0.3)] text-xs uppercase tracking-[0.2em] font-black"
        >
          <Plus size={20} />
          เพิ่มงานใหม่
        </button>
      </header>

      <div className="bg-navy-surface rounded-[3rem] border border-border-navy shadow-2xl shadow-black/50 overflow-hidden">
        {/* Calendar Header */}
        <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border-navy bg-navy-base/30">
          <div className="flex items-center gap-4">
            <div className="relative">
              <select 
                value={currentMonth.getMonth()}
                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                className="bg-navy-input border-2 border-border-navy rounded-xl pl-5 pr-10 py-3 text-sm font-black text-white outline-none focus:border-brand-primary transition-all cursor-pointer appearance-none shadow-sm"
              >
                {months.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronRight size={14} className="rotate-90" />
              </div>
            </div>
            <div className="relative">
              <select 
                value={currentMonth.getFullYear()}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="bg-navy-input border-2 border-border-navy rounded-xl pl-5 pr-10 py-3 text-sm font-black text-white outline-none focus:border-brand-primary transition-all cursor-pointer appearance-none shadow-sm"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y + (y > 2400 ? 0 : 543)}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronRight size={14} className="rotate-90" />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-3 hover:bg-navy-elevated rounded-xl transition-colors text-slate-500 border-2 border-border-navy shadow-sm">
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => {
                const today = new Date();
                setCurrentMonth(today);
                setSelectedDate(today);
              }} 
              className="px-8 py-3 text-xs font-black bg-brand-primary/10 text-brand-primary border-2 border-brand-primary/20 hover:bg-brand-primary hover:text-white hover:border-brand-primary rounded-xl transition-all uppercase tracking-widest shadow-sm"
            >
              วันนี้
            </button>
            <button onClick={nextMonth} className="p-3 hover:bg-navy-elevated rounded-xl transition-colors text-slate-500 border-2 border-border-navy shadow-sm">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 px-8 pb-6 flex-wrap">
          {Object.entries(TASK_STATUS_CHIP).map(([status, style]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full ${style.dot}`} />
              <span className="text-xs text-slate-500 font-bold">{status}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-red-400 text-sm">⚠</span>
            <span className="text-xs text-slate-500 font-bold">เกินกำหนด</span>
          </div>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 border-b border-border-navy">
          {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map(day => (
            <div key={day} className="py-4 text-center text-sm font-black text-slate-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);

            return (
              <div
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDate(day);
                  setStartDateStr(toDateString(day));
                  setSupervisorName(userProfile?.name || '');
                  setIsModalOpen(true);
                  setViewingTask(null); // Ensure viewing modal is closed when opening add modal
                }}
                className={cn(
                  "min-h-[120px] p-3 border-r border-b border-border-navy transition-colors cursor-pointer relative group/day",
                  isCurrentMonth ? 'bg-navy-surface/40' : 'bg-navy-base/20 opacity-50',
                  isSelected && "bg-brand-primary/5"
                )}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={cn(
                    "text-base font-black w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-inner",
                    isToday && "bg-brand-primary text-white shadow-xl shadow-brand-primary/20",
                    !isToday && isCurrentMonth && "text-slate-300 bg-navy-elevated border border-border-navy",
                    !isCurrentMonth && "text-slate-700 bg-transparent border-transparent shadow-none"
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                <div className="space-y-1">
                  {(() => {
                    const MAX_VISIBLE = 2;
                    const visibleTasks = dayTasks.slice(0, MAX_VISIBLE);
                    const hiddenCount = dayTasks.length - MAX_VISIBLE;

                    return (
                      <>
                        {visibleTasks.map(task => {
                          const chip = TASK_STATUS_CHIP[task.status] || TASK_STATUS_CHIP['Pending'];
                          return (
                            <div 
                              key={task.id}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setViewingTask(task);
                                setIsModalOpen(false);
                              }}
                              className={cn(
                                "flex items-center gap-1.5 px-2 py-1 relative rounded-lg text-xs font-black cursor-pointer truncate border border-white/10 hover:brightness-125 transition-all",
                                chip.bg,
                                chip.text,
                                isOverdue(task) ? 'ring-1 ring-red-500/50' : ''
                              )}
                              title={task.title}
                            >
                              <div className={cn("w-2 h-2 rounded-full shrink-0", chip.dot)} />
                              {isOverdue(task) && (
                                <span className="flex-shrink-0 text-red-400 text-xs" title="เกินกำหนด">⚠</span>
                              )}
                              <span className="truncate">{task.title}</span>
                            </div>
                          );
                        })}
                        {hiddenCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDayTasks({ date: day, tasks: dayTasks });
                            }}
                            className="w-full text-left text-[10px] font-black text-slate-500 hover:text-blue-400 transition-colors px-1 py-0.5 rounded hover:bg-blue-500/10"
                          >
                            +{hiddenCount} งานเพิ่มเติม
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>

                {isSelected && (
                  <div className="absolute bottom-3 right-3 text-blue-600 opacity-0 group-hover/day:opacity-100 transition-opacity">
                    <Plus size={18} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* View Task Details Modal */}
      {viewingTask && !isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-navy-surface border border-border-navy w-full max-w-2xl max-h-[95vh] rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="p-8 border-b border-border-navy flex justify-between items-center bg-navy-base/30 flex-shrink-0">
              <div className="flex items-center gap-5">
                <div className={cn("w-4 h-4 rounded-full shadow-lg", getStatusDotColor(viewingTask.status))} />
                <h3 className="text-2xl font-black text-white tracking-tight">รายละเอียดภารกิจ</h3>
              </div>
              <button onClick={() => setViewingTask(null)} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-navy-elevated rounded-xl">
                <X size={28} />
              </button>
            </div>

            <div className="flex border-b border-border-navy bg-navy-base/30 flex-shrink-0">
              <button 
                onClick={() => setActiveModalTab('details')}
                className={cn(
                  "flex-1 py-5 text-sm font-black flex items-center justify-center gap-3 transition-all border-b-4 uppercase tracking-widest",
                  activeModalTab === 'details' ? "text-brand-primary border-brand-primary bg-brand-primary/5" : "text-slate-500 border-transparent hover:text-white hover:bg-navy-elevated/50"
                )}
              >
                <Tag size={18} /> รายละเอียด
              </button>
              <button 
                onClick={() => setActiveModalTab('activity')}
                className={cn(
                  "flex-1 py-5 text-sm font-black flex items-center justify-center gap-3 transition-all border-b-4 uppercase tracking-widest",
                  activeModalTab === 'activity' ? "text-brand-primary border-brand-primary bg-brand-primary/5" : "text-slate-500 border-transparent hover:text-white hover:bg-navy-elevated/50"
                )}
              >
                <History size={18} /> ความเคลื่อนไหว
              </button>
            </div>

            <div className="p-10 space-y-10 flex-1 overflow-y-auto custom-scrollbar">
              {activeModalTab === 'details' ? (
                <>
                  <div className="space-y-4">
                    <h4 className="text-4xl font-black text-white leading-tight tracking-tight">{viewingTask.title}</h4>
                    <div className="flex flex-wrap gap-3 mt-6">
                      <span className={cn("px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.2em] bg-navy-input border border-border-navy shadow-inner", getStatusColor(viewingTask.status), 
                        viewingTask.status === 'Completed' ? "border-emerald-100" :
                        viewingTask.status === 'In Progress' ? "border-blue-100" :
                        viewingTask.status === 'Pending' ? "border-amber-100" : "border-rose-100"
                      )}>
                        {viewingTask.status === 'Pending' ? 'รอดำเนินการ' : 
                         viewingTask.status === 'In Progress' ? 'กำลังดำเนินการ' : 
                         viewingTask.status === 'Completed' ? 'เสร็จสิ้น' : 'ระงับชั่วคราว'}
                      </span>
                      <span className="px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] text-brand-primary bg-brand-primary/10 border border-brand-primary/20 shadow-inner">
                        {viewingTask.project}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] flex items-center gap-3">
                          <User className="w-4 h-4" /> ผู้รับผิดชอบ (Assignees)
                        </label>
                        <div className="space-y-3">
                          {(viewingTask.assigneeIds && viewingTask.assigneeIds.length > 0) ? (
                            viewingTask.assigneeIds.map(id => {
                              const member = teamMembers.find(m => m.id === id);
                              return (
                                <div key={id} className="bg-navy-input p-4 rounded-[1.5rem] border border-border-navy shadow-inner flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary overflow-hidden shadow-inner shrink-0">
                                    {member?.photoURL ? (
                                      <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <User size={20} />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white font-black text-sm truncate tracking-tight">{member?.name || 'ไม่ทราบชื่อ'}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{getRoleDisplayName(member?.role)}</p>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="bg-navy-input p-6 rounded-[2rem] border border-border-navy shadow-inner">
                              <p className="text-white font-black text-lg tracking-tight">{teamMembers.find(m => m.id === viewingTask.assigneeId)?.name || 'ไม่ระบุ'}</p>
                              <p className="text-xs text-slate-400 mt-1.5 font-bold uppercase tracking-widest">{getRoleDisplayName(teamMembers.find(m => m.id === viewingTask.assigneeId)?.role)}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] flex items-center gap-3">
                          <UserCheck className="w-4 h-4" /> ผู้สร้าง/ผู้ควบคุมงาน
                        </label>
                        <div className="bg-navy-input p-6 rounded-[2rem] border border-border-navy shadow-inner">
                          <p className="text-white font-black text-lg tracking-tight">
                            {(() => {
                              const supervisor = teamMembers.find(m => m.id === viewingTask.supervisorId) || 
                                               teamMembers.find(m => m.name === viewingTask.supervisorName);
                              return supervisor?.name || viewingTask.supervisorName || 'ไม่ระบุ';
                            })()}
                          </p>
                          <p className="text-xs text-slate-400 mt-1.5 font-bold uppercase tracking-widest">
                            {(() => {
                              const supervisor = teamMembers.find(m => m.id === viewingTask.supervisorId) || 
                                               teamMembers.find(m => m.name === viewingTask.supervisorName) ||
                                               teamMembers.find(m => m.id === viewingTask.createdBy);
                              
                              if (supervisor) {
                                // Double check if it's a system admin even if DB role is stale
                                const isActuallyAdmin = isSystemAdmin(supervisor.email);
                                const roleToUse = isActuallyAdmin ? 'Administrator' : supervisor.role;
                                return getRoleDisplayName(roleToUse);
                              }
                              
                              return viewingTask.supervisorName ? 'ผู้ควบคุมงาน' : 'ผู้สร้างงาน';
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="space-y-3">
                        <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] flex items-center gap-3">
                          <Building2 className="w-4 h-4" /> ส่วนงาน / หน่วยงาน
                        </label>
                        <div className="bg-navy-input p-6 rounded-[2rem] border border-border-navy shadow-inner">
                          <p className="text-white font-black text-lg tracking-tight">{viewingTask.ownerName}</p>
                          <p className="text-xs text-slate-400 mt-1.5 font-bold uppercase tracking-widest">{viewingTask.ownerDepartment}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] flex items-center gap-3">
                          <CalendarIcon className="w-4 h-4" /> ระยะเวลาดำเนินการ
                        </label>
                        <div className="bg-navy-input p-6 rounded-[2rem] border border-border-navy shadow-inner">
                          <p className="text-white font-black text-lg tracking-tight">
                            {formatThaiDate(viewingTask.startDate)}
                            {viewingTask.endDate && normalizeDateString(viewingTask.endDate) !== normalizeDateString(viewingTask.startDate) && (
                              <> - {formatThaiDate(viewingTask.endDate)}</>
                            )}
                          </p>
                        </div>
                      </div>

                      {viewingTask.dependencies && viewingTask.dependencies.length > 0 && (
                        <div className="space-y-3">
                          <label className="text-[11px] text-slate-500 uppercase font-black tracking-[0.2em] flex items-center gap-3">
                            <Plus className="w-4 h-4" /> งานที่ต้องทำก่อน
                          </label>
                          <div className="flex flex-wrap gap-3">
                            {viewingTask.dependencies.map(depId => {
                              const depTask = tasks.find(t => t.id === depId);
                              return (
                                <div key={depId} className="px-4 py-2 bg-navy-elevated border border-border-navy rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-sm">
                                  {depTask?.title || 'Unknown Task'}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em]">รายละเอียดเพิ่มเติม</label>
                    <div className="bg-navy-input p-8 rounded-[2rem] border border-border-navy min-h-[150px] shadow-inner text-slate-300 font-extrabold leading-relaxed whitespace-pre-wrap text-xl">
                      {viewingTask.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                    </div>
                  </div>

                  {viewingTask.attachments && viewingTask.attachments.length > 0 && (
                    <div className="space-y-6">
                      <label className="text-[11px] text-slate-500 uppercase font-black tracking-[0.2em] flex items-center gap-3">
                        <Paperclip className="w-4 h-4" /> ไฟล์แนบ ({viewingTask.attachments.length})
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {viewingTask.attachments.map((file) => (
                          <div key={file.id} className="bg-navy-input border border-border-navy p-6 rounded-[2rem] flex flex-col gap-5 group hover:border-brand-primary/50 hover:shadow-xl hover:shadow-black/50 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary overflow-hidden shadow-inner">
                                {file.type.startsWith('image/') ? (
                                  <img src={file.url} alt={file.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <FileIcon size={24} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-white truncate tracking-tight">{file.name}</p>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{(file.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            
                            {file.type.startsWith('image/') && (
                              <div className="relative aspect-video rounded-2xl overflow-hidden border border-border-navy shadow-sm">
                                <img src={file.url} alt={file.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            )}

                            <a 
                              href={file.url} 
                              download={file.name}
                              className="flex items-center justify-center gap-3 w-full py-4 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white text-xs font-black rounded-2xl transition-all uppercase tracking-[0.2em] border border-brand-primary/20 hover:border-brand-primary shadow-sm"
                            >
                              <Download size={18} />
                              ดาวน์โหลดไฟล์
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-10">
                  {/* Comments Section */}
                  <div className="space-y-6">
                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] flex items-center gap-3">
                      <MessageSquare className="w-4 h-4" /> ความคิดเห็น ({viewingTask.comments?.length || 0})
                    </label>
                    
                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                      {viewingTask.comments && viewingTask.comments.length > 0 ? (
                        [...viewingTask.comments].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((comment) => (
                          <div key={comment.id} className="flex gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary text-sm font-black border border-brand-primary/20 overflow-hidden shrink-0 shadow-sm">
                              {comment.userAvatar ? (
                                <img src={comment.userAvatar} alt={comment.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                comment.userName.charAt(0)
                              )}
                            </div>
                            <div className="flex-1 bg-navy-input border border-border-navy p-6 rounded-[2rem] rounded-tl-none shadow-sm">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xl font-black text-white tracking-tight">{comment.userName}</span>
                                <span className="text-xs text-slate-600 font-black uppercase tracking-widest">
                                  {(() => {
                                    try {
                                      const d = parseISO(comment.timestamp);
                                      if (!isValid(d)) return comment.timestamp;
                                      return `${format(d, 'd MMM', { locale: th })} ${d.getFullYear() + 543} ${format(d, 'HH:mm', { locale: th })}`;
                                    } catch (e) {
                                      return comment.timestamp;
                                    }
                                  })()}
                                </span>
                              </div>
                              <p className="text-xl text-slate-300 font-bold leading-relaxed">{comment.text}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 bg-navy-base/30 border border-border-navy border-dashed rounded-[2rem]">
                          <p className="text-sm text-slate-600 font-black uppercase tracking-widest">ยังไม่มีความคิดเห็นในขณะนี้</p>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleCommentSubmit} className="relative mt-6">
                      <input 
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="เขียนความคิดเห็นของคุณที่นี่..."
                        className="w-full bg-navy-input border border-border-navy rounded-2xl py-5 pl-6 pr-16 text-base text-white font-bold outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all shadow-sm placeholder:text-slate-600"
                      />
                      <button 
                        type="submit"
                        disabled={!newComment.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-3 text-brand-primary hover:bg-brand-primary hover:text-white rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent shadow-sm"
                      >
                        <Send size={24} />
                      </button>
                    </form>
                  </div>

                  {/* Activity Log Section */}
                  <div className="space-y-6">
                    <label className="text-[11px] text-slate-500 uppercase font-black tracking-[0.2em] flex items-center gap-3">
                      <History className="w-4 h-4" /> ประวัติกิจกรรม
                    </label>
                    <div className="space-y-6">
                      {viewingTask.activities && viewingTask.activities.length > 0 ? (
                        viewingTask.activities.slice().reverse().map((activity) => (
                          <div key={activity.id} className="flex gap-6 relative group">
                            <div className="w-1 bg-border-navy absolute left-5 top-10 bottom-0 group-last:hidden rounded-full" />
                            <div className="w-10 h-10 rounded-2xl bg-navy-base border border-border-navy flex items-center justify-center shrink-0 z-10 shadow-sm">
                              <div className="w-3 h-3 rounded-full bg-brand-primary shadow-xl shadow-brand-primary/20" />
                            </div>
                            <div className="pb-6">
                              <p className="text-base text-white font-black tracking-tight">{activity.description}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[11px] text-slate-500 font-black uppercase tracking-widest">{activity.userName}</span>
                                <span className="text-[11px] text-slate-300">•</span>
                                <span className="text-[11px] text-slate-600 font-black uppercase tracking-widest">{format(parseISO(activity.timestamp), 'd MMM', { locale: th })} {new Date(activity.timestamp).getFullYear() + 543} {format(parseISO(activity.timestamp), 'HH:mm', { locale: th })}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 bg-navy-base/30 border border-border-navy border-dashed rounded-[2rem]">
                          <p className="text-sm text-slate-600 font-black uppercase tracking-widest">ยังไม่มีประวัติกิจกรรมในขณะนี้</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-10 border-t border-border-navy bg-navy-base/30 flex-shrink-0">
              <div className="flex justify-end gap-4">
                <button 
                  onClick={handleDeleteTask}
                  className="px-8 py-4 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-black rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-[0.2em] border border-red-500/20 hover:border-red-500 shadow-sm"
                >
                  ลบงาน
                </button>
                <button 
                  onClick={handleEditTask}
                  className="px-8 py-4 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white font-black rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-[0.2em] border border-brand-primary/20 hover:border-brand-primary shadow-sm"
                >
                  แก้ไขงาน
                </button>
                <button 
                  onClick={() => setViewingTask(null)}
                  className="px-10 py-4 bg-navy-elevated hover:bg-navy-elevated/80 text-white font-black rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-[0.2em] shadow-xl shadow-black/20"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-[#27272a] w-full max-w-2xl max-h-[95vh] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="p-6 border-b border-[#27272a] flex justify-between items-center bg-[#09090b]/50 flex-shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-3 tracking-tight">
                {isEditing ? <Plus className="text-blue-500 rotate-45" /> : <Plus className="text-blue-500" />}
                {isEditing ? 'แก้ไขภารกิจ' : `เพิ่มงานวันที่ ${format(selectedDate, 'd MMMM', { locale: th })} ${selectedDate.getFullYear() + 543}`}
              </h3>
              <button onClick={() => {
                setIsModalOpen(false);
                setIsEditing(false);
              }} className="text-[#a1a1aa] hover:text-white transition-colors p-1 hover:bg-[#27272a] rounded-lg">
                <X size={24} />
              </button>
            </div>
            
            <form id="add-task-form" onSubmit={handleAddTask} className="flex-1 overflow-y-auto scrollbar-hide p-8 space-y-6 text-[#fafafa]">
              <div className="space-y-2">
                <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest">งาน/กิจกรรม/โครงการ</label>
                <input 
                  autoFocus
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-all placeholder:text-[#3f3f46]"
                  placeholder="ระบุชื่องาน..."
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest">รายละเอียด</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-all min-h-[100px] placeholder:text-[#3f3f46]"
                  placeholder="รายละเอียดงาน..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest">งานที่ต้องทำก่อน (Dependencies)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-40 overflow-y-auto p-4 bg-[#09090b] border border-[#27272a] rounded-2xl shadow-inner custom-scrollbar">
                  {tasks.filter(t => !isEditing || t.id !== viewingTask?.id).map(t => (
                    <label key={t.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#27272a]/50 cursor-pointer transition-colors border border-transparent hover:border-[#27272a]">
                      <input 
                        type="checkbox"
                        checked={dependencies.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDependencies([...dependencies, t.id]);
                          } else {
                            setDependencies(dependencies.filter(id => id !== t.id));
                          }
                        }}
                        className="w-5 h-5 rounded-lg border-2 border-[#27272a] bg-transparent checked:bg-blue-600 checked:border-blue-600 transition-all"
                      />
                      <span className="text-xs font-medium text-[#a1a1aa] truncate">{t.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest flex items-center gap-2">
                    <User className="w-3 h-3" /> ผู้รับผิดชอบ (เลือกได้หลายคน)
                  </label>
                  <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar shadow-inner">
                    {teamMembers.filter(m => m.isManual).map(m => (
                      <label key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#27272a]/50 cursor-pointer transition-colors group">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox"
                            checked={assigneeIds.includes(m.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssigneeIds([...assigneeIds, m.id]);
                              } else {
                                setAssigneeIds(assigneeIds.filter(id => id !== m.id));
                              }
                            }}
                            className="w-5 h-5 rounded-lg border-2 border-[#27272a] bg-transparent checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer appearance-none"
                          />
                          {assigneeIds.includes(m.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />}
                        </div>
                        <span className={cn(
                          "text-xs font-medium transition-colors",
                          assigneeIds.includes(m.id) ? "text-white" : "text-[#a1a1aa]"
                        )}>
                          {m.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest flex items-center gap-2">
                    <UserCheck className="w-3 h-3" /> ผู้สร้าง/ผู้ควบคุมงาน
                  </label>
                  <div className="relative group">
                    <select 
                      value={supervisorId || supervisorName}
                      onChange={(e) => {
                        const val = e.target.value;
                        const member = teamMembers.find(m => m.id === val || m.name === val);
                        if (member) {
                          setSupervisorId(member.id);
                          setSupervisorName(member.name);
                        } else {
                          setSupervisorId('');
                          setSupervisorName(val);
                        }
                      }}
                      className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer pr-10"
                      required
                    >
                      <option value="">เลือกผู้ควบคุมงาน...</option>
                      {teamMembers.filter(m => m.role !== 'Staff').map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({getRoleDisplayName(m.role)})</option>
                      ))}
                      <optgroup label="ผู้ใช้งานอื่น">
                        {teamMembers.filter(m => m.role === 'Staff').map(m => (
                          <option key={m.id} value={m.id}>{m.name} (Staff)</option>
                        ))}
                      </optgroup>
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-[#3f3f46] pointer-events-none group-hover:text-blue-500 transition-colors rotate-90" size={16} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest flex items-center gap-2">
                    <Tag className="w-3 h-3" /> สถานะ
                  </label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="Pending">รอดำเนินการ</option>
                    <option value="In Progress">กำลังดำเนินการ</option>
                    <option value="Completed">เสร็จสิ้น</option>
                    <option value="On Hold">ระงับชั่วคราว</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest flex items-center gap-2">
                    <Building2 className="w-3 h-3" /> ส่วนงาน
                  </label>
                  <select 
                    value={ownerName}
                    onChange={(e) => {
                      const owner = taskOwners.find(o => o.name === e.target.value);
                      setOwnerName(e.target.value);
                      if (owner) {
                        const dept = departments.find(d => d.id === owner.departmentId);
                        if (dept) setOwnerDepartment(dept.name);
                      }
                    }}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
                    required
                  >
                    <option value="">เลือกส่วนงาน...</option>
                    {taskOwners.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest">หน่วยงาน/สำนัก</label>
                  <select 
                    value={ownerDepartment}
                    onChange={(e) => setOwnerDepartment(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
                    required
                  >
                    <option value="">เลือกหน่วยงาน/สำนัก...</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest">โครงการ/งานที่รับผิดชอบ</label>
                <input 
                  type="text" 
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-all placeholder:text-[#3f3f46]"
                  placeholder="ระบุชื่อโครงการ หรือ งานหลัก..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest flex items-center gap-2">
                    <Building2 className="w-3 h-3" /> งบประมาณ (Budget)
                  </label>
                  <input 
                    type="number" 
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-all font-medium"
                    placeholder="0.00"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" /> ค่าใช้จ่ายจริง (Actual Cost)
                  </label>
                  <input 
                    type="number" 
                    value={actualCost}
                    onChange={(e) => setActualCost(Number(e.target.value))}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-all font-medium"
                    placeholder="0.00"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest">วันที่เริ่ม</label>
                    {startDateStr && (
                      <span className="text-[10px] text-blue-400 font-black">พ.ศ. {getThaiYear(startDateStr)}</span>
                    )}
                  </div>
                  <input 
                    type="date" 
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-all cursor-pointer"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest">วันที่สิ้นสุด (ไม่บังคับ)</label>
                    {endDateStr && (
                      <span className="text-[10px] text-blue-400 font-black">พ.ศ. {getThaiYear(endDateStr)}</span>
                    )}
                  </div>
                  <input 
                    type="date" 
                    value={endDateStr}
                    onChange={(e) => setEndDateStr(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-all cursor-pointer"
                    min={startDateStr}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] text-[#a1a1aa] uppercase font-bold tracking-widest flex items-center justify-between">
                  <span className="flex items-center gap-2"><Paperclip className="w-3 h-3" /> ไฟล์แนบ</span>
                  <span className="text-[9px] normal-case font-medium text-[#3f3f46]">จำกัด 500KB ต่อไฟล์</span>
                </label>
                
                <div className="grid grid-cols-1 gap-3">
                  {attachments.map((file) => (
                    <div key={file.id} className="bg-[#09090b] border border-[#27272a] p-3 rounded-2xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                        {file.type.startsWith('image/') ? <ImageIcon size={16} /> : <FileIcon size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{file.name}</p>
                        <p className="text-[9px] text-[#a1a1aa]">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeAttachment(file.id)}
                        className="p-2 text-[#3f3f46] hover:text-red-400 transition-colors"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}
                  
                  <label className="border-2 border-dashed border-[#27272a] hover:border-blue-500/50 rounded-2xl p-4 transition-all cursor-pointer group">
                    <input 
                      type="file" 
                      className="hidden" 
                      multiple 
                      onChange={handleFileUpload}
                    />
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-[#27272a] group-hover:bg-blue-500/10 flex items-center justify-center text-[#a1a1aa] group-hover:text-blue-400 transition-all">
                        <Plus size={20} />
                      </div>
                      <p className="text-xs font-bold text-[#a1a1aa] group-hover:text-blue-400">เพิ่มไฟล์แนบหรือรูปภาพ</p>
                    </div>
                  </label>
                </div>
              </div>
            </form>

            <div className="p-8 border-t border-[#27272a] bg-[#09090b]/50 flex-shrink-0">
              <button 
                type="submit" 
                form="add-task-form"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-5 rounded-2xl shadow-lg shadow-blue-900/40 transition-all active:scale-[0.98]"
              >
                {isEditing ? 'ยืนยันการแก้ไข' : 'ยืนยันการเพิ่มงาน'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog 
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="ยืนยันการลบงาน?"
        message="คุณแน่ใจหรือไม่ว่าต้องการลบงานนี้? เมื่อลบแล้วจะไม่สามารถกู้คืนข้อมูลได้"
        confirmText="ยืนยันการลบ"
        cancelText="ยกเลิก"
        type="danger"
      />

      {selectedDayTasks && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedDayTasks(null)}
        >
          <div 
            className="bg-navy-surface border border-border-navy rounded-3xl p-6 w-80 shadow-2xl space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-black text-white text-sm">
              งานวันที่ {format(selectedDayTasks.date, 'd MMMM', { locale: th })}
            </h3>
            <div className="space-y-2">
              {selectedDayTasks.tasks.map(task => {
                const chip = TASK_STATUS_CHIP[task.status] || TASK_STATUS_CHIP['Pending'];
                return (
                  <div key={task.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer border border-white/5 transition-all hover:brightness-125",
                      chip.bg,
                      chip.text,
                      isOverdue(task) ? 'ring-1 ring-red-500/50' : ''
                    )}
                    title={task.title}
                    onClick={() => { 
                      setViewingTask(task);
                      setSelectedDayTasks(null); 
                    }}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${chip.dot}`} />
                    {isOverdue(task) && (
                      <span className="flex-shrink-0 text-red-400 text-[10px]" title="เกินกำหนด">⚠</span>
                    )}
                    <span>{task.title}</span>
                  </div>
                );
              })}
            </div>
            <button 
              onClick={() => setSelectedDayTasks(null)}
              className="w-full text-xs text-slate-500 hover:text-white transition-colors pt-2"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

