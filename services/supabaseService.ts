
import { createClient } from '@supabase/supabase-js';
import { Candidate, JobDescription, AppRole, AccessRule, Permission } from '../types';
import { MOCK_CANDIDATES, DEFAULT_JOBS } from '../constants';

// Helper to get env vars safely
const getEnv = (key: string) => {
  return (import.meta as any).env?.[key] || process.env[key] || '';
};

const storedUrl = localStorage.getItem('SB_URL');
const storedKey = localStorage.getItem('SB_KEY');

const DEFAULT_URL = 'https://doeclppbusripsfqzsjt.supabase.co';
const DEFAULT_KEY = 'sb_publishable_RmAapGigOCOCgIWoCC7fNA_iIm0f1dr';

const SUPABASE_URL = storedUrl || getEnv('VITE_SUPABASE_URL') || DEFAULT_URL;
const SUPABASE_KEY = storedKey || getEnv('VITE_SUPABASE_KEY') || DEFAULT_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const auth = supabase.auth;

export const isSupabaseConfigured = () => {
  return SUPABASE_URL.includes('supabase.co') && SUPABASE_KEY.length > 10;
};

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('SB_URL', url);
  localStorage.setItem('SB_KEY', key);
  window.location.reload();
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem('SB_URL');
  localStorage.removeItem('SB_KEY');
  window.location.reload();
};

// --- AUTHENTICATION ---

export const signInWithGoogle = async () => {
    if (!isSupabaseConfigured()) {
        alert("Please configure Supabase connection first.");
        return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
    if (error) throw error;
};

export const signInWithMagicLink = async (email: string) => {
    if (!isSupabaseConfigured()) {
        alert("Please configure Supabase connection first.");
        return;
    }
    const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
            emailRedirectTo: window.location.origin
        }
    });
    if (error) throw error;
};

export const signOut = async () => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

// --- Table Names ---
const T_CANDIDATES = 'candidates';
const T_JOBS = 'job_descriptions';
const T_VIEWS = 'candidate_views';
const T_ROLES = 'app_roles';
const T_ACCESS = 'access_control';
const T_LOGS = 'action_logs';

// --- RBAC & AUTH SERVICE ---

/**
 * Resolves the user's role and permissions based on Email/Domain whitelist.
 * ROBUST IMPLEMENTATION: Completely ignores 'type' column.
 */
export const resolveUserPermissions = async (email: string): Promise<{ role: string, permissions: Permission[] }> => {
    if (!isSupabaseConfigured()) {
        // Fallback for Demo Mode
        if (email.includes('admin') || email.includes('robinhsu')) return { role: 'ADMIN', permissions: ['VIEW_DASHBOARD', 'VIEW_LIST', 'EDIT_CANDIDATE', 'DELETE_CANDIDATE', 'IMPORT_DATA', 'MANAGE_ACCESS', 'MANAGE_JD', 'AI_CHAT', 'VIEW_LOGS'] };
        return { role: 'USER', permissions: ['VIEW_DASHBOARD', 'VIEW_LIST', 'AI_CHAT'] };
    }

    const domain = email.split('@')[1];

    try {
        // 1. Fetch all matching rules by VALUE only.
        // We look for exact email match OR domain match in the 'value' column.
        const { data: rules, error } = await supabase
            .from(T_ACCESS)
            .select('*')
            .or(`value.eq.${email},value.eq.${domain}`);

        if (error) {
            console.warn("RBAC Check Error:", error.message);
            return { role: 'GUEST', permissions: [] };
        }

        if (!rules || rules.length === 0) {
            console.log(`Access Denied for ${email}: No matching whitelist rule.`);
            return { role: 'GUEST', permissions: [] };
        }

        // 2. Prioritize Exact Email Match over Domain Match
        const emailMatch = rules.find((r: any) => r.value === email);
        const domainMatch = rules.find((r: any) => r.value === domain);
        
        const resolvedRoleName = emailMatch?.role || domainMatch?.role || 'GUEST';

        // 3. Fetch Permissions for the role
        const { data: roleData } = await supabase
            .from(T_ROLES)
            .select('permissions')
            .eq('role_name', resolvedRoleName)
            .single();

        return { 
            role: resolvedRoleName, 
            permissions: (roleData?.permissions as Permission[]) || [] 
        };
    } catch (e) {
        console.error("RBAC Resolution Failed", e);
        return { role: 'GUEST', permissions: [] };
    }
};

// --- ACCESS CONTROL MANAGEMENT (ADMIN) ---

export const fetchAccessRules = async (): Promise<AccessRule[]> => {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase.from(T_ACCESS).select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    return data || [];
};

export const addAccessRule = async (value: string, role: string) => {
    if (!isSupabaseConfigured()) return;
    
    // Check if exists
    const { data: existing } = await supabase.from(T_ACCESS).select('id').eq('value', value).single();
    
    if (existing) {
        await supabase.from(T_ACCESS).update({ role }).eq('id', existing.id);
    } else {
        // Insert without 'type' column
        await supabase.from(T_ACCESS).insert({ value, role });
    }
};

export const deleteAccessRule = async (id: string) => {
    if (!isSupabaseConfigured()) return;
    await supabase.from(T_ACCESS).delete().eq('id', id);
};

