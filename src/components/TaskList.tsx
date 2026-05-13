import React, { useState, useEffect } from 'react';
import { formatThaiDate, cn, getRoleDisplayName, generateId, isSystemAdmin } from '../lib/utils';
import { ConfirmDialog } from './ConfirmDialog';
import { toast } from 'sonner';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Calendar as CalendarIcon,
  User,
  Building2,
  Tag,
  X,
  UserCheck,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  Paperclip,
  File as FileIcon,
  Image as ImageIcon,
  Trash,
  Download,
  MessageSquare,
  History,
  Send,
  CheckCircle2,
  Circle,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Brain,
  Zap,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import { th } from 'date-fns/locale';

function getDueDateStyle(endDate: string, status?: string) {
  if (!endDate) return 'text-slate-400';
  if (status === 'Completed') return 'text-emerald-400 font-bold';
  
  const end = parseISO(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // start of today
  
  const days = differenceInDays(end, today);
  
  if (days < 0)  return 'text-red-400 font-bold';   // overdue
  if (days <= 3) return 'text-orange-400 font-bold'; // urgent
  if (days <= 7) return 'text-yellow-400';            // warning
  return 'text-slate-400';
}
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { summarizeComments, analyzeTaskPriorityAndTags, predictProjectDelay } from '../services/geminiService';

import { Task, TaskStatus, Attachment, Comment, Activity, TeamMember } from '../types';

interface TaskListProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  taskOwners: { id: string; name: string; departmentId: string }[];
  departments: { id: string; name: string }[];
  userProfile: { id: string; name: string; photoURL?: string; role: string } | null;
  updateTask: (taskId: string, updatedData: Partial<Task>, existingTask?: Task) => Promise<void>;
  deleteTask: (taskId: string, user: any, userProfile: any, existingTask?: Task) => Promise<void>;
}

