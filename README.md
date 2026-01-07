
# HR Recruitment AI (104-ai-pm-interview)

A professional Job Vacancy Assessment System integrated with Google Gemini AI for intelligent resume analysis, candidate scoring, and recruitment pipeline management.

**Repository:** [https://github.com/robinhsu-lab/104-ai-pm-interview](https://github.com/robinhsu-lab/104-ai-pm-interview)

## 🚀 Quick Start (Git Sync)

To bind your local project to the GitHub repository and sync the code:

```bash
# 1. Initialize Git (if not already done)
git init

# 2. Add the remote repository
git remote add origin https://github.com/robinhsu-lab/104-ai-pm-interview.git

# 3. Rename branch to main
git branch -M main

# 4. Add all files
git add .

# 5. Commit
git commit -m "Initial commit: Complete HR AI Architecture"

# 6. Push to GitHub
git push -u origin main
```

---

## 🏗 Project Architecture

This project is built as a **Single Page Application (SPA)** using React and TypeScript, designed for high performance and strict type safety. It leverages a serverless architecture with Supabase for data persistence and Google Gemini for AI logic.

### Tech Stack

*   **Frontend Framework**: React 18 + Vite
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS
*   **AI Engine**: Google Gemini API (`@google/genai` SDK) via `gemini-3-flash-preview`
*   **Database & Auth**: Supabase (PostgreSQL + RLS)
*   **PDF Processing**: `pdfjs-dist` (Client-side parsing & rendering)
*   **Visualization**: Recharts (Radar, Bar, Pie charts)
*   **Icons**: Lucide React

### 📂 File Structure

```text
/
├── index.html              # Entry HTML
├── index.tsx               # Application Entry Point (React Root)
├── App.tsx                 # Main Application Layout & Global State
├── types.ts                # TypeScript Interfaces (Domain Models)
├── constants.ts            # App Constants & Mock Data
├── metadata.json           # Application Metadata
├── vite.config.ts          # Vite Configuration
├── tailwind.config.js      # Tailwind Configuration (implicit via CDN in index.html)
│
├── components/             # UI Components
│   ├── AccessControlModal.tsx  # Admin: RBAC, Whitelist, Logs, JD Management
│   ├── AIChat.tsx              # Floating AI Assistant Chatbot
│   ├── CandidateDetail.tsx     # Candidate Profile, Analysis, & History
│   ├── CandidateTable.tsx      # Main List View with Filters
│   ├── ConfigModal.tsx         # Database Connection Settings
│   ├── DashboardStats.tsx      # Analytics Dashboard (Charts)
│   ├── ImportModal.tsx         # PDF Upload, Preview, & Analysis Trigger
│   ├── LoginPage.tsx           # Authentication Screen
│   └── PermissionGuard.tsx     # RBAC Component Wrapper
│
├── contexts/               # React Contexts
│   └── LanguageContext.tsx     # i18n (English/Traditional Chinese)
│
└── services/               # Logic & API Layers
    ├── geminiService.ts        # AI Logic: Prompts, Resume Analysis, Re-scoring
    ├── logService.ts           # Audit Logging System
    ├── pdfService.ts           # PDF Parsing, Thumbnail & Image Extraction
    └── supabaseService.ts      # Database CRUD, Auth, Access Control
```

## 🧠 Key Logic & Features

### 1. Intelligent Resume Analysis (`geminiService.ts`)
*   **Dual-Pass Parsing**: Converts PDF content to text, then uses Gemini to extract structured JSON data.
*   **Robin Hsu Scoring Standard**: Implements a strict, prompt-engineered scoring logic:
    *   **Experience Ceiling**: Caps scores based on years of experience (e.g., Juniors capped at 2.9/10).
    *   **Industry Penalty**: Apply discount multipliers for candidates from bureaucratic industries (Banks, Gov, Telecom).
*   **Smart LinkedIn Discovery**: Uses Gemini Tools (`googleSearch`) to find LinkedIn profiles if missing from the resume.

### 2. PDF Processing Engine (`pdfService.ts`)
*   **WYSIWYG Preview**: Renders the first page of the PDF to an HTML Canvas/Image for immediate visual verification.
*   **Profile Photo Extraction**: parses PDF operator lists to find and extract the largest image (likely the profile photo).
*   **Client-Side Only**: All PDF processing happens in the browser for privacy and speed.

### 3. Data Persistence & RBAC (`supabaseService.ts`)
*   **Hybrid Storage**: Supports "Demo Mode" (Local State) and "Production Mode" (Supabase).
*   **Custom RBAC**:
    *   `access_control`: Whitelists users by Email or Domain.
    *   `app_roles`: Defines permissions (`VIEW_DASHBOARD`, `MANAGE_ACCESS`, etc.).
    *   **Secure Access**: Policies ensure users only see what they are permitted to.

### 4. Candidate Version Control
*   **History Tracking**: When a candidate re-applies or is re-uploaded, the system archives the old analysis and creates a new version entry.
*   **Soft Deletion**: Candidates are marked `is_deleted` rather than physically removed to preserve audit trails.

## 🛠 Database Schema (Supabase)

The system uses the following PostgreSQL tables:

1.  **`candidates`**: Core candidate data, JSONB for analysis results and version history.
2.  **`job_descriptions`**: Stores JDs used for contextual AI scoring.
3.  **`app_roles`**: Defines role names and permission arrays.
4.  **`access_control`**: Maps Emails/Domains to Roles.
5.  **`action_logs`**: Stores audit logs for all critical actions (View, Edit, Delete).
6.  **`candidate_views`**: Tracks who viewed which candidate (read receipts).

## 🔧 Environment Variables

While the app supports runtime configuration via `ConfigModal`, you can set these for build-time defaults:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_KEY=your_supabase_anon_key
API_KEY=your_gemini_api_key
```

---
*Generated by AI Assistant for Robin Hsu Lab*
