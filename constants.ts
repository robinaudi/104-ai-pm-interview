
import { Candidate, CandidateStatus, SourceType, User, UserRole, JobDescription, ScoringStandard } from './types';

export const APP_VERSION = 'v3.0.0';
export const APP_NAME = 'HR Recruitment AI';

export const MOCK_USER: User = {
  id: 'u-robin',
  email: 'robinhsu@91app.com',
  role: 'ADMIN', // Changed from UserRole enum to string literal to match new RBAC
  permissions: ['VIEW_DASHBOARD', 'VIEW_LIST', 'EDIT_CANDIDATE', 'DELETE_CANDIDATE', 'IMPORT_DATA', 'MANAGE_ACCESS', 'MANAGE_JD', 'AI_CHAT', 'VIEW_LOGS'],
  avatarUrl: 'https://ui-avatars.com/api/?name=Robin&background=0D8ABC&color=fff'
};

// The user specific JD
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
    // --- V3 SCORING DIMENSIONS (From PDF) ---
    {
        id: 'dim-1',
        category: 'DIMENSION_WEIGHT',
        condition: 'ERP/Finance Mastery',
        rule_text: '20', // Weight %
        description: '0: No Exp. 5: Used ERP. 10: Led Implementation. Keywords: Finance closing, Supply chain, API.',
        priority: 1,
        is_active: true
    },
    {
        id: 'dim-2',
        category: 'DIMENSION_WEIGHT',
        condition: 'AI & Digital Transformation',
        rule_text: '25', // Weight %
        description: '0: Interest only. 5: Used ChatGPT. 10: Successful Agentic AI/LCDP project with ROI.',
        priority: 2,
        is_active: true
    },
    {
        id: 'dim-3',
        category: 'DIMENSION_WEIGHT',
        condition: 'PM Methodology',
        rule_text: '15', // Weight %
        description: '0: Chaos. 5: PMP Cert only. 10: Hybrid Agile experience. Knows when to use Waterfall vs Scrum.',
        priority: 3,
        is_active: true
    },
    {
        id: 'dim-4',
        category: 'DIMENSION_WEIGHT',
        condition: 'Communication',
        rule_text: '20', // Weight %
        description: '0: Solo. 5: Single Dept. 10: Cross-Dept (C-Level/RD/Ops) & Vendor Mgmt.',
        priority: 4,
        is_active: true
    },
    {
        id: 'dim-5',
        category: 'DIMENSION_WEIGHT',
        condition: 'Industry Relevance',
        rule_text: '10', // Weight %
        description: '0: None. 5: Traditional Retail/Soft. 10: SaaS / Ecommerce / OMO Background.',
        priority: 5,
        is_active: true
    },
    {
        id: 'dim-6',
        category: 'DIMENSION_WEIGHT',
        condition: 'Education & Learning',
        rule_text: '10', // Weight %
        description: '0: Irrelevant. 5: Related Bachelor. 10: Master + Recent AI/Cloud Certs.',
        priority: 6,
        is_active: true
    },

    // --- LEGACY / GENERAL RULES ---
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
    },
    {
        id: 'rule-ind-1',
        category: 'INDUSTRY_PENALTY',
        condition: 'Traditional Sectors',
        rule_text: '{"competency": 0.7, "culture": 0.6}', // JSON Format
        priority: 30,
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
      modelVersion: 'v3.0',
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
      // V3 Structure
      scoringDimensions: {
          'ERP/Finance Mastery': 6.0,
          'AI & Digital Transformation': 5.0,
          'PM Methodology': 7.0,
          'Communication': 8.0,
          'Industry Relevance': 7.0,
          'Education & Learning': 8.0
      },
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
