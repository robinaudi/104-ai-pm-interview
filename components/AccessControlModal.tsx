
import React, { useState, useEffect } from 'react';
import { X, Shield, Search, User as UserIcon, Building, Plus, Trash2, Save, Activity, RefreshCw, Key, Lock, AlertTriangle, Briefcase, Edit2, RotateCcw, Scale, Settings, Check, ChevronDown, ChevronRight, AlertCircle, ArrowRight, Loader2, Sliders } from 'lucide-react';
import { supabase, fetchAccessRules, addAccessRule, deleteAccessRule, fetchRoles, updateRolePermissions, isSupabaseConfigured, fetchJobDescriptions, createJobDescription, deleteJobDescription, updateJobDescription, updateCandidateRoleName, fetchScoringStandards, updateScoringStandard, deleteScoringStandard, getUniqueCandidateRoles, migrateCandidateRoles, fetchDeletedCandidates, restoreCandidate, fetchCandidates, updateCandidate } from '../services/supabaseService';
import { fetchLogs, logAction } from '../services/logService';
import { AccessRule, AppRole, ActionLog, Permission, User, JobDescription, ScoringStandard, Candidate } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { reEvaluateCandidate } from '../services/geminiService';
import { APP_VERSION } from '../constants';

interface AccessControlModalProps {
  onClose: () => void;
  currentUser: User;
}

interface ToggleSectionProps {
  title: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

const ToggleSection: React.FC<ToggleSectionProps> = ({ title, isExpanded, onToggle, children }) => (
  <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
      <button 
        onClick={onToggle}
        className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
          <div className="font-bold text-slate-700 flex items-center gap-2">{title}</div>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400"/> : <ChevronRight className="w-4 h-4 text-slate-400"/>}
      </button>
      {isExpanded && <div className="p-4 border-t border-slate-200 animate-fade-in">{children}</div>}
  </div>
);

const AccessControlModal: React.FC<AccessControlModalProps> = ({ onClose, currentUser }) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'jds' | 'users' | 'roles' | 'logs' | 'recycle' | 'tuning'>('jds');
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [accessRules, setAccessRules] = useState<AccessRule[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [standards, setStandards] = useState<ScoringStandard[]>([]);
  const [uniqueRoles, setUniqueRoles] = useState<{role: string, count: number}[]>([]);
  
  // Recycle Bin State
  const [deletedCandidates, setDeletedCandidates] = useState<Candidate[]>([]);

  // Batch Process State
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  // JD Management State
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<'penalties' | 'advanced_rules' | 'data_fix' | null>('penalties');
  
  // Data Fixer State
  const [fixingRole, setFixingRole] = useState<string | null>(null);

  // Industry Penalty Form
  const [indName, setIndName] = useState('');
  const [indComp, setIndComp] = useState('0.7');
  const [indCult, setIndCult] = useState('0.6');
  const [indExp, setIndExp] = useState('0.9');

  // New Rule Form (Access)
  const [newRuleValue, setNewRuleValue] = useState('');
  const [newRuleRole, setNewRuleRole] = useState('USER');
  
  // Dimension Form
  const [dimName, setDimName] = useState('');
  const [dimWeight, setDimWeight] = useState('');
  const [dimDesc, setDimDesc] = useState('');

  // Load Data
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
      setLoading(true);
      if (activeTab === 'users') {
          setAccessRules(await fetchAccessRules());
          setRoles(await fetchRoles());
      } else if (activeTab === 'roles') {
          setRoles(await fetchRoles());
      } else if (activeTab === 'logs') {
          setLogs(await fetchLogs());
      } else if (activeTab === 'recycle') {
          setDeletedCandidates(await fetchDeletedCandidates());
      } else if (activeTab === 'jds' || activeTab === 'tuning') {
          const loadedJobs = await fetchJobDescriptions();
          setJobs(loadedJobs);
          setStandards(await fetchScoringStandards());
          
          if (activeTab === 'jds') {
              const roles = await getUniqueCandidateRoles();
              setUniqueRoles(roles);
              // Auto-expand Data Fixer if mismatches found
              const hasMismatch = roles.some(r => !loadedJobs.some(j => j.title === r.role));
              if (hasMismatch) {
                  setExpandedSection('data_fix');
              }
          }
      }
      setLoading(false);
  };

