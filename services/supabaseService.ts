
import { createClient } from '@supabase/supabase-js';
import { Candidate, JobDescription, AppRole, AccessRule, Permission, ScoringStandard, AnalysisResult } from '../types';
import { MOCK_CANDIDATES, DEFAULT_JOBS, DEFAULT_SCORING_STANDARDS } from '../constants';

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
const T_STANDARDS = 'scoring_standards'; 
const T_EVALUATIONS = 'candidate_evaluations'; // NEW
const T_EVAL_DIMS = 'evaluation_dimensions'; // NEW

// --- RBAC & AUTH SERVICE ---

export const resolveUserPermissions = async (email: string): Promise<{ role: string, permissions: Permission[] }> => {
    if (!isSupabaseConfigured()) {
        if (email.includes('admin') || email.includes('robinhsu')) return { role: 'ADMIN', permissions: ['VIEW_DASHBOARD', 'VIEW_LIST', 'EDIT_CANDIDATE', 'DELETE_CANDIDATE', 'IMPORT_DATA', 'MANAGE_ACCESS', 'MANAGE_JD', 'AI_CHAT', 'VIEW_LOGS'] };
        return { role: 'USER', permissions: ['VIEW_DASHBOARD', 'VIEW_LIST', 'AI_CHAT'] };
    }

    const domain = email.split('@')[1];

    try {
        const { data: rules, error } = await supabase
            .from(T_ACCESS)
            .select('*')
            .or(`value.eq.${email},value.eq.${domain}`);

        if (error) {
            console.warn("RBAC Check Error:", error.message);
            return { role: 'GUEST', permissions: [] };
        }

        if (!rules || rules.length === 0) {
            return { role: 'GUEST', permissions: [] };
        }

        const emailMatch = rules.find((r: any) => r.value === email);
        const domainMatch = rules.find((r: any) => r.value === domain);
        
        const resolvedRoleName = emailMatch?.role || domainMatch?.role || 'GUEST';

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
    const { data: existing } = await supabase.from(T_ACCESS).select('id').eq('value', value).single();
    if (existing) {
        await supabase.from(T_ACCESS).update({ role }).eq('id', existing.id);
    } else {
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

// --- CANDIDATE OPERATIONS ---

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
    deleted_by: candidate.deletedBy || null,
    deleted_at: candidate.deletedAt || null,
    is_unsolicited: candidate.isUnsolicited || false,
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
    deletedBy: dbRecord.deleted_by,
    deletedAt: dbRecord.deleted_at,
    isUnsolicited: dbRecord.is_unsolicited || false,
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

// NEW: Fetch deleted candidates for Recycle Bin
export const fetchDeletedCandidates = async (): Promise<Candidate[]> => {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase
        .from(T_CANDIDATES)
        .select('*')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

    if (error) {
        console.error("Error fetching deleted candidates", error);
        return [];
    }
    return (data || []).map(c => fromDatabaseLayer(c));
};

// --- NEW: EVALUATION SAVING LOGIC (INDEPENDENT TABLES) ---
const saveEvaluationSnapshot = async (candidate: Candidate) => {
    if (!candidate.analysis || !isSupabaseConfigured()) return;

    // 1. Insert into candidate_evaluations
    const evalPayload = {
        candidate_id: candidate.id,
        model_version: candidate.analysis.modelVersion || 'v3.0',
        total_score: candidate.analysis.matchScore,
        snapshot_summary: candidate.analysis.evaluationSnapshot, // JSONB
        evaluator_email: candidate.uploadedBy
    };

    const { data: evalData, error: evalError } = await supabase
        .from(T_EVALUATIONS)
        .insert(evalPayload)
        .select()
        .single();
    
    if (evalError) {
        console.warn("Failed to save independent evaluation record (Table might be missing):", evalError.message);
        return; // Non-blocking
    }

    // 2. Insert into evaluation_dimensions (if details exist)
    if (candidate.analysis.dimensionDetails && evalData) {
        const dimPayloads = candidate.analysis.dimensionDetails.map(d => ({
            evaluation_id: evalData.id,
            dimension_name: d.dimension,
            weight: d.weight,
            score: d.score,
            reasoning: d.reasoning
        }));
        
        const { error: dimError } = await supabase.from(T_EVAL_DIMS).insert(dimPayloads);
        if (dimError) console.warn("Failed to save dimensions:", dimError.message);
    }
};

export const createCandidate = async (candidate: Candidate): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const dbPayload = toDatabaseLayer(candidate);
  
  const { error } = await supabase.from(T_CANDIDATES).insert([dbPayload]);
  if (error) throw error;

  // Save the initial evaluation snapshot to external table
  await saveEvaluationSnapshot(candidate);
};

export const updateCandidate = async (candidate: Candidate): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const dbPayload = toDatabaseLayer(candidate);
  
  const { error } = await supabase.from(T_CANDIDATES).update(dbPayload).eq('id', candidate.id);
  if (error) throw error;

  // Save evaluation snapshot whenever analysis is updated
  // We check if "updatedAt" is recent to avoid dupes on minor status changes, 
  // but simpler logic is: always save snapshot on 'update' calls that contain full analysis data.
  // The UI calls this mostly for Re-scoring.
  await saveEvaluationSnapshot(candidate);
};

// Updated Soft Delete to track WHO and WHEN
export const softDeleteCandidate = async (id: string, userEmail: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase
    .from(T_CANDIDATES)
    .update({ 
        is_deleted: true, 
        deleted_by: userEmail,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString() 
    })
    .eq('id', id);
  if (error) throw error;
};

// NEW: Restore Candidate
export const restoreCandidate = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
        .from(T_CANDIDATES)
        .update({ 
            is_deleted: false, 
            deleted_by: null,
            deleted_at: null,
            updated_at: new Date().toISOString() 
        })
        .eq('id', id);
    if (error) throw error;
};

