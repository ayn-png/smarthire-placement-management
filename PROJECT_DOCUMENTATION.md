# SmartHire — College Placement Management System
### Complete Project Documentation

---

## 1. Project Title

**SmartHire — Enterprise-Grade College Placement Management System with AI Interview Preparation**

---

## 2. Problem Statement

Managing campus placements in colleges is a highly complex and manual process. Currently:

- **Students** have no single platform to discover jobs, track applications, and prepare for interviews.
- **Placement Officers (Admins)** waste significant time manually handling resumes, coordinating with companies, shortlisting students, and scheduling interviews via spreadsheets and emails.
- **College Management** lacks real-time visibility into placement statistics, branch-wise performance, and company hiring trends.
- **Resume quality** is often poor because students receive no feedback on how their resume performs in automated ATS (Applicant Tracking Systems) used by companies.
- There is **no AI-powered interview preparation** tool available inside placement portals.

This project solves all of the above problems in one unified, role-based web platform.

---

## 3. Objective of the Project

- Build a **full-stack, enterprise-grade** placement management web application.
- Provide **three distinct role-based dashboards**: Student, Placement Admin, and College Management.
- Integrate **AI capabilities** for resume analysis, ATS scoring, and interview preparation.
- Automate the **entire placement lifecycle**: from job posting → student application → shortlisting → interview scheduling → final selection.
- Generate **real-time analytics and reports** for college management and placement officers.
- Build a platform with **production-ready security**, performance, and clean UI/UX.

---

## 4. Complete System Overview (Step-by-Step)

### Step 1 — Registration & Login
- A new user visits the platform, registers with their email, name, password, and role (Student or Admin).
- On login, the backend verifies credentials, issues a **JWT Access Token** (valid 30 minutes) and a **JWT Refresh Token** (valid 7 days).
- Tokens are securely stored in **HTTP-only cookies** on the frontend.

### Step 2 — Role-Based Dashboard Routing
- After login, the system checks the user's role: `STUDENT`, `PLACEMENT_ADMIN`, or `COLLEGE_MANAGEMENT`.
- The Next.js middleware automatically redirects each user to their correct dashboard and blocks unauthorized route access.

### Step 3 — Student Workflow
1. Student fills their **profile** (roll number, branch, CGPA, skills, certifications, LinkedIn, GitHub).
2. Student **uploads their resume** as a PDF file.
3. Student browses the **Job Board** — filtered by branch eligibility, CGPA requirement, job type.
4. Student **applies** to jobs by submitting a cover letter.
5. Student tracks **application status** (Pending → Under Review → Shortlisted → Interview Scheduled → Selected / Rejected).
6. Student uses the **AI Resume Analyzer** to get ATS score, missing skills, and improvement suggestions.
7. Student uses the **Interview Preparation** module to get practice questions and conduct mock interviews.

### Step 4 — Admin Workflow
1. Placement Admin **creates and manages companies** and **posts jobs** with eligibility criteria (min CGPA, branches, skills required).
2. Admin **views all applications**, filters by branch, CGPA, or status.
3. Admin **shortlists candidates** and changes application status.
4. Admin **schedules interviews** by adding interview date, time, and meeting link to the application.
5. Admin **marks final status** (Selected or Rejected).
6. Admin views **analytics dashboard** with placement statistics.

### Step 5 — College Management Workflow
1. Management views a **read-only analytics dashboard** with placement percentage, branch-wise data, company-wise hiring, and monthly trends.
2. Management can **generate and export placement reports**.

### Step 6 — AI Features
- When a student clicks "Analyze Resume", the system:
  1. Fetches the student's uploaded PDF from local storage.
  2. Extracts all text using **PyPDF2**.
  3. Sends text along with optional job description to **Google Gemini AI** (or OpenRouter as fallback).
  4. The AI responds with a structured JSON: ATS Score, Missing Skills, Suggestions, Extracted Skills.
  5. Results are displayed on the student's dashboard.

---

## 5. Architecture Explanation

