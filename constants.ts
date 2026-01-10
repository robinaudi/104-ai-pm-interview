
import { Candidate, CandidateStatus, SourceType, User, UserRole, JobDescription, ScoringStandard } from './types';

export const APP_VERSION = 'v4.2.0'; // UPDATED to v4.2 Smart Scoring
export const APP_NAME = 'HR Recruitment AI';

export const MOCK_USER: User = {
  id: 'u-robin',
  email: 'robinhsu@91app.com',
  role: 'ADMIN', 
  permissions: ['VIEW_DASHBOARD', 'VIEW_LIST', 'EDIT_CANDIDATE', 'DELETE_CANDIDATE', 'IMPORT_DATA', 'MANAGE_ACCESS', 'MANAGE_JD', 'AI_CHAT', 'VIEW_LOGS'],
  avatarUrl: 'https://ui-avatars.com/api/?name=Robin&background=0D8ABC&color=fff'
};

const DEFAULT_PM_JD_TEXT = `【職位名稱】專案經理 (ERP/數位轉型/AI導入)

【實際的工作內容 / 關鍵任務】
1. 數位轉型推動： 因應公司營運策略（如新商模、合併/改組等），深入理解 ERP（財務循環）、CRM（銷售循環）、BPM（簽核管理）等內部系統運作。主導數位轉型專案，包含跨部門需求訪談、撰寫產品規格書，以及驗收測試與上線後的持續迭代優化。
2. 推行營運效率化： 依據公司 AI 發展策略，導入合適的 AI 工具 / LCDP (低程式碼平台) 等解決方案。透過小範圍 (Pilot) 施行優化作業流程，建立可規模化的標準機制，提升整體營運效率。
3. 跨部門協作與專案管理： 管理 電商代運營團隊 及 合作系統廠商 之專案進度。主持/參與 Sprint Planning ，與 RD 開發團隊及合作夥伴進行深度溝通；於 Refinement 階段與團隊定義需求、控管風險，確保專案如期推進。
4. 提升系統 SLA (服務水準)： 以產品思維負責上述系統的維運與障礙排除。針對異常數據進行根因分析，提出解決方案，並評估是否納入後續的系統或產品迭代計畫。

【期望你具備的基本條件】
1. 資訊軟體背景： 具備 3 年以上軟體專案管理 (PM)、技術專案管理 (TPM) 或系統分析/開發 (SA/RD) 經驗。 (熟悉敏捷開發流程/Scrum 經驗佳）。
2. 系統管理經驗： 具備 SaaS-based 企業內部系統管理與維運經驗。
3. 溝通整合能力： 擅長跨部門協作、利害關係人管理及跨平台系統整合。
4. 流程規劃能力： 具備高度標準化與文件化能力，以利配合產品團隊運用 AI 工具（如 Google AI ecosystem），加速專案推進。`;

export const DEFAULT_JOBS: JobDescription[] = [
    {
        id: 'jd-default-1',
        title: '專案經理 (ERP/數位轉型/AI)',
        department: 'Product',
        priority: 1, // High Priority
        content: DEFAULT_PM_JD_TEXT,
        created_at: new Date().toISOString()
    },
    {
        id: 'jd-default-2',
        title: 'Frontend Engineer (React)',
        department: 'Engineering',
        priority: 2, // Lower Priority
        content: 'Requires 3+ years React, TypeScript, Tailwind CSS. Experience with AI integration is a plus.',
        created_at: new Date().toISOString()
    }
];

