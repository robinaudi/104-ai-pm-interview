
// Domain Types

export interface JobDescription {
  id: string;
  title: string;
  content: string; // The full JD text
  department?: string;
  priority: number; // NEW: Weighting/Ordering (1 = High, 10 = Low)
  created_at?: string;
}

export enum CandidateStatus {
  NEW = 'New',
  SCREENING = 'Screening',
  INTERVIEW = 'Interview',
  OFFER = 'Offer',
  REJECTED = 'Rejected',
  HIRED = 'Hired'
}

// We keep this for the "Standard" options, but the Candidate.source field is now a string
export enum SourceType {
  LINKEDIN = 'LinkedIn',
  ONE_ZERO_FOUR = '104',
  TEAMDOOR = 'Teamdoor',
  OTHER = 'Other'
}

export interface AnalysisFiveForces {
  skillsMatch: number; // Renamed from competency. 1-10
  experience: number;
  cultureFit: number;
  potential: number;
  communication: number;
}

export interface WorkExperience {
  company: string;
  title: string;
  duration: string;
  description: string;
  isRelevant: boolean; // NEW: Determines if this role matches the target vacancy
}

export interface PortfolioItem {
  name: string;
  url: string;
}

// NEW: Detailed personal info structure (104 style)
export interface PersonalInfo {
  mobile: string;
  gender: string;
  age: string;
  address: string;
  highestEducation: string; // e.g. "Master", "Bachelor"
  school: string; // e.g. "National Taiwan University"
  major: string; // e.g. "Computer Science"
  marriage?: string; // Optional
}

export interface ExtractedCandidateInfo {
  name: string;
  englishName: string; 
  email: string;
  currentPosition: string;
  yearsOfExperience: number; // Total working years
  relevantYearsOfExperience: number; // NEW: Specific to the target role (PM/SA/Dev)
  detectedSource: string;
  isUnsolicited?: boolean; // NEW: Detected if "Active Applicant"
  linkedinUrl?: string; // NEW: Specific field for LinkedIn
  personalInfo: PersonalInfo; 
  skills: string[]; // Tech Skills
  otherSkills: string[]; // NEW: Non-tech skills (e.g. Driver License, Word)
  autobiography: string; // NEW: 104 Autobiography section
  certifications: string[]; 
  portfolio: PortfolioItem[]; 
  workExperience: WorkExperience[]; 
}

export interface AnalysisResult {
  extractedData: ExtractedCandidateInfo; 
  summary: string;
  modelVersion?: string; // NEW: Track which scoring model was used (e.g., 'v3.0')
  // NEW: Analysis against specific JD
  matchScore: number; // 0-100
  gapAnalysis: {
      pros: string[];
      cons: string[]; // Missing skills based on JD
  };
  // NEW V3: Dynamic Scoring Dimensions (Map of "Dimension Name" -> Score)
  scoringDimensions?: Record<string, number>;
  
  // Legacy support for older components
  fiveForces: AnalysisFiveForces;
  
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  hrAdvice: string;
  interviewQuestions: string[];
}

// NEW: Version History Structure
export interface CandidateVersion {
  date: string; // ISO String
  roleApplied: string;
  analysis: AnalysisResult;
  resumeUrl?: string; // In case we want to store different PDF links later
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  roleApplied: string;
  source: string; 
  status: CandidateStatus;
  isUnsolicited: boolean; // NEW: Flag for Active Applicants
  resumeUrl?: string;
  photoUrl?: string; 
  linkedinUrl?: string; // NEW: Top level access
  uploadedBy?: string; // NEW: Who uploaded this candidate
  analysis?: AnalysisResult;
  viewedBy?: string[]; // NEW: Array of user emails who have viewed this candidate
  
  // NEW: Version History
  versions?: CandidateVersion[];

  isDeleted?: boolean; // NEW: Soft delete flag
  deletedBy?: string; // NEW: Who deleted this candidate
  deletedAt?: string; // NEW: When was it deleted
  
  createdAt: string; // Acts as "Upload Date"
  updatedAt: string;
}

// --- SCORING STANDARDS (NEW) ---
export type ScoringCategory = 'EXPERIENCE_CEILING' | 'INDUSTRY_PENALTY' | 'SKILL_WEIGHT' | 'GENERAL_RULE' | 'DIMENSION_WEIGHT';

export interface ScoringStandard {
    id: string;
    category: ScoringCategory;
    condition: string; // e.g. "6-10 Years Exp" or "Finance Industry" or "ERP Mastery"
    rule_text: string; // The specific instruction OR the Weight Value (e.g. "20")
    description?: string; // Optional description for the UI
    priority: number; // Ordering for prompt
    is_active: boolean;
}

// --- RBAC & Auth Types (2026.01.v2) ---

export type Permission = 
  | 'VIEW_DASHBOARD' 
  | 'VIEW_LIST'
  | 'EDIT_CANDIDATE' 
  | 'DELETE_CANDIDATE'
  | 'IMPORT_DATA'
  | 'EXPORT_DATA'
  | 'SEND_EMAIL'
  | 'AI_CHAT'
  | 'MANAGE_ACCESS'
  | 'MANAGE_JD'
  | 'VIEW_LOGS';

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
  GUEST = 'GUEST'
}

export interface User {
  id: string;
  email: string;
  role: string;
  permissions: Permission[];
  avatarUrl?: string;
}

export interface AppRole {
  role_name: string;
  permissions: Permission[];
  description?: string;
  created_at?: string;
}

export interface AccessRule {
  id: string;
  type: 'EMAIL' | 'DOMAIN';
  value: string;
  role: string;
  created_at?: string;
}

export interface ActionLog {
  id: string;
  user_email: string;
  action: string;
  target?: string;
  details?: any;
  created_at: string;
}