```
[ User's Browser ]
        |
        ↓
[ Next.js Frontend (Port 3000) ]
   - Role-based routing (Middleware)
   - React components with Tailwind CSS
   - Axios calls to Backend API
        |
        ↓ HTTP REST API calls
        |
[ FastAPI Backend (Port 8000) ]
   - JWT Authentication Middleware
   - Business Logic (Services)
   - Pydantic Validation (Schemas)
   - File Upload Handler
        |
        ↓
[ MongoDB Database ]
   - Collections: users, student_profiles,
     companies, jobs, applications, reports
   - Indexed for fast queries
        |
[ AI Layer (External APIs) ]
   - Google Gemini 2.0 Flash (Primary)
   - OpenRouter (Fallback: LLaMA 3.3, Gemma 3, Mistral, etc.)
   ← Called by backend with resume text + prompt →
   ← Returns structured JSON with ATS score, skills, suggestions →
```

### Data Flow:
- **Frontend → Backend**: Axios HTTP requests with JWT Bearer tokens in headers.
- **Backend → MongoDB**: Async Motor (MongoDB async driver) queries.
- **Backend → AI**: Async HTTPX calls to external LLM APIs.
- **Backend → Frontend**: JSON responses validated by Pydantic schemas.

---

## 6. Tech Stack Used and Why We Used Each Technology

### Frontend — Next.js 14 (React Framework)
- **What**: A React-based framework for building web applications with server-side rendering, file-based routing, and built-in optimization.
- **Why**: Next.js provides fast page loads, SEO support, and a clean `/app` directory routing system. The App Router allows logical grouping of routes by role `(student)`, `(admin)`, `(management)`. It also handles middleware at the edge for secure route protection.

### UI Styling — Tailwind CSS + Framer Motion
- **What**: Tailwind is a utility-first CSS framework. Framer Motion is a React animation library.
- **Why**: Tailwind allows rapid, consistent UI development without writing custom CSS files. Framer Motion adds smooth animations and transitions, making the UI feel professional and modern.

### Frontend State & Forms — React Hook Form + Zod
- **What**: React Hook Form handles form state management. Zod is a TypeScript schema validation library.
- **Why**: Together they provide fast, performant forms with real-time validation and type safety without unnecessary re-renders.

### Charts & Visualization — Recharts
- **What**: A React charting library built on D3.
- **Why**: Used to render placement statistics, branch-wise bar charts, monthly application trend line charts, and status distribution pie charts on the analytics dashboard.

### HTTP Client — Axios
- **What**: A promise-based HTTP client for the browser.
- **Why**: Axios automatically attaches JWT tokens to every request via request interceptors, and handles token refresh logic seamlessly.

### Theme — next-themes
- **What**: A theme management library for Next.js.
- **Why**: Provides dark mode / light mode toggle support with persistent preference via `localStorage`.

---

### Backend — FastAPI (Python)
- **What**: A modern, high-performance Python web framework based on ASGI (asynchronous web standard).
- **Why**: FastAPI is chosen because:
  - It is **async-first**, perfectly suited for I/O-bound tasks (DB calls, AI API calls).
  - **Auto-generates API documentation** (Swagger UI at `/api/docs`, ReDoc at `/api/redoc`).
  - Uses **Pydantic** for request/response validation — eliminates manual validation code.
  - **Very fast** — comparable to Node.js and Go in benchmarks.
  - **Type-annotated** — reduces bugs and improves IDE support.

### Backend Libraries
| Library | Purpose |
|---|---|
| `uvicorn` | ASGI server to run FastAPI |
| `motor` | Async MongoDB driver — non-blocking database calls |
| `python-jose` | JWT token creation and verification |
| `bcrypt` (via passlib) | Secure password hashing |
| `PyPDF2` | Extract text from uploaded PDF resumes |
| `httpx` | Async HTTP client to call Gemini AI / OpenRouter |
| `pydantic-settings` | Load `.env` configuration into typed Python objects |
| `python-multipart` | Handle file uploads (multipart/form-data) |
| `aiofiles` | Async file read/write for saving uploaded resumes |

---