export const fetchRoles = async (): Promise<AppRole[]> => {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase.from(T_ROLES).select('*').order('role_name');
    if (error) console.error(error);
    return data || [];
};

export const updateRolePermissions = async (roleName: string, permissions: Permission[]) => {
    if (!isSupabaseConfigured()) return;
    await supabase.from(T_ROLES).update({ permissions }).eq('role_name', roleName);
};

// --- CANDIDATE OPERATIONS (Legacy Adapted) ---

const toDatabaseLayer = (candidate: Candidate) => {
  const personalInfo = candidate.analysis?.extractedData?.personalInfo || null;
  return {
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
    role_applied: candidate.roleApplied,
    source: candidate.source,
    status: candidate.status,
    resume_url: candidate.resumeUrl,
    photo_url: candidate.photoUrl,
    linkedin_url: candidate.linkedinUrl, 
    uploaded_by: candidate.uploadedBy, 
    analysis: candidate.analysis,
    personal_info: personalInfo,
    is_deleted: candidate.isDeleted || false,
    created_at: candidate.createdAt,
    updated_at: candidate.updatedAt
  };
};

const fromDatabaseLayer = (dbRecord: any, viewedByMap?: Record<string, string[]>): Candidate => {
  return {
    id: dbRecord.id,
    name: dbRecord.name,
    email: dbRecord.email,
    roleApplied: dbRecord.role_applied || dbRecord.roleApplied || '', 
    source: dbRecord.source,
    status: dbRecord.status,
    resumeUrl: dbRecord.resume_url || dbRecord.resumeUrl,
    photoUrl: dbRecord.photo_url || dbRecord.photoUrl,
    linkedinUrl: dbRecord.linkedin_url || dbRecord.linkedinUrl, 
    uploadedBy: dbRecord.uploaded_by || dbRecord.uploadedBy, 
    analysis: dbRecord.analysis,
    viewedBy: viewedByMap ? (viewedByMap[dbRecord.id] || []) : [],
    isDeleted: dbRecord.is_deleted || false,
    createdAt: dbRecord.created_at || dbRecord.createdAt || new Date().toISOString(),
    updatedAt: dbRecord.updated_at || dbRecord.updatedAt || new Date().toISOString()
  };
};

export const fetchCandidates = async (): Promise<Candidate[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data: candidatesData, error } = await supabase
    .from(T_CANDIDATES)
    .select('*')
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return []; 
    return [];
  }

  let viewedByMap: Record<string, string[]> = {};
  try {
      const { data: viewsData } = await supabase.from(T_VIEWS).select('candidate_id, user_email');
      if (viewsData) {
          viewsData.forEach((v: any) => {
              if (!viewedByMap[v.candidate_id]) viewedByMap[v.candidate_id] = [];
              viewedByMap[v.candidate_id].push(v.user_email);
          });
      }
  } catch (e) {}

  return (candidatesData || []).map(c => fromDatabaseLayer(c, viewedByMap));
};

export const createCandidate = async (candidate: Candidate): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const dbPayload = toDatabaseLayer(candidate);
  const { error } = await supabase.from(T_CANDIDATES).insert([dbPayload]);
  if (error) throw error;
};

export const updateCandidate = async (candidate: Candidate): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const dbPayload = toDatabaseLayer(candidate);
  const { error } = await supabase.from(T_CANDIDATES).update(dbPayload).eq('id', candidate.id);
  if (error) throw error;
};

export const softDeleteCandidate = async (id: string, userEmail: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase
    .from(T_CANDIDATES)
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

export const markCandidateAsViewed = async (candidateId: string, userEmail: string): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    await supabase.from(T_VIEWS).insert({ candidate_id: candidateId, user_email: userEmail }).select();
};

// --- JOB OPERATIONS ---

export const fetchJobDescriptions = async (): Promise<JobDescription[]> => {
    if (!isSupabaseConfigured()) return DEFAULT_JOBS;
    const { data } = await supabase.from(T_JOBS).select('*').order('created_at', { ascending: false });
    return data || [];
};

export const createJobDescription = async (job: JobDescription): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from(T_JOBS).insert([job]);
    if (error) throw error;
};

export const updateJobDescription = async (id: string, updates: Partial<JobDescription>): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from(T_JOBS).update(updates).eq('id', id);
    if (error) throw error;
};

export const deleteJobDescription = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from(T_JOBS).delete().match({ id });
    if (error) throw error;
};

// --- RESET DB ---

export const resetDatabaseWithMockData = async (): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    
    // We do NOT reset access_control or app_roles to avoid locking the admin out.
    await supabase.from(T_VIEWS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from(T_CANDIDATES).delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
    await supabase.from(T_JOBS).delete().neq('id', '0');

    const candidatesToInsert = MOCK_CANDIDATES.map(({ id, ...rest }) => {
        const candidateNoId = { ...rest, id: crypto.randomUUID() } as Candidate;
        return toDatabaseLayer(candidateNoId);
    });

    await supabase.from(T_CANDIDATES).insert(candidatesToInsert);
    await supabase.from(T_JOBS).insert(DEFAULT_JOBS);
};
