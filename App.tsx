
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Plus, ShieldCheck, AlertCircle, RefreshCw, Database, Globe, CheckCircle2, X, Loader2, Zap } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth'; // Import Firebase listener

import { MOCK_CANDIDATES, DEFAULT_JOBS, MOCK_USER } from './constants';
import { User, Candidate, JobDescription } from './types';
import { logAction } from './services/logService';
import { 
    fetchCandidates, createCandidate, isSupabaseConfigured, markCandidateAsViewed, 
    softDeleteCandidate, resolveUserPermissions, auth, verifyMagicLink, signOut, 
    updateCandidate, fetchJobDescriptions, initializeDatabase // Import Init Function
} from './services/supabaseService';
import { reEvaluateCandidate } from './services/geminiService';
import { useLanguage } from './contexts/LanguageContext';

import DashboardStats from './components/DashboardStats';
import CandidateTable from './components/CandidateTable';
import CandidateDetail from './components/CandidateDetail';
import ImportModal from './components/ImportModal';
import AIChat from './components/AIChat';
import PermissionGuard from './components/PermissionGuard';
import ConfigModal from './components/ConfigModal';
import AccessControlModal from './components/AccessControlModal';
import LoginPage from './components/LoginPage'; 

const App: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Data State
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [view, setView] = useState<'dashboard' | 'candidates'>('dashboard');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  
  // Modal States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAccessControlOpen, setIsAccessControlOpen] = useState(false);

  // UI States
  const [dataLoading, setDataLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isDbConnected, setIsDbConnected] = useState(false);
  
  const [toast, setToast] = useState<{
      message: string, 
      type: 'success' | 'error',
      candidate?: Candidate 
  } | null>(null);

  // Filters
  const [filterSource, setFilterSource] = useState<string>('All');
  const [filterRole, setFilterRole] = useState<string>('All');
  const [filterTopTalent, setFilterTopTalent] = useState<boolean>(false);
  const [showActiveApplicantsOnly, setShowActiveApplicantsOnly] = useState(false);

  // --- INITIALIZATION & AUTH ---
  useEffect(() => {
    const init = async () => {
        // 1. Initialize DB Schema/Seed Data
        await initializeDatabase();

        // 2. Check Magic Link Redirects
        await verifyMagicLink();

        const configured = isSupabaseConfigured();
        setIsDbConnected(configured);

        if (!configured) {
             // Fallback logic, though with hardcoded config this shouldn't happen unless Firebase is down
            console.warn("DB not configured. Entering Demo Mode.");
            setUser(MOCK_USER); 
            setCandidates(MOCK_CANDIDATES);
            setJds(DEFAULT_JOBS);
            if (DEFAULT_JOBS.length > 0) setFilterRole(DEFAULT_JOBS[0].title);
            setIsAuthChecking(false);
            return;
        }

        // 3. Real Auth Listener
        if (auth) {
            const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                if (firebaseUser) {
                    // Resolve Role & Permissions from Firestore
                    const { role, permissions } = await resolveUserPermissions(firebaseUser.email || '');
                    
                    const appUser: User = {
                        id: firebaseUser.uid,
                        email: firebaseUser.email || '',
                        role: role,
                        permissions: permissions,
                        avatarUrl: firebaseUser.photoURL || undefined
                    };
                    setUser(appUser);
                    loadData(true); // Load data after login
                } else {
                    setUser(null);
                    setCandidates([]);
                }
                setIsAuthChecking(false);
            });
            return () => unsubscribe();
        } else {
            setIsAuthChecking(false);
        }
    };
    
    init();
  }, []);

  // Auto-close Toast
  useEffect(() => {
      if (toast && toast.type === 'success') {
          const timer = setTimeout(() => setToast(null), 5000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  const loadData = async (forceDb = false) => {
    if (!isSupabaseConfigured() && !forceDb) return;

    setDataLoading(true);
    setDbError(null);
    try {
      const [data, jdData] = await Promise.all([
          fetchCandidates(),
          fetchJobDescriptions()
      ]);
      setCandidates(data); 
      
      const loadedJds = jdData.length > 0 ? jdData : DEFAULT_JOBS;
      setJds(loadedJds);

      // Default Filter Logic: Pick highest priority role
      if (loadedJds.length > 0) {
          const sortedJds = [...loadedJds].sort((a, b) => (a.priority || 99) - (b.priority || 99));
          const primaryRole = sortedJds[0];
          // Only set if currently 'All'
          setFilterRole(prev => prev === 'All' ? primaryRole.title : prev);
      }

    } catch (err) {
      console.error(err);
      setDbError("Failed to load data from Firebase.");
    } finally {
      setDataLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    window.location.reload();
  };

  // --- ACTIONS ---
  const handleImport = async (newCandidate: Candidate) => {
    const previousCandidates = [...candidates];
    setCandidates(prev => [newCandidate, ...prev]);
    setIsImportOpen(false);
    setSelectedCandidate(newCandidate);
    
    try {
      await createCandidate(newCandidate);
      if (user) logAction(user, 'IMPORT_CANDIDATE', newCandidate.name, { id: newCandidate.id });
      setToast({ message: `${newCandidate.name} imported successfully.`, type: 'success', candidate: newCandidate });
    } catch (error: any) {
      setCandidates(previousCandidates);
      setToast({ message: `Import Failed: ${error.message}`, type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('deleteConfirm'))) {
      const previousCandidates = [...candidates];
      setCandidates(prev => prev.filter(c => c.id !== id));
      try {
        if (!user) throw new Error("No user");
        await softDeleteCandidate(id, user.email);
        logAction(user, 'DELETE_CANDIDATE', id);
        setToast({ message: "Candidate removed.", type: 'success' });
      } catch (error: any) {
        setCandidates(previousCandidates);
        setToast({ message: `Delete Failed: ${error.message}`, type: 'error' });
      }
    }
  };

  const handleCandidateUpdate = async (updated: Candidate) => {
    setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c));
    if (!selectedCandidate) {
        setSelectedCandidate(updated);
    } else if (selectedCandidate.id === updated.id) {
        setSelectedCandidate(updated);
    }
    
    try {
        await updateCandidate(updated);
        if (user) logAction(user, 'UPDATE_CANDIDATE', updated.name, { id: updated.id });
        setToast({ message: `Candidate updated.`, type: 'success' });
    } catch (error: any) {
        setToast({ message: `Update Failed: ${error.message}`, type: 'error' });
    }
  };

  const handleSelectCandidate = (candidate: Candidate) => {
      setSelectedCandidate(candidate);
      if (user && isDbConnected) {
          const alreadyViewed = candidate.viewedBy?.includes(user.email);
          if (!alreadyViewed) {
              const updatedViewedBy = [...(candidate.viewedBy || []), user.email];
              const updatedCandidate = { ...candidate, viewedBy: updatedViewedBy };
              updateCandidate(updatedCandidate); 
              setCandidates(prev => prev.map(c => c.id === updatedCandidate.id ? updatedCandidate : c));
              markCandidateAsViewed(candidate.id, user.email);
          }
      }
  };

  const handleDashboardFilter = (type: 'source' | 'role' | 'topTalent', value: string | boolean) => {
    if (type === 'source') { setFilterSource(value as string); setFilterRole('All'); setFilterTopTalent(false); }
    if (type === 'role') { setFilterRole(value as string); setFilterSource('All'); setFilterTopTalent(false); }
    if (type === 'topTalent') { setFilterTopTalent(true); setFilterSource('All'); setFilterRole('All'); }
    setShowActiveApplicantsOnly(false);
    setView('candidates');
  };

  const resetFilters = () => { setFilterSource('All'); setFilterRole('All'); setFilterTopTalent(false); };
  
  const activeApplicantCount = candidates.filter(c => c.isUnsolicited).length;

  // --- RENDER ---

  if (isAuthChecking) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-slate-500 font-medium animate-pulse">Initializing GenAI Portal...</p>
          </div>
      );
  }

  // Not Logged In
  if (!user) {
      return (
        <>
            <LoginPage onLogin={(u) => setUser(u)} onOpenConfig={() => setIsConfigOpen(true)} />
            {isConfigOpen && <ConfigModal onClose={() => setIsConfigOpen(false)} />}
        </>
      );
  }

  // Logged In
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Toast */}
      {toast && (
          <div 
            onClick={() => { if (toast.candidate) { handleSelectCandidate(toast.candidate); setToast(null); } }}
            className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-slide-in-top border-2 transition-transform hover:scale-105 cursor-pointer backdrop-blur-sm max-w-lg
            ${toast.type === 'success' ? 'bg-slate-900/95 text-white border-slate-700' : 'bg-red-600/95 text-white border-red-500'}`}
          >
              <div className={`p-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500/20' : 'bg-white/20'}`}>
                {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-white" />}
              </div>
              <div>
                 <p className="font-bold text-sm">{toast.message}</p>
                 {toast.candidate && !selectedCandidate && <p className="text-xs opacity-70 mt-0.5 font-mono">Click to open profile</p>}
              </div>
              <button className="ml-2 p-1 hover:bg-white/10 rounded-full" onClick={(e) => { e.stopPropagation(); setToast(null); }}>
                 <X className="w-4 h-4 opacity-70" />
              </button>
          </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="w-full px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">H</div>
             <span className="font-semibold text-lg tracking-tight">HR GenAI <span className="text-[10px] bg-emerald-500 text-slate-900 px-1 py-0.5 rounded ml-1 font-bold">V4.2</span></span>
          </div>
          
          <nav className="hidden md:flex gap-6">
            <PermissionGuard user={user} requiredPermission="VIEW_DASHBOARD">
                <button onClick={() => setView('dashboard')} className={`flex items-center gap-2 text-sm font-medium transition-colors ${view === 'dashboard' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}>
                    <LayoutDashboard className="w-4 h-4" /> {t('dashboard')}
                </button>
            </PermissionGuard>
            <PermissionGuard user={user} requiredPermission="VIEW_LIST">
                <button onClick={() => { setView('candidates'); setShowActiveApplicantsOnly(false); }} className={`flex items-center gap-2 text-sm font-medium transition-colors ${view === 'candidates' && !showActiveApplicantsOnly ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}>
                    <Users className="w-4 h-4" /> {t('candidates')}
                </button>
            </PermissionGuard>
            <PermissionGuard user={user} requiredPermission="VIEW_LIST">
                <button onClick={() => { setView('candidates'); setShowActiveApplicantsOnly(true); }} className={`flex items-center gap-2 text-sm font-medium transition-colors relative ${showActiveApplicantsOnly ? 'text-indigo-400' : 'text-slate-400 hover:text-white'}`}>
                    <Zap className="w-4 h-4" /> Active Applicants
                    {activeApplicantCount > 0 && <span className="absolute -top-1 -right-2 bg-indigo-500 text-white text-[9px] px-1 rounded-full h-4 flex items-center justify-center">{activeApplicantCount}</span>}
                </button>
            </PermissionGuard>
            <PermissionGuard user={user} requiredPermission="MANAGE_ACCESS">
               <button onClick={() => setIsAccessControlOpen(true)} className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                  <ShieldCheck className="w-4 h-4" /> {t('admin')}
               </button>
            </PermissionGuard>
          </nav>

          <div className="flex items-center gap-4">
             <button onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                <Globe className="w-3 h-3" /> {language === 'en' ? 'EN' : '繁中'}
             </button>

             <button className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors border-emerald-500/30 bg-emerald-500/10 text-emerald-400`}>
                <Database className="w-3 h-3" /> {t('dbConnected')}
             </button>

             <div className="h-6 w-px bg-slate-700 mx-2" />
             <div className="flex items-center gap-2 cursor-pointer hover:opacity-80" onClick={handleLogout} title="Logout">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold ring-2 ring-slate-800 overflow-hidden">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="User" /> : user.email[0].toUpperCase()}
                </div>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-6 lg:px-8 py-8 relative">
        <div className="flex justify-between items-end mb-8">
           <div className="flex items-center gap-4">
             <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                  {showActiveApplicantsOnly ? 'Active Applicants (主動應徵)' : (view === 'dashboard' ? t('overview') : t('candidateManagement'))}
                  <button onClick={() => loadData(true)} disabled={dataLoading} className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm">
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${dataLoading ? 'animate-spin text-blue-500' : ''}`} />
                  </button>
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    {showActiveApplicantsOnly ? 'Candidates who explicitly mentioned "Active Application" in their resume.' : (view === 'dashboard' ? t('overviewDesc') : t('managementDesc'))}
                </p>
             </div>
           </div>
           
           <div className="flex items-center gap-4">
              {dbError && (
                 <span className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-200 flex items-center gap-2 cursor-pointer hover:bg-red-100" onClick={() => setIsConfigOpen(true)}>
                    <AlertCircle className="w-3 h-3" /> {dbError} <span className="underline ml-1">Check Config</span>
                 </span>
              )}
              
              <PermissionGuard user={user} requiredPermission="IMPORT_DATA">
                <button onClick={() => setIsImportOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm font-medium">
                  <Plus className="w-4 h-4" /> {t('newCandidate')}
                </button>
              </PermissionGuard>
           </div>
        </div>

        {view === 'dashboard' ? (
          <PermissionGuard user={user} requiredPermission="VIEW_DASHBOARD" fallback={<div className="text-center p-10 text-slate-400">Access Denied</div>}>
            <DashboardStats candidates={candidates} onFilterClick={handleDashboardFilter} />
          </PermissionGuard>
        ) : (
          <PermissionGuard user={user} requiredPermission="VIEW_LIST" fallback={<div className="text-center p-10 text-slate-400">Access Denied</div>}>
            <CandidateTable 
                candidates={showActiveApplicantsOnly ? candidates.filter(c => c.isUnsolicited) : candidates} 
                onSelect={handleSelectCandidate}
                onDelete={handleDelete}
                currentUser={user}
                externalFilterSource={filterSource}
                externalFilterRole={filterRole}
                externalFilterTopTalent={filterTopTalent}
                onFilterSourceChange={(val) => { setFilterSource(val); setFilterTopTalent(false); }} 
                onFilterRoleChange={(val) => { setFilterRole(val); setFilterTopTalent(false); }}
                onToggleTopTalent={(val) => setFilterTopTalent(val)}
                onClearFilters={resetFilters}
            />
          </PermissionGuard>
        )}
      </main>

      {/* MODALS */}
      {selectedCandidate && (
        <CandidateDetail 
          candidate={selectedCandidate} 
          currentUser={user} 
          onClose={() => setSelectedCandidate(null)} 
          onUpdate={handleCandidateUpdate}
        />
      )}

      {isImportOpen && (
        <ImportModal 
          currentUser={user} 
          onClose={() => setIsImportOpen(false)} 
          onImport={handleImport}
          onUpdate={handleCandidateUpdate}
          existingCandidates={candidates} 
        />
      )}

      {isConfigOpen && (
        <ConfigModal onClose={() => setIsConfigOpen(false)} />
      )}
      
      {isAccessControlOpen && (
        <AccessControlModal currentUser={user} onClose={() => setIsAccessControlOpen(false)} />
      )}

      <PermissionGuard user={user} requiredPermission="AI_CHAT">
        <AIChat />
      </PermissionGuard>
    </div>
  );
};

export default App;
