import { Task, TeamMember } from './types';

export const TEAM_MEMBERS: TeamMember[] = [
  { id: '1', name: 'สมชาย รักดี', jobTitle: 'หัวหน้าส่วนสารสนเทศ', department: 'ส่วนสารสนเทศ', role: 'Administrator' },
  { id: '2', name: 'วิภา พัฒนา', jobTitle: 'ผู้ควบคุมงานระบบ', department: 'ส่วนสารสนเทศ', role: 'Supervisor' },
  { id: '3', name: 'มานะ ขยันงาน', jobTitle: 'นักวิชาการคอมพิวเตอร์', department: 'ส่วนสารสนเทศ', role: 'Staff' },
  { id: '4', name: 'อารี มีสุข', jobTitle: 'นักวิเคราะห์ระบบ', department: 'ส่วนสารสนเทศ', role: 'Staff' },
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'T1',
    title: 'พัฒนาระบบจัดเก็บข้อมูลกลาง',
    description: 'ออกแบบและพัฒนาระบบฐานข้อมูลสำหรับส่วนงาน',
    status: 'In Progress',
    assigneeId: '3',
    supervisorId: '2',
    ownerName: 'ดร. สมเกียรติ',
    ownerDepartment: 'ฝ่ายบริหาร',
    startDate: '2026-03-01',
    endDate: '2026-04-15',
    project: 'Data Centralization'
  },
  {
    id: 'T2',
    title: 'ปรับปรุงระบบเครือข่ายภายใน',
    description: 'อัปเกรดอุปกรณ์ Switch และ Firewall',
    status: 'Completed',
    assigneeId: '3',
    supervisorId: '2',
    ownerName: 'คุณหญิง สดใส',
    ownerDepartment: 'ฝ่ายไอที',
    startDate: '2026-02-15',
    endDate: '2026-03-10',
    project: 'Infrastructure Upgrade'
  },
  {
    id: 'T3',
    title: 'อบรมการใช้งานโปรแกรมใหม่',
    description: 'จัดอบรมให้ความรู้พนักงานในส่วนงานต่างๆ',
    status: 'Pending',
    assigneeId: '4',
    supervisorId: '2',
    ownerName: 'คุณวิชัย',
    ownerDepartment: 'ฝ่ายทรัพยากรบุคคล',
    startDate: '2026-04-01',
    endDate: '2026-04-05',
    project: 'Training 2026'
  }
];
