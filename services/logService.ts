
import { ActionLog, User } from '../types';
import { db, isSupabaseConfigured } from './supabaseService';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

// Mock in-memory logs for demo/fallback
let localLogs: ActionLog[] = [];

// Helper to get IP
const getIpAddress = async (): Promise<string> => {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (e) {
        return 'unknown';
    }
};

export const logAction = async (user: User, action: string, target: string = '', extraDetails: any = {}) => {
  const ip = await getIpAddress();
  
  const details = {
      ...extraDetails,
      ip: ip,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
  };

  const newLog: ActionLog = {
    id: crypto.randomUUID(),
    action,
    user_email: user.email,
    target: target,
    details: details,
    created_at: new Date().toISOString()
  };

  console.log(`[AUDIT LOG] ${action}: ${target}`, details);
  localLogs.unshift(newLog);

  // Sync to Database if connected
  if (isSupabaseConfigured() && db) {
    // Fire and forget
    addDoc(collection(db, 'action_logs'), {
        action: newLog.action,
        user_email: newLog.user_email,
        target: newLog.target,
        details: newLog.details,
        created_at: newLog.created_at
    }).catch(error => {
          console.error('Failed to sync log to DB:', error);
    });
  }
};

export const fetchLogs = async (): Promise<ActionLog[]> => {
  if (isSupabaseConfigured() && db) {
      try {
        const q = query(collection(db, 'action_logs'), orderBy('created_at', 'desc'), limit(100));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ActionLog));
        return data;
      } catch (error) {
        console.error("Error fetching logs:", error);
      }
  }
  return localLogs;
};
