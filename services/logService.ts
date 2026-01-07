
import { ActionLog, User } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseService';

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
  if (isSupabaseConfigured()) {
    // Fire and forget
    supabase.from('action_logs').insert([{
        action: newLog.action,
        user_email: newLog.user_email,
        target: newLog.target,
        details: newLog.details,
        created_at: newLog.created_at
    }]).then(({ error }) => {
      if (error) {
          if (error.code !== '42P01') { // Ignore missing table
              console.error('Failed to sync log to DB:', error);
          }
      }
    });
  }
};

export const fetchLogs = async (): Promise<ActionLog[]> => {
  if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('action_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (!error && data) return data;
  }
  return localLogs;
};
