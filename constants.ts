

import { Candidate, CandidateStatus, SourceType, User, UserRole, JobDescription } from './types';

export const APP_VERSION = 'v1.4.0';
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
        content: DEFAULT_PM_JD_TEXT,
        created_at: new Date().toISOString()
    },
    {
        id: 'jd-default-2',
        title: 'Frontend Engineer (React)',
        department: 'Engineering',
        content: 'Requires 3+ years React, TypeScript, Tailwind CSS. Experience with AI integration is a plus.',
        created_at: new Date().toISOString()
    }
];

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: 'c-1',
    name: '陳雅婷',
    email: 'alice.chen@example.com',
    roleApplied: '專案經理 (ERP/數位轉型/AI)', 
    source: SourceType.LINKEDIN,
    status: CandidateStatus.INTERVIEW,
    uploadedBy: 'robinhsu@91app.com',
    viewedBy: ['robinhsu@91app.com'], // Demo: Already viewed by Robin
    createdAt: '2024-05-10T09:00:00Z',
    updatedAt: '2024-05-12T10:30:00Z',
    analysis: {
      extractedData: {
        name: '陳雅婷',
        englishName: 'Alice Chen',
        email: 'alice.chen@example.com',
        currentPosition: '資深技術專案經理',
        yearsOfExperience: 6, 
        relevantYearsOfExperience: 5,
        detectedSource: 'LinkedIn',
        personalInfo: {
            mobile: '0912-345-678',
            gender: 'Female',
            age: '32',
            address: 'Taipei City',
            highestEducation: 'Master',
            school: 'National Taiwan University',
            major: 'Business Administration',
            marriage: 'Single'
        },
        skills: ['Project Management', 'Agile', 'Scrum', 'Stakeholder Management', 'JIRA', 'SQL Basic'],
        otherSkills: ['Word', 'Excel', 'PowerPoint', 'Communication', 'Leadership', 'Driver License'],
        autobiography: '擁有超過 6 年的專案管理經驗，專注於軟體開發與跨部門協作。曾在跨國公司帶領團隊成功交付多個大型專案。善於溝通協調，能夠在壓力下保持冷靜並解決問題。',
        certifications: ['PMP', 'CSM', 'Google Project Management'],
        portfolio: [
            { name: 'LinkedIn Profile', url: 'https://linkedin.com/in/alicechen' },
            { name: 'Personal Blog', url: 'https://alice-pm-thoughts.com' }
        ],
        workExperience: [
            {
                company: 'Global SaaS Inc.',
                title: 'Senior Technical PM',
                duration: '2021 - Present',
                description: '領導 15 人跨國團隊，成功交付企業級 CRM 系統。導入 Agile 流程，提升交付效率 30%。',
                isRelevant: true
            },
            {
                company: 'TechStart Solutions',
                title: 'Project Manager',
                duration: '2018 - 2021',
                description: '負責金融科技 App 開發專案，協調行銷與工程團隊。管理預算超過 500 萬台幣。',
                isRelevant: true
            },
            {
                company: 'Starbucks TW',
                title: 'Store Manager',
                duration: '2016 - 2018',
                description: '負責門市營運管理、人員排班與庫存控管。',
                isRelevant: false
            }
        ]
      },
      summary: '擁有 6 年 SaaS 產品交付經驗的資深專案經理。具備 PMP 證照，擅長跨部門溝通與時程控管。',
      matchScore: 85,
      gapAnalysis: {
          pros: ['PMP 認證符合資格', '豐富的 SaaS 管理經驗', '跨部門溝通能力強'],
          cons: ['履歷中未提及 AI 工具導入經驗', 'ERP 相關經驗較少提及']
      },
      fiveForces: { competency: 8, experience: 9, cultureFit: 8, potential: 7, communication: 9 },
      swot: {
        strengths: ['PMP 國際專案管理師認證', '卓越的利害關係人管理能力', '熟悉 Agile/Scrum 開發流程'],
        weaknesses: ['技術背景較淺，無法進行程式碼審查', '有時過於依賴既定流程'],
        opportunities: ['非常適合負責新的企業級客戶導入專案'],
        threats: ['薪資期望可能略高於部門預算']
      },
      hrAdvice: '陳雅婷是面對客戶型 PM 的強力人選。建議在面試中驗證其對 JIRA 進階管理功能的熟悉度。',
      interviewQuestions: ['請描述一次您成功處理專案範圍發散 (Scope Creep) 的經驗。', '當不同部門的利害關係人需求衝突時，您如何解決？']
    }
  }
];