export function TaskList({ tasks, teamMembers, taskOwners, departments, userProfile, updateTask, deleteTask }: TaskListProps) {
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'details' | 'subtasks' | 'activity'>('details');
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{
    priority: string;
    reason: string;
    tags: string[];
    category: string;
  } | null>(null);

  // Form State for Editing
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState(''); // Keep for backward compatibility/primary
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerDepartment, setOwnerDepartment] = useState('');
  const [project, setProject] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Pending');
  const [endDateStr, setEndDateStr] = useState('');
  const [startDateStr, setStartDateStr] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [budget, setBudget] = useState<number>(0);
  const [actualCost, setActualCost] = useState<number>(0);
  const [delayPrediction, setDelayPrediction] = useState<{
    probability: number;
    reason: string;
  } | null>(null);

  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'All'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Reset page when filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const handleAISummarize = async () => {
    if (!viewingTask?.comments || viewingTask.comments.length === 0) {
      toast.info("ไม่มีความคิดเห็นให้สรุป");
      return;
    }
    setIsAnalyzing(true);
    try {
      const summary = await summarizeComments(viewingTask.comments);
      setAiSummary(summary);
      toast.success("สรุปเนื้อหาสำเร็จ");
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการสรุป");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAIAnalyze = async () => {
    if (!title) {
      toast.error("กรุณาระบุชื่องานก่อนวิเคราะห์");
      return;
    }
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeTaskPriorityAndTags({
        title,
        description,
        project,
        startDate: startDateStr,
        endDate: endDateStr
      });
      if (analysis) {
        setAiSuggestions(analysis);
        toast.success("วิเคราะห์งานสำเร็จ");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการวิเคราะห์");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePredictDelay = async () => {
    if (!viewingTask) return;
    setIsAnalyzing(true);
    try {
      const assignee = teamMembers.find(m => m.id === viewingTask.assigneeId);
      const prediction = await predictProjectDelay(viewingTask, assignee);
      setDelayPrediction(prediction);
      if (prediction) {
        toast.info(`ความเสี่ยงที่จะล่าช้า: ${prediction.probability}%`, {
          description: prediction.reason
        });
      }
    } catch (error) {
      toast.error("ไม่สามารถวิเคราะห์ความเสี่ยงได้");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyAISuggestions = () => {
    if (aiSuggestions) {
      // We can map AI priority to our system if needed, or just store it
      toast.success("นำข้อเสนอแนะไปใช้แล้ว");
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as TaskStatus;
    const task = tasks.find(t => t.id === draggableId);

    if (task && task.status !== newStatus) {
      try {
        await updateTask(task.id, { status: newStatus }, task);
        toast.success(`อัปเดตสถานะงานเป็น ${
          newStatus === 'Pending' ? 'รอดำเนินการ' : 
          newStatus === 'In Progress' ? 'กำลังดำเนินการ' : 
          newStatus === 'Completed' ? 'เสร็จสิ้น' : 'ระงับชั่วคราว'
        }`);
      } catch (error) {
        console.error("Error updating task status via drag:", error);
        toast.error("ไม่สามารถอัปเดตสถานะได้");
      }
    }
  };

  useEffect(() => {
    if (viewingTask) {
      const updatedTask = tasks.find(t => t.id === viewingTask.id);
      if (updatedTask) {
        const localCommentsCount = viewingTask.comments?.length || 0;
        const remoteCommentsCount = updatedTask.comments?.length || 0;
        
        if (remoteCommentsCount > localCommentsCount) {
          setViewingTask(updatedTask);
        }
      }
    }
  }, [tasks, viewingTask]);

  const normalizeDateString = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    let year = parseInt(parts[0]);
    if (year > 2400) year -= 543;
    return `${year}-${parts[1]}-${parts[2]}`;
  };

  const formatThaiDateInternal = (dateStr: string) => {
    return formatThaiDate(dateStr);
  };

  const filteredTasks = React.useMemo(() => tasks.filter(task => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = (
      (task.title || '').toLowerCase().includes(search) ||
      (task.project || '').toLowerCase().includes(search) ||
      (task.ownerName || '').toLowerCase().includes(search) ||
      (task.ownerDepartment || '').toLowerCase().includes(search)
    );
    const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [tasks, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const paginatedTasks = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTasks.slice(start, start + itemsPerPage);
  }, [filteredTasks, currentPage, itemsPerPage]);

  const handleEditClick = (task: Task) => {
    setViewingTask(task);
    setAiSummary(null);
    setAiSuggestions(null);
    setTitle(task.title);
    setDescription(task.description);
    setAssigneeId(task.assigneeId);
    setAssigneeIds(task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []));
    setSupervisorId(task.supervisorId || '');
    setSupervisorName(task.supervisorName || '');
    setOwnerName(task.ownerName);
    setOwnerDepartment(task.ownerDepartment);
    setProject(task.project);
    setStatus(task.status);
    setEndDateStr(task.endDate || '');
    setStartDateStr(task.startDate);
    setAttachments(task.attachments || []);
    setDependencies(task.dependencies || []);
    setBudget(task.budget || 0);
    setActualCost(task.actualCost || 0);
    setDelayPrediction(null);
    setIsEditing(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const { storageService } = await import('../services/storageService');
    const toastId = toast.loading('กำลังอัปโหลดไฟล์...');

    const ALLOWED_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    try {
      const uploadPromises = Array.from(files).map(async (file: File) => {
        // Validation: Size
        if (file.size > 2 * 1024 * 1024) {
          toast.error(`ไฟล์ ${file.name} มีขนาดใหญ่เกินไป (จำกัด 2MB)`);
          return null;
        }

        // Validation: MIME Type
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error(`ไฟล์ ${file.name} มีประเภทไม่ถูกต้องหรือไม่ได้รับอนุญาต`);
          return null;
        }

        // Sanitization: Filename
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_ก-๙]/g, '_').substring(0, 100);
        const path = `tasks/${Date.now()}_${safeFileName}`;
        
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

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (viewingTask) {
      if (budget < 0 || actualCost < 0) {
        toast.error('งบประมาณและค่าใช้จ่ายจริงต้องไม่ติดลบ');
        return;
      }
      try {
        await updateTask(viewingTask.id, {
          title,
          description,
          status,
          assigneeId: assigneeIds[0] || '', // Use first as primary for compatibility
          assigneeIds,
          supervisorId,
          supervisorName,
          ownerName,
          ownerDepartment,
          startDate: normalizeDateString(startDateStr),
          endDate: normalizeDateString(endDateStr || startDateStr),
          project,
          attachments,
          dependencies,
          budget,
          actualCost,
          aiPriority: aiSuggestions?.priority || viewingTask.aiPriority,
          aiPriorityReason: aiSuggestions?.reason || viewingTask.aiPriorityReason,
          aiTags: aiSuggestions?.tags || viewingTask.aiTags,
          aiCategory: aiSuggestions?.category || viewingTask.aiCategory
        }, viewingTask);
        setIsEditing(false);
        setViewingTask(null);
        setAiSummary(null);
        setAiSuggestions(null);
      } catch (error) {
        console.error("Error updating task:", error);
      }
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setDeletingTaskId(taskId);
  };

  const confirmDelete = () => {
    if (deletingTaskId) {
      const taskToDelete = tasks.find(t => t.id === deletingTaskId);
      deleteTask(deletingTaskId, null, userProfile, taskToDelete);
      setDeletingTaskId(null);
      setViewingTask(null);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !viewingTask || !userProfile) return;

    if (newComment.length > 1000) {
      toast.error('ความคิดเห็นต้องยาวไม่เกิน 1,000 ตัวอักษร');
      return;
    }

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

  const getStatusDotColor = (status: TaskStatus) => {
    switch (status) {
      case 'Completed': return 'bg-green-500';
      case 'In Progress': return 'bg-blue-500';
      case 'Review': return 'bg-purple-500';
      case 'Pending': return 'bg-amber-500';
      case 'On Hold': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'Completed': return 'text-green-400';
      case 'In Progress': return 'text-blue-400';
      case 'Review': return 'text-purple-400';
      case 'Pending': return 'text-amber-400';
      case 'On Hold': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-10 animate-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight">รายการงานที่ได้รับมอบหมาย</h2>
          <p className="text-white/40 font-medium mt-1">ติดตามสถานะและรายละเอียดของแต่ละโครงการอย่างเป็นระบบ</p>
        </div>
        
        <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
          <div className="flex items-center bg-navy-elevated p-1 rounded-xl border border-border-navy shadow-inner">
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-brand-primary text-white shadow-lg" : "text-slate-500 hover:text-white"
              )}
              title="มุมมองรายการ"
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'kanban' ? "bg-brand-primary text-white shadow-lg" : "text-slate-500 hover:text-white"
              )}
              title="มุมมองคัมบัง"
            >
              <LayoutGrid size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2 bg-navy-input border border-border-navy rounded-2xl px-4 py-1 shadow-inner min-w-[160px]">
            <Filter size={16} className="text-slate-500" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-white text-sm font-bold outline-none py-2.5 cursor-pointer w-full"
            >
              <option value="All" className="bg-navy-surface">ทุกสถานะ</option>
              <option value="Pending" className="bg-navy-surface">รอดำเนินการ</option>
              <option value="In Progress" className="bg-navy-surface">กำลังดำเนินการ</option>
              <option value="Completed" className="bg-navy-surface">เสร็จสิ้น</option>
              <option value="On Hold" className="bg-navy-surface">ระงับชั่วคราว</option>
            </select>
          </div>

          <div className="relative group flex-1 md:flex-none">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="ค้นหางาน..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-3.5 bg-navy-input border border-border-navy rounded-2xl text-white focus:outline-none focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary transition-all w-full md:w-80 placeholder:text-slate-600 shadow-inner font-medium"
            />
          </div>
        </div>
      </header>

      {viewMode === 'list' ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-5">
            {paginatedTasks.length > 0 ? (
              paginatedTasks.map((task, index) => {
              const assignee = teamMembers.find(m => m.id === task.assigneeId);

              return (
                <div 
                  key={task.id} 
                  onClick={() => setViewingTask(task)}
                  className={cn(
                    "bg-navy-surface border border-border-navy hover:border-blue-500/30 p-8 flex flex-col lg:flex-row lg:items-center gap-8 group cursor-pointer animate-in rounded-[2rem] transition-all",
                    `stagger-${(index % 4) + 1}`
                  )}
                >
                  {/* Status & ID */}
                  <div className="flex lg:flex-col items-center lg:items-start gap-4 lg:gap-2 min-w-[140px]">
                    <span className="text-[10px] font-mono text-slate-600 select-all" title="Task ID">
                      #{task.id?.substring(0, 6).toUpperCase()}
                    </span>
                    <StatusBadge status={task.status} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-xl font-display font-bold text-white group-hover:text-brand-primary transition-colors tracking-tight truncate">
                            {task.title}
                          </h3>
                          {task.aiPriority && (
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                              task.aiPriority === 'Urgent' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                              task.aiPriority === 'High' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                              task.aiPriority === 'Medium' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
                              'bg-slate-500/20 text-slate-400 border-slate-500/30'
                            )}>
                              {task.aiPriority}
                            </span>
                          )}
                        </div>
                        {(() => {
                          const cleanDesc = task.description?.replace(/\.+/g, '').trim();
                          return (
                            <p className="text-sm text-slate-500 line-clamp-1 font-medium mt-1">
                              {cleanDesc || <span className="italic text-slate-400">ไม่มีรายละเอียด</span>}
                            </p>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(task);
                          }}
                          className="p-2.5 text-slate-500 hover:text-brand-primary hover:bg-brand-primary/10 rounded-xl transition-all active:scale-90"
                          title="แก้ไขงาน"
                        >
                          <Edit2 size={18} />
                        </button>
                        {userProfile?.role === 'Administrator' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }}
                            className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all active:scale-90"
                            title="ลบงาน"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
                      <MetaItem 
                        icon={<Tag size={14} />} 
                        label="โครงการ" 
                        value={task.project?.trim() || <span className="italic text-slate-500">-</span>} 
                      />
                      <MetaItem 
                        icon={<CalendarIcon size={14} />} 
                        label="กำหนดส่ง" 
                        value={
                          <span className="flex items-center gap-1">
                            <span className={getDueDateStyle(task.endDate, task.status)}>{formatThaiDate(task.endDate)}</span>
                            {task.endDate && task.status !== 'Completed' && differenceInDays(parseISO(task.endDate), new Date().setHours(0,0,0,0)) < 0 && (
                              <span className="text-xs text-red-400 font-black ml-1">⚠ เกินกำหนด</span>
                            )}
                          </span>
                        } 
                      />
                      <MetaItem 
                        icon={<User size={14} />} 
                        label="ผู้รับผิดชอบ" 
                        value={
                          <div className="flex -space-x-2 overflow-hidden">
                            {(task.assigneeIds && task.assigneeIds.length > 0) ? (
                              task.assigneeIds.map(id => {
                                const member = teamMembers.find(m => m.id === id);
                                return (
                                  <div 
                                    key={id} 
                                    className="w-6 h-6 rounded-lg bg-brand-primary/10 border border-navy-elevated flex items-center justify-center text-[10px] font-bold text-brand-primary overflow-hidden shadow-sm"
                                    title={member?.name || 'ไม่ทราบชื่อ'}
                                  >
                                    {member?.photoURL ? (
                                      <img src={member.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      member?.name.charAt(0) || '?'
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div 
                                className="w-6 h-6 rounded-lg bg-brand-primary/10 border border-navy-elevated flex items-center justify-center text-[10px] font-bold text-brand-primary overflow-hidden shadow-sm"
                                title={teamMembers.find(m => m.id === task.assigneeId)?.name || 'ไม่ระบุ'}
                              >
                                {teamMembers.find(m => m.id === task.assigneeId)?.photoURL ? (
                                  <img src={teamMembers.find(m => m.id === task.assigneeId)?.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  teamMembers.find(m => m.id === task.assigneeId)?.name.charAt(0) || '?'
                                )}
                              </div>
                            )}
                          </div>
                        } 
                      />
                      <MetaItem 
                        icon={<Building2 size={14} />} 
                        label="ส่วนงาน" 
                        value={task.ownerName?.trim() || <span className="italic text-slate-500">ไม่ระบุ</span>} 
                      />
                      {task.attachments && task.attachments.length > 0 && (
                        <MetaItem icon={<Paperclip size={14} className="text-brand-primary" />} label="ไฟล์แนบ" value={`${task.attachments.length} ไฟล์`} />
                      )}
                    </div>

                    {task.subtasks && task.subtasks.length > 0 && (() => {
                      const done = task.subtasks.filter(s => s.completed).length;
                      const total = task.subtasks.length;
                      const pct = Math.round((done / total) * 100);
                      return (
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-navy-base rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 font-bold whitespace-nowrap">{done}/{total} งานย่อย</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Supervisor Avatar */}
                  <div className="flex items-center gap-6 pl-10 border-l border-border-navy hidden lg:flex min-w-[240px]">
                    {(() => {
                      const assignee = teamMembers.find(m => m.id === task.assigneeId);
                      const supervisor = teamMembers.find(m => m.id === task.supervisorId);
                      return (
                        <div className="flex flex-col items-center gap-2 min-w-[100px] flex-1">
                          <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.25em] mb-1">
                            {supervisor ? 'Supervisor' : 'Assignee'}
                          </span>
                          <div
                            className="w-14 h-14 rounded-2xl bg-blue-500/10 border-2 border-blue-500/20 flex items-center justify-center cursor-pointer overflow-hidden shadow-lg group-hover:border-brand-primary/40 transition-all duration-300"
                            title={supervisor?.name || assignee?.name || 'ไม่ระบุ'}
                          >
                            {(supervisor?.photoURL || assignee?.photoURL)
                              ? <img src={supervisor?.photoURL || assignee?.photoURL} className="w-full h-full object-cover rounded-2xl group-hover:scale-110 transition-all duration-500" referrerPolicy="no-referrer" />
                              : <UserCheck className="text-blue-400" size={24} />
                            }
                          </div>
                          <span className="text-[13px] font-bold text-slate-300 text-center leading-tight max-w-[160px] truncate group-hover:text-white transition-colors">
                            {supervisor?.name || assignee?.name || '-'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-navy-surface border border-border-navy border-dashed rounded-[2rem] p-20 text-center space-y-6">
              <div className="w-24 h-24 bg-navy-base rounded-3xl flex items-center justify-center mx-auto border border-border-navy shadow-inner">
                <List size={48} className="text-slate-700" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-bold text-white">ไม่พบรายการงาน</h3>
                <p className="text-slate-500 font-medium max-w-xs mx-auto">
                  {searchTerm 
                    ? `ไม่พบงานที่ตรงกับคำค้นหา "${searchTerm}"` 
                    : "ยังไม่มีรายการงานในระบบ หรือไม่มีงานที่ตรงกับเงื่อนไขการกรอง"}
                </p>
              </div>
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="px-6 py-2.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                >
                  ล้างการค้นหา
                </button>
              )}
            </div>
          )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-navy-surface/50 border border-border-navy p-6 rounded-[2rem]">
              <div className="text-sm font-medium text-slate-500">
                แสดง <span className="text-white font-bold">{((currentPage - 1) * itemsPerPage) + 1}</span> ถึง <span className="text-white font-bold">{Math.min(currentPage * itemsPerPage, filteredTasks.length)}</span> จากทั้งหมด <span className="text-white font-bold">{filteredTasks.length}</span> รายการ
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2.5 rounded-xl bg-navy-elevated border border-border-navy text-slate-400 hover:text-white hover:border-brand-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="หน้าแรก"
                >
                  <ChevronsLeft size={18} />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2.5 rounded-xl bg-navy-elevated border border-border-navy text-slate-400 hover:text-white hover:border-brand-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex items-center gap-1.5 px-2">
                  {(() => {
                    const pages = [];
                    const maxVisible = 3;
                    let start = Math.max(1, currentPage - 1);
                    let end = Math.min(totalPages, start + maxVisible - 1);
                    
                    if (end - start + 1 < maxVisible) {
                      start = Math.max(1, end - maxVisible + 1);
                    }

                    for (let i = start; i <= end; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          className={cn(
                            "w-10 h-10 rounded-xl font-bold transition-all",
                            currentPage === i 
                              ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-110" 
                              : "bg-navy-elevated border border-border-navy text-slate-400 hover:text-white hover:border-brand-primary/30"
                          )}
                        >
                          {i}
                        </button>
                      );
                    }
                    return pages;
                  })()}
                  {totalPages > 3 && currentPage < totalPages - 1 && (
                    <span className="text-slate-600 px-1 font-black">...</span>
                  )}
                  {totalPages > 3 && currentPage < totalPages - 1 && (
                     <button
                      onClick={() => setCurrentPage(totalPages)}
                      className={cn(
                        "w-10 h-10 rounded-xl font-bold transition-all",
                        currentPage === totalPages 
                          ? "bg-brand-primary text-white shadow-lg" 
                          : "bg-navy-elevated border border-border-navy text-slate-400 hover:text-white"
                      )}
                    >
                      {totalPages}
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2.5 rounded-xl bg-navy-elevated border border-border-navy text-slate-400 hover:text-white hover:border-brand-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="หน้าถัดไป"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2.5 rounded-xl bg-navy-elevated border border-border-navy text-slate-400 hover:text-white hover:border-brand-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="หน้าสุดท้าย"
                >
                  <ChevronsRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar min-h-[600px]">
            {(['Pending', 'In Progress', 'Review', 'Completed', 'On Hold'] as TaskStatus[]).map((columnStatus) => (
              <div key={columnStatus} className="flex-1 min-w-[320px] flex flex-col gap-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.3)]", getStatusDotColor(columnStatus))} />
                    <h3 className="text-sm font-black text-white/60 uppercase tracking-widest">
                      {columnStatus === 'Pending' ? 'รอดำเนินการ' : 
                       columnStatus === 'In Progress' ? 'กำลังดำเนินการ' : 
                       columnStatus === 'Review' ? 'รอตรวจสอบ' :
                       columnStatus === 'Completed' ? 'เสร็จสิ้น' : 'ระงับชั่วคราว'}
                    </h3>
                  </div>
                  <span className="text-[10px] font-black text-white/20 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                    {filteredTasks.filter(t => t.status === columnStatus).length}
                  </span>
                </div>

                <Droppable droppableId={columnStatus}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={cn(
                        "flex-1 bg-navy-base/30 border border-border-navy/50 rounded-[2rem] p-4 transition-all min-h-[500px]",
                        snapshot.isDraggingOver && "bg-brand-primary/5 border-brand-primary/20 ring-4 ring-brand-primary/5"
                      )}
                    >
                      <div className="space-y-4">
                        {filteredTasks
                          .filter(t => t.status === columnStatus)
                          .map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => setViewingTask(task)}
                                  className={cn(
                                    "bg-navy-surface p-5 rounded-2xl border border-border-navy hover:border-blue-500/30 transition-all cursor-pointer group relative",
                                    snapshot.isDragging && "shadow-2xl border-brand-primary/50 rotate-2 scale-105 z-50"
                                  )}
                                >
                                  <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="text-[10px] font-mono text-slate-600 select-all" title="Task ID">
                                        #{task.id?.substring(0, 6).toUpperCase()}
                                      </span>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleEditClick(task); }}
                                          className="p-1.5 text-slate-500 hover:text-brand-primary rounded-lg transition-colors"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        {userProfile?.role === 'Administrator' && (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                            className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors line-clamp-2 leading-tight">
                                        {task.title}
                                      </h4>
                                      {task.aiPriority && (
                                        <span className={cn(
                                          "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border",
                                          task.aiPriority === 'Urgent' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                                          task.aiPriority === 'High' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                                          task.aiPriority === 'Medium' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
                                          'bg-slate-500/20 text-slate-400 border-slate-500/30'
                                        )}>
                                          {task.aiPriority}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-col gap-2 pt-2 border-t border-border-navy">
                                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                                        <Tag size={10} className="text-brand-primary/50" />
                                        <span className="truncate">{task.project?.trim() || <span className="italic text-slate-500">-</span>}</span>
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                                          <CalendarIcon size={10} className="text-brand-primary/50" />
                                          <span className={getDueDateStyle(task.endDate, task.status)}>{formatThaiDate(task.endDate)}</span>
                                          {task.endDate && task.status !== 'Completed' && differenceInDays(parseISO(task.endDate), new Date().setHours(0,0,0,0)) < 0 && (
                                            <span className="text-[8px] text-red-400 font-black">⚠ เกินกำหนด</span>
                                          )}
                                        </div>
                                        <div className="flex -space-x-1.5 overflow-hidden">
                                          {(task.assigneeIds && task.assigneeIds.length > 0) ? (
                                            task.assigneeIds.map(id => {
                                              const member = teamMembers.find(m => m.id === id);
                                              return (
                                                <div 
                                                  key={id} 
                                                  className="w-6 h-6 rounded-lg bg-brand-primary/10 border border-navy-elevated flex items-center justify-center text-[10px] font-bold text-brand-primary overflow-hidden shadow-sm"
                                                  title={member?.name || 'ไม่ทราบชื่อ'}
                                                >
                                                  {member?.photoURL ? (
                                                    <img src={member.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                  ) : (
                                                    member?.name.charAt(0) || '?'
                                                  )}
                                                </div>
                                              );
                                            })
                                          ) : (
                                            <div 
                                              className="w-6 h-6 rounded-lg bg-brand-primary/10 border border-navy-elevated flex items-center justify-center text-[10px] font-bold text-brand-primary overflow-hidden shadow-sm"
                                              title={teamMembers.find(m => m.id === task.assigneeId)?.name || 'ไม่ระบุ'}
                                            >
                                              {teamMembers.find(m => m.id === task.assigneeId)?.photoURL ? (
                                                <img src={teamMembers.find(m => m.id === task.assigneeId)?.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                              ) : (
                                                teamMembers.find(m => m.id === task.assigneeId)?.name.charAt(0) || '?'
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {task.subtasks && task.subtasks.length > 0 && (() => {
                                        const done = task.subtasks.filter(s => s.completed).length;
                                        const total = task.subtasks.length;
                                        const pct = Math.round((done / total) * 100);
                                        return (
                                          <div className="mt-1 flex items-center gap-2">
                                            <div className="flex-1 h-1 bg-navy-base rounded-full overflow-hidden">
                                              <div
                                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%` }}
                                              />
                                            </div>
                                            <span className="text-[8px] text-slate-500 font-bold whitespace-nowrap">{done}/{total}</span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      {/* View Task Details Modal */}
      {viewingTask && !isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-navy-surface border border-border-navy w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-border-navy flex justify-between items-center bg-navy-base/30">
              <div className="flex items-center gap-5">
                <div className={cn("w-3 h-3 rounded-full shadow-lg", getStatusDotColor(viewingTask.status))} />
                <h3 className="text-2xl font-display font-bold text-white tracking-tight">รายละเอียดภารกิจ</h3>
              </div>
              <button onClick={() => setViewingTask(null)} className="text-slate-500 hover:text-white transition-all p-2 hover:bg-white/5 rounded-xl active:scale-90">
                <X size={24} />
              </button>
            </div>

            <div className="flex border-b border-border-navy bg-navy-base/10">
              <button 
                onClick={() => setActiveModalTab('details')}
                className={cn(
                  "flex-1 py-5 text-sm font-bold flex items-center justify-center gap-3 transition-all border-b-2",
                  activeModalTab === 'details' ? "text-brand-primary border-brand-primary bg-brand-primary/5" : "text-slate-500 border-transparent hover:text-white hover:bg-navy-elevated"
                )}
              >
                <Tag size={18} /> รายละเอียด
              </button>
              <button 
                onClick={() => setActiveModalTab('subtasks')}
                className={cn(
                  "flex-1 py-5 text-sm font-bold flex items-center justify-center gap-3 transition-all border-b-2",
                  activeModalTab === 'subtasks' ? "text-brand-primary border-brand-primary bg-brand-primary/5" : "text-slate-500 border-transparent hover:text-white hover:bg-navy-elevated"
                )}
              >
                <CheckSquare size={18} /> งานย่อย ({viewingTask.subtasks?.length || 0})
              </button>
              <button 
                onClick={() => setActiveModalTab('activity')}
                className={cn(
                  "flex-1 py-5 text-sm font-bold flex items-center justify-center gap-3 transition-all border-b-2",
                  activeModalTab === 'activity' ? "text-brand-primary border-brand-primary bg-brand-primary/5" : "text-slate-500 border-transparent hover:text-white hover:bg-navy-elevated"
                )}
              >
                <History size={18} /> ความเคลื่อนไหว
              </button>
            </div>

            <div className="p-10 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {activeModalTab === 'details' ? (
                <>
                  <div className="space-y-4">
                    <h4 className="text-3xl font-display font-bold text-white leading-tight tracking-tight">{viewingTask.title}</h4>
                    <div className="flex flex-wrap gap-3 mt-6">
                      <span className={cn("px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] bg-navy-base border border-border-navy shadow-inner", getStatusColor(viewingTask.status))}>
                        {viewingTask.status === 'Pending' ? 'รอดำเนินการ' : 
                         viewingTask.status === 'In Progress' ? 'กำลังดำเนินการ' : 
                         viewingTask.status === 'Completed' ? 'เสร็จสิ้น' : 'ระงับชั่วคราว'}
                      </span>
                      <span className="px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] text-brand-primary bg-brand-primary/5 border border-brand-primary/20 shadow-inner">
                        {viewingTask.project}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                          <User className="w-3.5 h-3.5" /> ผู้รับผิดชอบ (Assignees)
                        </label>
                        <div className="space-y-2">
                          {(viewingTask.assigneeIds && viewingTask.assigneeIds.length > 0) ? (
                            viewingTask.assigneeIds.map(id => {
                              const member = teamMembers.find(m => m.id === id);
                              return (
                                <div key={id} className="bg-navy-input p-4 rounded-2xl border border-border-navy shadow-inner group flex items-center gap-4 hover:border-brand-primary/30 transition-all">
                                  <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary overflow-hidden shadow-inner shrink-0">
                                    {member?.photoURL ? (
                                      <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <User size={20} />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold text-sm truncate">{member?.name || 'ไม่ทราบชื่อ'}</p>
                                    <p className="text-[10px] text-slate-500 font-medium">{getRoleDisplayName(member?.role)}</p>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="bg-navy-input p-6 rounded-2xl border border-border-navy shadow-inner group hover:border-brand-primary/30 transition-all">
                              <p className="text-white font-bold text-lg">{teamMembers.find(m => m.id === viewingTask.assigneeId)?.name || 'ไม่ระบุ'}</p>
                              <p className="text-xs text-slate-500 mt-1 font-medium">{getRoleDisplayName(teamMembers.find(m => m.id === viewingTask.assigneeId)?.role)}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                          <UserCheck className="w-3.5 h-3.5" /> ผู้สร้าง/ผู้ควบคุมงาน
                        </label>
                        <div className="bg-navy-input p-6 rounded-2xl border border-border-navy shadow-inner group hover:border-brand-primary/30 transition-all">
                          <p className="text-white font-bold text-lg">
                            {(() => {
                              const supervisor = teamMembers.find(m => m.id === viewingTask.supervisorId) || 
                                               teamMembers.find(m => m.name === viewingTask.supervisorName);
                              return supervisor?.name || viewingTask.supervisorName || 'ไม่ระบุ';
                            })()}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 font-medium">
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

                      {viewingTask.dependencies && viewingTask.dependencies.length > 0 && (
                        <div className="space-y-3">
                          <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5" /> งานที่ต้องทำก่อน (Prerequisites)
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {viewingTask.dependencies.map(depId => {
                              const depTask = tasks.find(t => t.id === depId);
                              return (
                                <div key={depId} className="px-3 py-1.5 bg-navy-elevated border border-border-navy rounded-xl text-[10px] font-bold text-slate-400">
                                  {depTask?.title || 'Unknown Task'}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-8">
                      <div className="space-y-3">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5" /> ส่วนงาน / หน่วยงาน
                        </label>
                        <div className="bg-navy-input p-6 rounded-2xl border border-border-navy shadow-inner group hover:border-brand-primary/30 transition-all">
                          <p className="text-white font-bold text-lg">{viewingTask.ownerName}</p>
                          <p className="text-xs text-slate-500 mt-1 font-medium">{viewingTask.ownerDepartment}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                          <CalendarIcon className="w-3.5 h-3.5" /> ระยะเวลาดำเนินการ
                        </label>
                        <div className="bg-navy-input p-6 rounded-2xl border border-border-navy shadow-inner group hover:border-brand-primary/30 transition-all">
                          <p className="text-white font-bold text-lg">
                            {formatThaiDate(viewingTask.startDate)}
                            {viewingTask.endDate && normalizeDateString(viewingTask.endDate) !== normalizeDateString(viewingTask.startDate) && (
                              <span className="mx-2 text-slate-500">→</span>
                            )}
                            {viewingTask.endDate && normalizeDateString(viewingTask.endDate) !== normalizeDateString(viewingTask.startDate) && (
                              <span>{formatThaiDate(viewingTask.endDate)}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {viewingTask.attachments && viewingTask.attachments.length > 0 && (
                    <div className="space-y-6">
                      <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                        <Paperclip className="w-3.5 h-3.5" /> ไฟล์แนบ ({viewingTask.attachments.length})
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {viewingTask.attachments.map((file) => (
                          <div key={file.id} className="bg-navy-input border border-border-navy p-5 rounded-3xl flex flex-col gap-4 group hover:border-brand-primary/50 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary overflow-hidden shadow-inner">
                                {file.type.startsWith('image/') ? (
                                  <img src={file.url} alt={file.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <FileIcon size={24} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">{file.name}</p>
                                <p className="text-[10px] font-mono text-slate-600">{(file.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            
                            {file.type.startsWith('image/') && (
                              <div className="relative aspect-video rounded-2xl overflow-hidden border border-border-navy">
                                <img src={file.url} alt={file.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            )}

                            <a 
                              href={file.url} 
                              download={file.name}
                              className="flex items-center justify-center gap-2 w-full py-3 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-bold rounded-2xl transition-all active:scale-[0.98]"
                            >
                              <Download size={16} />
                              ดาวน์โหลดไฟล์
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments Section moved to Details tab for better visibility */}
                  <div className="space-y-6 pt-6 border-t border-border-navy">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5" /> ความคิดเห็น ({viewingTask.comments?.length || 0})
                      </label>
                      <button 
                        onClick={handleAISummarize}
                        disabled={isAnalyzing || !viewingTask.comments?.length}
                        className="flex items-center gap-2 px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                      >
                        {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        สรุปด้วย AI
                      </button>
                    </div>

                    {aiSummary && (
                      <div className="p-5 glass border border-brand-primary/30 bg-brand-primary/5 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-2 mb-3">
                          <Brain className="w-4 h-4 text-brand-primary" />
                          <span className="text-xs font-bold text-brand-primary uppercase tracking-widest">สรุปโดย AI</span>
                        </div>
                        <p className="text-sm text-white/80 leading-relaxed font-medium italic">"{aiSummary}"</p>
                      </div>
                    )}
                    
                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                      {viewingTask.comments && viewingTask.comments.length > 0 ? (
                        [...viewingTask.comments].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((comment) => (
                          <div key={comment.id} className="flex gap-4 group">
                            <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary text-sm font-bold border border-brand-primary/20 overflow-hidden shrink-0 shadow-inner">
                              {comment.userAvatar ? (
                                <img src={comment.userAvatar} alt={comment.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                comment.userName.charAt(0)
                              )}
                            </div>
                            <div className="flex-1 bg-navy-input border border-border-navy p-5 rounded-3xl rounded-tl-none shadow-sm group-hover:border-brand-primary/20 transition-all">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-white">{comment.userName}</span>
                                <span className="text-[10px] font-mono text-slate-600">
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
                              <p className="text-sm text-slate-400 leading-relaxed font-medium">{comment.text}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 bg-navy-base/30 border border-border-navy border-dashed rounded-3xl">
                          <p className="text-sm text-slate-600 font-medium tracking-wide">ยังไม่มีความคิดเห็น</p>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleCommentSubmit} className="relative mt-6">
                      <input 
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="เขียนความคิดเห็น..."
                        className="w-full bg-navy-input border border-border-navy rounded-2xl py-4 pl-6 pr-14 text-sm text-white outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all shadow-inner font-medium"
                      />
                      <button 
                        type="submit"
                        disabled={!newComment.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-brand-primary hover:bg-brand-primary/10 rounded-xl transition-all disabled:opacity-20 active:scale-90"
                      >
                        <Send size={20} />
                      </button>
                    </form>
                  </div>
                </>
              ) : activeModalTab === 'subtasks' ? (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl font-display font-bold text-white">งานย่อย (Sub-tasks)</h4>
                    <div className="text-[10px] font-bold text-brand-primary uppercase tracking-widest px-3 py-1 bg-brand-primary/10 rounded-full border border-brand-primary/20">
                      {viewingTask.subtasks?.filter(s => s.completed).length || 0} / {viewingTask.subtasks?.length || 0} สำเร็จ
                    </div>
                  </div>

                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newSubtask.trim()) return;
                      const subtask = { id: generateId(), title: newSubtask.trim(), completed: false };
                      const updatedSubtasks = [...(viewingTask.subtasks || []), subtask];
                      await updateTask(viewingTask.id, { subtasks: updatedSubtasks }, viewingTask);
                      setNewSubtask('');
                    }}
                    className="relative"
                  >
                    <input 
                      type="text"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder="เพิ่มงานย่อยใหม่..."
                      className="w-full bg-navy-input border border-border-navy rounded-2xl py-4 pl-6 pr-14 text-sm text-white outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all shadow-inner font-medium"
                    />
                    <button 
                      type="submit"
                      disabled={!newSubtask.trim()}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-brand-primary hover:bg-brand-primary/10 rounded-xl transition-all disabled:opacity-20 active:scale-90"
                    >
                      <Plus size={20} />
                    </button>
                  </form>

                  <div className="space-y-4">
                    {viewingTask.subtasks && viewingTask.subtasks.length > 0 ? (
                      viewingTask.subtasks.map((subtask) => (
                        <div 
                          key={subtask.id} 
                          className="bg-navy-input border border-border-navy p-5 rounded-3xl flex items-center gap-4 group hover:border-brand-primary/30 transition-all"
                        >
                          <button 
                            onClick={async () => {
                              const updatedSubtasks = viewingTask.subtasks?.map(s => 
                                s.id === subtask.id ? { ...s, completed: !s.completed } : s
                              );
                              await updateTask(viewingTask.id, { subtasks: updatedSubtasks }, viewingTask);
                            }}
                            className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                              subtask.completed ? "bg-brand-primary text-white" : "border-2 border-border-navy hover:border-brand-primary/50"
                            )}
                          >
                            {subtask.completed && <CheckCircle2 size={14} />}
                          </button>
                          <span className={cn(
                            "flex-1 text-sm font-medium transition-all",
                            subtask.completed ? "text-slate-600 line-through" : "text-white"
                          )}>
                            {subtask.title}
                          </span>
                          <button 
                            onClick={async () => {
                              const updatedSubtasks = viewingTask.subtasks?.filter(s => s.id !== subtask.id);
                              await updateTask(viewingTask.id, { subtasks: updatedSubtasks }, viewingTask);
                            }}
                            className="p-2 text-white/10 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 glass border border-surface-border border-dashed rounded-3xl">
                        <p className="text-sm text-white/20 font-medium tracking-wide">ยังไม่มีงานย่อย</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-10">
                  {/* Activity Log Section */}
                  <div className="space-y-6">
                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                      <History className="w-3.5 h-3.5" /> ประวัติกิจกรรม
                    </label>
                    <div className="space-y-6 pl-2">
                      {viewingTask.activities && viewingTask.activities.length > 0 ? (
                        viewingTask.activities.slice().reverse().map((activity) => (
                          <div key={activity.id} className="flex gap-6 relative group">
                            <div className="w-px bg-border-navy absolute left-[15px] top-8 bottom-0 group-last:hidden" />
                            <div className="w-8 h-8 rounded-full bg-navy-base border border-border-navy flex items-center justify-center shrink-0 z-10 shadow-inner group-hover:border-brand-primary/50 transition-colors">
                              <div className="w-2 h-2 rounded-full bg-brand-primary shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
                            </div>
                            <div className="pb-6">
                              <p className="text-sm text-white font-semibold leading-snug">{activity.description}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{activity.userName}</span>
                                <span className="text-[10px] text-white/10">•</span>
                                <span className="text-[10px] font-mono text-slate-600">
                                  {(() => {
                                    try {
                                      const d = parseISO(activity.timestamp);
                                      if (!isValid(d)) return activity.timestamp;
                                      return `${format(d, 'd MMM', { locale: th })} ${d.getFullYear() + 543} ${format(d, 'HH:mm', { locale: th })}`;
                                    } catch (e) {
                                      return activity.timestamp;
                                    }
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 bg-navy-base/30 border border-border-navy border-dashed rounded-3xl">
                          <p className="text-sm text-slate-600 font-medium tracking-wide">ยังไม่มีประวัติกิจกรรม</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-border-navy bg-navy-base/30">
              <div className="flex justify-end gap-4">
                {userProfile?.role === 'Administrator' && (
                  <button 
                    onClick={() => handleDeleteTask(viewingTask.id)}
                    className="px-8 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                  >
                    ลบงาน
                  </button>
                )}
                <button 
                  onClick={() => handleEditClick(viewingTask)}
                  className="px-8 py-3.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary font-bold rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                >
                  แก้ไขงาน
                </button>
                <button 
                  onClick={() => setViewingTask(null)}
                  className="px-10 py-3.5 bg-navy-elevated hover:bg-navy-elevated/80 text-white font-bold rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest border border-white/5"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {isEditing && viewingTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-navy-surface border border-border-navy w-full max-w-2xl max-h-[95vh] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col">
            <div className="p-8 border-b border-border-navy flex justify-between items-center bg-navy-base/30 flex-shrink-0">
              <h3 className="text-2xl font-display font-bold text-white flex items-center gap-4 tracking-tight">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                  <Edit2 size={20} />
                </div>
                แก้ไขภารกิจ
              </h3>
              <button onClick={() => {
                setIsEditing(false);
                setViewingTask(null);
              }} className="text-slate-500 hover:text-white transition-all p-2 hover:bg-white/5 rounded-xl active:scale-90">
                <X size={24} />
              </button>
            </div>
            
            <form id="edit-task-form" onSubmit={handleUpdateTask} className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8 text-white">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">งาน/กิจกรรม/โครงการ</label>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={handlePredictDelay}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                      >
                        {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        วิเคราะห์ความเสี่ยง
                      </button>
                      <button 
                        type="button"
                        onClick={handleAIAnalyze}
                        disabled={isAnalyzing || !title}
                        className="flex items-center gap-2 px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                      >
                        {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                        วิเคราะห์งานด้วย AI
                      </button>
                    </div>
                </div>
                <input 
                  autoFocus
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-navy-input border border-border-navy rounded-2xl p-5 text-white outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary transition-all placeholder:text-slate-600 font-medium shadow-inner"
                  placeholder="ระบุชื่องาน..."
                  required
                />
              </div>

              {delayPrediction && (
                <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-[2rem] flex items-start gap-4 animate-in slide-in-from-top-4 duration-500">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">AI Delay Prediction</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-bold",
                        delayPrediction.probability > 70 ? "bg-red-500 text-white" :
                        delayPrediction.probability > 30 ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
                      )}>
                        {delayPrediction.probability}% Risk
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{delayPrediction.reason}</p>
                  </div>
                </div>
              )}

              {aiSuggestions && (
                <div className="p-6 glass border border-brand-primary/30 bg-brand-primary/5 rounded-[2rem] space-y-4 animate-in fade-in zoom-in duration-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand-primary" />
                      <span className="text-xs font-bold text-brand-primary uppercase tracking-widest">ข้อเสนอแนะจาก AI</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setAiSuggestions(null)}
                      className="text-white/20 hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">ลำดับความสำคัญที่แนะนำ</p>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                          aiSuggestions.priority === 'Urgent' ? "bg-red-500/20 text-red-400" :
                          aiSuggestions.priority === 'High' ? "bg-orange-500/20 text-orange-400" :
                          aiSuggestions.priority === 'Medium' ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"
                        )}>
                          {aiSuggestions.priority}
                        </span>
                        <p className="text-xs text-slate-400 italic">{aiSuggestions.reason}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">หมวดหมู่ที่แนะนำ</p>
                      <p className="text-xs text-white font-medium">{aiSuggestions.category}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">แท็กที่แนะนำ</p>
                    <div className="flex flex-wrap gap-2">
                      {aiSuggestions.tags.map((tag: string) => (
                        <span key={tag} className="px-2 py-1 bg-navy-elevated border border-border-navy rounded-lg text-[10px] text-slate-400 font-medium">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-navy-input border border-border-navy rounded-2xl p-5 text-white outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary transition-all min-h-[120px] placeholder:text-slate-600 font-medium shadow-inner"
                  placeholder="รายละเอียดงาน..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" /> งบประมาณ (Budget)
                  </label>
                  <input 
                    type="number" 
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full bg-navy-input border border-border-navy rounded-2xl p-4 text-white outline-none focus:border-brand-primary/50 transition-all font-medium"
                    placeholder="0.00"
                    min="0"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5" /> ค่าใช้จ่ายจริง (Actual Cost)
                  </label>
                  <input 
                    type="number" 
                    value={actualCost}
                    onChange={(e) => setActualCost(Number(e.target.value))}
                    className="w-full bg-navy-input border border-border-navy rounded-2xl p-4 text-white outline-none focus:border-brand-primary/50 transition-all font-medium"
                    placeholder="0.00"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> ผู้รับผิดชอบ (เลือกได้หลายคน)
                  </label>
                  <div className="bg-navy-input border border-border-navy rounded-2xl p-4 space-y-3 max-h-48 overflow-y-auto custom-scrollbar shadow-inner">
                    {teamMembers.filter(m => m.isManual).map(m => (
                      <label key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-navy-elevated cursor-pointer transition-colors group">
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
                            className="w-5 h-5 rounded-lg border-2 border-border-navy bg-transparent checked:bg-brand-primary checked:border-brand-primary transition-all cursor-pointer appearance-none"
                          />
                          {assigneeIds.includes(m.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-brand-primary/10 overflow-hidden shrink-0 border border-border-navy">
                          {m.photoURL ? (
                            <img src={m.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-brand-primary">
                              {m.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className={cn(
                          "text-sm font-medium transition-colors",
                          assigneeIds.includes(m.id) ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                        )}>
                          {m.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5" /> สถานะ
                  </label>
                  <div className="relative group">
                    <select 
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TaskStatus)}
                      className="w-full bg-navy-input border border-border-navy rounded-2xl p-5 text-white outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary appearance-none cursor-pointer font-medium shadow-inner transition-all"
                    >
                      <option value="Pending">รอดำเนินการ</option>
                      <option value="In Progress">กำลังดำเนินการ</option>
                      <option value="Completed">เสร็จสิ้น</option>
                      <option value="On Hold">ระงับชั่วคราว</option>
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none group-hover:text-brand-primary transition-colors">
                      <Plus size={18} className="rotate-45" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">งานที่ต้องทำก่อน (Dependencies)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-4 bg-navy-input border border-border-navy rounded-2xl shadow-inner custom-scrollbar">
                  {tasks.filter(t => t.id !== viewingTask.id).map(t => (
                    <label key={t.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-navy-elevated cursor-pointer transition-colors border border-transparent hover:border-border-navy">
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
                        className="w-5 h-5 rounded-lg border-2 border-border-navy bg-transparent checked:bg-brand-primary checked:border-brand-primary transition-all"
                      />
                      <span className="text-xs font-medium text-slate-400 truncate">{t.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5" /> ผู้สร้าง/ผู้ควบคุมงาน
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
                      className="w-full bg-navy-input border border-border-navy rounded-2xl p-5 text-white outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary appearance-none cursor-pointer font-medium shadow-inner transition-all"
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
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none group-hover:text-brand-primary transition-colors" size={18} />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" /> ส่วนงาน
                  </label>
                  <div className="relative group">
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
                      className="w-full bg-navy-input border border-border-navy rounded-2xl p-5 text-white outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary appearance-none cursor-pointer font-medium shadow-inner transition-all"
                      required
                    >
                      <option value="">เลือกส่วนงาน...</option>
                      {taskOwners.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none group-hover:text-brand-primary transition-colors" size={18} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">โครงการ/งาน (ที่จะแสดงในกราฟวิเคราะห์)</label>
                <input 
                  type="text" 
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full bg-navy-input border border-border-navy rounded-2xl p-5 text-white outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary transition-all placeholder:text-slate-600 font-medium shadow-inner"
                  placeholder="ระบุชื่อโครงการ หรือ งานหลัก..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">วันที่เริ่ม</label>
                  <input 
                    type="date" 
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    className="w-full bg-navy-input border border-border-navy rounded-2xl p-5 text-white outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary transition-all cursor-pointer font-medium shadow-inner"
                    required
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">วันที่สิ้นสุด</label>
                  <input 
                    type="date" 
                    value={endDateStr}
                    onChange={(e) => setEndDateStr(e.target.value)}
                    className="w-full bg-navy-input border border-border-navy rounded-2xl p-5 text-white outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary transition-all cursor-pointer font-medium shadow-inner"
                    min={startDateStr}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center justify-between">
                  <span className="flex items-center gap-2"><Paperclip className="w-3.5 h-3.5" /> ไฟล์แนบ</span>
                  <span className="text-[9px] normal-case font-medium text-slate-600">จำกัด 500KB ต่อไฟล์</span>
                </label>
                
                <div className="grid grid-cols-1 gap-4">
                  {attachments.map((file) => (
                    <div key={file.id} className="bg-navy-input border border-border-navy p-4 rounded-2xl flex items-center gap-4 group">
                      <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shadow-inner">
                        {file.type.startsWith('image/') ? <ImageIcon size={20} /> : <FileIcon size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{file.name}</p>
                        <p className="text-[10px] font-mono text-slate-600">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeAttachment(file.id)}
                        className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all active:scale-90"
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  ))}
                  
                  <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border-navy rounded-3xl hover:border-brand-primary/50 hover:bg-navy-elevated transition-all cursor-pointer group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Plus className="w-8 h-8 text-slate-600 group-hover:text-brand-primary transition-colors mb-2" />
                      <p className="text-xs font-bold text-slate-600 group-hover:text-brand-primary transition-colors uppercase tracking-widest">เพิ่มไฟล์แนบ</p>
                    </div>
                    <input type="file" className="hidden" multiple onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
            </form>

            <div className="p-8 border-t border-border-navy bg-navy-base/30 flex-shrink-0">
              <div className="flex justify-end gap-4">
                <button 
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setViewingTask(null);
                  }}
                  className="px-10 py-4 bg-navy-elevated hover:bg-navy-elevated/80 text-white font-bold rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest border border-white/5"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  form="edit-task-form"
                  className="px-12 py-4 bg-brand-primary text-white font-bold rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest shadow-lg shadow-brand-primary/20"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog 
        isOpen={!!deletingTaskId}
        onClose={() => setDeletingTaskId(null)}
        onConfirm={confirmDelete}
        title="ยืนยันการลบงาน?"
        message="คุณแน่ใจหรือไม่ว่าต้องการลบงานนี้? เมื่อลบแล้วจะไม่สามารถกู้คืนข้อมูลได้"
        confirmText="ยืนยันการลบ"
        cancelText="ยกเลิก"
        type="danger"
      />
    </div>
  );
}

const StatusBadge = React.memo(({ status }: { status: TaskStatus }) => {
  const statusConfig = {
    'Pending':     { color: 'bg-slate-500/20 text-slate-300 border-slate-500/30',  dot: 'bg-slate-400' },
    'In Progress': { color: 'bg-blue-500/20  text-blue-300  border-blue-500/30',   dot: 'bg-blue-400'  },
    'Review':      { color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',  dot: 'bg-amber-400' },
    'Completed':   { color: 'bg-green-500/20 text-green-300 border-green-500/30',  dot: 'bg-green-400' },
    'On Hold':     { color: 'bg-red-500/20   text-red-300   border-red-500/30',    dot: 'bg-red-400'   },
  };

  const config = statusConfig[status] || { color: 'bg-navy-elevated text-slate-500 border-border-navy', dot: 'bg-slate-500' };

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black border tracking-[0.15em] shadow-inner uppercase whitespace-nowrap", config.color)}>
      <span className={cn("w-2 h-2 rounded-full", config.dot)} />
      {status === 'Pending' ? 'รอดำเนินการ' : 
       status === 'In Progress' ? 'กำลังดำเนินการ' : 
       status === 'Review' ? 'รอตรวจสอบ' :
       status === 'Completed' ? 'เสร็จสิ้น' : 'ระงับชั่วคราว'}
    </span>
  );
});

const MetaItem = React.memo(({ icon, label, value, valueClassName }: { icon: React.ReactNode, label: string, value: string | React.ReactNode, valueClassName?: string }) => {
  return (
    <div className="flex items-center gap-3 text-sm group">
      <span className="text-slate-500 group-hover:text-brand-primary transition-colors scale-110">{icon}</span>
      <span className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">{label}:</span>
      <span className={cn("text-white/80 font-bold", valueClassName)}>{value}</span>
    </div>
  );
});


