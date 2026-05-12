import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar as CalendarIcon, 
  Home, 
  CheckSquare,
  User,
  UserCheck,
  Building2,
  ChevronDown,
  FileSpreadsheet,
  Shield,
  ShieldCheck,
  Activity,
  FolderOpen,
  Sparkles,
  Settings,
  LogOut,
  Key,
  UserCircle,
  X
} from 'lucide-react';
import { cn, getRoleDisplayName } from '../lib/utils';
import { logout } from '../firebase';

import { TeamMember } from '../types';
import { ChangePasswordModal } from './ChangePasswordModal';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  userProfile: TeamMember | null;
  departments: { id: string; name: string }[];
  selectedDepartment: string;
  setSelectedDepartment: (dept: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const menuItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks', label: 'Task Tracking', icon: CheckSquare },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { id: 'gantt', label: 'Gantt Chart', icon: CalendarIcon },
  { id: 'workload', label: 'Workload', icon: Activity },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'ai-insights', label: 'AI Insights', icon: Sparkles },
  { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
  { id: 'users', label: 'User Management', icon: Shield, roles: ['Administrator'] },
  { 
    id: 'master-data', 
    label: 'Master Data', 
    icon: Building2, 
    roles: ['Administrator', 'Supervisor'],
    subItems: [
      { id: 'header-master', label: 'ข้อมูลหลัก', isHeader: true },
      { id: 'master-team', label: 'ผู้รับผิดชอบ', icon: User },
      { id: 'master-owners', label: 'ส่วนงาน', icon: UserCheck },
      { id: 'master-depts', label: 'หน่วยงาน/สำนัก', icon: Building2 },
      { id: 'header-system', label: 'ระบบ', isHeader: true },
      { id: 'master-settings', label: 'ตั้งค่า', icon: ShieldCheck },
    ]
  },
];

