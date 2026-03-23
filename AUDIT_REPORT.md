# SmartHire — Production Readiness Audit Report
**Date:** 2026-03-01
**Stack:** FastAPI + MongoDB (backend) · Next.js 14 App Router (frontend)
**Roles:** STUDENT · PLACEMENT_ADMIN · COLLEGE_MANAGEMENT · COMPANY

---

## ✅ BACKEND — What Exists & Works

### Auth (`/api/v1/auth/`)
- `POST /register` — Register new user with role
- `POST /login` — JWT login (access + refresh tokens)
- `POST /logout` — Invalidate refresh token
- `GET /me` — Current user info
- `POST /forgot-password` — Generate reset token, trigger email
- `POST /reset-password` — Reset with token (30-min expiry)
- JWT middleware with role guards (`require_student`, `require_admin`, `require_management`, `require_company`)

### Students (`/api/v1/students/`)
- Profile CRUD (GET/PUT with `model_fields_set` protection)
- Resume upload (PDF, stored at `uploads/resumes/`)
- Avatar upload (image, stored at `uploads/avatars/`)
- Admin: list all students

### Companies (`/api/v1/companies/`)
- Company self-registration flow
- Admin CRUD (create, get, update, delete)
- Company: view own profile, own jobs, own applicants

### Jobs (`/api/v1/jobs/`)
- Admin: CRUD with filters (type, status, search)
- Students: Browse open jobs (search, filter by type, CGPA, branch)
- `salary_min`/`salary_max` stored in LPA — formatted with `formatSalaryRange()`

### Applications (`/api/v1/applications/`)
- Students: Apply, view own applications (status filter), withdraw
- Admin: List all (filter by branch, date range, status), update status, bulk update
- Status flow: `PENDING → UNDER_REVIEW → SHORTLISTED → INTERVIEW_SCHEDULED → SELECTED / REJECTED / WITHDRAWN`
- Interview scheduling: `interview_date` + `interview_link` via status update
- Remarks field for admin feedback

### AI Resume Analyzer (`/api/v1/ai/`)
- `POST /analyze-existing-resume` — Reads student's uploaded resume from disk
- **PDF extraction cascade:** PyMuPDF (fitz) → pdfplumber → pypdf
- **AI provider cascade:** Mistral/LangChain → Gemini → OpenRouter (6 models)
- Returns: `atsScore`, `extractedSkills`, `missingSkills`, `strengths`, `weaknesses`, `suggestions`
- Optional `job_description` body param for targeted analysis

### Analytics (`/api/v1/analytics/`)
- Dashboard stats: total students, companies, jobs, applications, placed count & %
- Branch-wise placement breakdown
- Company-wise hiring counts
- Application status distribution
- Monthly trend data (last 12 months)
- Reports: create/list

### Interview (`/api/v1/interview/`)
- `POST /questions` — Get questions by type (HR, TECHNICAL, MANAGERIAL, CASE_STUDY) & difficulty
- `POST /mock-chat` — Scripted mock interview chat (rule-based, not LLM)

### Notifications (`/api/v1/notifications/`)
- List (30 most recent), mark one read, mark all read
- Auto-created on application status changes
- Polling-based (no WebSocket)

### Email Service
- SMTP-based (stdlib `smtplib`, no extra deps)
- Sends on: status change, interview scheduled, selection, rejection, password reset
- Runs via `BackgroundTasks.add_task()` — never blocks request
- Graceful no-op if `SMTP_HOST` not configured

---

## ✅ FRONTEND — What Exists & Works

### Auth Pages
- `/login`, `/signup` — Role-based auth
- `/forgot-password`, `/reset-password` — Full password reset flow
- `/company-register` — Public company self-registration

### Student Pages (`/student/`)
- **Dashboard** — Stats overview, recent applications
- **Profile** — Edit personal info, branch, CGPA, skills, avatar upload
- **Resume** — Upload PDF resume + AI Resume Analyzer embedded
- **Jobs** — Browse/search open jobs, apply, view details modal
- **Applications** — Filter by status, progress bar tracker, withdraw, interview link
- **Interview** — Mock interview practice with question types

### Admin Pages (`/admin/`)
- **Dashboard** — System-wide stats
- **Students** — List all students
- **Companies** — CRUD with create/edit/delete
- **Jobs** — CRUD + filter by type
- **Applications** — List all, update status with remarks, interview scheduling, bulk update, filter by branch/date
- **Reports** — View generated reports

### Company Pages (`/company/`)
- **Dashboard** — View jobs and applicants

