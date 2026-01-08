
import React, { useState } from 'react';
import { Database, X, RefreshCw, Copy, Check } from 'lucide-react';
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

  const sqlCode = `-- SYSTEM REPAIR & MIGRATION SCRIPT (v4.0 - Scoring Model Update)
-- Run this in Supabase SQL Editor to apply the new V4 Schema and Scoring Rules.

-- 1. ENABLE RLS & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CREATE CORE TABLES (IF NOT EXIST)
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT
);

CREATE TABLE IF NOT EXISTS job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  department TEXT,
  content TEXT NOT NULL
);

-- 3. SAFE MIGRATION: ADD MISSING COLUMNS
DO $$
BEGIN
    -- candidates table extensions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'status') THEN
        ALTER TABLE candidates ADD COLUMN status TEXT DEFAULT 'New';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'source') THEN
        ALTER TABLE candidates ADD COLUMN source TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'role_applied') THEN
        ALTER TABLE candidates ADD COLUMN role_applied TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'resume_url') THEN
        ALTER TABLE candidates ADD COLUMN resume_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'photo_url') THEN
        ALTER TABLE candidates ADD COLUMN photo_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'uploaded_by') THEN
        ALTER TABLE candidates ADD COLUMN uploaded_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'linkedin_url') THEN
        ALTER TABLE candidates ADD COLUMN linkedin_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'analysis') THEN
        ALTER TABLE candidates ADD COLUMN analysis JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'personal_info') THEN
        ALTER TABLE candidates ADD COLUMN personal_info JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'is_deleted') THEN
        ALTER TABLE candidates ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'deleted_by') THEN
        ALTER TABLE candidates ADD COLUMN deleted_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'deleted_at') THEN
        ALTER TABLE candidates ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'is_unsolicited') THEN
        ALTER TABLE candidates ADD COLUMN is_unsolicited BOOLEAN DEFAULT FALSE;
    END IF;

    -- job_descriptions table extensions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_descriptions' AND column_name = 'priority') THEN
        ALTER TABLE job_descriptions ADD COLUMN priority INTEGER DEFAULT 99;
    END IF;
END $$;

-- 4. NEW TABLES
CREATE TABLE IF NOT EXISTS candidate_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    evaluation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    model_version TEXT,
    snapshot_summary JSONB, 
    total_score NUMERIC,
    evaluator_email TEXT
);

CREATE TABLE IF NOT EXISTS evaluation_dimensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID REFERENCES candidate_evaluations(id) ON DELETE CASCADE,
    dimension_name TEXT NOT NULL,
    weight TEXT, 
    score NUMERIC,
    reasoning TEXT
);

CREATE TABLE IF NOT EXISTS candidate_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(candidate_id, user_email)
);

-- 5. ADMIN & CONFIG TABLES
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

CREATE TABLE IF NOT EXISTS access_control (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text NOT NULL CHECK (type IN ('EMAIL', 'DOMAIN')),
    value text NOT NULL,
    role text REFERENCES app_roles(role_name) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

-- Default Admin
INSERT INTO access_control (type, value, role) 
SELECT 'EMAIL', 'robinhsu@91app.com', 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM access_control WHERE value = 'robinhsu@91app.com');

CREATE TABLE IF NOT EXISTS action_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email text,
    action text NOT NULL,
    target text,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scoring_standards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category text NOT NULL, 
    condition text,
    rule_text text NOT NULL,
    description text,
    priority int DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- CRITICAL FIX: Ensure 'description' column exists in scoring_standards
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scoring_standards' AND column_name = 'description') THEN
        ALTER TABLE scoring_standards ADD COLUMN description TEXT;
    END IF;
END $$;

-- 6. RLS POLICIES (Refresh)
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_dimensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Access Candidates" ON candidates;
CREATE POLICY "Public Access Candidates" ON candidates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access JDs" ON job_descriptions;
CREATE POLICY "Public Access JDs" ON job_descriptions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Views" ON candidate_views;
CREATE POLICY "Public Access Views" ON candidate_views FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Roles" ON app_roles;
CREATE POLICY "Public Access Roles" ON app_roles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Access" ON access_control;
CREATE POLICY "Public Access Access" ON access_control FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Logs" ON action_logs;
CREATE POLICY "Public Access Logs" ON action_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Standards" ON scoring_standards;
CREATE POLICY "Public Access Standards" ON scoring_standards FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Evals" ON candidate_evaluations;
CREATE POLICY "Public Access Evals" ON candidate_evaluations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access Dims" ON evaluation_dimensions;
CREATE POLICY "Public Access Dims" ON evaluation_dimensions FOR ALL USING (true) WITH CHECK (true);

-- 7. V4 MIGRATION: UPDATE SCORING STANDARDS
-- This block resets the scoring rules to the new V4 model (A-E)
DELETE FROM scoring_standards WHERE category = 'DIMENSION_WEIGHT';

INSERT INTO scoring_standards (category, condition, rule_text, description, priority, is_active)
VALUES
('DIMENSION_WEIGHT', '(A) 產業相關性', '30', '指標: Tier 1 SaaS/OMO, 營收驅動, 高流量/跨境。滿分(30分): 91APP/EZTABLE高管。及格: 18分 (6.0)。', 1, true),
('DIMENSION_WEIGHT', '(B) 系統導入經驗', '20', '指標: 深度(Build/Re-arch), 廣度(ERP+CRM+POS), 量化ROI。滿分(20分): 自建Social-CRM, ERP 0-1。及格: 12分 (6.0)。', 2, true),
('DIMENSION_WEIGHT', '(C) 專案管理經驗', '20', '指標: 規模(預算/人數), 方法論(PMP+Agile), 危機處理。滿分(20分): 管30+人, 雙證照, 解決系統癱瘓。及格: 12分 (6.0)。', 3, true),
('DIMENSION_WEIGHT', '(D) 技術量化成效', '20', '指標: 資歷(20+年/Dev背景), 證照(Full Stack), 硬指標(Speed/Cost)。滿分(20分): MCPD, AWS Cost -46%。及格: 12分 (6.0)。', 4, true),
('DIMENSION_WEIGHT', '(E) 未來就緒度', '10', '指標: AI/Low-Code實戰, 持續學習(碩士/教學)。滿分(10分): RPA Cost -80%, Copilot講師。及格: 5分 (5.0)。', 5, true);

-- Add Default Experience Rules if missing
INSERT INTO scoring_standards (category, condition, rule_text, description, priority, is_active)
SELECT 'EXPERIENCE_CEILING', '20+ Years', 'Score 10.0 : 20+ Years. (VP/Director Level).', '', 20, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_standards WHERE category = 'EXPERIENCE_CEILING');
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
                      <div className="flex flex-col">
                          <span className="font-bold">Database Update Script (v4.0)</span>
                          <span className="text-xs text-blue-600">Run this to update your database to the new Scoring Model.</span>
                      </div>
                      <button onClick={handleCopySQL} className="bg-white border border-blue-200 px-4 py-2 rounded-md text-blue-700 text-xs font-bold hover:bg-blue-50 flex items-center gap-1">
                          {copySuccess ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                          {copySuccess ? 'Copied!' : 'Copy SQL'}
                      </button>
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