export function Sidebar({ activeTab, setActiveTab, user, userProfile, departments, selectedDepartment, setSelectedDepartment, isOpen, onClose }: SidebarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentDeptName = selectedDepartment === 'all' 
    ? 'All Departments (Overview)' 
    : departments.find(d => d.name === selectedDepartment)?.name || selectedDepartment;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60] lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 lg:relative w-72 h-screen bg-navy-surface text-slate-400 flex flex-col border-r border-border-navy z-[70] transition-transform duration-300 lg:translate-x-0 shadow-xl lg:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 border-b border-border-navy relative z-10 flex items-center justify-between bg-navy-base/30">
          <h1 className="text-2xl font-sans font-bold tracking-tight text-white flex items-center gap-3 group">
            <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center shadow-lg shadow-brand-primary/20 transition-all duration-300 overflow-hidden">
              <span className="text-white font-black text-sm">STEP</span>
            </div>
            <div className="flex flex-col">
              <span className="leading-none text-white font-black">Performance</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mt-1.5 font-black">System v1.0</span>
            </div>
          </h1>
          <button onClick={onClose} className="lg:hidden p-2 text-slate-500 hover:text-white hover:bg-navy-elevated rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

      <div className={cn(
        "p-6 border-b border-border-navy bg-navy-surface relative transition-all duration-300",
        isDropdownOpen ? "z-30" : "z-20"
      )}>
        <label className="text-xs text-slate-500 uppercase font-black tracking-[0.15em] mb-3 block px-1">Operations</label>
        
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={cn(
              "w-full bg-navy-input border-border-navy rounded-2xl p-3.5 text-base flex items-center justify-between transition-all text-white font-bold shadow-sm active:scale-[0.98]",
              isDropdownOpen ? "border-brand-primary ring-4 ring-brand-primary/10 bg-navy-input" : "border-border-navy hover:border-slate-500 hover:bg-navy-elevated"
            )}
          >
            <div className="flex items-center gap-3 w-full min-w-0">
              <Building2 size={18} className="text-brand-primary shrink-0" />
              <span className="truncate flex-1">{currentDeptName}</span>
            </div>
            <ChevronDown className={cn("w-5 h-5 transition-transform duration-300 text-slate-500", isDropdownOpen && "rotate-180")} />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-navy-elevated rounded-xl z-50 py-2 max-h-[480px] overflow-y-auto custom-scrollbar border border-border-navy shadow-2xl animate-in fade-in slide-in-from-top-2 ring-1 ring-black/5">
              <button
                onClick={() => {
                  setSelectedDepartment('all');
                  setIsDropdownOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-3 text-base hover:bg-navy-surface transition-colors flex items-center gap-3 group",
                  selectedDepartment === 'all' ? "text-brand-primary bg-brand-primary/10 font-bold" : "text-slate-300 font-medium"
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                  selectedDepartment === 'all' ? "bg-brand-primary/20" : "bg-navy-surface group-hover:bg-navy-elevated"
                )}>
                  <LayoutDashboard size={18} />
                </div>
                <span className="flex-1">Overall Overview</span>
                {selectedDepartment === 'all' && <div className="w-2 h-2 rounded-full bg-brand-primary" />}
              </button>
              <div className="h-px bg-border-navy mx-4 my-1" />
              {departments.map(dept => (
                <button
                  key={dept.id}
                  onClick={() => {
                    setSelectedDepartment(dept.name);
                    setIsDropdownOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 text-base hover:bg-navy-surface transition-colors flex items-center gap-3 group",
                    selectedDepartment === dept.name ? "text-brand-primary bg-brand-primary/10 font-bold" : "text-slate-300 font-medium"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                    selectedDepartment === dept.name ? "bg-brand-primary/20" : "bg-navy-surface group-hover:bg-navy-elevated"
                  )}>
                    <Building2 size={18} />
                  </div>
                  <span className="flex-1 whitespace-normal break-words leading-tight">{dept.name}</span>
                  {selectedDepartment === dept.name && <div className="w-2 h-2 rounded-full bg-brand-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto custom-scrollbar relative z-10">
        {menuItems
          .filter(item => !item.roles || (userProfile?.role && item.roles.includes(userProfile.role)))
          .map((item) => {
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isExpanded = activeTab.startsWith(item.id);
            
            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => {
                    if (hasSubItems) {
                      const firstSelectable = item.subItems!.find(si => !si.isHeader);
                      if (firstSelectable) setActiveTab(firstSelectable.id);
                    } else {
                      setActiveTab(item.id);
                    }
                    onClose?.();
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 group relative active:scale-[0.98]",
                    activeTab === item.id || (hasSubItems && isExpanded)
                      ? "bg-brand-primary text-white font-bold shadow-lg shadow-brand-primary/20" 
                      : "text-slate-400 hover:bg-navy-elevated hover:text-white font-medium"
                  )}
                >
                  <item.icon size={22} className={cn(
                    "transition-all duration-200",
                    (activeTab === item.id || (hasSubItems && isExpanded)) ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                  )} />
                  <span className={cn(
                    "text-xl transition-colors",
                    (activeTab === item.id || (hasSubItems && isExpanded)) ? "text-white" : "text-white/70 group-hover:text-white"
                  )}>{item.label}</span>
                  
                  {hasSubItems && (
                    <ChevronDown className={cn(
                      "ml-auto w-5 h-5 transition-transform duration-300",
                      isExpanded ? "rotate-180" : ""
                    )} />
                  )}
                  
                  {!hasSubItems && activeTab === item.id && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50" />
                  )}
                </button>

                {hasSubItems && isExpanded && (
                  <div className="pl-12 space-y-1 animate-in slide-in-from-top-2 duration-300">
                    {item.subItems!.map((subItem) => {
                      if (subItem.isHeader) {
                        return (
                          <div key={subItem.id} className="pt-4 pb-2 px-4">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                              {subItem.label}
                            </span>
                          </div>
                        );
                      }
                      
                      return (
                        <button
                          key={subItem.id}
                          onClick={() => {
                            setActiveTab(subItem.id);
                            onClose?.();
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold",
                            activeTab === subItem.id
                              ? "text-white bg-white/10"
                              : "text-slate-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          {subItem.icon && <subItem.icon size={16} className={activeTab === subItem.id ? "text-brand-primary" : "text-slate-500"} />}
                          <span>{subItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </nav>

      <div className="p-6 border-t border-border-navy bg-navy-base/30 relative z-10" ref={profileRef}>
        <div 
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className={cn(
            "flex items-center gap-4 group cursor-pointer p-3 rounded-[1.5rem] transition-all duration-300 border border-transparent",
            isProfileOpen ? "bg-navy-elevated border-border-navy shadow-md" : "hover:bg-navy-elevated hover:shadow-md hover:border-border-navy"
          )}
        >
          <div className="w-12 h-12 rounded-xl bg-navy-base border border-border-navy flex items-center justify-center overflow-hidden shadow-sm ring-2 ring-navy-surface relative">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-xl">
                {userProfile?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-navy-base rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-black truncate text-white leading-tight">
              {userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'User'}
            </p>
            <div className="flex flex-col gap-0.5 mt-0.5">
              <p className="text-xs font-black text-white uppercase tracking-widest truncate">
                {userProfile?.jobTitle || 'ไม่ระบุตำแหน่ง'}
              </p>
              <div className="flex items-center gap-1">
                {userProfile?.role === 'Administrator' && <Shield size={10} className="text-brand-primary shrink-0" />}
                <p className={cn(
                   "text-[10px] font-black uppercase tracking-[0.15em] truncate",
                  userProfile?.role === 'Administrator' ? "text-brand-primary" : "text-slate-500"
                )}>
                  {getRoleDisplayName(userProfile?.role)}
                </p>
              </div>
            </div>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform duration-300", isProfileOpen && "rotate-180")} />
        </div>

        {isProfileOpen && (
          <div className="absolute bottom-full left-6 right-6 mb-2 bg-navy-elevated border border-border-navy rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
            <div className="px-4 py-3 border-b border-border-navy mb-1">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">สังกัด</p>
              <p className="text-sm font-bold text-white truncate">{userProfile?.department || 'ไม่ระบุหน่วยงาน'}</p>
            </div>
            
            <button 
              onClick={() => {
                setActiveTab('master-settings');
                setIsProfileOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm font-bold group"
            >
              <UserCircle size={18} className="text-slate-500 group-hover:text-brand-primary" />
              แก้ไขโปรไฟล์
            </button>
            
            <button 
              onClick={() => {
                setIsChangePasswordOpen(true);
                setIsProfileOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm font-bold group"
            >
              <Key size={18} className="text-slate-500 group-hover:text-brand-primary" />
              เปลี่ยนรหัสผ่าน
            </button>
            
            <div className="h-px bg-border-navy my-1" />
            
            <button 
              onClick={() => {
                logout();
                setIsProfileOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-all text-sm font-bold group"
            >
              <LogOut size={18} className="text-red-500/50 group-hover:text-red-400" />
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>

      <ChangePasswordModal 
        isOpen={isChangePasswordOpen} 
        onClose={() => setIsChangePasswordOpen(false)} 
      />
    </div>
    </>
  );
}