### Management Pages (`/management/`)
- **Dashboard** — College management overview
- **Analytics** — Full analytics dashboard with charts
- **Statistics** — Detailed stats
- **Reports** — View reports

### UI Components Working
- `AIResumeAnalyzer` — Score ring, Skills/Strengths/Weaknesses/Missing/Suggestions collapsible sections
- `NotificationDropdown` — Bell icon, badge, poll every 30s, auto mark-as-read on click
- `ThemeToggle` — Dark/light mode persisted
- `Sidebar` — Theme-aware gradient, role-based nav items
- `Badge` — Dark mode variants for all status/type values
- `Pagination`, `BranchSelect`, `SkillsMultiSelect`, `AllowedBranchesSelect`

---

## ❌ MISSING FEATURES (Not Implemented)

| # | Feature | Where Missing | Impact |
|---|---------|--------------|--------|
| 1 | **Company logo upload** | No upload endpoint; `logo_url` field exists but never populated | Company profiles show no logo |
| 2 | **Company profile edit page** | Only `/company/dashboard` exists — no `/company/profile` page | Companies can't update their info |
| 3 | **Company job posting UI** | No "Post New Job" form in company dashboard | Companies can't self-post jobs |
| 4 | **Student profile view by admin** | `/admin/students` lists but no detail page | Admin can't inspect full student profile |
| 5 | **Password change (authenticated)** | Only forgot/reset flow exists | No "Change Password" from settings |
| 6 | **Refresh token rotation** | No `/auth/refresh` endpoint | Access tokens expire → users get logged out |
| 7 | **New job notifications** | Only status-change notifications exist | Students miss new job alerts |
| 8 | **MISTRAL_API_KEY in `.env.example`** | Missing from example file | New devs miss the key |
| 9 | **WebSocket real-time notifications** | Currently polling every 30 seconds | Not production-grade |
| 10 | **File type validation (avatar)** | No MIME type check on avatar uploads | Non-image files can be uploaded |
| 11 | **Admin analytics export** | Reports page exists but no CSV/Excel/PDF export | Management can't take data offline |
| 12 | **Pagination on notifications** | Only returns 30 most recent | Older notifications inaccessible |

---

## ⚠️ BROKEN / NOT WORKING ADD-ONS

| # | Feature | Status | Root Cause |
|---|---------|--------|-----------|
| 1 | **Mock Interview Chat — AI** | 🔴 Rule-based only | `interview_service.py` uses scripted responses; LLM not integrated |
| 2 | **Analytics avg_package accuracy** | 🟡 Misleading | Computes average of `job.salary_max` from ALL jobs — not from SELECTED students' actual offers |
| 3 | **Token refresh / session persistence** | 🔴 Broken | No `/auth/refresh` endpoint; expired tokens cause silent API failures |
| 4 | **Company self-posting jobs** | 🟡 Partial | Backend has route but company dashboard UI has no "Post New Job" form |
| 5 | **Email — silent failures** | 🟡 Risk | If SMTP misconfigured, all email silently fails with only a warning log |
| 6 | **Preview server on Windows** | 🔴 Tooling | `preview_start` / `npm` ENOENT on Windows; run servers manually |

---

## 🐛 DEBUG LIST

| # | Issue | File | Status |
|---|-------|------|--------|
| 1 | PDF parsing fails on Canva/Word/Figma resumes | `ai_resume.py` | ✅ FIXED — PyMuPDF added as primary extractor |
| 2 | AI API keys not loading from `.env` | `config.py` | ✅ FIXED — Keys declared as `Settings` fields |
| 3 | Currency showing `$` + `₹` together on jobs page | `jobs/page.tsx`, `utils.ts` | ✅ FIXED — `formatSalaryRange()` added |
| 4 | Notification badge not decreasing after viewing | `NotificationDropdown.tsx` | ✅ FIXED — Optimistic update on row click |
| 5 | Interview date showing after REJECTED | `applications/page.tsx` | ✅ FIXED — Gated on `INTERVIEW_SCHEDULED` / `SELECTED` |
| 6 | Status/type badges invisible in dark mode | `utils.ts` | ✅ FIXED — All badges have `dark:` Tailwind variants |
| 7 | Avatar broken (server-relative URL) | `utils.ts` | ✅ FIXED — `getFileUrl()` prepends backend origin |
| 8 | Admin app filter not re-fetching on tab switch | `admin/applications/page.tsx` | ✅ FIXED — `filter` added to `useEffect` deps |
| 9 | motor 3.7.1 crash with pymongo 4.3.3 | `requirements.txt` | ✅ FIXED — Upgraded to pymongo 4.16.0 |
| 10 | `os.getenv()` returns `None` for settings keys | `ai_resume_service.py` | ✅ FIXED — All keys via `settings.*` |
| 11 | File path fails when CWD ≠ `backend/` | `ai_resume.py` | ✅ FIXED — Uses `BASE_DIR` from `file_upload.py` |
| 12 | Sidebar always dark regardless of theme | `Sidebar.tsx` | ✅ FIXED — Theme-aware gradient classes |
| 13 | `/auth/refresh` endpoint missing | Backend | 🔴 OPEN — Silent logout on token expiry |
| 14 | Company `logo_url` never set | `companies.py` | 🔴 OPEN — No upload endpoint |
| 15 | Mock interview answers not AI-evaluated | `interview_service.py` | 🟡 OPEN — Scripted responses only |
| 16 | `avg_package` uses job salary not offer | `analytics_service.py` | 🟡 OPEN — Logic needs fix |
| 17 | No token expiry handling in Axios | `frontend/src/lib/axios.ts` | 🔴 OPEN — 401 not retried with refresh |

