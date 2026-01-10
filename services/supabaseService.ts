
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, query, where, orderBy, setDoc, getDoc, Timestamp, writeBatch 
} from 'firebase/firestore';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, sendSignInLinkToEmail, 
  isSignInWithEmailLink, signInWithEmailLink, signOut as firebaseSignOut 
} from 'firebase/auth';

import { Candidate, JobDescription, AppRole, AccessRule, Permission, ScoringStandard, AnalysisResult } from '../types';
import { MOCK_CANDIDATES, DEFAULT_JOBS, DEFAULT_SCORING_STANDARDS, MOCK_USER } from '../constants';

// --- FIREBASE CONFIGURATION (Hardcoded as requested) ---

const firebaseConfig = {
  apiKey: "AIzaSyD2fR8IkZXUfK7KIK6syA-zcW75e-B5H6Q",
  authDomain: "app-ai-104.firebaseapp.com",
  projectId: "app-ai-104",
  storageBucket: "app-ai-104.firebasestorage.app",
  messagingSenderId: "411600166726",
  appId: "1:411600166726:web:04f1b1fdc42a81a8cd4f47",
  measurementId: "G-JFM138SG7Z"
};

export let app: any;
export let db: any;
export let auth: any;

// Initialize Firebase Immediately
try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  db = getFirestore(app);
  auth = getAuth(app);
  console.log("Firebase Initialized Successfully with Hardcoded Config.");
} catch (e) {
  console.error("Firebase Init Error:", e);
}

// Check if configured (Always true now)
export const isSupabaseConfigured = () => {
  return !!app && !!db;
};

// --- CONFIG MANAGEMENT (Legacy Support) ---
// Kept to avoid breaking imports, but functions do nothing now since config is hardcoded.
export const saveSupabaseConfig = (configStr: string) => { window.location.reload(); };
export const clearSupabaseConfig = () => { window.location.reload(); };

// --- AUTHENTICATION ---

export const signInWithGoogle = async () => {
    if (!auth) throw new Error("Firebase not configured");
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
};

export const signInWithMagicLink = async (email: string) => {
    if (!auth) throw new Error("Firebase not configured");
    const actionCodeSettings = {
        url: window.location.origin,
        handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
};

export const verifyMagicLink = async () => {
    if (!auth) return;
    if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = window.prompt('Please provide your email for confirmation');
        }
        if (email) {
            await signInWithEmailLink(auth, email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
        }
    }
};

export const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
};

export const supabase = { auth }; 

// --- COLLECTIONS ---
const C_CANDIDATES = 'candidates';
const C_JOBS = 'job_descriptions';
const C_ROLES = 'app_roles';
const C_ACCESS = 'access_control';
const C_LOGS = 'action_logs';
const C_STANDARDS = 'scoring_standards';

// --- DATABASE INITIALIZATION (SCHEMA SEEDING) ---

