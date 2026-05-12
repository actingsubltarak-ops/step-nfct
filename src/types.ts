export type TaskStatus = 'Pending' | 'In Progress' | 'Review' | 'Completed' | 'On Hold';

export interface TeamMember {
  id: string;
  uid?: string;
  name: string;
  email?: string;
  role: 'Staff' | 'Supervisor' | 'Administrator'; // This is the access level
  jobTitle?: string; // This is the actual position
  department: string;
  ownerId?: string;
  avatar?: string;
  photoURL?: string;
  status?: 'Active' | 'Inactive';
  lastActive?: any;
  createdAt?: any;
  updatedAt?: any;
  isManual?: boolean;
  provider?: 'google' | 'google.com' | 'email' | 'password' | 'system';
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string; // Firebase Storage URL
  size: number;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  timestamp: string;
}

export interface Activity {
  id: string;
  type: 'Status Change' | 'Update' | 'Comment' | 'Attachment' | 'Creation';
  description: string;
  userId: string;
  userName: string;
  timestamp: string;
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string;
  assigneeIds?: string[];
  supervisorId?: string;
  supervisorName?: string;
  ownerName: string;
  ownerDepartment: string;
  startDate: string;
  endDate: string;
  project: string;
  attachments?: Attachment[];
  comments?: Comment[];
  activities?: Activity[];
  subtasks?: SubTask[];
  dependencies?: string[];
  aiPriority?: string;
  aiPriorityReason?: string;
  aiTags?: string[];
  aiCategory?: string;
  aiSummary?: string;
  budget?: number;
  actualCost?: number;
  kpiScore?: number;
  qualityScore?: number;
  delayProbability?: number;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface Appointment {
  id: string;
  title: string;
  date: string;
  type: 'Task' | 'Meeting' | 'Deadline';
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'Task Assigned' | 'Status Change' | 'New Comment' | 'Deadline' | 'Alert';
  taskId?: string;
  isRead: boolean;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  targetId?: string;
  targetType: 'Task' | 'User' | 'Department' | 'System';
  timestamp: string;
  metadata?: any;
}
