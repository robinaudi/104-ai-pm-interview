
import React, { useState } from 'react';
import { Database, X, RefreshCw, Copy } from 'lucide-react';
import { saveSupabaseConfig, clearSupabaseConfig, isSupabaseConfigured, resetDatabaseWithMockData } from '../services/supabaseService';
import { useLanguage } from '../contexts/LanguageContext';

interface ConfigModalProps {
  onClose: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [url, setUrl] = useState(localStorage.getItem('SB_URL') || '');
  const [key, setKey] = useState(localStorage.getItem('SB_KEY') || '');
  const [isResetting, setIsResetting] = useState(false);
  const [activeTab, setActiveTab] = useState<'connection' | 'schema'>('connection');
  const isConfigured = isSupabaseConfigured();
  const [copySuccess, setCopySuccess] = useState(false);

  const handleSaveConfig = () => {
    if (!url || !key) return alert('Enter URL and Key');
    saveSupabaseConfig(url, key);
  };

  const handleClear = () => {
    if (confirm('Disconnect DB?')) clearSupabaseConfig();
  };

  const handleResetData = async () => {
      if (confirm('WARNING: DELETE ALL DATA?')) {
          setIsResetting(true);
          try {
              await resetDatabaseWithMockData();
              window.location.reload();
          } catch (error) { console.error(error); } finally { setIsResetting(false); }
      }
  };

  const handleCopySQL = () => {
      navigator.clipboard.writeText(sqlCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const sqlCode = `-- SYSTEM UPDATE 2026.01.v4 Schema (Includes Deleted By)
  
-- 1. ROLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS app_roles (
    role_name text PRIMARY KEY,
    permissions text[] DEFAULT '{}',
    description text,
    created_at timestamptz DEFAULT now()
);

INSERT INTO app_roles (role_name, permissions, description) 
VALUES
('ADMIN', '{"VIEW_DASHBOARD","VIEW_LIST","EDIT_CANDIDATE","DELETE_CANDIDATE","IMPORT_DATA","EXPORT_DATA","SEND_EMAIL","AI_CHAT","MANAGE_ACCESS","MANAGE_JD","VIEW_LOGS"}', 'System Administrator'),
('MANAGER', '{"VIEW_DASHBOARD","VIEW_LIST","EDIT_CANDIDATE","IMPORT_DATA","AI_CHAT","MANAGE_JD"}', 'Hiring Manager'),
('USER', '{"VIEW_DASHBOARD","VIEW_LIST","AI_CHAT"}', 'General User')
ON CONFLICT (role_name) DO NOTHING;

-- 2. ACCESS CONTROL (Whitelist)
CREATE TABLE IF NOT EXISTS access_control (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text NOT NULL CHECK (type IN ('EMAIL', 'DOMAIN')),
    value text NOT NULL,
    role text REFERENCES app_roles(role_name) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

-- Default Admin Access
INSERT INTO access_control (type, value, role) 
SELECT 'EMAIL', 'robinhsu@91app.com', 'ADMIN'
WHERE NOT EXISTS (
    SELECT 1 FROM access_control WHERE value = 'robinhsu@91app.com'
);

-- 3. AUDIT LOGS
CREATE TABLE IF NOT EXISTS action_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email text,
    action text NOT NULL,
    target text,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

-- 4. SCORING STANDARDS
CREATE TABLE IF NOT EXISTS scoring_standards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category text NOT NULL, -- EXPERIENCE_CEILING, INDUSTRY_PENALTY, etc.
    condition text,
    rule_text text NOT NULL,
    priority int DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 5. CORE TABLES
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'New',
  source TEXT,
  role_applied TEXT,
  resume_url TEXT,
  photo_url TEXT,
  uploaded_by TEXT,
  linkedin_url TEXT,
  analysis JSONB,
  personal_info JSONB,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by TEXT, -- NEW: Who deleted it
  deleted_at TIMESTAMP WITH TIME ZONE -- NEW: When it was deleted
);

CREATE TABLE IF NOT EXISTS job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  department TEXT,
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS candidate_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(candidate_id, user_email)
);

-- 6. RLS POLICIES (Safe Drop & Create)
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_standards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Access" ON candidates;
CREATE POLICY "Public Access" ON candidates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON job_descriptions;
CREATE POLICY "Public Access" ON job_descriptions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON candidate_views;
CREATE POLICY "Public Access" ON candidate_views FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON app_roles;
CREATE POLICY "Public Access" ON app_roles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON access_control;
CREATE POLICY "Public Access" ON access_control FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON action_logs;
CREATE POLICY "Public Access" ON action_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON scoring_standards;
CREATE POLICY "Public Access" ON scoring_standards FOR ALL USING (true) WITH CHECK (true);
`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white flex-shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="w-5 h-5" /> Backend Settings
          </h2>
          <button onClick={onClose} className="hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 bg-slate-50 flex-shrink-0">
            <button onClick={() => setActiveTab('connection')} className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'connection' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t('dbConnection')}</button>
            <button onClick={() => setActiveTab('schema')} className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'schema' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t('sqlSchema')}</button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
          
          {activeTab === 'connection' && (
              <div className="max-w-lg mx-auto space-y-4">
                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                    <p className="text-sm text-slate-600">Connect to Supabase to enable data persistence and advanced features.</p>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project URL</label><input type="text" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full border p-2 rounded text-sm" /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Anon Key</label><input type="password" value={key} onChange={(e) => setKey(e.target.value)} className="w-full border p-2 rounded text-sm font-mono" /></div>
                    <div className="flex gap-2">
                         {isConfigured && <button onClick={handleClear} className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded text-sm">Disconnect</button>}
                         <button onClick={handleSaveConfig} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Save & Connect</button>
                    </div>
                  </div>
                  {isConfigured && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col gap-2">
                        <button onClick={handleResetData} disabled={isResetting} className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded text-sm">{isResetting ? 'Resetting...' : 'Reset DB with Default JDs & Rules'}</button>
                    </div>
                  )}
              </div>
          )}

          {activeTab === 'schema' && (
              <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-sm text-blue-800 flex justify-between items-center">
                      <span>Run this script in Supabase SQL Editor to create ALL tables (Candidates, Roles, Rules).</span>
                      <button onClick={handleCopySQL} className="bg-white border border-blue-200 px-3 py-1.5 rounded-md text-blue-700 text-xs font-bold">{copySuccess ? 'Copied!' : 'Copy SQL'}</button>
                  </div>
                  <pre className="bg-slate-800 text-slate-200 p-4 rounded-lg text-xs font-mono overflow-auto h-96 select-all">{sqlCode}</pre>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
