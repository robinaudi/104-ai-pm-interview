
import React, { useState } from 'react';
import { Database, X, RefreshCw, Copy, Check, Flame, AlertCircle } from 'lucide-react';
import { saveSupabaseConfig, clearSupabaseConfig, isSupabaseConfigured, resetDatabaseWithMockData } from '../services/supabaseService';
import { useLanguage } from '../contexts/LanguageContext';

interface ConfigModalProps {
  onClose: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [configStr, setConfigStr] = useState(localStorage.getItem('FIREBASE_CONFIG') || '');
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null); // NEW: Error state
  const isConfigured = isSupabaseConfigured();

  const handleSaveConfig = () => {
    if (!configStr) {
        setError('Please enter the Firebase Config.');
        return;
    }
    
    try {
        setError(null);
        saveSupabaseConfig(configStr); 
        // Page will reload on success, so no need to clear state
    } catch (e: any) {
        setError(e.message || "Failed to save configuration.");
    }
  };

  const handleClear = () => {
    if (confirm('Disconnect DB?')) clearSupabaseConfig();
  };

  const handleResetData = async () => {
      if (confirm('WARNING: DELETE ALL DATA? This will wipe Firestore collections.')) {
          setIsResetting(true);
          try {
              await resetDatabaseWithMockData();
              window.location.reload();
          } catch (error) { console.error(error); } finally { setIsResetting(false); }
      }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white flex-shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" /> Firebase Configuration
          </h2>
          <button onClick={onClose} className="hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
          
          <div className="max-w-lg mx-auto space-y-4">
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                <p className="text-sm text-slate-600">
                    Paste your <strong>Firebase Config</strong> below.<br/>
                    <span className="text-xs text-slate-400">Supported: Raw JS Code (const firebaseConfig = ...) or clean JSON.</span>
                </p>
                
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <textarea 
                    value={configStr} 
                    onChange={(e) => { setConfigStr(e.target.value); setError(null); }} 
                    className={`w-full border p-3 rounded text-xs font-mono h-48 focus:ring-2 outline-none transition-colors ${error ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-amber-500'}`}
                    placeholder={`// Paste the full snippet from Firebase Console:\nconst firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  ...\n};`}
                />
                
                <div className="flex gap-2">
                      {isConfigured && <button onClick={handleClear} className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded text-sm">Disconnect</button>}
                      <button onClick={handleSaveConfig} className="flex-1 bg-slate-900 text-white px-4 py-2 rounded text-sm hover:bg-slate-800 font-bold shadow-sm">Save & Connect</button>
                </div>
              </div>
              
              {isConfigured && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col gap-2">
                    <button onClick={handleResetData} disabled={isResetting} className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded text-sm font-medium">{isResetting ? 'Resetting...' : 'Reset Firestore with Default JDs & Rules'}</button>
                </div>
              )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
