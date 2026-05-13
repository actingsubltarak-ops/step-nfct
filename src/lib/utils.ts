import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date string or Date object into dd/mm/yyyy format with Thai Buddhist Era (BE) year.
 * @param date Input date (string or Date)
 * @returns Formatted date string (dd/mm/yyyy)
 */
export function formatThaiDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  
  try {
    let d: Date;
    if (typeof date === 'string') {
      // Handle potential Thai year in input string (e.g. from input type="date")
      const parts = date.split('-');
      if (parts.length === 3) {
        let year = parseInt(parts[0]);
        if (year > 2400) year -= 543;
        d = parseISO(`${year}-${parts[1]}-${parts[2]}`);
      } else {
        d = parseISO(date);
      }
    } else {
      d = date;
    }

    if (!isValid(d)) return typeof date === 'string' ? date : '';

    const day = format(d, 'dd');
    const month = format(d, 'MM');
    const year = d.getFullYear() + 543;

    return `${day}/${month}/${year}`;
  } catch (e) {
    return typeof date === 'string' ? date : '';
  }
}

/**
 * Calculates KPI score based on task performance
 * @param startDate Task start date
 * @param endDate Task end date
 * @param completedAt Actual completion date
 * @returns KPI score (0-100)
 */
export function calculateKpiScore(startDate: string, endDate: string, completedAt?: string): number {
  if (!completedAt) return 0;
  
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const completed = parseISO(completedAt);
  
  if (!isValid(start) || !isValid(end) || !isValid(completed)) return 0;
  
  // If completed on or before end date
  if (completed <= end) {
    return 100;
  }
  
  // Penalty for delay: -5% per day
  const diffInTime = completed.getTime() - end.getTime();
  const diffInDays = Math.ceil(diffInTime / (1000 * 3600 * 24));
  
  const score = 100 - (diffInDays * 5);
  return Math.max(0, score);
}

/**
 * Returns the Thai Buddhist Era year from a Gregorian date string (YYYY-MM-DD)
 */
export function getThaiYear(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  let year = parseInt(parts[0]);
  if (year < 2400) year += 543;
  return year.toString();
}

/**
 * Checks if an email belongs to a system administrator.
 * Uses a bootstrap email and potentially a server-verified status.
 */
export function isSystemAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  
  // Secure Fix: Don't rely solely on a leaked env var list.
  // Use a bootstrap email and the 'Administrator' role from the DB.
  const bootstrapAdmins = ['actingsublt.arak@gmail.com', 'arak.p@nfc.mail.go.th'];
  const currentEmail = email.toLowerCase().trim();
  
  return bootstrapAdmins.includes(currentEmail);
}

/**
 * Generates a unique secure ID.
 */
export function generateId(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * Returns the Thai display name for a given role token.
 * @param role Role token ('Administrator', 'Supervisor', 'Staff')
 * @returns Thai display string
 */
export function getRoleDisplayName(role: string | undefined | null): string {
  if (!role) return 'เจ้าหน้าที่ (Staff)';
  
  const roles: Record<string, string> = {
    'Administrator': 'ผู้ดูแลระบบ (Admin)',
    'Supervisor': 'ผู้ควบคุมงาน (Supervisor)',
    'Staff': 'เจ้าหน้าที่ (Staff)'
  };
  
  return roles[role] || role;
}

/**
 * Recursively removes undefined values from an object or array.
 * Required for Firestore because it doesn't support 'undefined'.
 */
export function cleanFirestoreData<T>(data: T): T {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => cleanFirestoreData(item)) as any;
  }

  const result: any = {};
  Object.entries(data as Record<string, any>).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = cleanFirestoreData(value);
    }
  });

  return result;
}
