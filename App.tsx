
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, LogOut, Plus, ShieldCheck, AlertCircle, RefreshCw, Database, Globe, CheckCircle2, X, AlertTriangle, Loader2, LockKeyhole, Zap } from 'lucide-react';
import { MOCK_CANDIDATES, DEFAULT_JOBS } from './constants';
import { User, Candidate, JobDescription } from './types';
import { logAction } from './services/logService';
import { fetchCandidates, createCandidate, isSupabaseConfigured, markCandidateAsViewed, softDeleteCandidate, resolveUserPermissions, supabase, signOut, updateCandidate, fetchJobDescriptions } from './services/supabaseService';
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

const App: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();

  // --- BYPASS AUTH: Hardcoded Admin User ---
  const [user, setUser] = useState<User | null>({
      id: 'dev-bypass-admin',
      email: 'robinhsu@91app.com',
      role: 'ADMIN',
      permissions: ['VIEW_DASHBOARD', 'VIEW_LIST', 'EDIT_CANDIDATE', 'DELETE_CANDIDATE', 'IMPORT_DATA', 'MANAGE_ACCESS', 'MANAGE_JD', 'AI_CHAT', 'VIEW_LOGS'],
      avatarUrl: 'https://ui-avatars.com/api/?name=Robin+Hsu&background=0D8ABC&color=fff'
  });

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [view, setView] = useState<'dashboard' | 'candidates'>('dashboard');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  
  // Modal States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAccessControlOpen, setIsAccessControlOpen] = useState(false);

  const [dataLoading, setDataLoading] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isDbConnected, setIsDbConnected] = useState(isSupabaseConfigured());
  
  const [toast, setToast] = useState<{
      message: string, 
      type: 'success' | 'error',
      candidate?: Candidate 
  } | null>(null);

  const [filterSource, setFilterSource] = useState<string>('All');
  const [filterRole, setFilterRole] = useState<string>('All');
  const [filterTopTalent, setFilterTopTalent] = useState<boolean>(false);
  
  // NEW: Active Applicant Filter (Persistent Tab Logic)
  const [showActiveApplicantsOnly, setShowActiveApplicantsOnly] = useState(false);

  // --- INITIAL DATA LOAD ---
  useEffect(() => {
    // Check URL hash for cleanup (in case redirected from OAuth previously)
    if (window.location.hash && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname);
    }
    
    loadData();
  }, []);

  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 10000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  const loadData = async () => {
    if (!isSupabaseConfigured()) {
      setIsDbConnected(false);
      setCandidates(MOCK_CANDIDATES); 
      setJds(DEFAULT_JOBS);
      // Auto-select Default Project Manager logic in mock mode
      const defaultRole = DEFAULT_JOBS.sort((a, b) => (a.priority || 99) - (b.priority || 99))[0];
      if (defaultRole) setFilterRole(defaultRole.title);
      return;
    }

    setIsDbConnected(true);
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

      // --- DEFAULT FILTER LOGIC (Project Manager) ---
      // Sort by priority (1 is highest) and pick the first one
      if (loadedJds.length > 0) {
          const sortedJds = [...loadedJds].sort((a, b) => (a.priority || 99) - (b.priority || 99));
          const primaryRole = sortedJds[0];
          // Check if we already have a filter set, if 'All' change it to Default
          setFilterRole(prev => prev === 'All' ? primaryRole.title : prev);
      }

    } catch (err) {
      console.error(err);
      setDbError("Failed to load data.");
      setCandidates([]); 
    } finally {
      setDataLoading(false);
    }
  };

  const handleLogout = async () => {
    alert("Dev Mode: Logout is disabled. You are permanently logged in as Admin.");
  };

  // --- BATCH RE-SCORE LOGIC ---
  const handleBatchRescore = async () => {
      if (!candidates.length) return;
      if (!confirm(`This will re-analyze ALL ${candidates.length} candidates using the NEW Strict Scoring Benchmark (Robin Hsu Standard). This may take a while. Continue?`)) return;

      setIsBatchProcessing(true);
      setBatchProgress(0);
      let successCount = 0;

      const defaultJD = jds.length > 0 ? jds[0] : DEFAULT_JOBS[0];

      for (let i = 0; i < candidates.length; i++) {
          const c = candidates[i];
          setBatchProgress(Math.round(((i + 1) / candidates.length) * 100));
          
          try {
              const matchingJD = jds.find(j => j.title === c.roleApplied) || defaultJD;
              const targetLang = language === 'zh' ? 'Traditional Chinese' : 'English';
              
              const newAnalysis = await reEvaluateCandidate(c, matchingJD.content, targetLang);
              
              const updatedCandidate = { 
                  ...c, 
                  analysis: newAnalysis, 
                  updatedAt: new Date().toISOString() 
              };

              // Optimistic Update
              setCandidates(prev => prev.map(p => p.id === c.id ? updatedCandidate : p));

              // DB Update
              if (isDbConnected) {
                  await updateCandidate(updatedCandidate);
              }

              successCount++;
          } catch (e) {
              console.error(`Failed to re-score ${c.name}`, e);
          }
      }

      setIsBatchProcessing(false);
      setToast({ message: `Batch Update Complete. Re-scored ${successCount}/${candidates.length} candidates.`, type: 'success' });
      if (user) logAction(user, 'BATCH_RESCORE', `Processed ${candidates.length} candidates`);
  };

  // --- HANDLERS ---
  const handleImport = async (newCandidate: Candidate) => {
    const previousCandidates = [...candidates];
    setCandidates(prev => [newCandidate, ...prev]);
    setIsImportOpen(false);
    
    // NOTE: We pass 'newCandidate' directly to toast to ensure object reference is valid
    try {
      await createCandidate(newCandidate);
      if (user) logAction(user, 'IMPORT_CANDIDATE', newCandidate.name, { id: newCandidate.id });
      setToast({ 
          message: `${newCandidate.name} imported successfully. Click to view.`, 
          type: 'success', 
          candidate: newCandidate 
      });
    } catch (error: any) {
      setCandidates(previousCandidates);
      setToast({ message: "Database Insert Failed.", type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('deleteConfirm'))) {
      const previousCandidates = [...candidates];
      setCandidates(prev => prev.filter(c => c.id !== id));
      try {
        if (!user) throw new Error("No user logged in");
        await softDeleteCandidate(id, user.email);
        logAction(user, 'DELETE_CANDIDATE', id);
        setToast({ message: "Candidate removed (Soft Delete).", type: 'success' });
      } catch (error) {
        setCandidates(previousCandidates);
        setToast({ message: "Failed to delete candidate.", type: 'error' });
      }
    }
  };

  const handleCandidateUpdate = async (updated: Candidate) => {
    // 1. Optimistic UI update
    setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c));
    if (selectedCandidate && selectedCandidate.id === updated.id) {
        setSelectedCandidate(updated);
    }
    
    // 2. DB Update
    try {
        await updateCandidate(updated);
        if (user) logAction(user, 'UPDATE_CANDIDATE', updated.name, { id: updated.id, version: 'new_upload' });
        setToast({ message: `Candidate ${updated.name} updated successfully.`, type: 'success' });
    } catch (error) {
        console.error(error);
        setToast({ message: "Failed to update candidate database.", type: 'error' });
        loadData();
    }
  };

  const handleSelectCandidate = (candidate: Candidate) => {
      setSelectedCandidate(candidate);
      // Mark as read logic
      if (user) {
          const alreadyViewed = candidate.viewedBy?.includes(user.email);
          if (!alreadyViewed) {
              const updatedViewedBy = [...(candidate.viewedBy || []), user.email];
              const updatedCandidate = { ...candidate, viewedBy: updatedViewedBy };
              // We don't await this one for speed
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
    // Reset Active tab when using dashboard drill-down
    setShowActiveApplicantsOnly(false);
    setView('candidates');
  };

  const resetFilters = () => { setFilterSource('All'); setFilterRole('All'); setFilterTopTalent(false); };

  // Filter Logic including the new "Active Applicant" tab
  const getFilteredCandidates = () => {
      let result = candidates;
      
      if (showActiveApplicantsOnly) {
          result = result.filter(c => c.isUnsolicited);
      }
      
      // Other filters apply on top (or we could clear them when switching tabs)
      // For now, let them coexist
      return result;
  };

  const activeApplicantCount = candidates.filter(c => c.isUnsolicited).length;

  // 5. Main App
  if (!user) return null; // Should not happen in bypass mode

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Toast Notification */}
      {toast && (
          <div 
            onClick={() => { 
                if (toast.candidate) { 
                    handleSelectCandidate(toast.candidate); 
                    setToast(null); 
                } 
            }}
            className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-slide-in-top border-2 transition-transform hover:scale-105 cursor-pointer backdrop-blur-sm
            ${toast.type === 'success' ? 'bg-slate-900/95 text-white border-slate-700' : 'bg-red-600/95 text-white border-red-500'}`}
          >
              <div className={`p-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500/20' : 'bg-white/20'}`}>
                {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-white" />}
              </div>
              <div>
                 <p className="font-bold text-sm">{toast.message}</p>
                 {toast.candidate && <p className="text-xs opacity-70 mt-0.5 font-mono">Click to open profile</p>}
              </div>
              <button className="ml-2 p-1 hover:bg-white/10 rounded-full" onClick={(e) => { e.stopPropagation(); setToast(null); }}>
                 <X className="w-4 h-4 opacity-70" />
              </button>
          </div>
      )}

      {/* Navigation */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="w-full px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">H</div>
             <span className="font-semibold text-lg tracking-tight">HR GenAI <span className="text-[10px] bg-emerald-500 text-slate-900 px-1 py-0.5 rounded ml-1 font-bold">DEV</span></span>
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
            {/* NEW ACTIVE APPLICANTS TAB */}
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

             <button onClick={() => setIsConfigOpen(true)} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors ${isDbConnected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400 animate-pulse'}`}>
                <Database className="w-3 h-3" /> {isDbConnected ? t('dbConnected') : t('connectDb')}
             </button>

             <div className="h-6 w-px bg-slate-700 mx-2" />
             <div className="flex items-center gap-2">
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
                  <button onClick={loadData} disabled={dataLoading} className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm">
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
                    <AlertCircle className="w-3 h-3" /> {dbError} <span className="underline ml-1">Fix</span>
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

      {/* DETAILED VIEW MODAL */}
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
