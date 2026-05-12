import React, { useState } from 'react';
import { Task } from '../types';
import { 
  Download, 
  Search, 
  Filter, 
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';
import { formatThaiDate, cn } from '../lib/utils';
import * as XLSX from 'xlsx';

interface ReportsProps {
  tasks: Task[];
  teamMembers: any[];
}

export function Reports({ tasks, teamMembers }: ReportsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [taskFilter, setTaskFilter] = useState<string>('All');

  const taskTitles = Array.from(new Set(tasks.map(t => t.title))).sort();

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = (task.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (task.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
    const matchesTask = taskFilter === 'All' || task.title === taskFilter;
    return matchesSearch && matchesStatus && matchesTask;
  });

  const exportToExcel = () => {
    const data = filteredTasks.map(task => ({
      'ชื่องาน': task.title,
      'รายละเอียด': task.description,
      'สถานะ': task.status,
      'ผู้รับผิดชอบ': (task.assigneeIds && task.assigneeIds.length > 0) 
        ? task.assigneeIds.map(id => teamMembers.find(m => m.id === id)?.name || id).join(', ') 
        : (teamMembers.find(m => m.id === task.assigneeId)?.name || 'N/A'),
      'ส่วนงาน': task.ownerName,
      'หน่วยงาน': task.ownerDepartment,
      'โครงการ': task.project,
      'วันที่เริ่ม': formatThaiDate(task.startDate),
      'วันที่กำหนดส่ง': formatThaiDate(task.endDate),
      'AI Priority': task.aiPriority || 'N/A',
      'AI Category': task.aiCategory || 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks Report");
    XLSX.writeFile(workbook, `Task_Report_${formatThaiDate(new Date()).replace(/\//g, '-')}.xlsx`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight">รายงานผลการดำเนินงาน</h2>
          <p className="text-slate-400 text-lg font-bold mt-1">สรุปข้อมูลและส่งออกรายงานในรูปแบบ Excel สำหรับการวิเคราะห์เชิงลึก</p>
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-4 px-8 py-4 bg-emerald-500/10 text-emerald-400 border-2 border-emerald-500/20 font-black rounded-2xl hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all active:scale-95 shadow-xl shadow-emerald-500/10 text-xs uppercase tracking-[0.2em]"
        >
          <Download size={20} />
          ส่งออกเป็น Excel (.xlsx)
        </button>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-primary transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="ค้นหาชื่องาน หรือส่วนงาน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-navy-input border-2 border-border-navy rounded-2xl text-white font-bold focus:outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all shadow-sm placeholder:text-slate-600"
          />
        </div>
        
        <div className="relative group">
          <Filter className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-primary transition-colors" size={20} />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-14 pr-10 py-5 bg-navy-input border-2 border-border-navy rounded-2xl text-white font-bold focus:outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all appearance-none shadow-sm cursor-pointer"
          >
            <option value="All">ทุกสถานะการดำเนินงาน</option>
            <option value="Pending">รอดำเนินการ (Pending)</option>
            <option value="In Progress">กำลังดำเนินการ (In Progress)</option>
            <option value="Completed">เสร็จสิ้น (Completed)</option>
            <option value="On Hold">ระงับชั่วคราว (On Hold)</option>
          </select>
          <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
            <Filter size={16} />
          </div>
        </div>

        <div className="relative group">
          <FileSpreadsheet className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-primary transition-colors" size={20} />
          <select 
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value)}
            className="w-full pl-14 pr-10 py-5 bg-navy-input border-2 border-border-navy rounded-2xl text-white font-bold focus:outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all appearance-none shadow-sm cursor-pointer"
          >
            <option value="All">ทุกชื่องาน (รายชื่อของงาน)</option>
            {taskTitles.map(title => (
              <option key={title} value={title}>{title}</option>
            ))}
          </select>
          <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
            <ChevronRight size={16} className="rotate-90" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-navy-surface rounded-[2.5rem] border border-border-navy overflow-hidden shadow-xl shadow-navy-base/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-navy bg-navy-base/50">
                <th className="px-10 py-6 text-sm font-black text-slate-400 uppercase tracking-[0.25em]">ชื่องาน / รายละเอียด</th>
                <th className="px-10 py-6 text-sm font-black text-slate-400 uppercase tracking-[0.25em]">ผู้รับผิดชอบ</th>
                <th className="px-10 py-6 text-sm font-black text-slate-400 uppercase tracking-[0.25em]">สถานะ</th>
                <th className="px-10 py-6 text-sm font-black text-slate-400 uppercase tracking-[0.25em]">กำหนดส่ง</th>
                <th className="px-10 py-6 text-sm font-black text-slate-400 uppercase tracking-[0.25em]">AI Insights</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-navy">
              {filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-navy-elevated transition-colors group">
                  <td className="px-10 py-8">
                    <p className="text-xl font-black text-white group-hover:text-brand-primary transition-colors tracking-tight">{task.title}</p>
                    <p className="text-base text-slate-400 mt-2 line-clamp-1 font-bold">{task.description}</p>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex flex-col gap-2">
                      {(task.assigneeIds && task.assigneeIds.length > 0) ? (
                        task.assigneeIds.map(id => {
                          const member = teamMembers.find(m => m.id === id);
                          return (
                            <div key={id} className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-navy-base border border-border-navy flex items-center justify-center text-[10px] font-black text-slate-400 shadow-inner overflow-hidden shrink-0">
                                {member?.photoURL ? (
                                  <img src={member.photoURL} alt={member?.name || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  member?.name?.[0] || '?'
                                )}
                              </div>
                              <span className="text-sm font-black text-slate-300 truncate">
                                {member?.name || 'ไม่ทราบชื่อ'}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-navy-base border border-border-navy flex items-center justify-center text-[10px] font-black text-slate-400 shadow-inner overflow-hidden shrink-0">
                            {teamMembers.find(m => m.id === task.assigneeId)?.photoURL ? (
                              <img src={teamMembers.find(m => m.id === task.assigneeId)?.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              teamMembers.find(m => m.id === task.assigneeId)?.name?.[0] || '?'
                            )}
                          </div>
                          <span className="text-sm font-black text-slate-300">
                            {teamMembers.find(m => m.id === task.assigneeId)?.name || 'N/A'}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <span className={cn(
                      "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border shadow-sm whitespace-nowrap inline-block",
                      task.status === 'Completed' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      task.status === 'In Progress' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      task.status === 'Pending' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    )}>
                      {task.status === 'Completed' ? 'เสร็จสิ้น' : 
                       task.status === 'In Progress' ? 'กำลังดำเนินการ' : 
                       task.status === 'Pending' ? 'รอดำเนินการ' : 'ระงับชั่วคราว'}
                    </span>
                  </td>
                  <td className="px-10 py-8">
                    <p className="text-base font-black text-slate-400">{formatThaiDate(task.endDate)}</p>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex flex-wrap gap-2">
                      {task.aiPriority && (
                        <span className="px-4 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-black uppercase tracking-tighter">
                          {task.aiPriority}
                        </span>
                      )}
                      {task.aiCategory && (
                        <span className="px-4 py-1.5 bg-navy-base text-slate-500 rounded-lg text-xs font-black uppercase border border-border-navy tracking-tighter">
                          {task.aiCategory}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredTasks.length === 0 && (
          <div className="p-24 text-center bg-navy-base/30">
            <div className="w-20 h-20 bg-navy-base rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-700 shadow-inner">
              <FileSpreadsheet size={40} />
            </div>
            <p className="text-slate-600 font-black uppercase tracking-[0.2em] text-sm">ไม่พบข้อมูลที่ตรงตามเงื่อนไขการค้นหา</p>
          </div>
        )}
      </div>
    </div>
  );
}