export const DEFAULT_SCORING_STANDARDS: ScoringStandard[] = [
    // --- V4 ROBIN HSU BENCHMARK (A-E) ---
    {
        id: 'dim-v4-a',
        category: 'DIMENSION_WEIGHT',
        condition: '(A) 產業相關性',
        rule_text: '30', // Weight 30%
        description: '指標: Tier 1 SaaS/OMO, 營收驅動, 高流量/跨境。滿分(30分): 91APP/EZTABLE高管。及格: 18分 (6.0)。',
        priority: 1,
        is_active: true
    },
    {
        id: 'dim-v4-b',
        category: 'DIMENSION_WEIGHT',
        condition: '(B) 系統導入經驗',
        rule_text: '20', // Weight 20%
        description: '指標: 深度(Build/Re-arch), 廣度(ERP+CRM+POS), 量化ROI。滿分(20分): 自建Social-CRM, ERP 0-1。及格: 12分 (6.0)。',
        priority: 2,
        is_active: true
    },
    {
        id: 'dim-v4-c',
        category: 'DIMENSION_WEIGHT',
        condition: '(C) 專案管理經驗',
        rule_text: '20', // Weight 20%
        description: '指標: 規模(預算/人數), 方法論(PMP+Agile), 危機處理。滿分(20分): 管30+人, 雙證照, 解決系統癱瘓。及格: 12分 (6.0)。',
        priority: 3,
        is_active: true
    },
    {
        id: 'dim-v4-d',
        category: 'DIMENSION_WEIGHT',
        condition: '(D) 技術量化成效',
        rule_text: '20', // Weight 20%
        description: '指標: 資歷(20+年/Dev背景), 證照(Full Stack), 硬指標(Speed/Cost)。滿分(20分): MCPD, AWS Cost -46%。及格: 12分 (6.0)。',
        priority: 4,
        is_active: true
    },
    {
        id: 'dim-v4-e',
        category: 'DIMENSION_WEIGHT',
        condition: '(E) 未來就緒度',
        rule_text: '10', // Weight 10%
        description: '指標: AI/Low-Code實戰, 持續學習(碩士/教學)。滿分(10分): RPA Cost -80%, Copilot講師。及格: 5分 (5.0)。',
        priority: 5,
        is_active: true
    },

    // --- V4.1 INDUSTRY PENALTY DEFAULTS ---
    // The "Condition" is the Keyword, "Rule_Text" is the Multiplier
    {
        id: 'pen-1',
        category: 'INDUSTRY_PENALTY',
        condition: 'Manufacturing',
        rule_text: '0.6',
        description: 'Penalty for Traditional Manufacturing Background',
        priority: 10,
        is_active: true
    },
    {
        id: 'pen-2',
        category: 'INDUSTRY_PENALTY',
        condition: 'Semiconductor',
        rule_text: '0.6',
        description: 'Penalty for Semiconductor/Foundry Background',
        priority: 10,
        is_active: true
    },
    {
        id: 'pen-3',
        category: 'INDUSTRY_PENALTY',
        condition: 'Hardware',
        rule_text: '0.6',
        description: 'Penalty for Pure Hardware/OEM Background',
        priority: 10,
        is_active: true
    },

    // --- LEGACY / GENERAL RULES (Retained for Experience Cap) ---
    {
        id: 'rule-exp-1',
        category: 'EXPERIENCE_CEILING',
        condition: '20+ Years',
        rule_text: 'Score 10.0 : 20+ Years. (VP/Director Level).',
        priority: 20,
        is_active: true
    },
    {
        id: 'rule-exp-2',
        category: 'EXPERIENCE_CEILING',
        condition: '10-15 Years',
        rule_text: 'Score 8.0 - 9.9 : 10-15 Years. (Dept Manager Level).',
        priority: 21,
        is_active: true
    },
    {
        id: 'rule-exp-3',
        category: 'EXPERIENCE_CEILING',
        condition: '6-10 Years',
        rule_text: 'Score 6.0 - 7.9 : 6-10 Years. HARD MAX 7.9 for <10 yrs.',
        priority: 22,
        is_active: true
    },
    {
        id: 'rule-exp-4',
        category: 'EXPERIENCE_CEILING',
        condition: '3-5 Years',
        rule_text: 'Score 3.0 - 5.9 : 3-5 Years. (Mid-level).',
        priority: 23,
        is_active: true
    },
    {
        id: 'rule-exp-5',
        category: 'EXPERIENCE_CEILING',
        condition: '0-2 Years',
        rule_text: 'Score 1.0 - 2.9 : 0-2 Years. (Junior).',
        priority: 24,
        is_active: true
    }
];

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: 'c-1',
    name: '鍾佩婷',
    email: 'beiting0228@gmail.com',
    roleApplied: '專案經理 (ERP/數位轉型/AI)', 
    source: SourceType.LINKEDIN,
    status: CandidateStatus.INTERVIEW,
    isUnsolicited: false,
    uploadedBy: 'robinhsu@91app.com',
    viewedBy: ['robinhsu@91app.com'], 
    createdAt: '2024-05-10T09:00:00Z',
    updatedAt: '2024-05-12T10:30:00Z',
    analysis: {
      modelVersion: 'v4.0.0',
      extractedData: {
        name: '鍾佩婷',
        englishName: 'Becky',
        email: 'beiting0228@gmail.com',
        currentPosition: 'Digital Business Process Analyst',
        yearsOfExperience: 6, 
        relevantYearsOfExperience: 5,
        detectedSource: 'LinkedIn',
        isUnsolicited: false,
        personalInfo: {
            mobile: '0962-061-728',
            gender: '女',
            age: '28',
            address: '台北市信義區虎林街***',
            highestEducation: 'Master',
            school: '國立政治大學',
            major: '資訊管理學系 (大學畢業)',
            marriage: 'Single'
        },
        skills: ['MySQL', 'CRM', '敏捷專案管理', '系統分析', '系統管理', 'Python', 'Java', 'Agile/Scrum'],
        otherSkills: ['Word', 'Excel', 'PowerPoint'],
        autobiography: '...',
        certifications: [],
        portfolio: [],
        workExperience: [
            {
                company: '趨勢科技股份有限公司',
                title: '企業流程分析師 (Digital Business Process Analyst)',
                duration: '2020/12 - 仍在職',
                description: '主導 Salesforce 至 Microsoft Dynamics 的大型 CRM 遷移專案...',
                isRelevant: true
            }
        ]
      },
      summary: '具備大外商 CRM 遷移經驗的流程分析師，但缺乏 ERP 財務循環實戰經驗。',
      matchScore: 6.8, 
      gapAnalysis: {
          pros: ['具備大型 CRM 遷移經驗', '頂尖科技業背景', '數據分析能力'],
          cons: ['缺乏 ERP 財務循環經驗', '非純 PM 出身', 'AI 實戰經驗較少']
      },
      evaluationSnapshot: {
          candidateName: '鍾佩婷 (Becky)',
          birthInfo: '1995 / 29歲',
          jobTitle: 'Project Manager',
          experienceStats: '6.0 Years (Senior)',
          keyBackground: 'Trend Micro, CRM Migration, SA/SD'
      },
      // V4 Structure
      scoringDimensions: {
          '(A) 產業相關性': 7.0,
          '(B) 系統導入經驗': 6.5,
          '(C) 專案管理經驗': 7.5,
          '(D) 技術量化成效': 6.0,
          '(E) 未來就緒度': 5.0
      },
      dimensionDetails: [
          { dimension: '(A) 產業相關性', weight: '30%', score: 7.0, reasoning: '趨勢科技為 Tier 1 軟體公司，但非純電商/SaaS OMO。' },
          { dimension: '(B) 系統導入經驗', weight: '20%', score: 6.5, reasoning: '有 CRM 遷移經驗，但缺乏 ERP 財務/進銷存深度。' },
          { dimension: '(C) 專案管理經驗', weight: '20%', score: 7.5, reasoning: '具備跨國溝通與流程分析能力，方法論完整。' },
          { dimension: '(D) 技術量化成效', weight: '20%', score: 6.0, reasoning: '6年資歷，有技術背景但缺乏硬體/雲端成本優化數據。' },
          { dimension: '(E) 未來就緒度', weight: '10%', score: 5.0, reasoning: '尚無 AI/Low-Code 實戰導入案例。' }
      ],
      // Keep legacy for safety
      fiveForces: { 
          skillsMatch: 6.0, 
          experience: 7.0, 
          cultureFit: 8.0, 
          potential: 8.5, 
          communication: 8.0 
      },
      swot: {
        strengths: ['跨國 CRM 系統導入經驗', '溝通協調能力強'],
        weaknesses: ['不熟悉財務 ERP 模組'],
        opportunities: ['可培養為 CRM 專案 PM'],
        threats: ['對財務流程理解不足']
      },
      hrAdvice: '建議錄取為 CRM 相關專案 PM。',
      interviewQuestions: ['請說明您在 CRM 遷移專案中，如何處理跨部門的需求衝突？']
    }
  }
];
