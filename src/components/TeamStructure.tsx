import React from 'react';
import { User, Shield, Briefcase, Mail } from 'lucide-react';
import { cn, getRoleDisplayName } from '../lib/utils';

export function TeamStructure({ teamMembers }: { teamMembers: any[] }) {
  const managers = teamMembers.filter(m => m.role === 'Administrator' || m.level === 'Administrator');
  const supervisors = teamMembers.filter(m => m.role === 'Supervisor' || m.level === 'Supervisor');
  const staff = teamMembers.filter(m => m.role === 'Staff' || m.level === 'Staff' || (!m.role && !m.level));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-2xl font-bold text-white tracking-tight">โครงสร้างทีมงาน</h2>
        <p className="text-slate-400">บุคลากรและบทบาทหน้าที่ภายในส่วนสารสนเทศ</p>
      </header>

      <div className="flex flex-col items-center space-y-12">
        {/* Administrators Section */}
        <div className="w-full">
          <h3 className="text-center text-xs font-bold text-slate-600 uppercase tracking-[0.3em] mb-8">Management</h3>
          <div className="flex justify-center flex-wrap gap-6">
            {managers.map(member => (
              <div key={member.id}>
                <MemberCard member={member} />
              </div>
            ))}
          </div>
        </div>

        {/* Connector Line */}
        <div className="w-px h-12 bg-border-navy" />

        {/* Supervisors Section */}
        <div className="w-full">
          <h3 className="text-center text-xs font-bold text-slate-600 uppercase tracking-[0.3em] mb-8">Supervision</h3>
          <div className="flex justify-center flex-wrap gap-6">
            {supervisors.map(member => (
              <div key={member.id}>
                <MemberCard member={member} />
              </div>
            ))}
          </div>
        </div>

        {/* Connector Line */}
        <div className="w-px h-12 bg-border-navy" />

        {/* Staff Section */}
        <div className="w-full">
          <h3 className="text-center text-xs font-bold text-slate-600 uppercase tracking-[0.3em] mb-8">Operations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {staff.map(member => (
              <div key={member.id}>
                <MemberCard member={member} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberCard({ member }: { member: any }) {
  const role = member.role || member.level || 'Staff';
  
  return (
    <div className="bg-navy-surface p-8 rounded-[2.5rem] border border-border-navy shadow-sm hover:shadow-xl transition-all duration-500 group w-full max-w-[300px] hover:border-brand-primary/30 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-[2rem] bg-navy-base border border-border-navy flex items-center justify-center group-hover:scale-105 transition-transform duration-500 overflow-hidden shadow-inner">
            {member.photoURL ? (
              <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User size={40} className="text-slate-700" />
            )}
          </div>
          <div className={cn(
            "absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl border-4 border-navy-surface flex items-center justify-center shadow-lg transition-transform duration-500 group-hover:rotate-12",
            role === 'Administrator' ? "bg-orange-500" : 
            role === 'Supervisor' ? "bg-brand-primary" : "bg-zinc-600"
          )}>
            {role === 'Administrator' ? <Shield size={18} className="text-white" /> : 
             role === 'Supervisor' ? <User size={18} className="text-white" /> : 
             <Briefcase size={18} className="text-white" />}
          </div>
        </div>
        
        <h4 className="text-lg font-bold text-white mb-1 tracking-tight group-hover:text-brand-primary transition-colors duration-300">{member.name}</h4>
        <p className={cn(
          "text-xs font-black uppercase tracking-[0.2em] mb-6",
          role === 'Administrator' ? "text-orange-500" : 
          role === 'Supervisor' ? "text-brand-primary" : "text-slate-500"
        )}>{getRoleDisplayName(role)}</p>
        
        <div className="w-full pt-6 border-t border-border-navy flex items-center justify-center gap-4">
          <button className="p-2.5 text-slate-500 hover:text-white hover:bg-navy-elevated rounded-xl transition-all active:scale-90 shadow-sm">
            <Mail size={18} />
          </button>
          <div className="w-px h-6 bg-border-navy" />
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
            {member.department || 'ส่วนสารสนเทศ'}
          </span>
        </div>
      </div>
    </div>
  );
}