  // --- BATCH RE-SCORE HANDLER ---
  const handleBatchRescore = async () => {
      const allCandidates = await fetchCandidates();
      if (!allCandidates.length) { alert("No candidates found."); return; }
      
      const confirmMsg = `WARNING: BATCH RE-SCORE\n\nThis will re-analyze ALL ${allCandidates.length} candidates using the CURRENT scoring model (${APP_VERSION}).\n\nThis may take several minutes. Do not close this window.`;
      if (!confirm(confirmMsg)) return;

      setIsBatchProcessing(true);
      setBatchProgress(0);
      let successCount = 0;

      const defaultJD = jobs.length > 0 ? jobs[0] : null;

      try {
          for (let i = 0; i < allCandidates.length; i++) {
              const c = allCandidates[i];
              setBatchProgress(Math.round(((i + 1) / allCandidates.length) * 100));
              
              try {
                  const matchingJD = jobs.find(j => j.title === c.roleApplied) || defaultJD;
                  if (!matchingJD) continue;

                  const targetLang = language === 'zh' ? 'Traditional Chinese' : 'English';
                  const newAnalysis = await reEvaluateCandidate(c, matchingJD.content, targetLang);
                  
                  const updatedCandidate = { 
                      ...c, 
                      analysis: newAnalysis, 
                      updatedAt: new Date().toISOString() 
                  };

                  await updateCandidate(updatedCandidate);
                  successCount++;
              } catch (e) {
                  console.error(`Failed to re-score ${c.name}`, e);
              }
          }
          await logAction(currentUser, 'BATCH_RESCORE', `Processed ${allCandidates.length} candidates with ${APP_VERSION}`);
          alert(`Batch Process Complete!\nSuccessfully re-scored ${successCount} candidates.`);
      } catch (e) {
          console.error(e);
          alert("Batch process interrupted.");
      } finally {
          setIsBatchProcessing(false);
      }
  };

  // --- RECYCLE BIN HANDLERS ---
  const handleRestore = async (id: string, name: string) => {
      if (!confirm(`Restore candidate "${name}"?`)) return;
      setLoading(true);
      try {
          await restoreCandidate(id);
          setDeletedCandidates(prev => prev.filter(c => c.id !== id));
      } catch (e: any) {
          console.error(e);
          alert("Restore Failed");
      } finally {
          setLoading(false);
      }
  };

  // --- SCORING STANDARDS HANDLERS ---
  const handleAddIndustryPenalty = async () => {
      if (!indName) return;
      
      const config = {
          competency: parseFloat(indComp),
          culture: parseFloat(indCult),
          experience: parseFloat(indExp)
      };

      const newStd: ScoringStandard = {
          id: crypto.randomUUID(),
          category: 'INDUSTRY_PENALTY',
          condition: indName,
          rule_text: JSON.stringify(config), // Store structured config
          priority: 10,
          is_active: true
      };

      setStandards([...standards, newStd]);
      setIndName('');
      await updateScoringStandard(newStd);
  };
  
  const handleAddDimension = async () => {
      if (!dimName || !dimWeight) return;
      const newStd: ScoringStandard = {
          id: crypto.randomUUID(),
          category: 'DIMENSION_WEIGHT',
          condition: dimName,
          rule_text: dimWeight, // Stores weight %
          description: dimDesc,
          priority: 99,
          is_active: true
      };
      setStandards([...standards, newStd]);
      setDimName(''); setDimWeight(''); setDimDesc('');
      await updateScoringStandard(newStd);
  };

  const handleUpdateStandard = async (std: ScoringStandard) => {
      setStandards(prev => prev.map(p => p.id === std.id ? std : p));
      try { await updateScoringStandard(std); } catch(e) { console.error(e); }
  };

  const handleDeleteStandard = async (id: string) => {
      if(!confirm("Remove this rule?")) return;
      setStandards(prev => prev.filter(p => p.id !== id));
      try { await deleteScoringStandard(id); } catch(e) { console.error(e); }
  };

  // --- JD HANDLERS ---
  const handleEditJob = (job: JobDescription) => {
      setEditingJobId(job.id);
      setFormTitle(job.title);
      setFormContent(job.content);
  };

