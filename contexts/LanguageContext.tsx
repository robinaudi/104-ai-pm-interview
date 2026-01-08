
import React, { createContext, useState, useContext, ReactNode } from 'react';

type Language = 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    dashboard: 'Talent Intelligence',
    candidates: 'Talent Pool',
    admin: 'Admin',
    connectDb: 'Connect DB',
    dbConnected: 'DB Connected',
    overview: 'Talent Intelligence',
    candidateManagement: 'Candidate Management',
    overviewDesc: 'AI-driven insights on candidate quality and pipeline health.',
    managementDesc: 'Manage and analyze incoming applications.',
    newCandidate: 'New Candidate',
    totalCandidates: 'Total Candidates',
    inInterview: 'In Interview',
    hired: 'Hired',
    avgCompetency: 'Avg Skills Match',
    pipelineStatus: 'Pipeline Status',
    sourcingChannels: 'Source Efficiency',
    filterAll: 'All',
    candidate: 'Candidate',
    appliedRole: 'Applied Role',
    source: 'Source',
    status: 'Status',
    aiScore: 'AI Score',
    actions: 'Actions',
    uploadedInfo: 'Upload Info', 
    noCandidates: 'No candidates found in this category.',
    importAnalyze: 'Import & Analyze Resume',
    targetVacancy: 'Target Vacancy / Job Role',
    aiAutoDetect: 'AI Auto-Detection',
    aiDetectDesc: 'Candidate Name, Email, and Source (LinkedIn/104/Teamdoor) will be automatically extracted.',
    uploadText: 'Click to upload PDF Resume',
    supportedFormat: 'Supported: PDF (Max 5MB)',
    cancel: 'Cancel',
    analyzing: 'Analyzing...',
    startAnalysis: 'Start AI Analysis',
    fiveForces: 'Five Forces Analysis',
    resumeSummary: 'Resume Summary',
    swotAnalysis: 'SWOT Analysis',
    strengths: 'Strengths',
    weaknesses: 'Weaknesses',
    opportunities: 'Opportunities',
    threats: 'Threats',
    hrAdvice: 'HR Professional Recommendation',
    interviewQuestions: 'Suggested Interview Questions',
    chatTitle: 'HR Assistant AI',
    chatPlaceholder: 'Ask for interview advice...',
    chatIntro: 'Hello! I am your HR Assistant. Ask me about interview questions, resume analysis, or email drafts.',
    deleteConfirm: 'Are you sure you want to remove this candidate? This will perform a soft delete.',
    logout: 'Logout',
    signIn: 'Sign In',
    signInDesc: 'Secure Access for Recruitment Team',
    workEmail: 'Work Email',
    signInBtn: 'Sign In with Email',
    verifying: 'Verifying...',
    kpiTopTalent: 'AI Highly Recommended',
    kpiAvgScore: 'Talent Density (Avg Score)',
    kpiCulture: 'Avg Culture Fit',
    kpiAction: 'Pending Review',
    chartRadarTitle: 'Talent Pool Capability Radar',
    chartRoleTitle: 'Candidates by Role',
    chartSourceTitle: 'Sourcing Channel Distribution',
    // Config / JD
    jdManagement: 'JD Management',
    addNewJD: 'Add New Job Role (JD)',
    jdTitlePlaceholder: 'Job Title (e.g. Senior Backend Engineer)',
    jdContentPlaceholder: 'Paste the Full Job Description here...',
    saveJD: 'Save Job Description',
    noJDDefined: 'No Job Roles defined. Add one below.',
    dbConnection: 'DB Connection',
    sqlSchema: 'SQL Schema'
  },
  zh: {
    dashboard: '人才智慧庫',
    candidates: '人才庫',
    admin: '後台管理',
    connectDb: '連結資料庫',
    dbConnected: '資料庫已連線',
    overview: '人才智慧分析 (Talent Intelligence)',
    candidateManagement: '候選人管理',
    overviewDesc: 'AI 驅動的人才質量分析與管道健康度報告。',
    managementDesc: '管理並利用 AI 分析收到的履歷。',
    newCandidate: '新增候選人',
    totalCandidates: '總候選人',
    inInterview: '面試中',
    hired: '已錄用',
    avgCompetency: '平均技能匹配 (Skills)',
    pipelineStatus: '招聘流程狀態',
    sourcingChannels: '來源效益分析',
    filterAll: '全部',
    candidate: '候選人',
    appliedRole: '應徵職位',
    source: '來源',
    status: '狀態',
    aiScore: 'AI 評分',
    actions: '操作',
    uploadedInfo: '上傳資訊', 
    noCandidates: '此類別中沒有找到候選人。',
    importAnalyze: '匯入並分析履歷',
    targetVacancy: '目標職缺 / 職位名稱',
    aiAutoDetect: 'AI 自動偵測',
    aiDetectDesc: '將自動從履歷中擷取姓名、Email 與來源 (LinkedIn/104/Teamdoor)。',
    uploadText: '點擊上傳 PDF 履歷',
    supportedFormat: '支援格式: PDF (最大 5MB)',
    cancel: '取消',
    analyzing: '分析中...',
    startAnalysis: '開始 AI 分析',
    fiveForces: '五力分析',
    resumeSummary: '履歷摘要',
    swotAnalysis: 'SWOT 分析',
    strengths: '優勢 (Strengths)',
    weaknesses: '劣勢 (Weaknesses)',
    opportunities: '機會 (Opportunities)',
    threats: '威脅 (Threats)',
    hrAdvice: 'HR 專業建議',
    interviewQuestions: '建議面試問題',
    chatTitle: 'HR 智能助手',
    chatPlaceholder: '詢問面試建議或撰寫信件...',
    chatIntro: '您好！我是您的 HR 助手。關於面試問題、履歷分析或是信件撰寫都可以問我。',
    deleteConfirm: '您確定要移除這位候選人嗎？（系統將執行軟刪除，保留記錄）',
    logout: '登出',
    signIn: '登入系統',
    signInDesc: '招募團隊專用入口',
    workEmail: '工作信箱',
    signInBtn: '登入',
    verifying: '驗證中...',
    kpiTopTalent: 'AI 高度推薦人選',
    kpiAvgScore: '人才密度 (平均分)',
    kpiCulture: '平均文化契合度',
    kpiAction: '待審核履歷',
    chartRadarTitle: '人才庫五力綜合雷達',
    chartRoleTitle: '職缺分佈 (點擊篩選)',
    chartSourceTitle: '來源分佈 (點擊篩選)',
    // Config / JD
    jdManagement: 'JD 職缺管理',
    addNewJD: '新增職缺 (Job Description)',
    jdTitlePlaceholder: '職位名稱 (例如：資深後端工程師)',
    jdContentPlaceholder: '請在此貼上完整的職位描述 (Job Description)...',
    saveJD: '儲存職缺設定',
    noJDDefined: '尚未設定職缺。請在下方新增。',
    dbConnection: '資料庫連線',
    sqlSchema: 'SQL 結構 (Schema)'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('app_language') as Language) || 'zh';
  });

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
