# SmartHire — Placement Management System

## What I Want to Achieve

A full-featured college placement management portal that connects students, companies, and administrators. The system should:

- Let **students** build their profiles, upload resumes, browse and apply for jobs, track application status, and prepare for interviews using AI tools
- Let **companies** post job openings, review applicants, shortlist candidates, and manage their hiring pipeline
- Let **admins** oversee all placements, manage users, export reports, bulk-update application statuses, and monitor system health
- Provide **AI-powered features**: resume analysis (ATS scoring, strengths/weaknesses, skill gaps), mock interview chat, and job recommendations

---

## Architecture

| Layer | Technology | Port |
|-------|-----------|------|
| Frontend | Next.js 14 (App Router) | 3000 |
| Backend | FastAPI + Firebase Firestore | 8000 |
| Database | Firebase Firestore (project: `smarthire-82a1b`) | — |
| Auth | Firebase Auth (email/password) + custom claims | — |
| File Storage | Cloudinary (resumes, avatars, logos) | — |
| AI/LLM | OpenAI GPT-4o-mini (resume), Mistral (interview) | — |

---

## Development Setup

### Prerequisites
1. Download Firebase service account JSON from Firebase Console → Project Settings → Service Accounts → Generate new private key
2. Save it as `D:\Placement Management\backend\firebase-service-account.json`
3. Add `firebase-service-account.json` to `.gitignore`

### Start Backend
```bash
cd "D:/Placement Management/backend"
python -m uvicorn app.main:app --reload --port 8000
```

### Start Frontend
```bash
cd "D:/Placement Management/frontend"
npm run dev
```

### API Docs
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

---

## Module Overview

### Student Module (`/student/*`)
- **Profile** — name, branch, CGPA, skills, bio
- **Resume** — PDF upload (Cloudinary), AI analysis (ATS score, strengths, weaknesses, skill gaps)
- **Jobs** — browse open positions, filter by type, apply with cover letter
- **Applications** — track status (Pending → Shortlisted → Interview → Selected/Rejected), withdraw applications
- **Interview Prep** — AI mock interview chat (Mistral), practice questions by role/skills
- **Notifications** — real-time alerts for application updates and new jobs

### Company Module (`/company/*`)
- **Profile** — company info, logo upload (Cloudinary)
- **Jobs** — create and manage job postings
- **Applicants** — view and manage applicants for their jobs

### Admin Module (`/admin/*`)
- **Dashboard** — analytics, placement statistics, system health
- **Students** — view/manage all student profiles
- **Companies** — view/manage all companies
- **Jobs** — full CRUD on all job postings, CSV export
- **Applications** — bulk status updates, date/branch filters
- **Notifications** — system-wide broadcasts

---

## Key Files

### Backend
| File | Purpose |
|------|---------|
| `backend/app/core/config.py` | All env vars via Pydantic Settings — add new keys here |
| `backend/app/core/firebase_init.py` | Firebase Admin SDK singleton (Firestore + Auth) |
| `backend/app/core/firebase_jwt.py` | Firebase ID token verification |
| `backend/app/main.py` | FastAPI app, middleware (CORS, rate limiting, logging) |
| `backend/app/middleware/auth.py` | Firebase JWT auth — **DO NOT MODIFY** |
| `backend/app/utils/file_upload.py` | File upload helpers (Cloudinary wrappers) |
| `backend/app/services/cloudinary_service.py` | Cloudinary upload/delete (async with asyncio.to_thread) |
| `backend/app/api/v1/endpoints/` | All API endpoint routers |
| `backend/app/services/` | Business logic services |

### Frontend
| File | Purpose |
|------|---------|
| `frontend/src/lib/firebase.ts` | Firebase Web SDK initialization |
| `frontend/src/contexts/AuthContext.tsx` | Firebase auth context (user, role, isLoaded, getToken) |
| `frontend/src/lib/axios.ts` | Axios instance with Firebase token interceptor |
| `frontend/src/services/api.ts` | All API service functions |
| `frontend/src/lib/utils.ts` | `getFileUrl()`, `formatSalaryRange()`, status colors |
| `frontend/src/components/providers/ThemeProvider.tsx` | next-themes dark mode |
| `frontend/src/components/layout/Sidebar.tsx` | Theme-aware sidebar |
| `frontend/src/app/(student)/` | Student pages |
| `frontend/src/app/(company)/` | Company pages |
| `frontend/src/app/(admin)/` | Admin pages |

---

## Critical Rules