  const cancelEditJob = () => {
      setEditingJobId(null);
      setFormTitle('');
      setFormContent('');
  };

  const handleSaveJob = async () => {
      if (!formTitle || !formContent) return;
      setLoading(true);
      
      try {
          if (editingJobId) {
              const originalJob = jobs.find(j => j.id === editingJobId);
              const originalTitle = originalJob?.title;
              const updatedJob = { title: formTitle, content: formContent };
              setJobs(prev => prev.map(j => j.id === editingJobId ? { ...j, ...updatedJob } : j));
              await updateJobDescription(editingJobId, updatedJob);
              if (originalTitle && originalTitle !== formTitle) {
                  await updateCandidateRoleName(originalTitle, formTitle);
              }
              cancelEditJob();
          } else {
              const newJob: JobDescription = { 
                  id: crypto.randomUUID(), 
                  title: formTitle, 
                  content: formContent, 
                  priority: 99, 
                  created_at: new Date().toISOString() 
              };
              setJobs([newJob, ...jobs]);
              cancelEditJob();
              await createJobDescription(newJob);
          }
      } catch (e: any) {
          console.error(e);
          alert("Error: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteJob = async (id: string) => {
      if (!confirm('Delete this job role?')) return;
      setJobs(jobs.filter(j => j.id !== id));
      try { await deleteJobDescription(id); } catch (e) { console.error(e); }
  };

  // --- DATA FIX HANDLERS (UPDATED UX) ---
  const handleMigrateRole = async (from: string, to: string) => {
      if (!from || !to) return;
      
      if (!confirm(`CONFIRM MIGRATION:\n\nMove all candidates from role "${from}"\nto "${to}"?`)) {
          return; 
      }
      
      setFixingRole(from);
      try {
          await migrateCandidateRoles(from, to);
          const newRoles = await getUniqueCandidateRoles();
          setUniqueRoles(newRoles);
      } catch (e: any) { 
          console.error(e);
          alert("Migration Failed: " + (e.message || "Unknown DB Error"));
      } finally { 
          setFixingRole(null); 
      }
  };

  // --- ACCESS HANDLERS ---
  const handleAddRule = async () => {
      if (!newRuleValue) return;
      await addAccessRule(newRuleValue, newRuleRole);
      setNewRuleValue('');
      loadData();
  };

  const handleDeleteRule = async (id: string) => {
      if (!confirm('Revoke access for this rule?')) return;
      await deleteAccessRule(id);
      loadData();
  };

  const handlePermissionToggle = (roleName: string, perm: Permission) => {
      setRoles(prev => prev.map(r => {
          if (r.role_name !== roleName) return r;
          const hasPerm = r.permissions.includes(perm);
          const newPerms = hasPerm 
            ? r.permissions.filter(p => p !== perm) 
            : [...r.permissions, perm];
          return { ...r, permissions: newPerms };
      }));
  };

  const saveRolePermissions = async (role: AppRole) => {
      await updateRolePermissions(role.role_name, role.permissions);
      alert(`Permissions updated for ${role.role_name}`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-fade-in border border-slate-700">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center flex-shrink-0">
             <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-600 rounded-lg">
                     <Shield className="w-5 h-5 text-white" />
                 </div>
                 <div>
                     <h2 className="text-lg font-bold">System Admin Portal</h2>
                     <p className="text-xs text-slate-400">Configuration & Security</p>
                 </div>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                 <X className="w-5 h-5 text-slate-400" />
             </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 flex-shrink-0 overflow-x-auto">
             <button onClick={() => setActiveTab('jds')} className={`flex-1 min-w-[140px] py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'jds' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <Briefcase className="w-4 h-4" /> Vacancies & Scoring
            </button>
             <button onClick={() => setActiveTab('tuning')} className={`flex-1 min-w-[140px] py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'tuning' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <Sliders className="w-4 h-4" /> AI Model Tuning
            </button>
            <button onClick={() => setActiveTab('recycle')} className={`flex-1 min-w-[140px] py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'recycle' ? 'border-red-600 text-red-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <Trash2 className="w-4 h-4" /> Recycle Bin
            </button>
            <button onClick={() => setActiveTab('users')} className={`flex-1 min-w-[140px] py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'users' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <UserIcon className="w-4 h-4" /> User Whitelist
            </button>
            <button onClick={() => setActiveTab('roles')} className={`flex-1 min-w-[140px] py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'roles' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <Key className="w-4 h-4" /> Roles & Perms
            </button>
            <button onClick={() => setActiveTab('logs')} className={`flex-1 min-w-[140px] py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'logs' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <Activity className="w-4 h-4" /> Audit Logs
            </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
            
            {/* --- TAB: AI TUNING --- */}
            {activeTab === 'tuning' && (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg flex justify-between items-center shadow-sm">
                        <div>
                            <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2"><Scale className="w-5 h-5"/> Scoring Dimensions Configuration</h3>
                            <p className="text-sm text-indigo-700 mt-1">Define the specific criteria and weights for the AI Assessment Model ({APP_VERSION}).</p>
                        </div>
                        <button 
                            onClick={handleBatchRescore} 
                            disabled={isBatchProcessing}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-all"
                        >
                            {isBatchProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>}
                            {isBatchProcessing ? `Processing ${batchProgress}%` : 'Batch Re-Score All Candidates'}
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                        <h4 className="font-bold text-slate-700 mb-4 uppercase tracking-wide text-xs">Add New Dimension</h4>
                        <div className="grid grid-cols-12 gap-3 items-end">
                            <div className="col-span-4">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Dimension Name</label>
                                <input type="text" value={dimName} onChange={e => setDimName(e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="e.g. Leadership" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Weight %</label>
                                <input type="number" value={dimWeight} onChange={e => setDimWeight(e.target.value)} className="w-full border p-2 rounded text-sm text-center" placeholder="15" />
                            </div>
                             <div className="col-span-5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Scoring Criteria (Prompt)</label>
                                <input type="text" value={dimDesc} onChange={e => setDimDesc(e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="0: Poor, 10: Excellent..." />
                            </div>
                            <div className="col-span-1">
                                <button onClick={handleAddDimension} className="w-full bg-slate-900 text-white p-2 rounded text-sm font-bold hover:bg-slate-800"><Plus className="w-4 h-4 mx-auto"/></button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                         {standards.filter(s => s.category === 'DIMENSION_WEIGHT').map((std) => (
                             <div key={std.id} className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow group">
                                 <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg border-4 border-white shadow-sm ring-1 ring-slate-100">
                                     {std.rule_text}%
                                 </div>
                                 <div className="flex-1">
                                     <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-slate-800">{std.condition}</h4>
                                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">Priority: {std.priority}</span>
                                     </div>
                                     <input 
                                        type="text" 
                                        className="w-full mt-1 text-sm text-slate-600 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent"
                                        value={std.description}
                                        onChange={(e) => handleUpdateStandard({...std, description: e.target.value})}
                                     />
                                 </div>
                                 <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => handleDeleteStandard(std.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                                      <button onClick={() => handleUpdateStandard(std)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Save className="w-4 h-4"/></button>
                                 </div>
                             </div>
                         ))}
                    </div>

                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                        <strong>Note:</strong> The total weight should ideally sum to 100%. The AI will use these weights to calculate the final Match Score.
                        Current Total: <strong>{standards.filter(s => s.category === 'DIMENSION_WEIGHT').reduce((acc, curr) => acc + (parseInt(curr.rule_text) || 0), 0)}%</strong>
                    </div>
                </div>
            )}
            
            {/* --- TAB: VACANCIES --- */}
            {activeTab === 'jds' && (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                     
                     {/* 1. JD MANAGEMENT */}
                     <div className={`bg-white p-6 rounded-lg border shadow-sm ${editingJobId ? 'border-blue-300 ring-4 ring-blue-50' : 'border-slate-200'}`}>
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-800">
                          {editingJobId ? <Edit2 className="w-4 h-4 text-blue-500"/> : <Plus className="w-4 h-4 text-emerald-500"/>}
                          {editingJobId ? 'Edit Job Description' : t('addNewJD')}
                      </h3>
                      <div className="space-y-4">
                          <input type="text" placeholder={t('jdTitlePlaceholder')} value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full border border-slate-300 p-3 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none" />
                          <textarea placeholder={t('jdContentPlaceholder')} value={formContent} onChange={e => setFormContent(e.target.value)} className="w-full border border-slate-300 p-3 rounded-lg text-sm h-32 focus:ring-2 focus:ring-blue-100 outline-none resize-none" />
                          <div className="flex gap-2 justify-end">
                            {editingJobId && (<button onClick={cancelEditJob} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>)}
                            <button onClick={handleSaveJob} disabled={!formTitle || !formContent || loading} className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-all shadow-sm flex items-center gap-2">
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                                {editingJobId ? 'Update JD & Sync' : t('saveJD')}
                            </button>
                          </div>
                      </div>
                  </div>

                  {/* ACTIVE JOBS LIST */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {jobs.map(job => (
                          <div key={job.id} className={`bg-white p-4 rounded-lg border shadow-sm relative group hover:shadow-md transition-shadow ${editingJobId === job.id ? 'border-blue-500 bg-blue-50/10' : 'border-slate-200'}`}>
                              <h3 className="font-bold text-slate-800 pr-16 truncate text-base">{job.title}</h3>
                              <p className="text-[10px] text-slate-400 mb-2 font-mono">{job.id}</p>
                              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditJob(job)} className="p-1.5 bg-white text-slate-400 hover:text-blue-600 border border-slate-200 rounded shadow-sm" title="Edit"><Edit2 className="w-3 h-3" /></button>
                                <button onClick={() => handleDeleteJob(job.id)} className="p-1.5 bg-white text-slate-400 hover:text-red-600 border border-slate-200 rounded shadow-sm" title="Delete"><Trash2 className="w-3 h-3" /></button>
                              </div>
                          </div>
                      ))}
                  </div>

                  <hr className="border-slate-200 my-4" />

                  {/* 2. INDUSTRY PENALTIES */}
                  <ToggleSection 
                    title={<><Scale className="w-4 h-4 text-red-500"/> Industry Negative List (Penalties)</>}
                    isExpanded={expandedSection === 'penalties'}
                    onToggle={() => setExpandedSection(expandedSection === 'penalties' ? null : 'penalties')}
                  >
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                           <div className="grid grid-cols-5 gap-3 items-end">
                               <div className="col-span-2">
                                   <label className="text-[10px] font-bold text-slate-500 uppercase">Industry Name</label>
                                   <input type="text" value={indName} onChange={e => setIndName(e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="e.g. Banking" />
                               </div>
                               <div>
                                   <label className="text-[10px] font-bold text-slate-500 uppercase">Competency x</label>
                                   <input type="number" step="0.1" value={indComp} onChange={e => setIndComp(e.target.value)} className="w-full border p-2 rounded text-sm text-center" />
                               </div>
                               <div>
                                   <label className="text-[10px] font-bold text-slate-500 uppercase">Culture x</label>
                                   <input type="number" step="0.1" value={indCult} onChange={e => setIndCult(e.target.value)} className="w-full border p-2 rounded text-sm text-center" />
                               </div>
                               <button onClick={handleAddIndustryPenalty} className="bg-red-600 text-white p-2 rounded text-sm font-bold hover:bg-red-700">Add Rule</button>
                           </div>
                      </div>
                      
                      {/* List existing penalties... (keeping it simple for now) */}
                  </ToggleSection>

                  {/* 3. DATA CLEAN UP TOOL */}
                  <ToggleSection 
                    title={<><RefreshCw className="w-4 h-4 text-amber-500"/> Data Consistency Fixer</>}
                    isExpanded={expandedSection === 'data_fix'}
                    onToggle={() => setExpandedSection(expandedSection === 'data_fix' ? null : 'data_fix')}
                  >
                       <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mb-4 text-sm text-amber-900">
                           <div className="font-bold flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4"/> Found mismatched roles?</div>
                           Candidates usually contain different variations of role names (e.g. "PM", "Project Manager", "專案經理"). 
                           Select a Target Role to automatically merge them.
                       </div>

                       <div className="space-y-2">
                           {uniqueRoles.map((r) => {
                               const isExactMatch = jobs.some(j => j.title === r.role);
                               if (isExactMatch) return null; 

                               const isFixing = fixingRole === r.role;

                               return (
                                   <div key={r.role} className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-lg shadow-sm animate-fade-in">
                                       <div className="flex items-center gap-3">
                                            <div className="bg-slate-100 text-slate-500 font-mono text-xs px-2 py-1 rounded min-w-[30px] text-center">{r.count}</div>
                                            <div className="font-bold text-red-600">{r.role}</div>
                                       </div>
                                       <div className="flex items-center gap-2">
                                           <ArrowRight className="w-4 h-4 text-slate-400" />
                                           <div className="relative">
                                             <select 
                                                  className={`border border-slate-300 rounded text-sm py-1.5 px-2 w-64 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer ${isFixing ? 'opacity-50' : 'hover:border-blue-400'}`}
                                                  value="" 
                                                  onChange={(e) => {
                                                      if (e.target.value) handleMigrateRole(r.role, e.target.value);
                                                  }}
                                                  disabled={isFixing}
                                             >
                                                 <option value="" disabled>{isFixing ? 'Processing...' : 'Select to Merge...'}</option>
                                                 {jobs.map(j => <option key={j.id} value={j.title}>{j.title}</option>)}
                                             </select>
                                             {isFixing && <div className="absolute right-2 top-2"><Loader2 className="w-4 h-4 animate-spin text-blue-500"/></div>}
                                           </div>
                                       </div>
                                   </div>
                               )
                           })}
                           {uniqueRoles.length > 0 && uniqueRoles.every(r => jobs.some(j => j.title === r.role)) && (
                               <div className="text-center text-emerald-600 font-bold py-4 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-center gap-2">
                                   <Check className="w-5 h-5" /> All candidate roles match your JDs! Good job.
                               </div>
                           )}
                           {uniqueRoles.length === 0 && !loading && (
                               <div className="text-center text-slate-400 py-4 italic">No candidates found to analyze.</div>
                           )}
                       </div>
                  </ToggleSection>
                </div>
            )}
            
            {/* --- TAB: RECYCLE BIN --- */}
            {activeTab === 'recycle' && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <div className="p-4 bg-red-50 border-b border-red-100 text-red-800 text-sm flex items-center gap-2">
                        <Trash2 className="w-4 h-4"/>
                        <span>These candidates are soft-deleted. They do not appear in the main list or statistics.</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        <table className="w-full border-collapse text-sm">
                            <thead className="bg-slate-100 text-xs font-bold text-slate-500 uppercase text-left sticky top-0 shadow-sm">
                                <tr>
                                    <th className="p-3">Candidate Name</th>
                                    <th className="p-3">Role Applied</th>
                                    <th className="p-3">Deleted By</th>
                                    <th className="p-3">Deleted At</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {deletedCandidates.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-bold text-slate-800">{c.name}</td>
                                        <td className="p-3 text-slate-600">{c.roleApplied}</td>
                                        <td className="p-3">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs border border-slate-200">
                                                {c.deletedBy || 'Unknown User'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-xs text-slate-500">
                                            {c.deletedAt ? new Date(c.deletedAt).toLocaleString() : 'Unknown'}
                                        </td>
                                        <td className="p-3 text-right">
                                            <button 
                                                onClick={() => handleRestore(c.id, c.name)}
                                                className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 ml-auto transition-colors"
                                            >
                                                <RotateCcw className="w-3 h-3"/> Restore
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {deletedCandidates.length === 0 && (
                            <div className="p-10 text-center flex flex-col items-center gap-2">
                                <Trash2 className="w-10 h-10 text-slate-200"/>
                                <span className="text-slate-400">Recycle bin is empty.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- TAB: USERS --- */}
            {activeTab === 'users' && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap gap-4 items-end shadow-sm z-10">
                        <div className="flex-1 min-w-[200px]"><label className="text-xs font-bold text-slate-500 uppercase">Search User</label><div className="relative mt-1"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by email or domain..." className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div></div>
                        <div className="flex gap-2 items-end">
                            <div className="w-64"><label className="text-xs font-bold text-slate-500 uppercase">Whitelist Value</label><input type="text" value={newRuleValue} onChange={e => setNewRuleValue(e.target.value)} placeholder="e.g. user@company.com" className="w-full mt-1 border rounded-lg p-2 text-sm" /></div>
                            <div className="w-32"><label className="text-xs font-bold text-slate-500 uppercase">Role</label><select className="w-full mt-1 border rounded-lg p-2 text-sm bg-slate-50" value={newRuleRole} onChange={e => setNewRuleRole(e.target.value)}>{roles.map(r => <option key={r.role_name} value={r.role_name}>{r.role_name}</option>)}</select></div>
                            <button onClick={handleAddRule} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 h-[38px]"><Plus className="w-4 h-4" /> Add</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        <table className="w-full border-collapse">
                            <thead className="bg-slate-100 text-xs font-bold text-slate-500 uppercase text-left sticky top-0"><tr><th className="p-3 rounded-tl-lg">Type</th><th className="p-3">Identity Value</th><th className="p-3">Assigned Role</th><th className="p-3 rounded-tr-lg text-right">Actions</th></tr></thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {accessRules.filter(r => r.value.toLowerCase().includes(searchQuery.toLowerCase())).map(rule => (
                                    <tr key={rule.id} className="hover:bg-slate-50 group">
                                        <td className="p-3">{rule.value.includes('@') ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold"><UserIcon className="w-3 h-3"/> Email</span> : <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-700 text-xs font-bold"><Building className="w-3 h-3"/> Domain</span>}</td>
                                        <td className="p-3 font-medium text-slate-800">{rule.value}</td>
                                        <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${rule.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{rule.role}</span></td>
                                        <td className="p-3 text-right"><button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- TAB: ROLES --- */}
            {activeTab === 'roles' && (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {roles.map(role => (
                            <div key={role.role_name} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                                    <div><h3 className="font-bold text-lg text-slate-800">{role.role_name}</h3><p className="text-xs text-slate-500">{role.description || 'Custom Role'}</p></div>
                                    <button onClick={() => saveRolePermissions(role)} className="text-xs bg-white border border-slate-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 px-3 py-1.5 rounded-md font-bold transition-colors flex items-center gap-1"><Save className="w-3 h-3" /> Save Changes</button>
                                </div>
                                <div className="p-4 grid grid-cols-2 gap-2">
                                    {['VIEW_DASHBOARD', 'VIEW_LIST', 'EDIT_CANDIDATE', 'DELETE_CANDIDATE', 'IMPORT_DATA', 'MANAGE_ACCESS', 'MANAGE_JD', 'AI_CHAT', 'VIEW_LOGS'].map(perm => {
                                        const isChecked = role.permissions.includes(perm as Permission);
                                        return (
                                            <label key={perm} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors border ${isChecked ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50 border-transparent'}`}>
                                                <input type="checkbox" checked={isChecked} onChange={() => handlePermissionToggle(role.role_name, perm as Permission)} className="rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500" />
                                                <span className={`text-xs font-medium ${isChecked ? 'text-blue-800' : 'text-slate-600'}`}>{perm.replace(/_/g, ' ')}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- TAB: LOGS --- */}
            {activeTab === 'logs' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4">
                        <table className="w-full border-collapse text-sm">
                            <thead className="bg-slate-100 text-xs font-bold text-slate-500 uppercase text-left sticky top-0 shadow-sm"><tr><th className="p-3 w-40">Time</th><th className="p-3 w-48">User</th><th className="p-3 w-32">Action</th><th className="p-3">Target / Details</th><th className="p-3 w-32">IP / Device</th></tr></thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {logs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="p-3 text-slate-500 text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                                        <td className="p-3 font-medium text-slate-800">{log.user_email}</td>
                                        <td className="p-3"><span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600">{log.action}</span></td>
                                        <td className="p-3 text-slate-600 break-all"><span className="font-bold text-slate-800 mr-2">{log.target}</span></td>
                                        <td className="p-3 text-xs text-slate-400"><div>{log.details?.ip || 'Unknown IP'}</div><div className="truncate max-w-[150px]">{log.details?.platform || 'Web'}</div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {logs.length === 0 && <div className="p-10 text-center text-slate-400">No logs found.</div>}
                    </div>
                </div>
            )}
        </div>
        
        {/* Footer Status */}
        <div className="bg-slate-50 border-t border-slate-200 p-2 px-4 flex justify-between items-center text-xs text-slate-400">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Secure Access Mode Active</span>
            <span>{loading ? <RefreshCw className="w-3 h-3 animate-spin inline mr-1" /> : null} Syncing with Database...</span>
        </div>
      </div>
    </div>
  );
};

export default AccessControlModal;