export const markCandidateAsViewed = async (candidateId: string, userEmail: string): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    await supabase.from(T_VIEWS).insert({ candidate_id: candidateId, user_email: userEmail }).select();
};

// --- DATA CONSISTENCY TOOLS ---

export const updateCandidateRoleName = async (oldRoleName: string, newRoleName: string): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
        .from(T_CANDIDATES)
        .update({ role_applied: newRoleName })
        .eq('role_applied', oldRoleName);
    if (error) throw error;
};

export const getUniqueCandidateRoles = async (): Promise<{role: string, count: number}[]> => {
    let rawData: any[] = [];

    if (isSupabaseConfigured()) {
        const { data } = await supabase
            .from(T_CANDIDATES)
            .select('role_applied')
            .or('is_deleted.is.null,is_deleted.eq.false');
        rawData = data || [];
    } else {
        rawData = MOCK_CANDIDATES.map(c => ({ role_applied: c.roleApplied }));
    }
    
    if (!rawData) return [];
    
    const map: Record<string, number> = {};
    rawData.forEach((row: any) => {
        const r = row.role_applied || 'Unknown';
        map[r] = (map[r] || 0) + 1;
    });

    return Object.entries(map)
        .map(([role, count]) => ({ role, count }))
        .sort((a, b) => b.count - a.count);
};

export const migrateCandidateRoles = async (fromRole: string, toRole: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        console.warn("Mock Mode: Migration simulated.", fromRole, "->", toRole);
        return;
    }
    await updateCandidateRoleName(fromRole, toRole);
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

// --- SCORING STANDARDS OPERATIONS ---

export const fetchScoringStandards = async (): Promise<ScoringStandard[]> => {
    if (!isSupabaseConfigured()) return DEFAULT_SCORING_STANDARDS;
    
    const { data, error } = await supabase
        .from(T_STANDARDS)
        .select('*')
        .order('priority', { ascending: true });
        
    if (error) {
        console.warn("Failed to fetch scoring standards:", error.message);
        return DEFAULT_SCORING_STANDARDS;
    }
    
    return data && data.length > 0 ? data : DEFAULT_SCORING_STANDARDS;
};

export const updateScoringStandard = async (standard: ScoringStandard): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from(T_STANDARDS).upsert(standard);
    if (error) throw error;
};

export const deleteScoringStandard = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from(T_STANDARDS).delete().eq('id', id);
    if (error) throw error;
};

// --- RESET DB ---

export const resetDatabaseWithMockData = async (): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    await supabase.from(T_VIEWS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from(T_CANDIDATES).delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
    await supabase.from(T_JOBS).delete().neq('id', '0');
    await supabase.from(T_STANDARDS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Clean external tables too
    try {
        await supabase.from(T_EVAL_DIMS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from(T_EVALUATIONS).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch(e) {}

    const candidatesToInsert = MOCK_CANDIDATES.map(({ id, ...rest }) => {
        const candidateNoId = { ...rest, id: crypto.randomUUID() } as Candidate;
        return toDatabaseLayer(candidateNoId);
    });

    await supabase.from(T_CANDIDATES).insert(candidatesToInsert);
    await supabase.from(T_JOBS).insert(DEFAULT_JOBS);
    await supabase.from(T_STANDARDS).insert(DEFAULT_SCORING_STANDARDS); 
};