export const initializeDatabase = async () => {
    if (!db) return;
    console.log("Checking Database Integrity...");

    try {
        // 1. Check Roles
        const rolesSnap = await getDocs(collection(db, C_ROLES));
        if (rolesSnap.empty) {
            console.log("Seeding Roles...");
            const batch = writeBatch(db);
            
            // ADMIN
            const adminPerms: Permission[] = ['VIEW_DASHBOARD', 'VIEW_LIST', 'EDIT_CANDIDATE', 'DELETE_CANDIDATE', 'IMPORT_DATA', 'EXPORT_DATA', 'SEND_EMAIL', 'AI_CHAT', 'MANAGE_ACCESS', 'MANAGE_JD', 'VIEW_LOGS'];
            batch.set(doc(db, C_ROLES, 'ADMIN'), { role_name: 'ADMIN', permissions: adminPerms, description: 'Full System Access', created_at: new Date().toISOString() });

            // MANAGER
            const managerPerms: Permission[] = ['VIEW_DASHBOARD', 'VIEW_LIST', 'EDIT_CANDIDATE', 'IMPORT_DATA', 'AI_CHAT', 'MANAGE_JD'];
            batch.set(doc(db, C_ROLES, 'MANAGER'), { role_name: 'MANAGER', permissions: managerPerms, description: 'Hiring Manager', created_at: new Date().toISOString() });

            // USER
            const userPerms: Permission[] = ['VIEW_DASHBOARD', 'VIEW_LIST', 'AI_CHAT'];
            batch.set(doc(db, C_ROLES, 'USER'), { role_name: 'USER', permissions: userPerms, description: 'Standard User', created_at: new Date().toISOString() });

            await batch.commit();
        }

        // 2. Check Access Control (Allow the mock user email and domain by default)
        const accessSnap = await getDocs(collection(db, C_ACCESS));
        if (accessSnap.empty) {
            console.log("Seeding Access Control...");
            const batch = writeBatch(db);
            
            // Allow Robin (Mock User)
            const mockEmail = MOCK_USER.email;
            batch.set(doc(collection(db, C_ACCESS)), {
                value: mockEmail,
                role: 'ADMIN',
                type: 'EMAIL',
                created_at: new Date().toISOString()
            });

            // Allow Domain 91app.com (Inferred from context)
            batch.set(doc(collection(db, C_ACCESS)), {
                value: '91app.com',
                role: 'ADMIN',
                type: 'DOMAIN',
                created_at: new Date().toISOString()
            });

            // Allow localhost for dev
            batch.set(doc(collection(db, C_ACCESS)), {
                value: 'localhost',
                role: 'ADMIN',
                type: 'DOMAIN',
                created_at: new Date().toISOString()
            });

            await batch.commit();
        }

        // 3. Check Job Descriptions
        const jdsSnap = await getDocs(collection(db, C_JOBS));
        if (jdsSnap.empty) {
            console.log("Seeding Job Descriptions...");
            const batch = writeBatch(db);
            DEFAULT_JOBS.forEach(job => {
                const { id, ...data } = job;
                // Use a new ID or the one from constants if we want consistency
                batch.set(doc(collection(db, C_JOBS)), data);
            });
            await batch.commit();
        }

        // 4. Check Scoring Standards
        const stdSnap = await getDocs(collection(db, C_STANDARDS));
        if (stdSnap.empty) {
            console.log("Seeding Scoring Standards...");
            const batch = writeBatch(db);
            DEFAULT_SCORING_STANDARDS.forEach(std => {
                const { id, ...data } = std;
                batch.set(doc(collection(db, C_STANDARDS)), data);
            });
            await batch.commit();
        }

        // 5. Check Candidates (Seed with Mock if empty for demo purposes)
        const candSnap = await getDocs(collection(db, C_CANDIDATES));
        if (candSnap.empty) {
             console.log("Seeding Mock Candidates...");
             const batch = writeBatch(db);
             MOCK_CANDIDATES.forEach(c => {
                 const { id, ...data } = c;
                 // Ensure ID is used as doc key
                 batch.set(doc(db, C_CANDIDATES, c.id), data);
             });
             await batch.commit();
        }

        console.log("Database Initialization Complete.");

    } catch (e) {
        console.error("Database Seeding Failed:", e);
    }
};

// --- RBAC & AUTH SERVICE ---

