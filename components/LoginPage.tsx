
import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldAlert, Mail, CheckCircle, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { signInWithGoogle, signInWithMagicLink, isSupabaseConfigured } from '../services/supabaseService';

interface LoginPageProps {
  onLogin: (user: any) => void;
}

const LoginPage: React.FC<LoginPageProps> = () => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
        await signInWithGoogle();
        // Redirect will happen automatically if successful
    } catch (e: any) {
        console.error("Login Error:", e);
        // Better user feedback for the specific 400 error
        if (e.message?.includes('provider is not enabled') || e.code === 400) {
             setError("Google Login is not enabled in this project. Please use Email login.");
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
      try {
          await signInWithMagicLink(email);
          setMagicLinkSent(true);
      } catch (e: any) {
          console.error(e);
          setError(e.message || "Failed to send login link.");
      } finally {
          setIsLoading(false);
      }
  };

  const isConfigured = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative">
        <div className="p-8 text-center bg-slate-900">
           <div className="w-16 h-16 bg-blue-600 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-900/50">
             <Lock className="w-8 h-8 text-white" />
           </div>
           <h1 className="text-2xl font-bold text-white mb-2">HR GenAI Portal</h1>
           <p className="text-slate-400 text-sm">{t('signInDesc')}</p>
        </div>

        <div className="p-8">
          {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-start gap-2 text-xs">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" /> 
                  <span className="leading-relaxed">{error}</span>
              </div>
          )}

          {!isConfigured && (
              <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded text-sm">
                  <strong>Database Not Configured.</strong><br/>
                  Set environment variables or use the config menu.
              </div>
          )}
          
          {magicLinkSent ? (
              <div className="text-center py-6">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Check your inbox</h3>
                  <p className="text-slate-500 text-sm">We sent a secure login link to <br/><strong>{email}</strong></p>
                  <button onClick={() => setMagicLinkSent(false)} className="mt-6 text-blue-600 text-sm hover:underline">
                      Back to login
                  </button>
              </div>
          ) : (
            <div className="space-y-4">
                <form onSubmit={handleMagicLinkLogin} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@company.com"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
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
                    <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase">Or</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3.5 rounded-lg transition-all flex items-center justify-center gap-3 relative shadow-sm group text-sm"
                >
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-4 h-4" alt="Google" />
                    <span>Sign in with Google</span>
                </button>
            </div>
          )}
            
          <p className="text-xs text-center text-slate-400 mt-6 leading-relaxed">
            Authorization managed via internal whitelist.<br/>
            Contact Admin if you need access.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