### Database — MongoDB (via Motor)
- **What**: A document-oriented NoSQL database that stores data as JSON-like BSON documents.
- **Why MongoDB is ideal here**:
  - Placement data is **semi-structured** — different jobs have different fields, students have varying skills lists.
  - **Flexible schema** — no need for complex table migrations when adding new fields.
  - **Native array support** — skills, certifications, allowed_branches are stored as arrays directly.
  - **Aggregation Pipelines** — used for analytics (e.g., branch-wise placement, monthly trends) without needing complex SQL joins.
  - **Motor** makes all DB operations fully `async`, so they don't block the FastAPI event loop.

### Database Collections (Tables equivalent):
| Collection | Purpose |
|---|---|
| `users` | Stores login credentials, role, active status |
| `student_profiles` | CGPA, branch, skills, resume URL, certifications |
| `companies` | Company name, industry, location, contact details |
| `jobs` | Job postings with eligibility criteria |
| `applications` | Links students to jobs, tracks status lifecycle |
| `reports` | Generated placement reports saved for history |

---

### AI / ML Components — Google Gemini + OpenRouter

#### Primary: Google Gemini 2.0 Flash Lite
- **What**: Google's latest large language model available via REST API.
- **Why**: The free tier offers 15 requests per minute and 1500 requests per day — more than sufficient for a college placement system. It is highly capable at structured JSON generation and text analysis.

#### Fallback: OpenRouter (Multiple Free LLMs)
- **What**: OpenRouter is a gateway that provides access to multiple AI models (LLaMA 3.3 70B, Gemma 3 27B, Mistral, Qwen, etc.) via a single unified API.
- **Why**: Used as a fallback chain — if Gemini fails or rate-limits, the system automatically attempts OpenRouter models in sequence. This ensures **99%+ uptime** for AI features.

---

### APIs Used

| API | Purpose |
|---|---|
| **Google Gemini API** | Primary AI for resume analysis — extract skills, score resume, generate suggestions |
| **OpenRouter API** | Fallback AI provider — chains through 6 free LLM models |
| **FastAPI REST API** | Internal API between frontend and backend |

---

### Authentication Method — JWT (JSON Web Tokens)
- **Access Token**: Short-lived (30 minutes) — sent in `Authorization: Bearer <token>` header.
- **Refresh Token**: Long-lived (7 days) — used to silently obtain a new access token without re-login.
- **Password Hashing**: bcrypt with salt rounds — industry-standard, one-way hashing.
- **Token storage**: Stored in browser cookies (not `localStorage`) for better XSS protection.
- **Role-based guards**: Backend middleware checks user role before executing any protected endpoint.

---

### Deployment Platform
- **Development**: Local — FastAPI on `localhost:8000`, Next.js on `localhost:3000`.
- **Production Ready**: The system is designed to deploy on:
  - **Backend**: Any cloud VM with Python, or Docker container, or services like **Railway / Render**.
  - **Frontend**: **Vercel** (optimal for Next.js — zero-config deployment).
  - **Database**: **MongoDB Atlas** (managed cloud MongoDB).

---

## 7. AI Features Explanation

### What AI is Used For
1. **Resume ATS Scoring** — Evaluates how well a resume would pass automated Applicant Tracking Systems used by companies.
2. **Skill Extraction** — Identifies all technical and soft skills present in the resume.
3. **Gap Analysis** — Identifies missing skills that are critical for the student's field.
4. **Improvement Suggestions** — Gives actionable, specific advice on formatting, keywords, and structure.
5. **Interview Preparation** — Provides curated questions by interview type (Technical, HR, Managerial, Case Study) with hints and sample answers.

---

### How Resume / Job Matching Works
- When a student analyzes their resume, they can optionally **paste a job description**.
- The AI prompt explicitly instructs the model to **compare the resume against the job description** when generating the score and identifying missing skills.
- This creates a **targeted gap analysis** — showing exactly what skills are missing for that specific job.
- Without a job description, the AI performs a **general ATS analysis** based on the student's field.

---

