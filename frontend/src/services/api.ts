import api from "@/lib/axios";
import { StudentProfile, Company, Job, Application, AnalyticsDashboard, InterviewQuestion, ResumeAnalysis, AppNotification, MarketJob, MarketJobsListResponse, PlacementDrive, InterviewScheduleItem } from "@/types";

// ---- AUTH ----
// login / register / logout are handled by Firebase on the client.
// Only backend-delegated operations are kept here.
export const authService = {
  getMe: () => api.get("/auth/me").then((r) => r.data),

  // Send OTP for password change (logged-in user)
  sendChangePasswordOtp: () =>
    api.post<{ message: string }>("/auth/send-change-password-otp").then((r) => r.data),

  // Change password with OTP (new flow — no current_password)
  changePasswordWithOtp: (data: { otp_code: string; new_password: string }) =>
    api.post<{ message: string }>("/auth/change-password", data).then((r) => r.data),

  // Keep legacy alias so any other callers don't break
  changePassword: (data: { otp_code: string; new_password: string }) =>
    api.post<{ message: string }>("/auth/change-password", data).then((r) => r.data),

  // Forgot password — custom token flow (replaces Firebase sendPasswordResetEmail)
  forgotPasswordCustom: (email: string) =>
    api.post<{ message: string }>("/auth/forgot-password", { email }).then((r) => r.data),

  // Reset password with custom token
  resetPasswordWithToken: (data: { token: string; new_password: string }) =>
    api.post<{ message: string }>("/auth/reset-password-confirm", data).then((r) => r.data),

  getAdminRequests: (status?: string) => api.get("/api/v1/auth/admin-requests", { params: status ? { status } : {} }),
  approveAdmin: (userId: string) => api.patch(`/api/v1/auth/admin-requests/${userId}/approve`),
  rejectAdmin: (userId: string, reason: string) => api.patch(`/api/v1/auth/admin-requests/${userId}/reject`, { reason }),

  // Admin user management
  listUsers: (params?: { role?: string; is_active?: boolean; page?: number; limit?: number }) =>
    api.get<{ users: Array<{ id: string; email: string; full_name: string; role: string; is_active: boolean; created_at: string }>; total: number; page: number; limit: number }>(
      "/auth/admin/users", { params }
    ).then((r) => r.data),

  setUserActive: (userId: string, isActive: boolean) =>
    api.patch<{ message: string; user_id: string; is_active: boolean }>(
      `/auth/admin/users/${userId}/activate`, null, { params: { is_active: isActive } }
    ).then((r) => r.data),

  updateUserRole: (userId: string, role: string) =>
    api.patch<{ message: string; user_id: string; role: string }>(
      `/auth/admin/users/${userId}/role`, null, { params: { role } }
    ).then((r) => r.data),
};

