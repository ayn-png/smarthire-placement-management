# 🎓 SmartHire — College Placement Management System

Enterprise-grade web application for managing college placements with AI interview preparation.

---

## 🏗️ Architecture

```
placement-system/
├── backend/                 # FastAPI Python backend
│   ├── app/
│   │   ├── api/v1/endpoints/   # Route handlers
│   │   ├── core/               # Config, security, enums, exceptions
│   │   ├── db/                 # MongoDB connection, helpers
│   │   ├── middleware/         # Auth dependencies
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── services/           # Business logic layer
│   │   ├── utils/              # File upload utilities
│   │   └── main.py             # Application entry point
│   ├── .env
│   └── requirements.txt
│
└── frontend/                # Next.js 14 App Router frontend
    └── src/
        ├── app/
        │   ├── (auth)/          # Login, Signup pages
        │   ├── (student)/       # Student dashboard pages
        │   ├── (admin)/         # Admin dashboard pages
        │   └── (management)/    # Management dashboard pages
        ├── components/          # Reusable UI components
        ├── lib/                 # Axios, auth utilities
        ├── services/            # API service layer
        └── types/               # TypeScript type definitions
```

---

## 👥 User Roles

| Role | Access |
|------|--------|
| `STUDENT` | Profile, Resume, Jobs, Applications, AI Interview Prep |
| `PLACEMENT_ADMIN` | Companies, Jobs, Applications Review, Reports |
| `COLLEGE_MANAGEMENT` | Analytics, Statistics, Reports (read-only) |

---

## 🚀 Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB 6.0+ (local or Atlas)

---

### Backend Setup

```bash
cd placement-system/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate     # Linux/Mac
# OR
venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URL and secret keys

# Create uploads directory
mkdir -p uploads/resumes

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**API docs available at:** http://localhost:8000/api/docs

---

### Frontend Setup

```bash
cd placement-system/frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:8000

# Run development server
npm run dev
```

**App available at:** http://localhost:3000

---

## 📡 API Routes Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout |
| GET  | `/api/v1/auth/me` | Get current user |

### Students
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/students/profile` | STUDENT | Create profile |
| GET | `/api/v1/students/profile/me` | STUDENT | Get my profile |
| PUT | `/api/v1/students/profile/me` | STUDENT | Update profile |
| POST | `/api/v1/students/resume` | STUDENT | Upload resume PDF |
| GET | `/api/v1/students/` | ADMIN/MGMT | List all students |
| GET | `/api/v1/students/profile/{id}` | ALL | Get student by ID |

### Companies
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/companies/` | ALL | List companies |
| POST | `/api/v1/companies/` | ADMIN | Create company |
| GET | `/api/v1/companies/{id}` | ALL | Get company |
| PUT | `/api/v1/companies/{id}` | ADMIN | Update company |
| DELETE | `/api/v1/companies/{id}` | ADMIN | Delete company |

### Jobs
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/jobs/` | ALL | List jobs |
| POST | `/api/v1/jobs/` | ADMIN | Create job |
| GET | `/api/v1/jobs/{id}` | ALL | Get job |
| PUT | `/api/v1/jobs/{id}` | ADMIN | Update job |
| DELETE | `/api/v1/jobs/{id}` | ADMIN | Delete job |

### Applications
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/applications/` | STUDENT | Apply to job |
| GET | `/api/v1/applications/my` | STUDENT | My applications |
| GET | `/api/v1/applications/` | ADMIN | All applications |
| GET | `/api/v1/applications/{id}` | ALL | Get application |
| PATCH | `/api/v1/applications/{id}/status` | ADMIN | Update status |
| POST | `/api/v1/applications/{id}/withdraw` | STUDENT | Withdraw |

### Analytics
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/analytics/dashboard` | ADMIN/MGMT | Full analytics |
| POST | `/api/v1/analytics/reports` | ADMIN | Create report |
| GET | `/api/v1/analytics/reports` | ADMIN/MGMT | List reports |