### How ATS Scoring Works
1. The student's resume PDF is uploaded to the server.
2. **PyPDF2** reads all pages and extracts raw text content.
3. The text (max 6000 characters) is embedded into a structured **prompt** sent to the AI.
4. The prompt asks the AI to act as an "**Expert ATS Analyst**" and return a JSON object with `atsScore` (0–100).
5. The score reflects:
   - Presence of industry-relevant keywords.
   - Proper formatting signals (sections, bullet points).
   - Skill density and relevance.
   - Completeness (education, experience, projects, skills sections).
6. The AI is explicitly instructed **not to inflate the score** — ensuring honest, realistic feedback.

---

### How Suggestions Are Generated
- The AI returns an array of `suggestions` — each one is a **specific, actionable improvement**.
- Examples: "Add a quantifiable achievement to your project descriptions", "Include Docker/Kubernetes as you listed DevOps experience", "Use stronger action verbs at the start of bullet points".
- Suggestions are sanitized (HTML tags stripped) and capped at 15 items.
- Extracted skills are capped at 30, missing skills at 20 — to keep output clean and readable.

---

### LLM / NLP Used — Detailed Explanation

#### Model: Google Gemini 2.0 Flash Lite
- **Type**: Large Language Model (LLM) — Transformer-based neural network.
- **NLP Capability**: Gemini understands natural language, reads resume text holistically, extracts meaning (not just keyword matching), and generates human-readable suggestions.
- **How it differs from basic keyword matching**: A keyword matcher would simply count occurrences of words. Gemini **understands context** — e.g., it understands that "built a REST API using Node.js" implies Node.js, Express, REST, and JSON skills even if all terms aren't explicitly listed.

#### Prompt Engineering
- The system uses a carefully crafted prompt that:
  - Sets the AI's persona: "You are an expert ATS resume analyst."
  - Specifies the exact JSON schema expected in the response.
  - Provides rules to prevent hallucination (no inflated scores, no extra text).
  - Embeds the resume text and optional job description clearly.
  - Temperature is set to **0.3** (low) — makes the AI more factual and consistent, less creative.

#### Response Parsing
- The AI response is parsed with robust JSON extraction:
  1. Direct `json.loads()` attempted first.
  2. If that fails, markdown code fences are stripped and re-parsed.
  3. If still failing, regex searches for the first `{...}` block.
  4. If all fail, a `ValueError` is raised and the system returns a friendly error to the student.

#### Fallback Chain (OpenRouter)
- If Gemini fails, the system tries **6 different free AI models** on OpenRouter in order.
- For each model, it retries up to **2 times** on rate-limit errors (HTTP 429) with exponential backoff.
- This multi-provider strategy ensures the AI feature is **always available**.

---

## 8. Folder Structure Explanation

