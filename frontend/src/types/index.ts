export type UserRole = "STUDENT" | "PLACEMENT_ADMIN" | "COLLEGE_MANAGEMENT";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: UserRole;
  user_id: string;
  full_name: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  roll_number: string;
  branch: string;
  semester: number;
  cgpa: number;
  phone: string;
  date_of_birth?: string;
  address?: string;
  skills: string[];
  certifications: string[];
  linkedin_url?: string;
  github_url?: string;
  about?: string;
  avatar_url?: string;    // Feature 8
  resume_url?: string;
  sgpa?: number;
  marksheet_url?: string;
  offer_letter_url?: string;
  is_placed?: boolean;
  placed_company?: string;
  placed_package?: number;
  created_at: string;
  updated_at: string;
}

export type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
export type JobStatus = "OPEN" | "CLOSED" | "PAUSED";

export interface Company {
  id: string;
  name: string;
  industry: string;
  description?: string;
  website?: string;
  location: string;
  contact_email: string;
  contact_person?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  title: string;
  company_id: string;
  company_name?: string;
  company_logo?: string;
  description: string;
  requirements: string;
  required_skills: string[];
  job_type: JobType;
  location: string;
  salary_min?: number;
  salary_max?: number;
  min_cgpa: number;
  allowed_branches: string[];
  openings: number;
  application_deadline?: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

export type ApplicationStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "SHORTLISTED"
  | "INTERVIEW_SCHEDULED"
  | "SELECTED"
  | "REJECTED"
  | "WITHDRAWN";

export interface Application {
  id: string;
  job_id: string;
  job_title?: string;
  company_name?: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  student_cgpa?: number;
  student_branch?: string;
  cover_letter?: string;
  status: ApplicationStatus;
  remarks?: string;
  interview_date?: string;
  interview_link?: string;
  resume_url?: string;
  applied_at: string;
  updated_at: string;
}

export interface AnalyticsDashboard {
  statistics: {
    total_students: number;
    total_placed: number;
    placement_percentage: number;
    total_companies: number;
    total_jobs: number;
    total_applications: number;
    avg_package?: number;
    highest_package?: number;
  };
  branch_wise: Array<{
    branch: string;
    total_students: number;
    placed_students: number;
    placement_percentage: number;
  }>;
  company_wise: Array<{
    company_id: string;
    company_name: string;
    total_hired: number;
  }>;
  application_status_distribution: Record<string, number>;
  monthly_applications: Array<{ year: number; month: number; count: number }>;
}

export type InterviewType = "TECHNICAL" | "HR" | "MANAGERIAL" | "CASE_STUDY";

export interface InterviewQuestion {
  question: string;
  category: string;
  difficulty: string;
  hint?: string;
  sample_answer?: string;
}

// Legacy Resume Analysis (kept for backward compatibility)
export interface JobSuggestion {
  role: string;
  matchScore: string;
  requiredSkills: string[];
}

export interface ResumeAnalysis {
  atsScore: number;
  extractedSkills: string[];
  missingSkills: string[];
  strengths: string[];     // Added: positive aspects of the resume
  weaknesses: string[];    // Added: areas needing improvement
  suggestions: string[];
  jobSuggestions?: JobSuggestion[];  // Added: job role recommendations based on skills
  // Multi-Agent System fields (optional for backward compatibility)
  success?: boolean;
  request_id?: string;
  resume_analysis?: ExtractedResumeData;
  job_recommendations?: JobRecommendation[];
  metadata?: {
    trace_id?: string;
    trace_url?: string;
    timestamp?: string;
    extraction_method?: string;
    extraction_confidence?: number;
    ocr_used?: boolean;
    total_jobs_evaluated?: number;
    jobs_matched?: number;
  };
  errors?: string[];
  warnings?: string[];
}

// Multi-Agent System: Extracted Resume Data
export interface ExtractedResumeData {
  personal_info: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  skills: string[];
  education: Array<{
    degree: string;
    institution: string;
    year?: string;
    cgpa?: number;
  }>;
  experience: Array<{
    title: string;
    company: string;
    duration?: string;
    description?: string;
  }>;
  projects: Array<{
    title: string;
    description?: string;
    technologies: string[];
    link?: string;
  }>;
  certifications: string[];
}

// Multi-Agent System: Job Recommendation
export interface JobRecommendation {
  job_id: string;
  job_title: string;
  company_name: string;
  match_score: number;
  skill_match_score: number;
  experience_match: boolean;
  education_match: boolean;
  reasons: string[];
  missing_skills: string[];
  matching_skills: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ---- MARKET JOBS (external Arbeitnow listings) ----
export interface MarketJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  tags: string[];
  job_types: string[];
  location: string;
  remote: boolean;
  url: string;
  created_at: number; // unix timestamp
}

export interface MarketJobsListResponse {
  jobs: MarketJob[];
  total: number;
  page: number;
  limit: number;
}

// Feature 11 — In-app notifications
export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  created_at: string;
}

// Feature 2 — Placement Drives
export type DriveStatus = "UPCOMING" | "ONGOING" | "COMPLETED" | "CANCELLED";
export interface PlacementDrive {
  id: string;
  title: string;
  description?: string;
  company_id?: string;
  company_name?: string;
  job_ids: string[];
  drive_date: string;
  eligible_branches: string[];
  min_cgpa: number;
  venue?: string;
  status: DriveStatus;
  created_at: string;
  updated_at: string;
}

// Feature 6 — Interview Schedule
export interface InterviewScheduleItem {
  id: string;
  job_id: string;
  job_title?: string;
  company_name?: string;
  interview_date: string;
  interview_type?: string;
  interview_link?: string;
  interview_location?: string;
  status: string;
}

// Feature 3 — Student placement status
export interface StudentPlacedStatus {
  is_placed: boolean;
  placed_company?: string;
  placed_package?: number;
}

// Feature 5 — AI Ranking
export interface ApplicantRank {
  application_id: string;
  student_name: string;
  score: number;
  strengths: string[];
  gaps: string[];
  cgpa?: number;
}
export interface RankingResponse {
  job_id: string;
  ranked: ApplicantRank[];
  cached: boolean;
  ranked_at: string;
}