---

## 🚀 PRODUCTION READINESS CHECKLIST

### 🔐 Security (Critical)
- [ ] Set a strong `SECRET_KEY` in `.env` (min 32 random chars)
- [ ] Restrict `ALLOWED_ORIGINS` to production domain only
- [ ] Add rate limiting — install `slowapi`; protect `/auth/login`, `/auth/register`, `/ai/analyze-existing-resume`
- [ ] Add MIME type validation on avatar uploads
- [ ] Implement `/auth/refresh` endpoint + Axios interceptor for silent token renewal
- [ ] Use `httpOnly` cookies for refresh tokens instead of localStorage

### ⚙️ Configuration
- [ ] Add `MISTRAL_API_KEY` to `backend/.env.example`
- [ ] Configure SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`)
- [ ] Set `MONGODB_URL` to production Atlas cluster
- [ ] Set `NEXT_PUBLIC_API_URL` in frontend to production backend URL

### 🧩 Missing Feature Fixes (High Priority)
- [ ] Implement `/auth/refresh` + Axios 401 interceptor
- [ ] Company logo upload — `POST /companies/me/logo` endpoint + frontend button
- [ ] Company profile edit page — `/company/profile/page.tsx`
- [ ] Authenticated password change — `POST /auth/change-password` + UI
- [ ] Fix `avg_package` — use SELECTED applications joined with job salary

### 📦 Infrastructure
- [ ] Run behind reverse proxy (Nginx/Caddy) with HTTPS
- [ ] Serve static uploads via Nginx instead of FastAPI StaticFiles
- [ ] Set `--workers 4` in Uvicorn for multi-core
- [ ] Add MongoDB indexes on `applications.student_id`, `applications.status`, `jobs.status`, `users.email`
- [ ] Move uploads to S3/Cloudinary (local disk doesn't scale)
- [ ] Add `GET /health` endpoint for load balancer probes

### 🧪 Testing
- [ ] Write backend tests for auth, application status flow, AI service fallback chain
- [ ] Add Playwright/Cypress E2E tests for key student flows
- [ ] Test SMTP with Mailtrap or Resend sandbox

### 🔧 Nice-to-Have
- [ ] WebSocket / SSE notifications (replace 30s polling)
- [ ] LLM-powered mock interview (integrate Mistral into `interview_service.py`)
- [ ] CSV export for analytics reports
- [ ] Admin student detail view page
- [ ] New job notification when job matches student's branch

---

## 📊 OVERALL SCORE

| Area | Score | Status |
|------|-------|--------|
| Core Auth & JWT | 9/10 | ✅ Solid — missing only token refresh |
| Student Features | 8/10 | ✅ Working well |
| Admin Features | 8/10 | ✅ Working well |
| Company Features | 4/10 | ⚠️ Dashboard only — missing profile edit & job posting |
| Management Features | 7/10 | ✅ Analytics present — missing CSV export |
| AI Resume Analyzer | 9/10 | ✅ PyMuPDF + 3-provider chain — solid |
| Mock Interview | 4/10 | ⚠️ Rule-based, not AI-powered |
| Notifications | 6/10 | ⚠️ Polling works — no WebSocket |
| Email | 7/10 | ✅ Functional — needs SMTP config in prod |
| Dark Mode | 9/10 | ✅ All components covered |
| **Production Readiness** | **5/10** | 🔴 Auth refresh, rate limiting, HTTPS, S3 required before launch |

---

*Report generated by Claude Code — SmartHire Audit Session 2026-03-01*