```
Placement Management/
│
├── backend/                         # FastAPI Python backend
│   ├── requirements.txt             # Python dependencies list
│   └── app/
│       ├── main.py                  # App entry point, CORS, lifespan startup
│       ├── api/
│       │   └── v1/
│       │       ├── __init__.py      # Aggregates all API routers
│       │       └── endpoints/
│       │           ├── auth.py      # Register, login, logout, refresh token
│       │           ├── students.py  # Profile CRUD, resume upload
│       │           ├── companies.py # Company management
│       │           ├── jobs.py      # Job posting and retrieval
│       │           ├── applications.py # Apply, track, update status
│       │           ├── analytics.py # Dashboard stats, reports
│       │           ├── interview.py # Get questions, mock interview
│       │           └── ai_resume.py # AI resume analysis endpoint
│       ├── core/
│       │   ├── config.py            # Environment variables (MongoDB URL, secrets)
│       │   ├── enums.py             # All system enums (roles, statuses, job types)
│       │   ├── security.py          # JWT creation/decoding, bcrypt hashing
│       │   └── exceptions.py        # Custom HTTP exception classes
│       ├── db/
│       │   ├── database.py          # MongoDB connection, index creation
│       │   └── helpers.py           # ObjectId serialization, date utilities
│       ├── middleware/
│       │   └── auth.py              # JWT validation, role-based access control
│       ├── schemas/                 # Pydantic request/response models
│       │   ├── auth.py
│       │   ├── student.py
│       │   ├── job.py
│       │   ├── application.py
│       │   ├── interview.py
│       │   └── analytics.py
│       ├── services/                # Business logic layer
│       │   ├── auth_service.py
│       │   ├── student_service.py
│       │   ├── company_service.py
│       │   ├── job_service.py
│       │   ├── application_service.py
│       │   ├── analytics_service.py
│       │   ├── interview_service.py
│       │   └── ai_resume_service.py # Core AI integration logic
│       └── utils/
│           └── file_upload.py       # PDF validation, save, delete
│
├── frontend/                        # Next.js TypeScript frontend
│   ├── package.json                 # Node dependencies
│   ├── tailwind.config.ts           # Tailwind CSS configuration
│   ├── tsconfig.json                # TypeScript configuration
│   └── src/
│       ├── middleware.ts            # Edge middleware: route protection by role
│       ├── app/
│       │   ├── layout.tsx           # Root layout with theme provider
│       │   ├── page.tsx             # Landing/home page
│       │   ├── (auth)/              # Login & Signup pages (public)
│       │   ├── (student)/           # Student dashboard, profile, jobs, applications, AI
│       │   ├── (admin)/             # Admin dashboard, companies, jobs, applications, reports
│       │   └── (management)/        # Management analytics & statistics
│       ├── components/
│       │   ├── ui/                  # Reusable UI atoms (Button, Input, Badge, Card)
│       │   ├── layout/              # DashboardLayout, Sidebar, SearchBar
│       │   ├── shared/              # AIResumeAnalyzer, StatsCard
│       │   └── providers/           # ThemeProvider (dark/light mode)
│       ├── lib/
│       │   ├── auth.ts              # Cookie-based token management
│       │   ├── axios.ts             # Axios instance with interceptors
│       │   └── utils.ts             # Utility functions (class merging, etc.)
│       ├── services/
│       │   └── api.ts               # All API service functions (typed)
│       └── types/
│           └── index.ts             # TypeScript type definitions for all entities
│
├── README.md
└── PROJECT_DOCUMENTATION.md        # This file
```

---

## 9. Database Schema Explanation

### Collection: `users`
```
{
  _id:         ObjectId (auto-generated unique ID),
  email:       String (unique, indexed),
  full_name:   String,
  password:    String (bcrypt hashed),
  role:        Enum ["STUDENT", "PLACEMENT_ADMIN", "COLLEGE_MANAGEMENT"],
  is_active:   Boolean (default: true),
  created_at:  DateTime,
  updated_at:  DateTime
}
```

### Collection: `student_profiles`
```
{
  _id:            ObjectId,
  user_id:        String (references users._id, unique, indexed),
  roll_number:    String,
  branch:         String (indexed),
  semester:       Integer (1–10),
  cgpa:           Float (0.0–10.0, indexed),
  phone:          String,
  date_of_birth:  String (optional),
  address:        String (optional),
  skills:         Array of Strings,
  certifications: Array of Strings,
  linkedin_url:   String (optional),
  github_url:     String (optional),
  about:          String (optional),
  resume_url:     String (path to uploaded PDF),
  created_at:     DateTime,
  updated_at:     DateTime
}
```

### Collection: `companies`
```
{
  _id:             ObjectId,
  name:            String (unique, indexed),
  industry:        String (indexed),
  description:     String (optional),
  website:         String (optional),
  location:        String,
  contact_email:   String,
  contact_person:  String (optional),
  logo_url:        String (optional),
  created_at:      DateTime,
  updated_at:      DateTime
}
```

### Collection: `jobs`
```
{
  _id:                  ObjectId,
  title:                String,
  company_id:           String (references companies._id, indexed),
  description:          String,
  requirements:         String,
  required_skills:      Array of Strings (indexed),
  job_type:             Enum ["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT"],
  location:             String,
  salary_min:           Float (optional),
  salary_max:           Float (optional),
  min_cgpa:             Float (eligibility filter),
  allowed_branches:     Array of Strings (eligibility filter),
  openings:             Integer,
  application_deadline: String (optional),
  status:               Enum ["OPEN", "CLOSED", "PAUSED"] (indexed),
  created_at:           DateTime,
  updated_at:           DateTime
}
```

