
// Domain Types

export interface JobDescription {
  id: string;
  title: string;
  content: string; // The full JD text
  department?: string;
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
  competency: number; // 1-10
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
  // NEW: Analysis against specific JD
  matchScore: number; // 0-100
  gapAnalysis: {
      pros: string[];
      cons: string[]; // Missing skills based on JD
  };
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
  resumeUrl?: string;
  photoUrl?: string; 
  linkedinUrl?: string; // NEW: Top level access
  uploadedBy?: string; // NEW: Who uploaded this candidate
  analysis?: AnalysisResult;
  viewedBy?: string[]; // NEW: Array of user emails who have viewed this candidate
  
  // NEW: Version History
  versions?: CandidateVersion[];

  isDeleted?: boolean; // NEW: Soft delete flag
  createdAt: string; // Acts as "Upload Date"
  updatedAt: string;
}

// --- RBAC & Auth Types (2026.01.v2) ---

export type Permission = 
  | 'VIEW_DASHBOARD' 
  | 'VIEW_LIST'
  | 'EDIT_CANDIDATE' // Replaces EDIT_PATENT for HR Context
  | 'DELETE_CANDIDATE' // Replaces DELETE_PATENT
  | 'IMPORT_DATA' 
  | 'EXPORT_DATA' 
  | 'SEND_EMAIL' 
  | 'AI_CHAT' 
  | 'MANAGE_ACCESS'
  | 'MANAGE_JD'
  | 'VIEW_LOGS';

export interface AppRole {
  role_name: string;
  permissions: Permission[];
  description?: string;
}

export interface AccessRule {
  id: string;
  // type column removed to match user's actual DB schema
  value: string; // email or domain
  role: string; // references AppRole.role_name
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  role: string; // The assigned role name (e.g. 'ADMIN')
  permissions: Permission[]; // Computed permissions based on role
  avatarUrl?: string;
}

// Legacy Enum for backward compatibility if needed, but RBAC prefers strings now
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  RECRUITER = 'RECRUITER',
  VIEWER = 'VIEWER'
}

// Log Types

export interface ActionLog {
  id: string;
  action: string;
  user_email: string; // Changed from userEmail to match DB
  target?: string;    // Changed from details to target/details structure
  details: any;       // JSONB in DB
  created_at: string;
}