export const resolveUserPermissions = async (email: string): Promise<{ role: string, permissions: Permission[] }> => {
    if (!isSupabaseConfigured()) {
        // Fallback if DB is somehow down
        if (email.includes('admin') || email.includes('robinhsu')) return { role: 'ADMIN', permissions: ['VIEW_DASHBOARD', 'VIEW_LIST', 'EDIT_CANDIDATE', 'DELETE_CANDIDATE', 'IMPORT_DATA', 'MANAGE_ACCESS', 'MANAGE_JD', 'AI_CHAT', 'VIEW_LOGS'] };
        return { role: 'USER', permissions: ['VIEW_DASHBOARD', 'VIEW_LIST', 'AI_CHAT'] };
    }

    const domain = email.split('@')[1];

    try {
        const q = query(collection(db, C_ACCESS));
        const snapshot = await getDocs(q);
        const rules = snapshot.docs.map(d => d.data() as AccessRule);

        // Exact Email Match > Domain Match
        const emailMatch = rules.find(r => r.value.toLowerCase() === email.toLowerCase());
        const domainMatch = rules.find(r => r.type === 'DOMAIN' && domain.includes(r.value));
        
        const resolvedRoleName = emailMatch?.role || domainMatch?.role || 'GUEST';

        // Fetch Role Permissions
        const roleRef = doc(db, C_ROLES, resolvedRoleName);
        const roleSnap = await getDoc(roleRef);
        
        if (roleSnap.exists()) {
            return { role: resolvedRoleName, permissions: roleSnap.data().permissions as Permission[] };
        }

        // Hardcoded Fallback for Admin during first run if DB fetch fails but logic matched
        if (resolvedRoleName === 'ADMIN') return { role: 'ADMIN', permissions: ['VIEW_DASHBOARD', 'VIEW_LIST', 'EDIT_CANDIDATE', 'DELETE_CANDIDATE', 'IMPORT_DATA', 'MANAGE_ACCESS', 'MANAGE_JD', 'AI_CHAT', 'VIEW_LOGS'] as Permission[] };

        return { role: 'GUEST', permissions: [] };

    } catch (e) {
        console.error("RBAC Resolution Failed", e);
        return { role: 'GUEST', permissions: [] };
    }
};

// --- ACCESS CONTROL ---

export const fetchAccessRules = async (): Promise<AccessRule[]> => {
    if (!db) return [];
    const q = query(collection(db, C_ACCESS), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as AccessRule));
};

export const addAccessRule = async (value: string, role: string) => {
    if (!db) return;
    await addDoc(collection(db, C_ACCESS), {
        value,
        role,
        type: value.includes('@') ? 'EMAIL' : 'DOMAIN',
        created_at: new Date().toISOString()
    });
};

export const deleteAccessRule = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, C_ACCESS, id));
};

export const fetchRoles = async (): Promise<AppRole[]> => {
    if (!db) return [];
    const snap = await getDocs(collection(db, C_ROLES));
    return snap.docs.map(d => ({ ...d.data(), role_name: d.id } as AppRole));
};

export const updateRolePermissions = async (roleName: string, permissions: Permission[]) => {
    if (!db) return;
    await setDoc(doc(db, C_ROLES, roleName), { permissions }, { merge: true });
};

// --- CANDIDATE OPERATIONS ---

export const fetchCandidates = async (): Promise<Candidate[]> => {
  if (!db) return [];
  try {
      const q = query(collection(db, C_CANDIDATES), where('isDeleted', '!=', true), orderBy('isDeleted'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as Candidate));
  } catch (e) {
      console.warn("Candidates Fetch Error (might be indexing):", e);
      // Fallback simple query if composite index is missing
      const snap = await getDocs(collection(db, C_CANDIDATES));
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as Candidate)).filter(c => !c.isDeleted);
  }
};

export const fetchDeletedCandidates = async (): Promise<Candidate[]> => {
    if (!db) return [];
    const q = query(collection(db, C_CANDIDATES), where('isDeleted', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Candidate));
};

export const createCandidate = async (candidate: Candidate): Promise<void> => {
  if (!db) return;
  const { id, ...data } = candidate;
  // Use Firebase ID if new, or specified UUID if imported
  if (candidate.id && candidate.id.length > 10) {
      await setDoc(doc(db, C_CANDIDATES, candidate.id), data);
  } else {
      await addDoc(collection(db, C_CANDIDATES), data);
  }
};

export const updateCandidate = async (candidate: Candidate): Promise<void> => {
  if (!db) return;
  const { id, ...data } = candidate;
  await updateDoc(doc(db, C_CANDIDATES, id), data);
};

export const softDeleteCandidate = async (id: string, userEmail: string): Promise<void> => {
  if (!db) return;
  await updateDoc(doc(db, C_CANDIDATES, id), {
      isDeleted: true,
      deletedBy: userEmail,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
  });
};

