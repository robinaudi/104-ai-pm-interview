
import React, { useState, useEffect } from 'react';
import { X, Shield, Search, User as UserIcon, Building, Plus, Trash2, Save, Activity, RefreshCw, Key, Lock, AlertTriangle, Briefcase, Edit2, RotateCcw } from 'lucide-react';
import { supabase, fetchAccessRules, addAccessRule, deleteAccessRule, fetchRoles, updateRolePermissions, isSupabaseConfigured, fetchJobDescriptions, createJobDescription, deleteJobDescription, updateJobDescription } from '../services/supabaseService';
import { fetchLogs } from '../services/logService';
import { AccessRule, AppRole, ActionLog, Permission, User, JobDescription } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { DEFAULT_JOBS } from '../constants';

interface AccessControlModalProps {
  onClose: () => void;
  currentUser: User;
}

const AccessControlModal: React.FC<AccessControlModalProps> = ({ onClose, currentUser }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'logs' | 'jds'>('users');
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [accessRules, setAccessRules] = useState<AccessRule[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [logs, setLogs] = useState<ActionLog[]>([]);

  // JD Management State
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Rule Form
  const [newRuleValue, setNewRuleValue] = useState('');
  const [newRuleRole, setNewRuleRole] = useState('USER');

  // Load Data
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
      setLoading(true);
      if (activeTab === 'users') {
          const rules = await fetchAccessRules();
          setAccessRules(rules);
          const r = await fetchRoles();
          setRoles(r);
      } else if (activeTab === 'roles') {
          const r = await fetchRoles();
          setRoles(r);
      } else if (activeTab === 'logs') {
          const l = await fetchLogs();
          setLogs(l);
      } else if (activeTab === 'jds') {
          const j = await fetchJobDescriptions();
          setJobs(j);
      }
      setLoading(false);
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
      if (editingJobId) {
          const updatedJob = { title: formTitle, content: formContent };
          setJobs(prev => prev.map(j => j.id === editingJobId ? { ...j, ...updatedJob } : j));
          cancelEditJob();
          try { await updateJobDescription(editingJobId, updatedJob); } catch (e) { console.error(e); }
      } else {
          const newJob: JobDescription = { id: crypto.randomUUID(), title: formTitle, content: formContent, created_at: new Date().toISOString() };
          setJobs([newJob, ...jobs]);
          cancelEditJob();
          try { await createJobDescription(newJob); } catch (e) { console.error(e); }
      }
      setLoading(false);
  };

  const handleDeleteJob = async (id: string) => {
      if (!confirm('Delete this job role?')) return;
      setJobs(jobs.filter(j => j.id !== id));
      try { await deleteJobDescription(id); } catch (e) { console.error(e); }
  };

  const handleRestoreDefaultJDs = async () => {
      if (!confirm("Add default JDs?")) return;
      setLoading(true);
      setJobs(prev => [...prev, ...DEFAULT_JOBS]);
      try {
          for (const job of DEFAULT_JOBS) {
              await createJobDescription({ ...job, id: crypto.randomUUID() });
          }
          const j = await fetchJobDescriptions();
          setJobs(j);
      } catch(e) {}
      setLoading(false);
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

  // --- RENDERING HELPERS ---

  // Highlight Text for Smart Search
  const HighlightText = ({ text, highlight }: { text: string, highlight: string }) => {
      if (!highlight.trim()) return <>{text}</>;
      const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
      return (
          <span>
              {parts.map((part, i) => 
                  part.toLowerCase() === highlight.toLowerCase() 
                  ? <span key={i} className="bg-yellow-200 font-bold px-0.5 rounded text-slate-900">{part}</span> 
                  : part
              )}
          </span>
      );
  };

  const ALL_PERMISSIONS: Permission[] = [
      'VIEW_DASHBOARD', 'VIEW_LIST', 'EDIT_CANDIDATE', 'DELETE_CANDIDATE', 
      'IMPORT_DATA', 'EXPORT_DATA', 'SEND_EMAIL', 'AI_CHAT', 
      'MANAGE_ACCESS', 'MANAGE_JD', 'VIEW_LOGS'
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-fade-in border border-slate-700">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center flex-shrink-0">
             <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-600 rounded-lg">
                     <Shield className="w-5 h-5 text-white" />
                 </div>
                 <div>
                     <h2 className="text-lg font-bold">System Admin Portal</h2>
                     <p className="text-xs text-slate-400">Manage Vacancies, Access & Logs</p>
                 </div>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                 <X className="w-5 h-5 text-slate-400" />
             </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 flex-shrink-0">
             <button 
                onClick={() => setActiveTab('jds')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'jds' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
                <Briefcase className="w-4 h-4" /> Vacancies / JDs
            </button>
            <button 
                onClick={() => setActiveTab('users')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'users' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
                <UserIcon className="w-4 h-4" /> User Whitelist
            </button>
            <button 
                onClick={() => setActiveTab('roles')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'roles' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
                <Key className="w-4 h-4" /> Role & Permissions
            </button>
            <button 
                onClick={() => setActiveTab('logs')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'logs' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
                <Activity className="w-4 h-4" /> Audit Logs
            </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
            
            {/* --- TAB: VACANCIES (JDS) --- */}
            {activeTab === 'jds' && (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Form Section */}
                     <div className={`bg-white p-6 rounded-lg border shadow-sm ${editingJobId ? 'border-blue-300 ring-4 ring-blue-50' : 'border-slate-200'}`}>
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-800">
                          {editingJobId ? <Edit2 className="w-4 h-4 text-blue-500"/> : <Plus className="w-4 h-4 text-emerald-500"/>}
                          {editingJobId ? 'Edit Job Description' : t('addNewJD')}
                      </h3>
                      <div className="space-y-4">
                          <input 
                            type="text" 
                            placeholder={t('jdTitlePlaceholder')} 
                            value={formTitle} 
                            onChange={e => setFormTitle(e.target.value)} 
                            className="w-full border border-slate-300 p-3 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none" 
                          />
                          <textarea 
                            placeholder={t('jdContentPlaceholder')} 
                            value={formContent} 
                            onChange={e => setFormContent(e.target.value)} 
                            className="w-full border border-slate-300 p-3 rounded-lg text-sm h-40 focus:ring-2 focus:ring-blue-100 outline-none resize-none" 
                          />
                          <div className="flex gap-2 justify-end">
                            {editingJobId && (
                                <button onClick={cancelEditJob} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                    Cancel
                                </button>
                            )}
                            <button 
                                onClick={handleSaveJob} 
                                disabled={!formTitle || !formContent || loading} 
                                className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-all shadow-sm flex items-center gap-2"
                            >
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                                {editingJobId ? 'Update JD' : t('saveJD')}
                            </button>
                          </div>
                      </div>
                  </div>

                  <hr className="border-slate-200" />
                  
                  {/* List Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {jobs.map(job => (
                          <div key={job.id} className={`bg-white p-5 rounded-lg border shadow-sm relative group hover:shadow-md transition-shadow ${editingJobId === job.id ? 'border-blue-500 bg-blue-50/10' : 'border-slate-200'}`}>
                              <h3 className="font-bold text-slate-800 pr-20 truncate text-lg">{job.title}</h3>
                              <p className="text-xs text-slate-400 mb-3 flex items-center gap-1 font-mono">
                                  ID: {job.id.slice(0, 8)}...
                              </p>
                              <div className="text-sm text-slate-600 line-clamp-3 mb-2 h-16 bg-slate-50 p-3 rounded border border-slate-100 text-xs leading-relaxed">
                                {job.content}
                              </div>
                              <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => handleEditJob(job)} 
                                    className="p-2 bg-white text-slate-400 hover:text-blue-600 border border-slate-200 rounded-full shadow-sm hover:shadow"
                                    title="Edit"
                                >
                                    <Edit2 className="w-3 h-3" />
                                </button>
                                <button 
                                    onClick={() => handleDeleteJob(job.id)} 
                                    className="p-2 bg-white text-slate-400 hover:text-red-600 border border-slate-200 rounded-full shadow-sm hover:shadow"
                                    title="Delete"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                          </div>
                      ))}
                      {jobs.length === 0 && (
                          <div className="col-span-2 text-center py-12 bg-white rounded-lg border border-dashed border-slate-300 flex flex-col items-center gap-3">
                              <Briefcase className="w-10 h-10 text-slate-300" />
                              <p className="text-slate-500 font-medium">{t('noJDDefined')}</p>
                              <button onClick={handleRestoreDefaultJDs} className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-2">
                                  <RotateCcw className="w-4 h-4" /> Restore Default JDs
                              </button>
                          </div>
                      )}
                  </div>
                </div>
            )}

            {/* --- TAB: USERS --- */}
            {activeTab === 'users' && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap gap-4 items-end shadow-sm z-10">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs font-bold text-slate-500 uppercase">Search User</label>
                            <div className="relative mt-1">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search by email or domain..."
                                    className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 items-end">
                            <div className="w-64">
                                <label className="text-xs font-bold text-slate-500 uppercase">Whitelist Value</label>
                                <input 
                                    type="text" 
                                    value={newRuleValue}
                                    onChange={e => setNewRuleValue(e.target.value)}
                                    placeholder="e.g. user@company.com"
                                    className="w-full mt-1 border rounded-lg p-2 text-sm"
                                />
                            </div>
                            <div className="w-32">
                                <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                                <select 
                                    className="w-full mt-1 border rounded-lg p-2 text-sm bg-slate-50"
                                    value={newRuleRole}
                                    onChange={e => setNewRuleRole(e.target.value)}
                                >
                                    {roles.map(r => <option key={r.role_name} value={r.role_name}>{r.role_name}</option>)}
                                </select>
                            </div>
                            <button 
                                onClick={handleAddRule}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 h-[38px]"
                            >
                                <Plus className="w-4 h-4" /> Add
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <table className="w-full border-collapse">
                            <thead className="bg-slate-100 text-xs font-bold text-slate-500 uppercase text-left sticky top-0">
                                <tr>
                                    <th className="p-3 rounded-tl-lg">Type</th>
                                    <th className="p-3">Identity Value</th>
                                    <th className="p-3">Assigned Role</th>
                                    <th className="p-3 rounded-tr-lg text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {accessRules
                                    .filter(r => r.value.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map(rule => (
                                    <tr key={rule.id} className="hover:bg-slate-50 group">
                                        <td className="p-3">
                                            {rule.value.includes('@') 
                                                ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold"><UserIcon className="w-3 h-3"/> Email</span>
                                                : <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-700 text-xs font-bold"><Building className="w-3 h-3"/> Domain</span>
                                            }
                                        </td>
                                        <td className="p-3 font-medium text-slate-800">
                                            <HighlightText text={rule.value} highlight={searchQuery} />
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold 
                                                ${rule.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                                                {rule.role}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right">
                                            <button 
                                                onClick={() => handleDeleteRule(rule.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {accessRules.length === 0 && (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">No access rules defined.</td></tr>
                                )}
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
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">{role.role_name}</h3>
                                        <p className="text-xs text-slate-500">{role.description || 'Custom Role'}</p>
                                    </div>
                                    <button 
                                        onClick={() => saveRolePermissions(role)}
                                        className="text-xs bg-white border border-slate-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 px-3 py-1.5 rounded-md font-bold transition-colors flex items-center gap-1"
                                    >
                                        <Save className="w-3 h-3" /> Save Changes
                                    </button>
                                </div>
                                <div className="p-4 grid grid-cols-2 gap-2">
                                    {ALL_PERMISSIONS.map(perm => {
                                        const isChecked = role.permissions.includes(perm);
                                        return (
                                            <label key={perm} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors border ${isChecked ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50 border-transparent'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isChecked}
                                                    onChange={() => handlePermissionToggle(role.role_name, perm)}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className={`text-xs font-medium ${isChecked ? 'text-blue-800' : 'text-slate-600'}`}>
                                                    {perm.replace(/_/g, ' ')}
                                                </span>
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
                            <thead className="bg-slate-100 text-xs font-bold text-slate-500 uppercase text-left sticky top-0 shadow-sm">
                                <tr>
                                    <th className="p-3 w-40">Time</th>
                                    <th className="p-3 w-48">User</th>
                                    <th className="p-3 w-32">Action</th>
                                    <th className="p-3">Target / Details</th>
                                    <th className="p-3 w-32">IP / Device</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {logs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="p-3 text-slate-500 text-xs whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-3 font-medium text-slate-800">
                                            {log.user_email}
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-600 break-all">
                                            <span className="font-bold text-slate-800 mr-2">{log.target}</span>
                                            {/* Render limited details */}
                                        </td>
                                        <td className="p-3 text-xs text-slate-400">
                                            <div>{log.details?.ip || 'Unknown IP'}</div>
                                            <div className="truncate max-w-[150px]" title={log.details?.userAgent}>
                                                {log.details?.platform || 'Web'}
                                            </div>
                                        </td>
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
            <span className="flex items-center gap-1">
                <Lock className="w-3 h-3" /> Secure Access Mode Active
            </span>
            <span>
                {loading ? <RefreshCw className="w-3 h-3 animate-spin inline mr-1" /> : null}
                Syncing with Database...
            </span>
        </div>
      </div>
    </div>
  );
};

export default AccessControlModal;
