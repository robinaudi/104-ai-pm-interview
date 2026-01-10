
import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, FileText, Loader2, AlertCircle, CheckCircle, Briefcase, Image as ImageIcon, Link as LinkIcon, Clipboard, ChevronDown, Camera, ExternalLink, Search, Linkedin, Mail, User as UserIcon, AlertTriangle, ArrowRight, History, Eye, Crop, Star, Zap, Globe } from 'lucide-react';
import { analyzeResume } from '../services/geminiService';
import { extractProfileImageFromPDF, renderPDFPageToDataURL } from '../services/pdfService';
import { Candidate, CandidateStatus, User, JobDescription } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchJobDescriptions } from '../services/supabaseService';
import { DEFAULT_JOBS } from '../constants';

interface ImportModalProps {
  onClose: () => void;
  onImport: (candidate: Candidate) => void;
  onUpdate?: (candidate: Candidate) => void; 
  currentUser: User;
  existingCandidates?: Candidate[];
}

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport, onUpdate, currentUser, existingCandidates = [] }) => {
  const { t, language } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  
  // Job Selection State
  const [availableJobs, setAvailableJobs] = useState<JobDescription[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [extractedPhoto, setExtractedPhoto] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);
  
  // Staging state
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [linkedInUrl, setLinkedInUrl] = useState('');

  // Duplicate Detection State
  const [duplicateCandidate, setDuplicateCandidate] = useState<Candidate | null>(null);

  useEffect(() => {
      const loadJobs = async () => {
          let jobs = await fetchJobDescriptions();
          if (jobs.length === 0) jobs = DEFAULT_JOBS;
          const sortedJobs = jobs.sort((a, b) => (a.priority || 99) - (b.priority || 99));
          setAvailableJobs(sortedJobs);
          
          const pmJob = sortedJobs.find(j => 
              j.title.includes('Project Manager') || 
              j.title.includes('專案經理') || 
              (j.title.includes('PM') && !j.title.includes('TPM'))
          );

          if (pmJob) {
              setSelectedJobId(pmJob.id);
          } else if (sortedJobs.length > 0) {
              setSelectedJobId(sortedJobs[0].id);
          }
      };
      loadJobs();
  }, []);

  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
        if (e.clipboardData && e.clipboardData.files.length > 0) {
            const pastedFile = e.clipboardData.files[0];
            if (pastedFile.type.startsWith('image/')) {
                e.preventDefault();
                e.stopPropagation();
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (ev.target?.result) {
                        setExtractedPhoto(ev.target.result as string);
                        setStatusText('Photo updated from clipboard');
                        setTimeout(() => setStatusText(''), 2000);
                    }
                };
                reader.readAsDataURL(pastedFile);
            }
        }
    };
    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, []);

  const handlePasteImageButton = async () => {
      try {
          const clipboardItems = await navigator.clipboard.read();
          for (const item of clipboardItems) {
              const imageType = item.types.find(type => type.startsWith('image/'));
              if (imageType) {
                  const blob = await item.getType(imageType);
                  const reader = new FileReader();
                  reader.onload = (e) => {
                      if (e.target?.result) {
                          setExtractedPhoto(e.target.result as string);
                          setStatusText('Photo pasted!');
                          setTimeout(() => setStatusText(''), 2000);
                      }
                  };
                  reader.readAsDataURL(blob);
                  return;
              }
          }
          alert("No image found in clipboard.");
      } catch (err) {
          alert("Browser security blocked button paste. Please press Ctrl+V (or Cmd+V) directly!");
      }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);
      setAnalysisResult(null); 
      setDuplicateCandidate(null);
      setPdfPreview(null);
      
      if (!extractedPhoto) setExtractedPhoto(null);

      if (selectedFile.type === 'application/pdf') {
          // Generate PDF Preview
          renderPDFPageToDataURL(selectedFile, 0.6).then(url => {
              if (url) setPdfPreview(url);
          });

          setStatusText('Extracting photo from PDF...');
          try {
              const photoBase64 = await extractProfileImageFromPDF(selectedFile);
              if (photoBase64) {
                  setExtractedPhoto(photoBase64);
                  setStatusText('Photo extracted from PDF');
              } else {
                  setStatusText(''); 
              }
          } catch (e) {
              setStatusText('');
          }
      }
    }
  };

  const handleViewPdf = () => {
      if (file) {
          const url = URL.createObjectURL(file);
          window.open(url, '_blank');
      }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    if (!selectedJobId) { setError("Please select a Target Job Role."); return; }
    const selectedJob = availableJobs.find(j => j.id === selectedJobId);
    if (!selectedJob) return;

    setIsAnalyzing(true);
    setError(null);
    setStatusText(`Identifying format (104/LinkedIn/Teamdoor)...`);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const targetLanguage = language === 'zh' ? 'Traditional Chinese (繁體中文)' : 'English';

        try {
          const analysis = await analyzeResume(base64Data, file.type, selectedJob.title, targetLanguage, selectedJob.content);
          
          setAnalysisResult(analysis);
          setLinkedInUrl(analysis.extractedData.linkedinUrl || '');
          setStatusText('');
          setIsAnalyzing(false);

          // DUPLICATE CHECK
          const extractedEmail = analysis.extractedData.email;
          if (extractedEmail && extractedEmail !== 'Unknown') {
              const match = existingCandidates.find(c => 
                  c.email.toLowerCase() === extractedEmail.toLowerCase() &&
                  !c.isDeleted
              );
              if (match) setDuplicateCandidate(match);
          }

        } catch (err: any) {
          console.error(err);
          setError(err.message || 'AI Analysis failed.');
          setIsAnalyzing(false);
        }
      };
    } catch (err) {
      setError("An unexpected error occurred.");
      setIsAnalyzing(false);
    }
  };

  const handleFinalSave = async () => {
      if (!analysisResult || !file) return;
      setIsSaving(true); 

      const selectedJob = availableJobs.find(j => j.id === selectedJobId);
      analysisResult.extractedData.linkedinUrl = linkedInUrl;
      
      const extractedName = analysisResult.extractedData.name !== 'Unknown' ? analysisResult.extractedData.name : file.name.split('.')[0];
      const extractedEmail = analysisResult.extractedData.email !== 'Unknown' ? analysisResult.extractedData.email : 'unknown@example.com';
      const isUnsolicited = analysisResult.extractedData.isUnsolicited || false;
      
      let finalSource = analysisResult.extractedData.detectedSource;
      if (linkedInUrl && (!finalSource || finalSource === 'Unknown')) finalSource = 'LinkedIn (Verified)';
      if (!finalSource || finalSource === 'Other' || finalSource === 'Unknown') {
         const userName = currentUser.email.split('@')[0];
         finalSource = `Uploaded by ${userName}`;
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      if (duplicateCandidate && onUpdate) {
          const historyEntry = {
              date: duplicateCandidate.updatedAt,
              roleApplied: duplicateCandidate.roleApplied,
              analysis: duplicateCandidate.analysis || analysisResult
          };
          const newVersions = [...(duplicateCandidate.versions || []), historyEntry];
          const updatedCandidate: Candidate = {
              ...duplicateCandidate,
              roleApplied: selectedJob?.title || duplicateCandidate.roleApplied,
              status: CandidateStatus.NEW, 
              updatedAt: new Date().toISOString(),
              analysis: analysisResult,
              versions: newVersions,
              photoUrl: extractedPhoto || duplicateCandidate.photoUrl,
              resumeUrl: URL.createObjectURL(file), 
              uploadedBy: currentUser.email,
              isUnsolicited: isUnsolicited 
          };
          onUpdate(updatedCandidate);
      } else {
          const newCandidate: Candidate = {
            id: crypto.randomUUID(),
            name: extractedName,
            email: extractedEmail,
            roleApplied: selectedJob?.title || 'Unknown Role', 
            source: finalSource, 
            status: CandidateStatus.NEW,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            analysis: analysisResult,
            resumeUrl: URL.createObjectURL(file), 
            uploadedBy: currentUser.email,
            linkedinUrl: linkedInUrl,
            photoUrl: extractedPhoto || undefined,
            versions: [],
            isUnsolicited: isUnsolicited
          };
          onImport(newCandidate);
      }
      setIsSaving(false);
      onClose();
  };

  const getNormalizedScore = (score: number) => score > 10 ? score / 10 : score;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${analysisResult ? 'max-w-4xl' : 'max-w-lg'} overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300`}>
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white flex-shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5" /> 
            {duplicateCandidate ? 'Duplicate Detected - Version Control' : (analysisResult ? 'Review & Confirm' : t('importAnalyze'))}
          </h2>
          <button onClick={onClose} disabled={isAnalyzing || isSaving} className="hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50/50">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {!analysisResult ? (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-blue-600" />
                        {t('targetVacancy')} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <select
                            value={selectedJobId}
                            onChange={(e) => setSelectedJobId(e.target.value)}
                            className="w-full appearance-none border border-blue-200 rounded-md px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium text-slate-900 shadow-sm pr-10"
                        >
                            {availableJobs.map(job => (
                                <option key={job.id} value={job.id}>{job.title}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                <div className="flex gap-4 items-stretch h-56">
                    <div className="flex-1 border-2 border-dashed border-slate-300 rounded-xl bg-white relative flex flex-col justify-center items-center group overflow-hidden transition-all hover:border-blue-400 hover:bg-blue-50/10">
                        <input type="file" id="resume-upload" className="hidden" accept="application/pdf" onChange={handleFileChange} />
                        
                        {file ? (
                            <div className="w-full h-full relative z-10 flex flex-col items-center justify-center p-2">
                                {pdfPreview ? (
                                    <div 
                                        className="relative w-full h-full group/preview cursor-pointer"
                                        onClick={handleViewPdf}
                                        title="Click to open original PDF for screenshot"
                                    >
                                        <img src={pdfPreview} alt="PDF Preview" className="w-full h-full object-contain opacity-100 group-hover/preview:opacity-40 transition-all duration-300" />
                                        <div className="absolute inset-0 bg-slate-900/0 group-hover/preview:bg-slate-900/60 transition-all flex flex-col items-center justify-center backdrop-blur-[1px] opacity-0 group-hover/preview:opacity-100">
                                            <Eye className="w-8 h-8 text-white mb-2" />
                                            <span className="text-white font-bold text-xs text-center px-4 break-all mb-4">
                                                Open PDF to Capture Photo
                                            </span>
                                            
                                            <label 
                                                htmlFor="resume-upload" 
                                                className="bg-white text-slate-900 text-[10px] px-3 py-1.5 rounded-full font-bold cursor-pointer hover:bg-blue-50 transition-colors shadow-lg"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Change File
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <FileText className="w-10 h-10 text-blue-600" />
                                        <span className="text-sm font-bold text-slate-800 truncate max-w-[150px]">{file.name}</span>
                                        <label htmlFor="resume-upload" className="mt-2 text-xs text-blue-600 underline cursor-pointer">Change File</label>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <label htmlFor="resume-upload" className="cursor-pointer flex flex-col items-center gap-2 w-full h-full justify-center py-4 transition-colors">
                                <div className="bg-slate-100 p-4 rounded-full group-hover:bg-blue-100 transition-colors">
                                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                </div>
                                <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{t('uploadText')}</span>
                                <div className="flex gap-2 mt-2 opacity-60 grayscale group-hover:grayscale-0 transition-all">
                                    <img src="https://www.104.com.tw/favicon.ico" className="w-4 h-4" title="104 Corp"/>
                                    <Linkedin className="w-4 h-4 text-[#0a66c2]" />
                                    <span title="Teamdoor">
                                      <Briefcase className="w-4 h-4 text-[#00b0ff]" />
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1">Supports: 104, LinkedIn, Teamdoor, CakeResume</span>
                            </label>
                        )}
                    </div>
                    
                    <div className="w-32 flex flex-col gap-2">
                        <div className="flex-1 bg-white rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden relative group">
                            {extractedPhoto ? (
                                <>
                                    <img src={extractedPhoto} className="w-full h-full object-cover" />
                                    <button onClick={() => setExtractedPhoto(null)} className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X className="w-5 h-5 text-white" />
                                    </button>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-slate-300 gap-1"><ImageIcon className="w-6 h-6" /><span className="text-[9px]">No Photo</span></div>
                            )}
                        </div>
                        <button onClick={handlePasteImageButton} className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"><Clipboard className="w-3 h-3" /> Paste Photo</button>
                    </div>
                </div>

                {statusText && (
                    <div className="text-xs text-blue-600 font-medium flex items-center gap-2 animate-pulse bg-blue-50 p-2 rounded border border-blue-100">
                        <Loader2 className="w-3 h-3 animate-spin" /> {statusText}
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button onClick={onClose} disabled={isAnalyzing} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50">{t('cancel')}</button>
                    <button 
                        onClick={handleAnalyze} 
                        disabled={!file || isAnalyzing} 
                        className={`flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2 transition-all ${!file || isAnalyzing ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg'}`}
                    >
                        {isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('analyzing')}</> : <><CheckCircle className="w-4 h-4" /> {t('startAnalysis')}</>}
                    </button>
                </div>
              </div>
          ) : (
              /* PHASE 2: REVIEW OR DUPLICATE RESOLUTION */
              <div className="animate-fade-in flex flex-col gap-6">
                  
                  {/* DUPLICATE WARNING */}
                  {duplicateCandidate && (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
                          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                              <h3 className="text-sm font-bold text-amber-800">Duplicate Candidate Detected</h3>
                              <p className="text-xs text-amber-700 mt-1">
                                  <b>{duplicateCandidate.name}</b> ({duplicateCandidate.email}) already exists in your database.
                                  <br/>You are about to update their profile. The existing data will be archived as a <b>historical version</b>.
                              </p>
                          </div>
                      </div>
                  )}
                  
                  {/* ACTIVE APPLICANT NOTICE */}
                  {analysisResult.extractedData.isUnsolicited && (
                       <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg flex items-center gap-3">
                           <div className="bg-indigo-600 text-white p-1 rounded-full">
                               <Zap className="w-4 h-4" />
                           </div>
                           <div>
                               <h3 className="text-sm font-bold text-indigo-800">Active Applicant Detected</h3>
                               <p className="text-xs text-indigo-600">The AI detected "Active Application" keywords in this resume.</p>
                           </div>
                       </div>
                  )}

                  {/* COMPARISON VIEW */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* OLD DATA (If Duplicate) */}
                      {duplicateCandidate ? (
                          <div className="bg-slate-100 rounded-xl p-5 border border-slate-200 opacity-80 relative">
                               <div className="absolute top-3 right-3 bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                  <History className="w-3 h-3" /> Current Version
                               </div>
                               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-200 pb-2">Existing Data</h4>
                               
                               <div className="space-y-4">
                                   <div className="flex items-center gap-3">
                                       <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden">
                                           {duplicateCandidate.photoUrl ? <img src={duplicateCandidate.photoUrl} className="w-full h-full object-cover"/> : <UserIcon className="w-full h-full p-2 text-slate-400"/>}
                                       </div>
                                       <div>
                                           <div className="font-bold text-slate-800">{duplicateCandidate.name}</div>
                                           <div className="text-xs text-slate-500">{duplicateCandidate.roleApplied}</div>
                                       </div>
                                   </div>
                                   
                                   <div>
                                       <div className="text-[10px] font-bold text-slate-400">SCORE</div>
                                       <div className="text-xl font-bold text-slate-600">{getNormalizedScore(duplicateCandidate.analysis?.matchScore || 0).toFixed(1)} <span className="text-sm text-slate-400 font-normal">/ 10</span></div>
                                   </div>

                                   <div>
                                       <div className="text-[10px] font-bold text-slate-400">LAST UPDATED</div>
                                       <div className="text-sm text-slate-600">{new Date(duplicateCandidate.updatedAt).toLocaleDateString()}</div>
                                   </div>
                               </div>
                          </div>
                      ) : null}

                      {/* NEW DATA */}
                      <div className={`bg-white rounded-xl p-5 border shadow-md relative ${duplicateCandidate ? 'border-blue-500 ring-2 ring-blue-50' : 'border-slate-200 col-span-2'}`}>
                           <div className="flex justify-between items-start mb-3 border-b border-slate-200 pb-2">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    {duplicateCandidate ? 'Incoming Data' : 'Candidate Preview'}
                                </h4>
                                {file && (
                                    <button 
                                        onClick={handleViewPdf}
                                        className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded transition-colors"
                                    >
                                        <Eye className="w-3 h-3" /> View PDF
                                    </button>
                                )}
                           </div>

                           <div className="space-y-4">
                               <div className="flex items-center gap-3">
                                   <div className="relative group/avatar cursor-pointer" onClick={handlePasteImageButton} title="Click to Paste Photo (Ctrl+V)">
                                       <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                                           <img src={extractedPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(analysisResult.extractedData.name)}`} className="w-full h-full object-cover"/>
                                       </div>
                                       <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                                           <Clipboard className="w-4 h-4 text-white" />
                                       </div>
                                   </div>
                                   <div>
                                       <div className="font-bold text-slate-900">{analysisResult.extractedData.name}</div>
                                       <div className="text-xs text-blue-600 font-bold">{availableJobs.find(j => j.id === selectedJobId)?.title}</div>
                                       <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                           Detected from: <span className="font-bold text-slate-600">{analysisResult.extractedData.detectedSource}</span>
                                       </div>
                                   </div>
                               </div>

                               <div>
                                   <div className="text-[10px] font-bold text-slate-400">NEW SCORE</div>
                                   <div className="flex items-baseline gap-2">
                                        <div className={`text-2xl font-bold ${getNormalizedScore(analysisResult.matchScore) >= 8 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                            {getNormalizedScore(analysisResult.matchScore).toFixed(1)}
                                        </div>
                                        <span className="text-sm text-slate-400">/ 10</span>
                                   </div>
                               </div>

                               <div>
                                   <div className="text-[10px] font-bold text-slate-400 mb-1">SUMMARY</div>
                                   <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">
                                       {analysisResult.summary}
                                   </p>
                               </div>
                               
                               {/* LinkedIn Input for New Data */}
                               <div className="pt-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Linkedin className="w-3 h-3 text-blue-600" /> 
                                        LinkedIn (Verify)
                                    </label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={linkedInUrl} 
                                            onChange={(e) => setLinkedInUrl(e.target.value)}
                                            placeholder="https://linkedin.com/in/..." 
                                            className="w-full border border-blue-200 p-2 rounded text-xs bg-blue-50/30 focus:ring-2 focus:ring-blue-500 outline-none" 
                                        />
                                        {linkedInUrl && (
                                            <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border border-slate-200">
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                           </div>
                      </div>
                  </div>
                  
                  {/* ACTIONS */}
                  <div className="flex gap-3 pt-2">
                      <button onClick={() => { setAnalysisResult(null); setDuplicateCandidate(null); }} disabled={isSaving} className="px-6 py-3 border border-slate-300 rounded-lg text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors">
                          Back
                      </button>
                      <button 
                        onClick={handleFinalSave} 
                        disabled={isSaving}
                        className={`flex-1 px-4 py-3 rounded-lg text-white text-sm font-bold shadow-lg flex items-center justify-center gap-2 transform transition-all
                            ${isSaving ? 'bg-slate-400 scale-95 cursor-wait' : (duplicateCandidate ? 'bg-amber-600 hover:bg-amber-700 hover:translate-y-[-1px]' : 'bg-slate-900 hover:bg-slate-800 hover:translate-y-[-1px]')}`}
                      >
                          {isSaving ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                              </>
                          ) : (
                              duplicateCandidate ? (
                                  <>
                                    <History className="w-4 h-4" />
                                    Update & Archive Old Version
                                  </>
                              ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4" /> 
                                    Confirm & Save
                                  </>
                              )
                          )}
                      </button>
                  </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
