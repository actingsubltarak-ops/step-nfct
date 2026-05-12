import React, { useMemo, useState } from 'react';
import { Task, Attachment } from '../types';
import { 
  File as FileIcon, 
  Image as ImageIcon, 
  Search, 
  Download, 
  ExternalLink, 
  Calendar, 
  Filter,
  Grid,
  List as ListIcon
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { th } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface DocumentCenterProps {
  tasks: Task[];
}

export function DocumentCenter({ tasks }: DocumentCenterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'document'>('all');

  const allAttachments = useMemo(() => {
    const docs: (Attachment & { taskTitle: string, taskId: string, date: string, assignee: string })[] = [];
    tasks.forEach(task => {
      if (task.attachments) {
        task.attachments.forEach(att => {
          docs.push({
            ...att,
            taskTitle: task.title,
            taskId: task.id,
            date: task.startDate,
            assignee: task.assigneeId
          });
        });
      }
    });
    return docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [tasks]);

  const filteredDocs = useMemo(() => {
    return allAttachments.filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           doc.taskTitle.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || 
                         (filterType === 'image' && doc.type.startsWith('image/')) ||
                         (filterType === 'document' && !doc.type.startsWith('image/'));
      return matchesSearch && matchesType;
    });
  }, [allAttachments, searchTerm, filterType]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight">Document Center</h2>
          <p className="text-slate-400">ศูนย์รวมไฟล์แนบและเอกสารประกอบภารกิจทั้งหมด</p>
        </div>
        
        <div className="flex items-center gap-3 bg-navy-elevated p-1.5 rounded-2xl border border-border-navy shadow-inner">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "p-2 rounded-xl transition-all",
              viewMode === 'grid' ? "bg-brand-primary text-white shadow-lg" : "text-slate-500 hover:text-white"
            )}
          >
            <Grid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "p-2 rounded-xl transition-all",
              viewMode === 'list' ? "bg-brand-primary text-white shadow-lg" : "text-slate-500 hover:text-white"
            )}
          >
            <ListIcon size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-primary transition-colors" size={18} />
          <input 
            type="text"
            placeholder="ค้นหาชื่อไฟล์ หรือชื่องาน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-navy-input border border-border-navy rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all placeholder:text-slate-600"
          />
        </div>
        <div className="flex items-center gap-2 bg-navy-input border border-border-navy rounded-2xl p-1.5">
          {(['all', 'image', 'document'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                filterType === type ? "bg-navy-elevated text-white" : "text-slate-500 hover:text-white"
              )}
            >
              {type === 'all' ? 'ทั้งหมด' : type === 'image' ? 'รูปภาพ' : 'เอกสาร'}
            </button>
          ))}
        </div>
      </div>

      {filteredDocs.length === 0 ? (
        <div className="p-20 text-center space-y-4 bg-navy-surface rounded-[2.5rem] border border-border-navy border-dashed">
          <div className="w-16 h-16 bg-navy-base rounded-3xl flex items-center justify-center mx-auto text-slate-600">
            <FileIcon size={32} />
          </div>
          <p className="text-sm font-medium text-slate-500">ไม่พบไฟล์ที่ตรงกับการค้นหา</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDocs.map((doc) => (
            <div key={doc.id} className="group bg-navy-surface border border-border-navy rounded-[2rem] overflow-hidden hover:border-brand-primary/30 transition-all hover:shadow-2xl hover:shadow-brand-primary/10">
              <div className="aspect-video bg-navy-base relative overflow-hidden flex items-center justify-center">
                {doc.type.startsWith('image/') ? (
                  <img src={doc.url} alt={doc.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                ) : (
                  <FileIcon size={48} className="text-slate-700 group-hover:text-brand-primary/30 transition-colors" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <a href={doc.url} download={doc.name} className="p-3 bg-white text-navy-base rounded-xl hover:scale-110 transition-transform">
                    <Download size={20} />
                  </a>
                  <a href={doc.url} target="_blank" rel="noreferrer" className="p-3 bg-brand-primary text-white rounded-xl hover:scale-110 transition-transform">
                    <ExternalLink size={20} />
                  </a>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{doc.name}</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{(doc.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div className={cn(
                    "p-2 rounded-lg shrink-0",
                    doc.type.startsWith('image/') ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-400"
                  )}>
                    {doc.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileIcon size={14} />}
                  </div>
                </div>
                <div className="pt-4 border-t border-border-navy space-y-2">
                  <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} /> 
                    {(() => {
                      try {
                        const d = parseISO(doc.date);
                        if (!isValid(d)) return doc.date;
                        return format(d, 'd MMM yyyy', { locale: th });
                      } catch (e) {
                        return doc.date;
                      }
                    })()}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold truncate">
                    งาน: {doc.taskTitle}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-navy-surface rounded-[2rem] border border-border-navy overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-navy-base/50">
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-border-navy">File Name</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-border-navy">Task</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-border-navy">Date</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-border-navy">Size</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-border-navy text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-navy">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-navy-elevated transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        doc.type.startsWith('image/') ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-400"
                      )}>
                        {doc.type.startsWith('image/') ? <ImageIcon size={20} /> : <FileIcon size={20} />}
                      </div>
                      <span className="text-sm font-bold text-white truncate max-w-xs">{doc.name}</span>
                    </div>
                  </td>
                  <td className="p-6 text-sm text-slate-300 truncate max-w-xs">{doc.taskTitle}</td>
                  <td className="p-6 text-xs text-slate-500 font-medium">
                    {(() => {
                      try {
                        const d = parseISO(doc.date);
                        if (!isValid(d)) return doc.date;
                        return format(d, 'd MMM yyyy', { locale: th });
                      } catch (e) {
                        return doc.date;
                      }
                    })()}
                  </td>
                  <td className="p-6 text-xs text-slate-500 font-medium">{(doc.size / 1024).toFixed(1)} KB</td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a href={doc.url} download={doc.name} className="p-2 text-slate-600 hover:text-brand-primary transition-colors">
                        <Download size={18} />
                      </a>
                      <a href={doc.url} target="_blank" rel="noreferrer" className="p-2 text-slate-600 hover:text-brand-primary transition-colors">
                        <ExternalLink size={18} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