### Collection: `applications`
```
{
  _id:             ObjectId,
  job_id:          String (indexed),
  student_id:      String (indexed),
  cover_letter:    String (optional),
  status:          Enum ["PENDING", "UNDER_REVIEW", "SHORTLISTED",
                         "INTERVIEW_SCHEDULED", "SELECTED", "REJECTED", "WITHDRAWN"],
  remarks:         String (optional, admin notes),
  interview_date:  String (optional),
  interview_link:  String (optional, meeting URL),
  resume_url:      String (snapshot of resume at time of application),
  applied_at:      DateTime,
  updated_at:      DateTime
}
Unique index: (student_id + job_id) — prevents duplicate applications
```

### Collection: `reports`
```
{
  _id:          ObjectId,
  report_type:  String (indexed),
  title:        String,
  data:         Object (full report data),
  created_by:   String (admin user_id),
  created_at:   DateTime (indexed)
}
```

---

## 10. Security Features Implemented

1. **Password Hashing with bcrypt**
   - All passwords are hashed with bcrypt + random salt before storing.
   - Raw passwords are never stored in the database.
   - Even if the database is stolen, passwords cannot be reversed.

2. **JWT Authentication (Access + Refresh Tokens)**
   - Short-lived access tokens (30 min) reduce the window of token theft.
   - Refresh tokens (7 days) allow silent renewal without re-login.
   - Tokens are signed with HMAC-SHA256 using a secret key.
   - Token type (`access` or `refresh`) is embedded in the payload — prevents a refresh token from being used as an access token.

3. **Role-Based Access Control (RBAC)**
   - Every protected endpoint is guarded by role middleware: `require_student`, `require_admin`, `require_management`, `require_admin_or_management`.
   - A student cannot access admin endpoints and vice versa — enforced at the backend level.
   - At the frontend, Next.js Middleware enforces route-level role isolation.

4. **CORS (Cross-Origin Resource Sharing)**
   - Only whitelisted origins (e.g., `localhost:3000`) can make API calls.
   - Configured via `ALLOWED_ORIGINS` environment variable.

5. **File Upload Validation**
   - Only `.pdf` files with `application/pdf` MIME type are accepted.
   - File size is limited to 5MB.
   - Files are saved with a UUID-based unique name — prevents path traversal attacks.

6. **Account Active Check**
   - Every request verifies that the user's `is_active` flag is `true`.
   - Admins can deactivate accounts without deleting data.

7. **Application Eligibility Enforcement**
   - Server-side validation ensures students cannot apply to jobs they are ineligible for (CGPA below minimum, wrong branch).
   - Duplicate applications are blocked by a unique compound index in MongoDB.

8. **Global Exception Handler**
   - All unhandled exceptions return a generic `500 Internal Server Error` — sensitive stack traces are never exposed to clients.
   - Errors are logged server-side for debugging.

9. **Environment-Based Secrets**
   - All secrets (JWT keys, MongoDB URL, AI API keys) are loaded from a `.env` file using `pydantic-settings`.
   - Secrets are never hardcoded in source code.

10. **Pydantic Input Validation**
    - All incoming request bodies are validated by Pydantic models.
    - CGPA must be between 0.0 and 10.0, semester between 1 and 10.
    - Invalid data types, missing fields, or out-of-range values automatically return a 422 Unprocessable Entity error.

---

## 11. Key Modules Explanation

### Module 1: Authentication Module (`/auth`)
- **Endpoints**: `POST /register`, `POST /login`, `POST /logout`, `POST /refresh`, `GET /me`
- **Functionality**: User registration with role selection, JWT-based login, token refresh.
- **Who Uses It**: All users (Students, Admins, Management).

---

### Module 2: Student Module (`/students`)
- **Endpoints**: `POST /profile`, `GET /profile/me`, `PUT /profile/me`, `POST /resume`, `GET /students`, `GET /profile/:id`
- **Functionality**:
  - Students create and update academic profiles with skills and certifications.
  - Resume (PDF) upload with type and size validation.
  - Admins can browse all student profiles with filters.