### Authentication — DO NOT TOUCH
The Firebase auth system is complete. Do not modify:
- `backend/app/core/firebase_init.py`
- `backend/app/core/firebase_jwt.py`
- `backend/app/middleware/auth.py`
- `frontend/src/lib/firebase.ts`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/lib/axios.ts` (auth interceptors)
- Any `/auth/*` endpoints
- Firebase configuration in `.env` / `.env.local`

### Auth Flow
1. User signs up → `createUserWithEmailAndPassword` → redirected to `/signup/role-select`
2. User picks role → `/api/set-role` sets Firebase custom claim `{role: "STUDENT"}` → calls backend `/auth/firebase-sync` → creates Firestore user doc
3. User logs in → `signInWithEmailAndPassword` → reads `role` from ID token claims → sets `__role` cookie → redirects to dashboard
4. Every API request → `Authorization: Bearer <Firebase ID token>` → backend verifies with `firebase_admin.auth.verify_id_token()`
5. Role stored in: Firebase custom claim, `__role` cookie (for middleware), Firestore `users` collection

### Firestore Collections
| Collection | Document ID | Purpose |
|-----------|-------------|---------|
| `users` | firebase_uid | User account + role |
| `student_profiles` | firebase_uid | Student profile details |
| `companies` | auto-generated | Company records |
| `jobs` | auto-generated | Job postings |
| `applications` | auto-generated | Job applications |
| `notifications` | auto-generated | In-app notifications |
| `reports` | auto-generated | Analytics reports |

### Firestore SDK (Backend)
- The Python Firestore SDK is **synchronous** — ALL calls must be wrapped in `asyncio.to_thread()`
- Use `asyncio.gather()` for parallel Firestore reads
- No aggregation pipelines — use Python `Counter`, `groupby`, list comprehensions instead
- Firestore `where("x", "in", ids)` supports max 30 items — batch in groups of 30

### Environment Variables
Always add new env vars as fields in `backend/app/core/config.py` Settings class.
Never use `os.getenv()` — always use `settings.<KEY>`.

### File URLs
- All uploads go to Cloudinary → return full HTTPS URLs
- Frontend: use `getFileUrl()` from `lib/utils.ts` to handle URL prefixing

### Salary Format
- Stored as LPA (e.g., 5 = ₹5 LPA)
- Use `formatSalaryRange()` from `lib/utils.ts`, NOT `DollarSign` icon

### Async in Backend
- All Cloudinary SDK calls are synchronous — must be wrapped in `asyncio.to_thread()`
- All Firestore SDK calls are synchronous — must be wrapped in `asyncio.to_thread()`
- Sync PDF I/O (pdfplumber/pymupdf) must also run in `asyncio.to_thread()`

### Dark Mode
- `darkMode: "class"` in Tailwind
- All status badges need both light and `dark:` variants in `getStatusColor()` / `getJobTypeBadge()`

---

## Environment Variables Required

### Backend (`backend/.env`)
| Variable | Purpose |
|---------|---------|
| `FIREBASE_PROJECT_ID` | Firebase project ID (`smarthire-82a1b`) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to service account JSON file |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service account JSON as string (overrides file path) |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | File storage |
| `OPENAI_API_KEY` | Resume AI analysis |
| `MISTRAL_API_KEY` | Mock interview chat |
| `SMTP_*` | Email notifications |
| `INTERNAL_API_SECRET` | Next.js → FastAPI server calls |

### Frontend (`frontend/.env.local`)
| Variable | Purpose |
|---------|---------|
| `NEXT_PUBLIC_API_URL` | Backend URL (default: http://localhost:8000) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web SDK API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_*` | Other Firebase Web SDK config |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service account JSON (for set-role API route) |

---

## Known Fixes Applied
See `memory/MEMORY.md` for full list. Key ones:
1. Cloudinary uploads wrapped in `asyncio.to_thread()` — fixes resume upload blocking event loop
2. Resume content-type accepts `application/octet-stream` when filename is `.pdf` — browser compat
3. `pymupdf` 1.27.2 required on Windows (1.24.x had DLL load error)
4. All AI API keys declared in `Settings` class, not `os.getenv()`
5. **Firebase migration**: Removed Clerk + MongoDB; replaced with Firebase Auth + Firestore
   - All Firestore SDK calls in `asyncio.to_thread()` for FastAPI compatibility
   - Python-side aggregation replaces MongoDB pipelines in analytics_service.py
   - `AuthContext.tsx` replaces `ClerkProvider` + `ClerkTokenBridge`
   - Cookie-based middleware (`__session` + `__role`) replaces `clerkMiddleware`
