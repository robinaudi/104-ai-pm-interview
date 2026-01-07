
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Candidate, User, JobDescription, AnalysisResult } from '../types';
import { X, Brain, Target, Briefcase, Mail, Award, Link as LinkIcon, Building2, Calendar, User as UserIcon, Globe, ExternalLink, Filter, FileText, Phone, MapPin, GraduationCap, Edit2, Camera, Star, Code2, ScrollText, Clock, Linkedin, Quote, ClipboardPaste, Clipboard, ChevronDown, ChevronUp, Save, Check, RefreshCw, Zap, Loader2, Search, Sparkles, History } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Radar as RechartsRadar } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, isSupabaseConfigured, fetchJobDescriptions, updateCandidate } from '../services/supabaseService';
import { reEvaluateCandidate } from '../services/geminiService';

// --- Sub-components Definitions ---

interface SwotCardProps {
  title: string;
  items: string[];
  color: 'emerald' | 'red' | 'blue' | 'amber';
}

const SwotCard: React.FC<SwotCardProps> = ({ title, items, color }) => {
  const colorMap = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-100', dot: 'bg-emerald-500' },
    red: { bg: 'bg-red-50', text: 'text-red-900', border: 'border-red-100', dot: 'bg-red-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-100', dot: 'bg-blue-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-100', dot: 'bg-amber-500' },
  };
  const theme = colorMap[color];

  return (
    <div className={`p-4 rounded-lg border ${theme.bg} ${theme.border}`}>
      <h4 className={`font-bold mb-2 flex items-center gap-2 text-xs uppercase tracking-wide ${theme.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
        {title}
      </h4>
      <ul className="space-y-1">
        {items && items.length > 0 ? (
          items.map((item, idx) => (
            <li key={idx} className={`text-xs opacity-90 leading-relaxed pl-3 border-l-2 border-current`}>
               {item}
            </li>
          ))
        ) : (
          <li className="text-xs opacity-50 italic">None</li>
        )}
      </ul>
    </div>
  );
};

interface InfoRow104Props {
  label: string;
  value: string | undefined;
  isLink?: boolean;
}

const InfoRow104: React.FC<InfoRow104Props> = ({ label, value, isLink }) => (
  <div className="flex flex-col border-b border-slate-100 pb-2">
    <span className="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider">{label}</span>
    {isLink ? (
      <a href={`mailto:${value}`} className="text-sm font-bold text-blue-600 hover:underline truncate">
        {value}
      </a>
    ) : (
      <span className="text-sm font-bold text-slate-800 truncate" title={value}>{value || '-'}</span>
    )}
  </div>
);

// --- Main Component ---

interface CandidateDetailProps {
  candidate: Candidate;
  onClose: () => void;
  onUpdate?: (updatedCandidate: Candidate) => void;
  currentUser?: User | null;
}

const CandidateDetail: React.FC<CandidateDetailProps> = ({ candidate, onClose, onUpdate, currentUser }) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'analysis' | 'experience' | 'info'>('analysis'); 
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(candidate.photoUrl);
  
  // Versioning State
  const [selectedVersionDate, setSelectedVersionDate] = useState<string>('latest');
  
  const [isReScoring, setIsReScoring] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<JobDescription[]>([]);

  useEffect(() => {
    fetchJobDescriptions().then(setAvailableJobs);
  }, []);

  // Compute the displayed analysis based on selected version
  const displayedData = useMemo(() => {
      if (selectedVersionDate === 'latest') {
          return {
              analysis: candidate.analysis,
              role: candidate.roleApplied,
              date: candidate.updatedAt
          };
      }
      const historical = candidate.versions?.find(v => v.date === selectedVersionDate);
      return historical ? {
          analysis: historical.analysis,
          role: historical.roleApplied,
          date: historical.date
      } : {
          analysis: candidate.analysis,
          role: candidate.roleApplied,
          date: candidate.updatedAt
      };
  }, [candidate, selectedVersionDate]);

  const analysis = displayedData.analysis;
  if (!analysis) return null;
  const { extractedData } = analysis;
  
  // Normalization for 0-10 Scale Legacy Handling
  const normalizeScore = (val: number) => (val > 10 ? val / 10 : val);
  const finalMatchScore = normalizeScore(analysis.matchScore);

  const handleReScore = async () => {
    if (selectedVersionDate !== 'latest') {
        alert("You can only re-evaluate the latest version.");
        return;
    }
    if (!confirm(`Re-evaluate ${candidate.name} (Strict 0-10 Scale)?`)) return;
    
    setIsReScoring(true);
    try {
        const targetJD = availableJobs.find(j => j.title === candidate.roleApplied)?.content || `Role: ${candidate.roleApplied}`;
        const targetLang = language === 'zh' ? 'Traditional Chinese' : 'English';
        
        const newAnalysis = await reEvaluateCandidate(candidate, targetJD, targetLang);
        
        const updatedCandidate = { 
            ...candidate, 
            analysis: newAnalysis,
            updatedAt: new Date().toISOString()
        };

        if (onUpdate) onUpdate(updatedCandidate);

        if (isSupabaseConfigured()) {
            await updateCandidate(updatedCandidate);
        }
        alert("Re-scored successfully.");
    } catch (e) {
        console.error("Re-score failed", e);
        alert("Failed to re-score.");
    } finally {
        setIsReScoring(false);
    }
  };

  // --- ROBUST LINKEDIN VALIDATION ---
  const getValidatedLinkedinUrl = () => {
      let url = candidate.linkedinUrl || extractedData.linkedinUrl || extractedData.portfolio?.find(p => p.url?.toLowerCase().includes('linkedin'))?.url;
      if (!url) return null;
      url = url.trim();
      const garbage = ['n/a', 'none', 'linkedin', 'link', 'profile', 'url'];
      if (garbage.includes(url.toLowerCase())) return null;
      if (!url.toLowerCase().includes('linkedin.com')) {
          if (url.toLowerCase().startsWith('linkedin.com')) url = 'https://www.' + url;
          else return null;
      }
      if (!url.startsWith('http')) url = 'https://' + url;
      return url;
  };

  const validLinkedinUrl = getValidatedLinkedinUrl();
  const hasLinkedin = !!validLinkedinUrl;

  const radarData = [
    { subject: 'Competency', A: normalizeScore(analysis.fiveForces.competency), fullMark: 10 },
    { subject: 'Experience', A: normalizeScore(analysis.fiveForces.experience), fullMark: 10 },
    { subject: 'Culture Fit', A: normalizeScore(analysis.fiveForces.cultureFit), fullMark: 10 },
    { subject: 'Potential', A: normalizeScore(analysis.fiveForces.potential), fullMark: 10 },
    { subject: 'Communication', A: normalizeScore(analysis.fiveForces.communication), fullMark: 10 },
  ];

  const getAvatarName = () => extractedData.englishName && extractedData.englishName !== 'Unknown' ? extractedData.englishName : extractedData.name;
  const finalAvatarUrl = currentPhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(getAvatarName())}&background=random&color=fff&size=200&bold=true`;

  const info = extractedData.personalInfo || { mobile: 'N/A', gender: 'N/A', age: 'N/A', address: 'N/A', highestEducation: 'N/A', school: 'N/A', major: 'N/A' };
  
  const getScoreColor = (score: number) => {
      if (score >= 8) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      if (score >= 6) return 'text-blue-600 bg-blue-50 border-blue-200';
      return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] xl:max-w-[90vw] h-[90vh] flex overflow-hidden relative border border-slate-200">
        
        <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 bg-white/80 hover:bg-white rounded-full text-slate-500 hover:text-slate-800 transition-colors shadow-sm"><X className="w-5 h-5" /></button>

        {/* SIDEBAR */}
        <aside className="w-80 bg-slate-50 border-r border-slate-200 overflow-y-auto p-6 flex flex-col gap-6 flex-shrink-0">
            <div className="text-center">
                <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-white border-4 border-white shadow-lg overflow-hidden">
                    <img src={finalAvatarUrl} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(extractedData.name)}`; }} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{extractedData.name}</h2>
                {extractedData.englishName && <p className="text-sm text-slate-500 font-medium">{extractedData.englishName}</p>}
                
                {/* VERSION SELECTOR */}
                {candidate.versions && candidate.versions.length > 0 && (
                    <div className="mt-4 mb-2">
                        <div className="relative">
                            <select 
                                value={selectedVersionDate} 
                                onChange={(e) => setSelectedVersionDate(e.target.value)}
                                className="w-full appearance-none bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="latest">Latest: {new Date(candidate.updatedAt).toLocaleDateString()} ({candidate.roleApplied})</option>
                                {candidate.versions.slice().reverse().map((v, i) => (
                                    <option key={i} value={v.date}>
                                        History: {new Date(v.date).toLocaleDateString()} ({v.roleApplied})
                                    </option>
                                ))}
                            </select>
                            <History className="absolute right-3 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                )}
                
                <div className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-lg font-bold border ${getScoreColor(finalMatchScore)}`}>
                   <span className="text-xs uppercase mr-2 opacity-70">Score</span>
                   {finalMatchScore.toFixed(1)} <span className="text-xs opacity-50 ml-1">/ 10</span>
                </div>
            </div>

            <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between border-b pb-2">
                    <span className="text-slate-400">Total Exp</span>
                    <span className="font-semibold text-slate-700">{extractedData.yearsOfExperience} Yrs</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                    <span className="text-slate-400">Relevant Exp</span>
                    <span className="font-bold text-blue-600">{extractedData.relevantYearsOfExperience ?? extractedData.yearsOfExperience} Yrs</span>
                </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="space-y-3">
                {hasLinkedin ? (
                    <a 
                        href={validLinkedinUrl!} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-[#0a66c2] hover:bg-[#004182] text-white py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                        title={validLinkedinUrl!}
                    >
                        <Linkedin className="w-4 h-4" />
                        View on LinkedIn
                    </a>
                ) : (
                    <div className="w-full bg-slate-100 text-slate-400 py-2.5 rounded-lg font-medium text-center text-sm flex items-center justify-center gap-2 cursor-not-allowed">
                        <Linkedin className="w-4 h-4" />
                        No LinkedIn Provided
                    </div>
                )}

                {selectedVersionDate === 'latest' && (
                    <button onClick={handleReScore} disabled={isReScoring} className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                        {isReScoring ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>}
                        Re-Evaluate (Strict)
                    </button>
                )}
            </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
            <div className="border-b border-slate-200 px-8 pt-6">
                <div className="flex gap-8">
                    <button onClick={() => setActiveTab('analysis')} className={`pb-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'analysis' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <Brain className="w-4 h-4" /> AI Analysis
                    </button>
                    <button onClick={() => setActiveTab('experience')} className={`pb-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'experience' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <Briefcase className="w-4 h-4" /> Work Experience
                    </button>
                     <button onClick={() => setActiveTab('info')} className={`pb-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <FileText className="w-4 h-4" /> Basic Info
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                {selectedVersionDate !== 'latest' && (
                    <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm">
                        <History className="w-5 h-5" />
                        <div>
                            <span className="font-bold">Viewing Historical Version.</span>
                            <span className="text-sm ml-2">Job: {displayedData.role} | Date: {new Date(displayedData.date).toLocaleDateString()}</span>
                        </div>
                    </div>
                )}

                {activeTab === 'analysis' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Summary Card */}
                            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Executive Summary</h4>
                                <p className="text-slate-800 text-sm font-medium leading-relaxed">{analysis.summary}</p>
                            </div>

                             {/* Advice Card */}
                            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">HR Verdict</h4>
                                <div className="text-slate-800 text-sm leading-relaxed whitespace-pre-line">{analysis.hrAdvice}</div>
                            </div>

                             {/* SWOT */}
                            <div className="grid grid-cols-2 gap-3">
                                <SwotCard title="Pros" items={analysis.swot.strengths} color="emerald" />
                                <SwotCard title="Cons" items={analysis.swot.weaknesses} color="red" />
                            </div>
                        </div>

                        <div className="lg:col-span-1 space-y-4">
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-64 flex flex-col items-center justify-center">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 w-full text-center">5-Forces Radar</h4>
                                <div className="w-full h-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                            <PolarGrid stroke="#e2e8f0" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                                            <RechartsRadar dataKey="A" stroke="#3b82f6" strokeWidth={2} fill="#3b82f6" fillOpacity={0.2} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Gap Analysis</h4>
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-xs font-bold text-emerald-600 mb-1 flex items-center gap-1"><Check className="w-3 h-3"/> Matching</div>
                                        <ul className="text-xs text-slate-600 list-disc pl-4 space-y-1">{analysis.gapAnalysis.pros.slice(0,3).map((p,i) => <li key={i}>{p}</li>)}</ul>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-red-600 mb-1 flex items-center gap-1"><X className="w-3 h-3"/> Missing</div>
                                        <ul className="text-xs text-slate-600 list-disc pl-4 space-y-1">{analysis.gapAnalysis.cons.slice(0,3).map((p,i) => <li key={i}>{p}</li>)}</ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'experience' && (
                    <div className="max-w-3xl space-y-6 animate-fade-in">
                        {extractedData.workExperience.map((job, idx) => (
                            <div key={idx} className={`bg-white p-5 rounded-lg border ${job.isRelevant !== false ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-bold text-slate-800">{job.title}</h4>
                                        <div className="text-sm text-slate-500 flex items-center gap-2"><Building2 className="w-3 h-3"/> {job.company}</div>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded font-medium ${job.isRelevant !== false ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                                        {job.duration}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{job.description}</p>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'info' && (
                    <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Candidate Basic Info</h3>
                            <span className="text-xs text-slate-400">104 Format</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                            <InfoRow104 label="Full Name (CH)" value={extractedData.name} />
                            <InfoRow104 label="English Name" value={extractedData.englishName} />
                            <InfoRow104 label="Email" value={candidate.email} isLink />
                            <InfoRow104 label="Mobile" value={info.mobile} />
                            <InfoRow104 label="Age" value={info.age ? `${info.age}` : undefined} />
                            <InfoRow104 label="Gender" value={info.gender} />
                            <InfoRow104 label="Education" value={`${info.school} ${info.major} (${info.highestEducation})`} />
                            <InfoRow104 label="Address" value={info.address} />
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100">
                             <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Code2 className="w-4 h-4 text-blue-500"/> Skills</h4>
                             <div className="flex flex-wrap gap-2">
                                 {extractedData.skills.map(s => <span key={s} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded border border-slate-200">{s}</span>)}
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
      </div>
    </div>
  );
};

export default CandidateDetail;