- **Who Uses It**: Students (own profile), Admins (view all).

---

### Module 3: Company Module (`/companies`)
- **Endpoints**: `GET /companies`, `POST /companies`, `PUT /companies/:id`, `DELETE /companies/:id`
- **Functionality**: Full CRUD for companies. Each company becomes the parent of job listings.
- **Who Uses It**: Placement Admins only.

---

### Module 4: Job Module (`/jobs`)
- **Endpoints**: `GET /jobs`, `POST /jobs`, `PUT /jobs/:id`, `DELETE /jobs/:id`, `GET /jobs/:id`
- **Functionality**:
  - Admins post jobs specifying eligibility: minimum CGPA, allowed branches, required skills, salary range, deadline.
  - Job status: OPEN, CLOSED, or PAUSED.
  - Students see only jobs they are eligible for on the Job Board.
- **Who Uses It**: Admins (post/manage), Students (view/apply).

---

### Module 5: Application Module (`/applications`)
- **Endpoints**: `POST /applications`, `GET /applications/my`, `GET /applications`, `PATCH /applications/:id/status`
- **Functionality**:
  - Students apply with a cover letter.
  - Backend checks eligibility (CGPA, branch, resume uploaded, job is open, no duplicate).
  - Admits students automatically through a **7-stage pipeline**: Pending → Under Review → Shortlisted → Interview Scheduled → Selected / Rejected / Withdrawn.
  - Interview date and meeting link are added when status is set to `INTERVIEW_SCHEDULED`.
- **Who Uses It**: Students (apply/track), Admins (shortlist/decide).

---

### Module 6: Analytics & Reports Module (`/analytics`)
- **Endpoints**: `GET /analytics/dashboard`, `POST /reports`, `GET /reports`
- **Functionality**:
  - Real-time placement statistics: total students, placed count, placement %, avg package, highest package.
  - Branch-wise breakdown of placement performance.
  - Company-wise hiring totals.
  - Application status distribution (for pie chart).
  - Monthly application trends (for line chart).
  - Saveable reports for future reference.
- **Who Uses It**: Placement Admins, College Management.

---

### Module 7: AI Resume Analyzer (`/ai`)
- **Endpoint**: `POST /ai/analyze-existing-resume`
- **Functionality**:
  - Fetches student's uploaded PDF.
  - Extracts text with PyPDF2.
  - Sends to Gemini / OpenRouter for analysis.
  - Returns: ATS Score (0–100), Missing Skills, Improvement Suggestions, Extracted Skills.
  - Optional: Compare against a specific job description.
- **Who Uses It**: Students only.

---

### Module 8: Interview Preparation (`/interview`)
- **Endpoints**: `POST /interview/questions`, `POST /interview/mock`
- **Functionality**:
  - Returns curated interview questions by type (Technical, HR, Managerial, Case Study) and difficulty (easy, medium, hard).
  - Each question includes a hint and optional sample answer.
  - Mock interview chat simulates a real interviewer.
- **Who Uses It**: Students only.

---

## 12. Unique Features of This Project

1. **Dual AI Provider with Automatic Fallback**
   - Not just one AI API — the system chains through 7 different AI models (Gemini + 6 OpenRouter models) to guarantee the AI feature never goes down.

2. **ATS Score + Job Description Matching**
   - Students can paste any job description and instantly see how well their resume matches that specific job — a feature even professional tools charge for.

3. **7-Stage Application Pipeline**
   - The application lifecycle goes through 7 clear stages with admin control at each point — complete end-to-end placement tracking.

4. **Eligibility Engine**
   - Jobs can specify exact eligibility: CGPA threshold + specific branches allowed. Students outside criteria are automatically blocked from applying.
   - This prevents incorrect data entry and saves admin time.

5. **Three Distinct Role Dashboards**
   - Student, Placement Admin, and College Management each have completely separate UIs and permissions — not just a single dashboard with hidden buttons.

6. **Branch-Wise + Company-Wise Analytics**
   - Management can see detailed analytics by engineering branch and by company — providing insights for future planning and accreditation reports.