export const restoreCandidate = async (id: string): Promise<void> => {
    if (!db) return;
    await updateDoc(doc(db, C_CANDIDATES, id), {
        isDeleted: false,
        deletedBy: null,
        deletedAt: null,
        updatedAt: new Date().toISOString()
    });
};

export const markCandidateAsViewed = async (candidateId: string, userEmail: string): Promise<void> => {
    if (!db) return;
    const candidateRef = doc(db, C_CANDIDATES, candidateId);
    const snap = await getDoc(candidateRef);
    if (snap.exists()) {
        const data = snap.data();
        const viewedBy = data.viewedBy || [];
        if (!viewedBy.includes(userEmail)) {
            await updateDoc(candidateRef, { viewedBy: [...viewedBy, userEmail] });
        }
    }
};

// --- DATA CONSISTENCY TOOLS ---

export const updateCandidateRoleName = async (oldRoleName: string, newRoleName: string): Promise<void> => {
    if (!db) return;
    const q = query(collection(db, C_CANDIDATES), where('roleApplied', '==', oldRoleName));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
        await updateDoc(doc(db, C_CANDIDATES, d.id), { roleApplied: newRoleName });
    }
};

export const getUniqueCandidateRoles = async (): Promise<{role: string, count: number}[]> => {
    const candidates = await fetchCandidates();
    const map: Record<string, number> = {};
    candidates.forEach(c => {
        const r = c.roleApplied || 'Unknown';
        map[r] = (map[r] || 0) + 1;
    });
    return Object.entries(map).map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count);
};

export const migrateCandidateRoles = async (fromRole: string, toRole: string): Promise<void> => {
    await updateCandidateRoleName(fromRole, toRole);
};

// --- JOB OPERATIONS ---

export const fetchJobDescriptions = async (): Promise<JobDescription[]> => {
    if (!db) return DEFAULT_JOBS;
    const q = query(collection(db, C_JOBS), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as JobDescription));
};

export const createJobDescription = async (job: JobDescription): Promise<void> => {
    if (!db) return;
    const { id, ...data } = job;
    await addDoc(collection(db, C_JOBS), data);
};

export const updateJobDescription = async (id: string, updates: Partial<JobDescription>): Promise<void> => {
    if (!db) return;
    await updateDoc(doc(db, C_JOBS, id), updates);
};

export const deleteJobDescription = async (id: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, C_JOBS, id));
};

// --- SCORING STANDARDS OPERATIONS ---

export const fetchScoringStandards = async (): Promise<ScoringStandard[]> => {
    if (!db) return DEFAULT_SCORING_STANDARDS;
    const q = query(collection(db, C_STANDARDS), orderBy('priority', 'asc'));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as ScoringStandard));
    return data.length > 0 ? data : DEFAULT_SCORING_STANDARDS;
};

export const updateScoringStandard = async (standard: ScoringStandard): Promise<void> => {
    if (!db) return;
    const { id, ...data } = standard;
    
    // Check if exists using id (if it's a valid ID)
    let exists = false;
    if (id && id.length > 5) {
        const snap = await getDoc(doc(db, C_STANDARDS, id));
        exists = snap.exists();
    }

    if (exists) {
        await updateDoc(doc(db, C_STANDARDS, id), data);
    } else {
        await addDoc(collection(db, C_STANDARDS), data);
    }
};

export const deleteScoringStandard = async (id: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, C_STANDARDS, id));
};

// --- RESET DB ---

export const resetDatabaseWithMockData = async (): Promise<void> => {
    if (!db) return;
    // Helper to delete all in collection
    const deleteCollection = async (path: string) => {
        const q = query(collection(db, path));
        const snap = await getDocs(q);
        snap.forEach(async (d) => await deleteDoc(d.ref));
    };
    // Re-initialize uses the initializeDatabase function now by clearing first
    await deleteCollection(C_CANDIDATES);
    await deleteCollection(C_JOBS);
    await deleteCollection(C_STANDARDS);
    await deleteCollection(C_ROLES);
    await deleteCollection(C_ACCESS);
    await initializeDatabase();
};
