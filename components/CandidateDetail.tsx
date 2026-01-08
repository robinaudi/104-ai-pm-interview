
import React, { useState, useEffect, useMemo } from 'react';
import { Candidate, User, JobDescription, AnalysisResult, ScoreAdjustment, ScoringStandard } from '../types';
import { X, Brain, Briefcase, Link as LinkIcon, Building2, User as UserIcon, FileText, Code2, Linkedin, History, ArrowRightLeft, Edit2, Save, Calculator, Sparkles, MessageCircleQuestion, AlertCircle, ChevronDown, Check, Loader2, MousePointerClick, Contact } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Radar as RechartsRadar, Tooltip } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { isSupabaseConfigured, fetchJobDescriptions, updateCandidate, fetchScoringStandards } from '../services/supabaseService';
import { reEvaluateCandidate, explainScoring } from '../services/geminiService';

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

// --- Custom Tooltip for Radar ---
const CustomRadarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="bg-slate-800 text-white text-xs p-2 rounded shadow-xl border border-slate-700 z-50">
        <p className="font-bold mb-1">{dataPoint.fullSubject || label}</p>
        <p className="text-emerald-400 font-mono">Score: {payload[0].value} / 10</p>
      </div>
    );
  }
  return null;
};

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
  const [scoringStandards, setScoringStandards] = useState<ScoringStandard[]>([]);
  
  // Job Switching State
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  // Editing State
  const [editingDimension, setEditingDimension] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(0);
  const [editReason, setEditReason] = useState<string>('');

  // AI Explanation State
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
        const [jobs, standards] = await Promise.all([
            fetchJobDescriptions(),
            fetchScoringStandards()
        ]);
        setAvailableJobs(jobs);
        setScoringStandards(standards);
        
        // Find matching job ID based on candidate role title
        const currentJob = jobs.find(j => j.title === candidate.roleApplied);
        if (currentJob) {
            setSelectedJobId(currentJob.id);
        }
    };
    loadData();
  }, [candidate.roleApplied]);

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
  
  const normalizeScore = (val: number | undefined) => {
      if (typeof val !== 'number') return 0;
      return val > 10 ? val / 10 : val;
  };
  
  const finalMatchScore = normalizeScore(analysis.matchScore);

  // --- MERGE V3/V4 DIMENSIONS LOGIC ---
  const mergedDimensions = useMemo(() => {
      // 1. Prefer Detailed Array if available (V3.1+)
      if (analysis.dimensionDetails && analysis.dimensionDetails.length > 0) {
          const map: Record<string, number> = {};
          analysis.dimensionDetails.forEach(d => map[d.dimension] = d.score);
          return map;
      }

      // 2. Fallback to Simple Map
      if (analysis.scoringDimensions) {
          return analysis.scoringDimensions;
      }

      return {};
  }, [analysis]);

  // DYNAMIC RADAR DATA
  const radarData = useMemo(() => {
      return Object.entries(mergedDimensions).map(([key, value]) => {
          // Intelligent Truncation
          let shortSubject = key;
          if (key.length > 10) {
              if (key.match(/^\([A-E]\)/)) {
                  shortSubject = key.substring(0, 10) + '...';
              } else {
                  shortSubject = key.substring(0, 8) + '...';
              }
          }

          return {
              subject: shortSubject,
              fullSubject: key,
              A: normalizeScore(value as number),
              fullMark: 10
          };
      });
  }, [mergedDimensions]);

  // --- ACTIONS ---

  const handleRoleChangeAndRescore = async () => {
      const newJob = availableJobs.find(j => j.id === selectedJobId);
      if (!newJob) return;
      if (!confirm(`Confirm change role to "${newJob.title}" and Re-Analyze?\nThis will overwrite the current analysis.`)) return;

      setIsReScoring(true);
      try {
          const targetLang = language === 'zh' ? 'Traditional Chinese' : 'English';
          const newAnalysis = await reEvaluateCandidate(candidate, newJob.content, targetLang);
          
          const historyEntry = {
              date: candidate.updatedAt,
              roleApplied: candidate.roleApplied,
              analysis: candidate.analysis!
          };
          const newVersions = [...(candidate.versions || []), historyEntry];

          const updatedCandidate = { 
              ...candidate, 
              roleApplied: newJob.title, 
              analysis: newAnalysis, 
              versions: newVersions,
              updatedAt: new Date().toISOString()
          };

          if (onUpdate) onUpdate(updatedCandidate);

          if (isSupabaseConfigured()) {
              await updateCandidate(updatedCandidate);
          }
          alert(`Role updated to ${newJob.title} and re-scored successfully.`);
          setSelectedVersionDate('latest');

      } catch (e) {
          console.error("Role switch re-score failed", e);
          alert("Failed to re-score.");
      } finally {
          setIsReScoring(false);
      }
  };

  const handleExplainScore = async () => {
      if (explanation) { setExplanation(null); return; } // Toggle off
      
      // Check if we have a pre-stored explanation
      if (analysis.scoringExplanation) {
          setExplanation(analysis.scoringExplanation);
          return;
      }

      setIsExplaining(true);
      try {
          const job = availableJobs.find(j => j.id === selectedJobId) || { content: candidate.roleApplied };
          const result = await explainScoring(candidate, job.content);
          setExplanation(result);
      } catch (e) {
          console.error(e);
          setExplanation("Failed to generate explanation. Check API Key.");
      } finally {
          setIsExplaining(false);
      }
  };

  const handleSaveScoreEdit = async () => {
      if (!editingDimension || !currentUser) return;
      if (!editReason.trim()) { alert("Please provide a reason for the adjustment."); return; }

      const oldScore = mergedDimensions[editingDimension];
      const newDimensions = { ...mergedDimensions, [editingDimension]: editScore };
      
      // Update logic for V3.1 Array structure
      let newDetails = analysis.dimensionDetails ? [...analysis.dimensionDetails] : [];
      const detailIndex = newDetails.findIndex(d => d.dimension === editingDimension);
      
      if (detailIndex >= 0) {
          newDetails[detailIndex] = { ...newDetails[detailIndex], score: editScore, reasoning: editReason };
      } else {
          // Add new if missing
          newDetails.push({ dimension: editingDimension, score: editScore, weight: '', reasoning: editReason });
      }

      // Create Audit Log
      const adjustment: ScoreAdjustment = {
          dimension: editingDimension,
          oldScore: oldScore,
          newScore: editScore,
          reason: editReason,
          adjustedBy: currentUser.email,
          adjustedAt: new Date().toISOString()
      };

      const updatedAnalysis = {
          ...analysis,
          scoringDimensions: newDimensions, // Keep legacy map sync
          dimensionDetails: newDetails,     // Update new structure
          scoreAdjustments: [adjustment, ...(analysis.scoreAdjustments || [])]
      };

      const updatedCandidate = {
          ...candidate,
          analysis: updatedAnalysis,
          updatedAt: new Date().toISOString()
      };

      if (onUpdate) onUpdate(updatedCandidate);
      if (isSupabaseConfigured()) await updateCandidate(updatedCandidate);

      setEditingDimension(null);
      setEditReason('');
  };

  const getValidatedLinkedinUrl = () => {
      let url = candidate.linkedinUrl || extractedData.linkedinUrl || extractedData.portfolio?.find(p => p.url?.toLowerCase().includes('linkedin'))?.url;
      if (!url) return null;
      url = url.trim();
      if (!url.toLowerCase().includes('linkedin.com')) {
          if (url.toLowerCase().startsWith('linkedin.com')) url = 'https://www.' + url;
          else return null;
      }
      if (!url.startsWith('http')) url = 'https://' + url;
      return url;
  };

  const validLinkedinUrl = getValidatedLinkedinUrl();
  const hasLinkedin = !!validLinkedinUrl;

  const getAvatarName = () => extractedData.englishName && extractedData.englishName !== 'Unknown' ? extractedData.englishName : extractedData.name;
  const finalAvatarUrl = currentPhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(getAvatarName())}&background=random&color=fff&size=200&bold=true`;

  const info = extractedData.personalInfo || { mobile: 'N/A', gender: 'N/A', age: 'N/A', address: 'N/A', highestEducation: 'N/A', school: 'N/A', major: 'N/A' };
  
  const getScoreColor = (score: number) => {
      if (score >= 8) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      if (score >= 6) return 'text-blue-600 bg-blue-50 border-blue-200';
      return 'text-red-600 bg-red-50 border-red-200';
  };

  const selectedJob = availableJobs.find(j => j.id === selectedJobId);
  const isRoleChanged = selectedJob && selectedJob.title !== candidate.roleApplied;

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
                
                <div className={`mt-3 flex flex-col items-center gap-2`}>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-lg font-bold border ${getScoreColor(finalMatchScore)}`}>
                        <span className="text-xs uppercase mr-2 opacity-70">Score</span>
                        {finalMatchScore.toFixed(1)} <span className="text-xs opacity-50 ml-1">/ 10</span>
                    </div>
                    {/* Explain Button */}
                    <button 
                        onClick={handleExplainScore}
                        disabled={isExplaining}
                        className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 bg-blue-50 px-3 py-2 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
                    >
                        {isExplaining ? <Loader2 className="w-3 h-3 animate-spin"/> : <MessageCircleQuestion className="w-3 h-3"/>}
                        {explanation ? 'Hide Analysis' : 'Why this score?'}
                    </button>
                </div>
            </div>

            {/* --- JOB ROLE SELECTOR & SWITCHER --- */}
            {selectedVersionDate === 'latest' && (
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" /> Target Job Role
                    </label>
                    <div className="relative">
                        <select 
                            value={selectedJobId} 
                            onChange={(e) => setSelectedJobId(e.target.value)}
                            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                        >
                            <option value="" disabled>Select Job Role</option>
                            {availableJobs.map(job => (
                                <option key={job.id} value={job.id}>{job.title}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    
                    {/* Show Button only if role is different */}
                    {isRoleChanged && (
                        <button 
                            onClick={handleRoleChangeAndRescore}
                            disabled={isReScoring}
                            className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 animate-fade-in shadow-md transition-all"
                        >
                            {isReScoring ? <Loader2 className="w-3 h-3 animate-spin"/> : <ArrowRightLeft className="w-3 h-3" />}
                            Switch & Re-Analyze
                        </button>
                    )}
                </div>
            )}

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
                
                {/* VERSION SELECTOR */}
                {candidate.versions && candidate.versions.length > 0 && (
                    <div className="relative pt-2 border-t border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Version History</label>
                        <select 
                            value={selectedVersionDate} 
                            onChange={(e) => setSelectedVersionDate(e.target.value)}
                            className="w-full appearance-none bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium py-1.5 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="latest">Current: {new Date(candidate.updatedAt).toLocaleDateString()}</option>
                            {candidate.versions.slice().reverse().map((v, i) => (
                                <option key={i} value={v.date}>
                                    {new Date(v.date).toLocaleDateString()} - {v.roleApplied}
                                </option>
                            ))}
                        </select>
                        <History className="absolute right-3 bottom-2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
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

                {/* AI Explanation Area */}
                {explanation && (
                    <div className="mb-6 bg-indigo-50 border border-indigo-200 p-6 rounded-xl animate-fade-in shadow-sm relative">
                        <div className="flex items-start gap-3">
                            <Sparkles className="w-6 h-6 text-indigo-500 mt-1 flex-shrink-0" />
                            <div>
                                <h4 className="font-bold text-indigo-900 mb-2">AI Analysis Report ({analysis.modelVersion})</h4>
                                <div className="text-sm text-indigo-800 leading-relaxed whitespace-pre-line">
                                    {explanation}
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setExplanation(null)} className="absolute top-4 right-4 p-1 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-700"><X className="w-4 h-4"/></button>
                    </div>
                )}

                {activeTab === 'analysis' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                        <div className="lg:col-span-2 space-y-6">
                            
                            {/* EVALUATION SNAPSHOT */}
                            {analysis.evaluationSnapshot && (
                                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Contact className="w-3 h-3"/> Evaluation Overview
                                        </h4>
                                        <span className="text-[10px] text-slate-400">Snapshot</span>
                                    </div>
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Candidate / Age</div>
                                            <div className="font-bold text-slate-800">{analysis.evaluationSnapshot.candidateName} / {analysis.evaluationSnapshot.birthInfo}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Applied Role</div>
                                            <div className="font-bold text-blue-600">{analysis.evaluationSnapshot.jobTitle}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Stats / Level</div>
                                            <div className="font-medium text-slate-700">{analysis.evaluationSnapshot.experienceStats}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Key Background</div>
                                            <div className="font-medium text-slate-700">{analysis.evaluationSnapshot.keyBackground}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Summary Card */}
                            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                                <div className="flex justify-between items-center mb-2">
                                     <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Executive Summary</h4>
                                     <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">Model: {analysis.modelVersion || 'Legacy'}</span>
                                </div>
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
                                <SwotCard title="Pros" items={analysis.swot?.strengths || []} color="emerald" />
                                <SwotCard title="Cons" items={analysis.swot?.weaknesses || []} color="red" />
                            </div>
                        </div>

                        <div className="lg:col-span-1 space-y-4">
                            {/* RADAR CHART */}
                            <div 
                                className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-72 flex flex-col items-center justify-center relative cursor-pointer group transition-all hover:shadow-md hover:border-blue-300"
                                onClick={handleExplainScore}
                                title="Click for AI Score Breakdown"
                            >
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 w-full text-center flex items-center justify-center gap-2">
                                    COMPETENCY MATRIX (V4)
                                    <MousePointerClick className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"/>
                                </h4>
                                <div className="w-full h-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                            <PolarGrid gridType="polygon" stroke="#cbd5e1" strokeWidth={1} />
                                            <PolarAngleAxis 
                                                dataKey="subject" 
                                                tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} 
                                            />
                                            {/* Exact 0-10 Scale: tickCount 6 gives 0, 2, 4, 6, 8, 10 */}
                                            <PolarRadiusAxis 
                                                angle={30} 
                                                domain={[0, 10]} 
                                                tickCount={6} 
                                                tick={{ fill: '#94a3b8', fontSize: 10 }} 
                                                axisLine={false}
                                            />
                                            <RechartsRadar 
                                                name="Score" 
                                                dataKey="A" 
                                                stroke="#2563eb" 
                                                strokeWidth={3} 
                                                fill="#3b82f6" 
                                                fillOpacity={0.4} 
                                            />
                                            <Tooltip content={<CustomRadarTooltip />} cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '3 3' }}/>
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="absolute inset-0 bg-blue-50/0 group-hover:bg-blue-50/5 transition-colors rounded-lg pointer-events-none"></div>
                            </div>
                            
                            {/* SCORING BREAKDOWN - ENHANCED V4 */}
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex justify-between items-center">
                                    Detailed Scoring
                                    <span className="text-[9px] bg-slate-100 px-1 rounded flex items-center gap-1"><Edit2 className="w-2 h-2"/> Click to Edit</span>
                                </h4>
                                <div className="space-y-3">
                                    {/* Prefer dimensionDetails array if available, otherwise map keys */}
                                    {(analysis.dimensionDetails && analysis.dimensionDetails.length > 0 ? analysis.dimensionDetails : Object.entries(mergedDimensions).map(([k,v]) => ({dimension: k, score: v, weight: '', reasoning: ''}))).map((item, idx) => {
                                        const isEditing = editingDimension === item.dimension;
                                        return (
                                        <div key={idx} className={`text-xs p-3 rounded border transition-colors ${isEditing ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <div>
                                                    <span className="text-slate-700 font-bold block">{item.dimension}</span>
                                                    {item.weight && <span className="text-[10px] text-slate-400 bg-white px-1 rounded border border-slate-100 inline-block mt-0.5">Weight: {item.weight}</span>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-bold ${item.score >= 8 ? 'text-emerald-600' : item.score < 6 ? 'text-red-500' : 'text-blue-600'}`}>
                                                        {item.score.toFixed(1)}
                                                    </span>
                                                    {selectedVersionDate === 'latest' && !isEditing && (
                                                        <button onClick={() => { setEditingDimension(item.dimension); setEditScore(item.score); setEditReason(item.reasoning || ''); }} className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600">
                                                            <Edit2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Reasoning Text */}
                                            {item.reasoning && !isEditing && (
                                                <div className="mt-1 text-slate-600 leading-relaxed pl-2 border-l-2 border-slate-300 italic opacity-90">
                                                    {item.reasoning}
                                                </div>
                                            )}
                                            
                                            {/* Inline Editor */}
                                            {isEditing && (
                                                <div className="mt-2 pt-2 border-t border-blue-200 animate-fade-in">
                                                    <div className="flex gap-2 items-center mb-2">
                                                        <input 
                                                            type="number" 
                                                            min="0" max="10" step="0.1" 
                                                            value={editScore} 
                                                            onChange={(e) => setEditScore(parseFloat(e.target.value))}
                                                            className="w-16 border rounded p-1 text-center font-bold"
                                                        />
                                                        <input 
                                                            type="text" 
                                                            placeholder="Reason (Required)" 
                                                            value={editReason}
                                                            onChange={(e) => setEditReason(e.target.value)}
                                                            className="flex-1 border rounded p-1 px-2 text-xs"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => setEditingDimension(null)} className="text-[10px] text-slate-500 hover:underline">Cancel</button>
                                                        <button onClick={handleSaveScoreEdit} className="bg-blue-600 text-white px-3 py-1 rounded text-[10px] font-bold hover:bg-blue-700">Save</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )})}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'experience' && (
                    <div className="max-w-3xl space-y-6 animate-fade-in">
                        {extractedData.workExperience?.map((job, idx) => (
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
                                 {extractedData.skills?.map(s => <span key={s} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded border border-slate-200">{s}</span>)}
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
