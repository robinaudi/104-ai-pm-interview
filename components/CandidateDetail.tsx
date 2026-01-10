
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Candidate, User, JobDescription, AnalysisResult, ScoreAdjustment, ScoringStandard, DetectedAttachment } from '../types';
import { X, Brain, Briefcase, Link as LinkIcon, Building2, User as UserIcon, FileText, Code2, Linkedin, History, ArrowRightLeft, Edit2, Save, Calculator, Sparkles, MessageCircleQuestion, AlertCircle, ChevronDown, Check, Loader2, MousePointerClick, Contact, RefreshCw, Paperclip, Upload, Eye, ExternalLink, Globe, File, Plus } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Radar as RechartsRadar, Tooltip } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { isSupabaseConfigured, fetchJobDescriptions, updateCandidate, fetchScoringStandards } from '../services/supabaseService';
import { reEvaluateCandidate, explainScoring } from '../services/geminiService';
import { APP_VERSION } from '../constants';

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

// --- Processing Overlay Component ---
const ProcessingOverlay = ({ status }: { status: string }) => (
    <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-fade-in rounded-xl">
        <div className="relative mb-6">
            <div className="w-20 h-20 border-4 border-slate-100 rounded-full"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <Brain className="w-8 h-8 text-blue-600 animate-pulse"/>
            </div>
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">AI Processing</h3>
        <p className="text-sm text-slate-500 font-medium animate-pulse">{status}</p>
        
        {/* Fake Progress Steps */}
        <div className="mt-8 flex gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{animationDelay: '0ms'}}></div>
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{animationDelay: '150ms'}}></div>
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{animationDelay: '300ms'}}></div>
        </div>
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
  const [activeTab, setActiveTab] = useState<'analysis' | 'experience' | 'info' | 'sources'>('analysis'); 
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(candidate.photoUrl);
  
  // Versioning State
  const [selectedVersionDate, setSelectedVersionDate] = useState<string>('latest');
  
  const [isReScoring, setIsReScoring] = useState(false);
  const [reScoreStatus, setReScoreStatus] = useState('Initializing...'); // For the overlay
  
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

  // Attachments State
  const [detectedItems, setDetectedItems] = useState<DetectedAttachment[]>([]);

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
  
  // Update Detected items when analysis changes
  useEffect(() => {
      if (analysis?.extractedData?.detectedAttachments) {
          const aiDetected = analysis.extractedData.detectedAttachments.map((item: any) => ({
              ...item,
              id: item.id || crypto.randomUUID(), // Ensure ID
              isLinked: !!item.fileUrl
          }));
          const merged = [...aiDetected, ...(candidate.extraAttachments || [])];
          setDetectedItems(merged);
      }
  }, [analysis, candidate.extraAttachments]);

  if (!analysis) return null;
  const { extractedData } = analysis;
  
  const normalizeScore = (val: number | undefined) => {
      if (typeof val !== 'number') return 0;
      return val > 10 ? val / 10 : val;
  };
  
  const finalMatchScore = normalizeScore(analysis.matchScore);

  // --- STRICT V4 DIMENSIONS LOGIC ---
  const V4_AXES = [
      { prefix: '(A)', label: '(A) 產業相關性', defaultWeight: '30%' },
      { prefix: '(B)', label: '(B) 系統導入經驗', defaultWeight: '20%' },
      { prefix: '(C)', label: '(C) 專案管理經驗', defaultWeight: '20%' },
      { prefix: '(D)', label: '(D) 技術量化成效', defaultWeight: '20%' },
      { prefix: '(E)', label: '(E) 未來就緒度', defaultWeight: '10%' }
  ];

  const processedDimensions = useMemo(() => {
      const detailsArray = analysis.dimensionDetails || [];
      const dimensionsMap = analysis.scoringDimensions || {};

      const findData = (prefix: string) => {
          const inArray = detailsArray.find(d => d.dimension.startsWith(prefix));
          if (inArray) return { score: inArray.score, reason: inArray.reasoning, weight: inArray.weight };
          const keyInMap = Object.keys(dimensionsMap).find(k => k.startsWith(prefix));
          if (keyInMap) return { score: dimensionsMap[keyInMap], reason: '', weight: '' };
          return null;
      };

      return V4_AXES.map(axis => {
          const data = findData(axis.prefix);
          return {
              dimension: axis.label,
              score: data ? normalizeScore(data.score) : 0, 
              reasoning: data?.reason || (analysis.modelVersion?.includes('v4') ? 'No data' : 'Legacy Data - Re-score required'),
              weight: data?.weight || axis.defaultWeight
          };
      });
  }, [analysis]);

  const radarData = useMemo(() => {
      return processedDimensions.map(d => {
          let shortSubject = d.dimension;
          if (d.dimension.length > 10) {
              if (d.dimension.match(/^\([A-E]\)/)) {
                  shortSubject = d.dimension.substring(0, 10) + '..';
              } else {
                  shortSubject = d.dimension.substring(0, 8) + '..';
              }
          }
          return {
              subject: shortSubject,
              fullSubject: d.dimension,
              A: d.score,
              fullMark: 10
          };
      });
  }, [processedDimensions]);

  // --- ACTIONS ---

  const handleForceRescore = async () => {
      const currentJob = availableJobs.find(j => j.id === selectedJobId) || { content: candidate.roleApplied };
      
      // REMOVED: Native confirm to provide instant feedback via UI
      setIsReScoring(true);
      setReScoreStatus('Initializing AI Model...');
      
      try {
          const targetLang = language === 'zh' ? 'Traditional Chinese' : 'English';
          
          // Simulate progress steps for UX
          setTimeout(() => setReScoreStatus('Analyzing Resume Content...'), 1000);
          setTimeout(() => setReScoreStatus(`Applying ${APP_VERSION} Scoring Logic...`), 2500);
          setTimeout(() => setReScoreStatus('Checking Industry Penalties...'), 4000);
          
          const newAnalysis = await reEvaluateCandidate(candidate, currentJob.content, targetLang);
          
          setReScoreStatus('Finalizing & Saving...');
          
          const updatedCandidate = { 
              ...candidate, 
              analysis: newAnalysis, 
              updatedAt: new Date().toISOString()
          };

          if (onUpdate) onUpdate(updatedCandidate);
          if (isSupabaseConfigured()) await updateCandidate(updatedCandidate);
          
          // Keep success message briefly
          setReScoreStatus('Success!');
          await new Promise(r => setTimeout(r, 800));

      } catch (e) {
          console.error("Force Re-score failed", e);
          alert("Failed to re-score. Please check your connection.");
      } finally {
          setIsReScoring(false);
      }
  };

  const handleRoleChangeAndRescore = async () => {
      const newJob = availableJobs.find(j => j.id === selectedJobId);
      if (!newJob) return;
      
      // REMOVED: Native confirm
      setIsReScoring(true);
      setReScoreStatus(`Switching Role to ${newJob.title}...`);

      try {
          const targetLang = language === 'zh' ? 'Traditional Chinese' : 'English';
          setTimeout(() => setReScoreStatus('Re-Evaluating against new JD...'), 1500);

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
          if (isSupabaseConfigured()) await updateCandidate(updatedCandidate);
          
          setReScoreStatus('Role Updated Successfully!');
          await new Promise(r => setTimeout(r, 800));
          setSelectedVersionDate('latest');

      } catch (e) {
          console.error("Role switch re-score failed", e);
          alert("Failed to re-score.");
      } finally {
          setIsReScoring(false);
      }
  };

  const handleExplainScore = async () => {
      if (explanation) { setExplanation(null); return; }
      if (analysis.scoringExplanation) { setExplanation(analysis.scoringExplanation); return; }

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

      let newDetails = analysis.dimensionDetails ? [...analysis.dimensionDetails] : [];
      const existingIdx = newDetails.findIndex(d => d.dimension === editingDimension);
      if (existingIdx >= 0) {
          newDetails[existingIdx] = { ...newDetails[existingIdx], score: editScore, reasoning: editReason };
      } else {
          newDetails.push({ dimension: editingDimension, score: editScore, weight: '', reasoning: editReason });
      }

      const newMap = { ...(analysis.scoringDimensions || {}) };
      newMap[editingDimension] = editScore;

      const adjustment: ScoreAdjustment = {
          dimension: editingDimension,
          oldScore: processedDimensions.find(d => d.dimension === editingDimension)?.score || 0,
          newScore: editScore,
          reason: editReason,
          adjustedBy: currentUser.email,
          adjustedAt: new Date().toISOString()
      };

      const updatedAnalysis = {
          ...analysis,
          scoringDimensions: newMap,
          dimensionDetails: newDetails,
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

  // --- ATTACHMENT HANDLING ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, itemId?: string) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const fileUrl = URL.createObjectURL(file); // Temporary blob URL for now
          
          if (itemId) {
              setDetectedItems(prev => prev.map(item => item.id === itemId ? { ...item, fileUrl, isLinked: true } : item));
          } else {
              const newItem: DetectedAttachment = {
                  id: crypto.randomUUID(),
                  name: file.name,
                  type: 'file_ref',
                  context: 'User Upload',
                  fileUrl,
                  isLinked: true
              };
              setDetectedItems(prev => [...prev, newItem]);
          }
          
          if (onUpdate) {
              const updatedExtra = [...(candidate.extraAttachments || []), { id: itemId || crypto.randomUUID(), name: file.name, type: 'file_ref', context: 'User Upload', fileUrl, isLinked: true } as DetectedAttachment];
              onUpdate({...candidate, extraAttachments: updatedExtra});
          }
      }
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
        
        {/* NEW: BLOCKING OVERLAY FOR RE-SCORE */}
        {isReScoring && <ProcessingOverlay status={reScoreStatus} />}

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

                    {selectedVersionDate === 'latest' && (
                        <button 
                            onClick={handleForceRescore}
                            disabled={isReScoring}
                            className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md mt-1 mb-1 border border-slate-700 hover:scale-[1.02]"
                        >
                            {isReScoring ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>}
                            {isReScoring ? 'Processing...' : `Re-Score (${APP_VERSION})`}
                        </button>
                    )}

                    <button 
                        onClick={handleExplainScore}
                        disabled={isExplaining}
                        className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 bg-blue-50 px-3 py-2 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors w-full justify-center"
                    >
                        {isExplaining ? <Loader2 className="w-3 h-3 animate-spin"/> : <MessageCircleQuestion className="w-3 h-3"/>}
                        {explanation ? 'Hide Analysis' : 'Why this score?'}
                    </button>
                </div>
            </div>

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
                    {isRoleChanged && (
                        <button 
                            onClick={handleRoleChangeAndRescore}
                            disabled={isReScoring}
                            className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 animate-fade-in shadow-md transition-all hover:scale-[1.02]"
                        >
                            {isReScoring ? <Loader2 className="w-3 h-3 animate-spin"/> : <ArrowRightLeft className="w-3 h-3" />}
                            Switch & Re-Analyze
                        </button>
                    )}
                </div>
            )}

            <div className="space-y-3">
                {/* ... (Rest of sidebar unchanged) */}
                {hasLinkedin ? (
                    <a 
                        href={validLinkedinUrl!} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-[#0a66c2] hover:bg-[#004182] text-white py-2.5 rounded-lg font-medium transition-colors shadow-sm"
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
                    <button onClick={() => setActiveTab('sources')} className={`pb-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sources' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <Paperclip className="w-4 h-4" /> Sources ({detectedItems.length + 1})
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
                                    {processedDimensions.map((item, idx) => {
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
                                            {item.reasoning && !isEditing && (
                                                <div className="mt-1 text-slate-600 leading-relaxed pl-2 border-l-2 border-slate-300 italic opacity-90">
                                                    {item.reasoning}
                                                </div>
                                            )}
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

                {/* SOURCES & ATTACHMENTS TAB (NEW) */}
                {activeTab === 'sources' && (
                    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
                        {/* 1. PRIMARY SOURCE */}
                        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-500"/> Primary Resume / Source File
                            </h3>
                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-red-100 rounded text-red-600"><FileText className="w-6 h-6"/></div>
                                    <div>
                                        <div className="font-bold text-slate-800">Original Resume (PDF)</div>
                                        <div className="text-xs text-slate-500">Source: {candidate.source} | Uploaded: {new Date(candidate.createdAt).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                {candidate.resumeUrl && (
                                    <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded text-sm font-bold text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-sm">
                                        <Eye className="w-4 h-4"/> Preview
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* 2. SMART SOURCE NEXUS */}
                        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <LinkIcon className="w-4 h-4 text-emerald-500"/> Smart Source Nexus
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">AI detected the following attachments or links in the resume. Upload files to link them.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {detectedItems.length === 0 && (
                                    <div className="col-span-2 text-center p-8 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                                        No additional attachments detected in the resume text.
                                        <br/>You can manually add files below.
                                    </div>
                                )}

                                {detectedItems.map((item) => (
                                    <div key={item.id} className={`p-4 rounded-lg border transition-all relative group ${item.isLinked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 border-dashed hover:border-blue-300'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                {item.type === 'url_ref' ? <Globe className="w-4 h-4 text-blue-500"/> : <Paperclip className="w-4 h-4 text-slate-400"/>}
                                                <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                                            </div>
                                            <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-100 text-slate-400">{item.context || 'Detected'}</span>
                                        </div>
                                        
                                        {/* Content Area */}
                                        <div className="mt-3">
                                            {item.isLinked ? (
                                                <div className="flex gap-2">
                                                    {item.url ? (
                                                        <a href={item.url} target="_blank" rel="noreferrer" className="flex-1 text-center py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-1">
                                                            <ExternalLink className="w-3 h-3"/> Open Link
                                                        </a>
                                                    ) : (
                                                        <a href={item.fileUrl} target="_blank" rel="noreferrer" className="flex-1 text-center py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 flex items-center justify-center gap-1">
                                                            <Eye className="w-3 h-3"/> View File
                                                        </a>
                                                    )}
                                                </div>
                                            ) : (
                                                <label className="flex flex-col items-center justify-center w-full h-20 border border-slate-200 bg-slate-50 rounded cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors">
                                                    <Upload className="w-4 h-4 text-slate-400 mb-1"/>
                                                    <span className="text-[10px] text-slate-500 font-medium">Upload to Link</span>
                                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, item.id)} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Add Manual Attachment Block */}
                                <div className="p-4 rounded-lg border border-slate-200 border-dashed bg-slate-50/50 flex flex-col justify-center items-center gap-2 hover:bg-slate-50 transition-colors">
                                    <label className="cursor-pointer flex flex-col items-center gap-2 w-full h-full justify-center">
                                        <div className="p-2 bg-white rounded-full shadow-sm">
                                            <Plus className="w-4 h-4 text-slate-400"/>
                                        </div>
                                        <span className="text-xs text-slate-500 font-bold">Add Manual File</span>
                                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e)} />
                                    </label>
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