// ---- STUDENT PROFILE ----
export const studentService = {
  createProfile: (data: Partial<StudentProfile>) =>
    api.post<StudentProfile>("/students/profile", data).then((r) => r.data),

  getMyProfile: () => api.get<StudentProfile>("/students/profile/me").then((r) => r.data),

  updateProfile: (data: Partial<StudentProfile>) =>
    api.put<StudentProfile>("/students/profile/me", data).then((r) => r.data),

  uploadResume: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    // Do NOT set Content-Type manually — the browser/XMLHttpRequest automatically
    // sets "multipart/form-data; boundary=<...>" when FormData is the body.
    // A manual override loses the boundary and breaks server-side parsing.
    return api.post<{ resume_url: string; filename: string; message: string }>("/students/resume", form).then((r) => r.data);
  },

  // Feature 8 — Avatar upload
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{ avatar_url: string; message: string }>("/students/avatar", form).then((r) => r.data);
  },

  // Marksheet upload — returns Cloudinary URL + AI-extracted data
  uploadMarksheet: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{
      marksheet_url: string;
      extracted_data: {
        roll_number: string | null;
        full_name: string | null;
        semester: number | null;
        branch: string | null;
        sgpa: number | null;
        cgpa: number | null;
      };
      message: string;
    }>("/students/marksheet", form).then((r) => r.data);
  },

  getStudentById: (id: string) =>
    api.get<StudentProfile>(`/students/profile/${id}`).then((r) => r.data),

  listStudents: (params?: Record<string, unknown>) =>
    api.get("/students", { params }).then((r) => r.data),

  // CSV Export
  exportCsv: (params?: Record<string, unknown>) =>
    api.get("/students/export-csv", { params, responseType: "blob" }).then((r) => r.data),

  // Feature 3 — Offer letter upload (student)
  uploadOfferLetter: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{ offer_letter_url: string; message: string }>("/students/offer-letter", form).then((r) => r.data);
  },

  // Feature 3 — Mark student as placed (admin)
  markPlaced: (studentId: string, data: { is_placed: boolean; placed_company?: string; placed_package?: number }) =>
    api.patch<{ message: string }>(`/students/${studentId}/placed-status`, data).then((r) => r.data),

  uploadMarksheet10th: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post("/students/marksheet-10th", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  uploadMarksheet12th: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post("/students/marksheet-12th", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  uploadAadharDoc: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post("/students/aadhar-doc", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};

// ---- COMPANIES ----
export const companyService = {
  list: (params?: Record<string, unknown>) =>
    api.get<{ companies: Company[]; total: number }>("/companies", { params }).then((r) => r.data),

  get: (id: string) => api.get<Company>(`/companies/${id}`).then((r) => r.data),

  create: (data: Partial<Company>) => api.post<Company>("/companies", data).then((r) => r.data),

  update: (id: string, data: Partial<Company>) =>
    api.put<Company>(`/companies/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/companies/${id}`).then((r) => r.data),

  // CSV Export
  exportCsv: (params?: Record<string, unknown>) =>
    api.get("/companies/export-csv", { params, responseType: "blob" }).then((r) => r.data),
};

// ---- JOBS ----
export const jobService = {
  list: (params?: Record<string, unknown>) =>
    api.get<{ jobs: Job[]; total: number }>("/jobs", { params }).then((r) => r.data),

  get: (id: string) => api.get<Job>(`/jobs/${id}`).then((r) => r.data),

  create: (data: Partial<Job>) => api.post<Job>("/jobs", data).then((r) => r.data),

  update: (id: string, data: Partial<Job>) =>
    api.put<Job>(`/jobs/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/jobs/${id}`).then((r) => r.data),

  // CSV Export
  exportCsv: (params?: Record<string, unknown>) =>
    api.get("/jobs/export-csv", { params, responseType: "blob" }).then((r) => r.data),
};

// ---- APPLICATIONS ----
export const applicationService = {
  apply: (data: { job_id: string; cover_letter?: string }) =>
    api.post<Application>("/applications", data).then((r) => r.data),

  getMyApplications: (status?: string) =>
    api.get<{ applications: Application[]; total: number }>("/applications/my", { params: { status } }).then((r) => r.data),

  listAll: (params?: Record<string, unknown>) =>
    api.get<{ applications: Application[]; total: number }>("/applications", { params }).then((r) => r.data),

  getById: (id: string) => api.get<Application>(`/applications/${id}`).then((r) => r.data),

  updateStatus: (id: string, data: { status: string; remarks?: string; interview_date?: string; interview_link?: string; interview_type?: string; interview_location?: string }) =>
    api.patch<Application>(`/applications/${id}/status`, data).then((r) => r.data),

  withdraw: (id: string) =>
    api.post<Application>(`/applications/${id}/withdraw`).then((r) => r.data),

  // Feature 9 — Bulk update
  bulkUpdateStatus: (data: { application_ids: string[]; status: string; remarks?: string }) =>
    api.post<{ updated_count: number; failed_ids: string[]; message: string }>("/applications/bulk-update", data).then((r) => r.data),

  // CSV Export
  exportCsv: (params?: Record<string, unknown>) =>
    api.get("/applications/export-csv", { params, responseType: "blob" }).then((r) => r.data),
};

// ---- ANALYTICS ----
export const analyticsService = {
  getDashboard: () => api.get<AnalyticsDashboard>("/analytics/dashboard").then((r) => r.data),

  listReports: (params?: Record<string, unknown>) =>
    api.get("/analytics/reports", { params }).then((r) => r.data),

  createReport: (data: { report_type: string; title: string }) =>
    api.post("/analytics/reports", data).then((r) => r.data),

  exportCsv: () =>
    api.get("/analytics/export-csv", { responseType: "blob" }).then((r) => r.data),

  // Department-level analytics
  getDepartmentAnalytics: () =>
    api.get<{
      departments: Array<{
        branch: string;
        total_students: number;
        placed_students: number;
        placement_percentage: number;
        avg_package_lpa: number | null;
        highest_package_lpa: number | null;
        application_funnel: Record<string, number>;
        companies_hired: number;
      }>;
      total_branches: number;
    }>("/analytics/department").then((r) => r.data),

  // NW#4 — system health status (SMTP, AI keys)
  getSystemStatus: () =>
    api.get<{
      smtp: { configured: boolean; host: string | null };
      openai: { configured: boolean };
      mistral: { configured: boolean };
    }>("/analytics/system-status").then((r) => r.data),
};

// ---- INTERVIEW ----
export const interviewService = {
  getQuestions: (data: { interview_type: string; difficulty?: string; count?: number; skills?: string[]; job_title?: string }) =>
    api.post<{ questions: InterviewQuestion[]; total: number; interview_type: string }>("/interview/questions", data).then((r) => r.data),

  mockChat: (data: { messages: Array<{ role: string; content: string }>; job_title?: string; skills?: string[]; interview_type?: string; difficulty?: string }) =>
    api.post<{ reply: string; feedback?: string; score?: number }>("/interview/mock-chat", data).then((r) => r.data),
};

// ---- AI RANKING (Feature 5) ----
export const aiRankingService = {
  rankApplicants: (data: { job_id: string; application_ids: string[] }) =>
    api.post<{ job_id: string; ranked: import("@/types").ApplicantRank[]; cached: boolean; ranked_at: string }>(
      "/ai/rank-applicants", data
    ).then((r) => r.data),
};

// ---- AI RESUME ANALYZER ----
// Uses /ai/analyze-existing-resume which reads the student's already-uploaded
// resume from disk and returns ATS score, skills, strengths, weaknesses,
// and improvement suggestions via OpenAI GPT-4o-mini.
// Previously pointed at /multi-agent/analyze which returns a completely
// different schema (AgentState) and requires LangGraph + both OpenAI and
// LangSmith to be configured — not suitable as the default analyzer.
export const aiResumeService = {
  analyzeResume: (data?: { job_description?: string }) =>
    api.post<ResumeAnalysis>("/ai/analyze-existing-resume", data || {}).then((r) => r.data),
};

// ---- NOTIFICATIONS (Feature 11) ----
export const notificationService = {
  list: () => api.get<{ notifications: AppNotification[]; unread_count: number }>("/notifications").then((r) => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch("/notifications/read-all").then((r) => r.data),
};

// ---- MARKET JOBS (external Arbeitnow listings) ----
// Feature 2: Placement Drives
export const placementDriveService = {
  list: (params?: { status?: string; company_id?: string; page?: number; limit?: number }) =>
    api.get<{ drives: PlacementDrive[]; total: number; page: number; limit: number }>("/placement-drives", { params }).then((r) => r.data),
  get: (driveId: string) =>
    api.get<PlacementDrive>(`/placement-drives/${driveId}`).then((r) => r.data),
  create: (data: Partial<PlacementDrive>) =>
    api.post<PlacementDrive>("/placement-drives", data).then((r) => r.data),
  update: (driveId: string, data: Partial<PlacementDrive>) =>
    api.put<PlacementDrive>(`/placement-drives/${driveId}`, data).then((r) => r.data),
  delete: (driveId: string) =>
    api.delete(`/placement-drives/${driveId}`),
};

// ---- DRIVE ROUNDS ----
export const driveRoundsService = {
  list: (driveId: string) =>
    api.get<any[]>(`/placement-drives/${driveId}/rounds`).then((r) => r.data),
  create: (driveId: string, data: { round_number: number; round_name: string; round_type: string }) =>
    api.post(`/placement-drives/${driveId}/rounds`, data).then((r) => r.data),
  update: (driveId: string, roundId: string, data: any) =>
    api.put(`/placement-drives/${driveId}/rounds/${roundId}`, data).then((r) => r.data),
  delete: (driveId: string, roundId: string) =>
    api.delete(`/placement-drives/${driveId}/rounds/${roundId}`),
};

// Feature 6: Interview schedule + Google Calendar
export const calendarService = {
  getMyInterviews: () =>
    api.get<InterviewScheduleItem[]>("/applications/my/interviews").then((r) => r.data),
  getGoogleAuthUrl: () =>
    api.get<{ auth_url: string }>("/calendar/google/auth-url").then((r) => r.data),
  googleCallback: (code: string) =>
    api.post<{ connected: boolean; message: string }>("/calendar/google/callback", { code }).then((r) => r.data),
  addGoogleEvent: (applicationId: string, timezone?: string) =>
    api.post<{ event_id: string; event_url: string; message: string }>("/calendar/google/add-event", { application_id: applicationId, timezone: timezone || "Asia/Kolkata" }).then((r) => r.data),
  disconnectGoogle: () =>
    api.delete<{ disconnected: boolean }>("/calendar/google/disconnect").then((r) => r.data),
  getGoogleStatus: () =>
    api.get<{ connected: boolean; connected_at: string | null; configured: boolean }>("/calendar/google/status").then((r) => r.data),
};

export const marketJobsService = {
  list: (params?: {
    search?: string;
    role?: string;
    location?: string;
    remote?: boolean;
    page?: number;
    limit?: number;
  }) =>
    api.get<MarketJobsListResponse>("/market-jobs", { params }).then((r) => r.data),

  recordClick: (data: { job_title: string; company_name: string }) =>
    api
      .post<{ message: string; department: string }>("/market-jobs/apply", data)
      .then((r) => r.data),

  getStats: () =>
    api
      .get<{
        stats: Array<{ department: string; click_count: number }>;
        total_clicks: number;
      }>("/market-jobs/stats")
      .then((r) => r.data),
};

// ---- ROUNDS ----
export const roundService = {
  list: (params?: { application_id?: string; job_id?: string }) =>
    api.get("/api/v1/rounds/", { params }),
  create: (data: any) => api.post("/api/v1/rounds/", data),
  updateResult: (roundId: string, data: { result: string; admin_notes?: string }) =>
    api.patch(`/api/v1/rounds/${roundId}/result`, data),
  update: (roundId: string, data: any) => api.put(`/api/v1/rounds/${roundId}`, data),
  delete: (roundId: string) => api.delete(`/api/v1/rounds/${roundId}`),
  getMyUpcoming: () => api.get("/api/v1/rounds/my/upcoming"),
};

// ---- SETTINGS ----
export const settingsService = {
  get: () => api.get("/api/v1/settings/"),
  update: (data: any) => api.patch("/api/v1/settings/", data),
};

// ---- ADMIN PROFILE ----
export const adminProfileService = {
  get: () => api.get("/api/v1/admin-profile/me"),
  create: (data: any) => api.post("/api/v1/admin-profile/", data),
  update: (data: any) => api.put("/api/v1/admin-profile/me", data),
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/api/v1/admin-profile/avatar", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ---- VERIFICATION ----
export const verificationService = {
  submit: (doc_url: string) => api.post("/api/v1/verification/submit", { doc_url }),
  getMyStatus: () => api.get("/api/v1/verification/my-status"),
  listPending: (params?: any) => api.get("/api/v1/verification/pending", { params }),
  listAll: (status?: string) => api.get("/api/v1/verification/all", { params: status ? { status } : {} }),
  review: (studentId: string, data: { status: string; admin_notes?: string }) =>
    api.patch(`/api/v1/verification/${studentId}/review`, data),
};