### AI Interview
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/interview/questions` | STUDENT | Generate questions |
| POST | `/api/v1/interview/mock-chat` | STUDENT | Mock interview chat |

---

## 🗄️ Database Schema

### users
```json
{
  "_id": ObjectId,
  "email": "string (unique, indexed)",
  "hashed_password": "string",
  "full_name": "string",
  "role": "STUDENT | PLACEMENT_ADMIN | COLLEGE_MANAGEMENT",
  "is_active": true,
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### student_profiles
```json
{
  "_id": ObjectId,
  "user_id": "string (ref: users._id, unique)",
  "full_name": "string",
  "email": "string",
  "roll_number": "string (unique)",
  "branch": "string",
  "semester": "int",
  "cgpa": "float",
  "phone": "string",
  "skills": ["string"],
  "certifications": ["string"],
  "resume_url": "string | null",
  "linkedin_url": "string | null",
  "github_url": "string | null",
  "about": "string | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### companies
```json
{
  "_id": ObjectId,
  "name": "string (unique)",
  "industry": "string",
  "location": "string",
  "contact_email": "string",
  "contact_person": "string | null",
  "website": "string | null",
  "description": "string | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### jobs
```json
{
  "_id": ObjectId,
  "title": "string",
  "company_id": "string (ref: companies._id)",
  "description": "string",
  "requirements": "string",
  "required_skills": ["string"],
  "job_type": "FULL_TIME | PART_TIME | INTERNSHIP | CONTRACT",
  "location": "string",
  "salary_min": "float | null",
  "salary_max": "float | null",
  "min_cgpa": "float",
  "allowed_branches": ["string"],
  "openings": "int",
  "application_deadline": "string | null",
  "status": "OPEN | CLOSED | PAUSED",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### applications
```json
{
  "_id": ObjectId,
  "job_id": "string (ref: jobs._id)",
  "student_id": "string (ref: users._id)",
  "cover_letter": "string | null",
  "status": "PENDING | UNDER_REVIEW | SHORTLISTED | INTERVIEW_SCHEDULED | SELECTED | REJECTED | WITHDRAWN",
  "remarks": "string | null",
  "interview_date": "string | null",
  "interview_link": "string | null",
  "resume_url": "string | null",
  "applied_at": "datetime",
  "updated_at": "datetime"
}
```

---

## 🔐 Authentication Flow

1. **Register** → Server hashes password with bcrypt, creates user, returns JWT access + refresh tokens
2. **Login** → Verifies email + password, returns JWT tokens + user role
3. **Authenticated Request** → Client sends `Authorization: Bearer <access_token>` header
4. **Token Refresh** → When access token expires (401 response), client uses refresh token to get new pair
5. **Logout** → Client removes tokens from cookies

**Frontend middleware** (`src/middleware.ts`) intercepts all requests and:
- Redirects unauthenticated users to `/login`
- Redirects authenticated users to their role-specific dashboard from root/auth pages
- Prevents cross-role access (e.g., students cannot access `/admin` routes)

---

## 🚀 Production Deployment

### Backend (Render/Railway/EC2)
```bash
# Install dependencies
pip install -r requirements.txt

# Update .env for production
SECRET_KEY=<strong-random-key-min-32-chars>
REFRESH_SECRET_KEY=<different-strong-key>
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/
ALLOWED_ORIGINS=https://yourfrontend.vercel.app
ENVIRONMENT=production

# Run with gunicorn
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend (Vercel)
```bash
# Set environment variables in Vercel dashboard:
NEXT_PUBLIC_API_URL=https://your-backend-domain.com

# Deploy
npm run build
vercel --prod
```

### Docker (Optional)
```dockerfile
# Backend Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p uploads/resumes
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 🔧 Environment Variables

### Backend (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017` |
| `DATABASE_NAME` | MongoDB database name | `placement_db` |
| `SECRET_KEY` | JWT signing key (min 32 chars) | — |
| `REFRESH_SECRET_KEY` | Refresh token key (min 32 chars) | — |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | `7` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `http://localhost:3000` |
| `UPLOAD_DIR` | File upload directory | `uploads` |
| `MAX_FILE_SIZE_MB` | Max resume file size | `5` |

### Frontend (.env.local)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |

---

## 🛡️ Security Features

- ✅ Passwords hashed with bcrypt (cost factor 12)
- ✅ JWT access tokens (30 min expiry)
- ✅ JWT refresh tokens (7 day expiry, separate secret)
- ✅ Role-Based Access Control on all API endpoints
- ✅ CORS properly configured
- ✅ File type validation (PDF only for resumes)
- ✅ File size limits enforced server-side
- ✅ Input validation via Pydantic schemas
- ✅ Frontend route protection via Next.js middleware
- ✅ Secure httpOnly-like cookie storage via js-cookie with sameSite=strict
- ✅ Auto token refresh on 401 responses
