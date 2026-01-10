
import React, { useState } from 'react';
import { Lock, ShieldAlert, Mail, CheckCircle, Database, Globe, Copy, ClipboardCheck, Info, Server } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { signInWithGoogle, signInWithMagicLink, isSupabaseConfigured } from '../services/supabaseService';

interface LoginPageProps {
  onLogin: (user: any) => void;
  onOpenConfig: () => void; // Callback to open config modal
}

const LoginPage: React.FC<LoginPageProps> = ({ onOpenConfig }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [copied, setCopied] = useState(false);

  // This captures the ACTUAL domain the app is running on (inside the iframe/sandbox)
  const currentDomain = window.location.hostname;

  const handleCopyDomain = () => {
    // Select the input field
    const input = document.getElementById('domain-input') as HTMLInputElement;
    if (input) {
        input.select();
        input.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            navigator.clipboard.writeText(input.value).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        } catch (err) {
            // If automatic copy fails, just leave it selected for the user
            console.warn("Clipboard failed, user must copy manually");
        }
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    setErrorCode(null);
    try {
        await signInWithGoogle();
        // Redirect handled by App.tsx listener
    } catch (e: any) {
        console.error("Login Error:", e);
        if (e.message.includes('auth/unauthorized-domain') || e.code === 'auth/unauthorized-domain') {
            setErrorCode('auth/unauthorized-domain');
            setError("Domain Configuration Required");
        } else {
            setError(e.message || "Google Login failed.");
        }
        setIsLoading(false);
    }
  };

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) return;
      setIsLoading(true);
      setError(null);
      setErrorCode(null);
      try {
          await signInWithMagicLink(email);
          setMagicLinkSent(true);
      } catch (e: any) {
          console.error(e);
          if (e.message.includes('auth/unauthorized-domain') || e.code === 'auth/unauthorized-domain') {
              setErrorCode('auth/unauthorized-domain');
              setError("Domain Configuration Required");
          } else {
              setError(e.message || "Failed to send login link.");
          }
      } finally {
          setIsLoading(false);
      }
  };

  const isConfigured = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative z-10">
        <div className="p-8 text-center bg-slate-900">
           <div className="w-16 h-16 bg-blue-600 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-900/50">
             <Lock className="w-8 h-8 text-white" />
           </div>
           <h1 className="text-2xl font-bold text-white mb-2">HR GenAI Portal</h1>
           <p className="text-slate-400 text-sm">{t('signInDesc')}</p>
        </div>

        <div className="p-8">
          {/* SPECIAL HANDLING FOR DOMAIN ERROR */}
          {errorCode === 'auth/unauthorized-domain' ? (
              <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-900 p-5 rounded-lg text-sm flex flex-col gap-4 animate-fade-in shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                  
                  <div className="flex items-center gap-2 font-bold text-lg text-amber-800 border-b border-amber-200 pb-2">
                      <Globe className="w-5 h-5"/> Configuration Needed
                  </div>
                  
                  <div className="text-xs text-amber-800 space-y-2">
                      <p>
                          Firebase blocked the login because the <b>App Sandbox URL</b> is not in the whitelist.
                      </p>
                  </div>

                  {/* The Critical Info Box */}
                  <div className="bg-white border-2 border-amber-200 p-3 rounded-lg shadow-inner">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1">
                          <Server className="w-3 h-3"/> Sandbox Host (Whitelist This)
                      </label>
                      <div className="flex justify-between items-center gap-2 bg-slate-50 rounded border border-slate-300 p-1">
                          <input 
                             id="domain-input"
                             type="text" 
                             readOnly 
                             value={currentDomain} 
                             className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-mono font-bold text-blue-700 w-full px-2"
                             onClick={(e) => e.currentTarget.select()}
                          />
                          <button 
                            onClick={handleCopyDomain}
                            className={`p-2 rounded-md transition-all flex-shrink-0 flex items-center gap-1 font-bold text-xs shadow-sm ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200'}`}
                            title="Select and Copy"
                          >
                            {copied ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 text-center">
                          If copy button fails, click text to select and press Ctrl+C
                      </p>
                  </div>

                  <div className="text-xs text-amber-800 bg-amber-100/50 p-3 rounded">
                      <strong>Solution:</strong>
                      <ol className="list-decimal pl-4 mt-1 space-y-1">
                          <li>Go to <a href="https://console.firebase.google.com/" target="_blank" className="text-blue-700 underline font-bold">Firebase Console</a> &gt; Auth &gt; Settings.</li>
                          <li>Add the domain above to <b>Authorized Domains</b>.</li>
                      </ol>
                  </div>
              </div>
          ) : error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3 text-xs shadow-sm">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-500" /> 
                  <span className="leading-relaxed font-medium">{error}</span>
              </div>
          )}

          {!isConfigured && (
              <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded text-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2 font-bold">
                      <Database className="w-4 h-4"/> Database Not Configured
                  </div>
                  <p className="text-xs text-amber-800">Please connect to your Firebase project to enable authentication.</p>
                  <button 
                      onClick={onOpenConfig}
                      className="w-full bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold py-2 rounded text-xs transition-colors border border-amber-200"
                  >
                      Setup Connection
                  </button>
              </div>
          )}
          
          {magicLinkSent ? (
              <div className="text-center py-6 animate-fade-in">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Check your inbox</h3>
                  <p className="text-slate-500 text-sm">We sent a secure login link to <br/><strong>{email}</strong></p>
                  <button onClick={() => setMagicLinkSent(false)} className="mt-6 text-blue-600 text-sm hover:underline font-medium">
                      Back to login
                  </button>
              </div>
          ) : (
            <div className={`space-y-4 ${!isConfigured ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <form onSubmit={handleMagicLinkLogin} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@company.com"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform active:scale-[0.99]"
                    >
                        {isLoading ? (
                            <span className="opacity-70">Sending...</span>
                        ) : (
                            <>
                                <Mail className="w-4 h-4" />
                                <span>Send Login Link</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-bold tracking-wider">Or</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3.5 rounded-lg transition-all flex items-center justify-center gap-3 relative shadow-sm group text-sm hover:shadow-md transform active:scale-[0.99]"
                >
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                    <span>Sign in with Google</span>
                </button>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER DEBUG INFO FOR URL */}
      <div className="mt-8 text-center max-w-md w-full animate-fade-in opacity-70 hover:opacity-100 transition-opacity">
          <div className="bg-slate-200/50 rounded-lg p-3 text-xs text-slate-500 border border-slate-200 flex flex-col gap-2">
             <div className="flex items-center justify-center gap-2">
                 <Server className="w-3 h-3" />
                 <span>Current App Host:</span>
             </div>
             <div className="flex items-center gap-2 bg-white rounded border border-slate-300 p-1 pl-2">
                 <input 
                    type="text" 
                    readOnly 
                    value={currentDomain} 
                    className="flex-1 font-mono text-[10px] bg-transparent border-none focus:ring-0 text-slate-600 w-full"
                    onClick={(e) => e.currentTarget.select()}
                 />
                 <button 
                    onClick={() => {
                        const el = document.createElement('textarea');
                        el.value = currentDomain;
                        document.body.appendChild(el);
                        el.select();
                        document.execCommand('copy');
                        document.body.removeChild(el);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600"
                    title="Copy Domain for Firebase"
                 >
                    {copied ? <ClipboardCheck className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                 </button>
             </div>
             <div className="text-[9px] text-slate-400">
                <Info className="w-2 h-2 inline mr-1" />
                This URL must be in Firebase Authorized Domains.
             </div>
          </div>
      </div>
    </div>
  );
};

export default LoginPage;