7. **Resume Snapshot on Application**
   - When a student applies, the current resume URL is captured in the application record. Even if the student later updates their resume, the admin always sees the resume that was submitted at the time of application.

8. **Dark Mode + Light Mode**
   - Full dark/light theme support with persistent preference — making the UI comfortable for all users.

9. **Interview Question Bank by Type and Difficulty**
   - Curated question bank for HR, Technical, Managerial, and Case Study interviews — with STAR method hints, sample answers, and randomized selection for re-practice.

10. **Production-Ready Indexing**
    - MongoDB indexes are automatically created on startup — ensuring fast queries even with thousands of students and applications.

---

## 13. Real-World Use Case

### Scenario: ABC Engineering College Placement Season

- **October**: Placement Admin logs in, creates companies (TCS, Infosys, Google) and posts jobs with CGPA and branch filters.
- **November**: 500 students log in, complete profiles, upload resumes, and browse 30 available jobs on the Job Board. Smart eligibility filtering shows each student only the jobs they qualify for.
- **November–December**: Students use the AI Resume Analyzer to improve their resumes before applying. 400 applications are submitted.
- **December**: Admin logs in, views all applications, filters by branch and CGPA, and shortlists 100 students. Status changes to `SHORTLISTED` and students are notified.
- **January**: Admin sets interview dates and Google Meet links. Application status changes to `INTERVIEW_SCHEDULED` and students see interview details in their dashboard.
- **January–February**: Interviews happen. Admin marks final status as `SELECTED` or `REJECTED`. 80 students are selected.
- **February**: College Management logs into the analytics dashboard, views 16% placement rate, branch-wise data, exports a report for NAAC accreditation submission.

---

## 14. Future Enhancements

1. **Real-Time Notifications**
   - Integrate WebSockets or push notifications (Firebase FCM) to alert students when their application status changes, without needing to refresh the page.

2. **Live Mock AI Interview**
   - Replace the static question bank with a real LLM-powered conversational interview — the AI asks questions, evaluates student answers, and gives a final performance score.

3. **Email Notifications**
   - Send automated emails (via SendGrid or SMTP) when applications are shortlisted, interviews are scheduled, or offers are made.

4. **Company Recruiter Portal**
   - Add a fourth role: `RECRUITER` — allowing external company HR teams to log in, post jobs, and directly view applications without going through the placement admin.

5. **Resume Builder**
   - Let students build a resume inside the platform using templates, automatically formatted and optimized for ATS.

6. **Skill Recommendation Engine**
   - Analyze which skills appear most in posted jobs vs. what students have, and recommend specific courses or certifications to bridge the gap.

7. **Offer Letter Management**
   - Allow admins to generate and upload offer letters, which students can accept or decline from their dashboard.

8. **Mobile Application**
   - Build a React Native app for iOS/Android using the same backend API — allowing students to apply and track placements from their phones.

9. **Alumni Placement Data**
   - Add historical placement records linking alumni to companies — helping current students understand career paths.

10. **OAuth Login**
    - Add "Login with Google" / "Login with LinkedIn" for faster, passwordless authentication.

---

## 15. Conclusion

**SmartHire** is a complete, production-ready College Placement Management System that solves a real, widespread problem in education institutions. It is not just a CRUD application — it integrates:

- **Intelligent AI** (LLMs via Gemini and OpenRouter) for resume analysis and interview preparation.
- **Role-based access control** ensuring data security across three distinct user types.
- **A complete 7-stage application lifecycle** automating the entire placement process.
- **Real-time analytics** giving management actionable insights into placement performance.
- **Modern, responsive UI** with dark mode, animations, and clean design.

The project demonstrates expertise in **full-stack development** (Next.js + FastAPI), **database design** (MongoDB with proper indexing), **AI integration** (Prompt Engineering + LLM APIs), and **software engineering best practices** (separation of concerns, environment-based configuration, input validation, error handling).

This system is immediately deployable to a real college and can scale to handle thousands of students and hundreds of companies with minimal infrastructure changes — making it both **technically impressive** and **practically valuable**.

---

*Documentation generated for SmartHire v1.0.0 — February 2026*
