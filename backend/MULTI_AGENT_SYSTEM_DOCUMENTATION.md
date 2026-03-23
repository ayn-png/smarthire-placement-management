# Multi-Agent AI System Documentation

## SmartHire Portal - Production-Ready Multi-Agent Architecture

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [API Endpoints](#api-endpoints)
7. [Agent Details](#agent-details)
8. [LangSmith Integration](#langsmith-integration)
9. [Testing](#testing)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Multi-Agent AI System in SmartHire Portal uses **LangGraph** for orchestration, **LangChain** for LLM pipelines, and **LangSmith** for monitoring and tracing. It provides intelligent resume analysis and job matching through a Supervisor Agent that coordinates multiple specialized sub-agents.

### Key Features

- **Automated Resume Extraction**: Multi-method PDF extraction with OCR fallback
- **Intelligent Job Matching**: Semantic similarity-based job recommendations
- **Workflow Orchestration**: LangGraph-powered agent coordination
- **Error Recovery**: Automatic retry logic and fallback mechanisms
- **Full Tracing**: LangSmith integration for monitoring and debugging
- **Production-Ready**: Async execution, proper error handling, scalability

### Technology Stack

- **LangGraph 0.2.0+**: Agent workflow orchestration
- **LangChain**: LLM integration and pipelines
- **LangSmith**: Tracing, monitoring, and evaluation
- **OpenAI GPT-4o-mini**: Cost-effective LLM for analysis
- **OpenAI Embeddings**: Semantic similarity matching
- **FastAPI**: Async API endpoints
- **MongoDB**: Document storage

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND                      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │         API Endpoint: /multi-agent/analyze        │ │
│  └────────────────────┬──────────────────────────────┘ │
│                       │                                 │
│  ┌────────────────────▼──────────────────────────────┐ │
│  │           SUPERVISOR AGENT (LangGraph)            │ │
│  │                                                    │ │
│  │  ┌──────────────────────────────────────────┐    │ │
│  │  │  StateGraph Workflow                     │    │ │
│  │  │  • Node: Resume Extraction               │    │ │
│  │  │  • Node: Validate Extraction             │    │ │
│  │  │  • Node: Job Matching                    │    │ │
│  │  │  • Node: Validate Matches                │    │ │
│  │  │  • Node: Error Handling                  │    │ │
│  │  │  • Conditional Edges for routing         │    │ │
│  │  └──────────────────────────────────────────┘    │ │
│  │                                                    │ │
│  │     ┌──────────────┐      ┌──────────────┐       │ │
│  │     │   RESUME     │      │  JOB MATCHING│       │ │
│  │     │ EXTRACTION   │      │    AGENT     │       │ │
│  │     │   AGENT      │      │              │       │ │
│  │     └──────────────┘      └──────────────┘       │ │
│  └────────────────────────────────────────────────┘ │
│                       │                               │
│  ┌────────────────────▼──────────────────────────┐  │
│  │         LANGCHAIN COMPONENTS                  │  │
│  │  • ChatOpenAI (gpt-4o-mini)                   │  │
│  │  • OpenAIEmbeddings (text-embedding-3-small) │  │
│  │  • PyPDFLoader                                │  │
│  │  • JsonOutputParser                           │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
┌────────▼─────┐ ┌────▼──────┐ ┌───▼────────┐
│   MongoDB    │ │ OpenAI API│ │ LangSmith  │
│              │ │           │ │   Cloud    │
│ • Jobs       │ │ • GPT-4o  │ │            │
│ • Users      │ │ • Embed   │ │ • Traces   │
│ • Profiles   │ │           │ │ • Metrics  │
└──────────────┘ └───────────┘ └────────────┘
```

### Workflow Flow

```
START
  ↓
[Supervisor: Initialize State]
  ↓
[Resume Extraction Agent]
  ├─ Extract PDF text (5-method cascade)
  ├─ Structure with LLM (GPT-4o-mini)
  └─ Calculate confidence score
  ↓
[Supervisor: Validate Extraction]
  ├─ Check confidence score (>= 0.4)
  ├─ Retry if needed (max 3 attempts)
  └─ Decide: Proceed or Retry or Error
  ↓
[Job Matching Agent]
  ├─ Fetch active jobs from MongoDB
  ├─ Filter by eligibility (CGPA, branch)
  ├─ Calculate skill similarity scores
  ├─ Rank jobs by overall match score
  ├─ Generate explanations with LLM
  └─ Return top 5 recommendations
  ↓
[Supervisor: Validate Matches]
  ├─ Check if matches found
  └─ Finalize results
  ↓
[END: Return Results to API]
```

---

## Components

### 1. Supervisor Agent (`supervisor_agent.py`)

**Role**: Main orchestrator that manages the entire multi-agent workflow using LangGraph.

**Responsibilities**:
- Control workflow transitions between agents
- Validate outputs from each agent
- Handle error recovery and retries
- Maintain shared state (AgentState)
- Provide LangSmith tracing

**LangGraph Nodes**:
- `resume_extraction`: Execute Resume Extraction Agent
- `validate_extraction`: Validate extraction quality
- `job_matching`: Execute Job Matching Agent
- `validate_matches`: Validate matching results
- `handle_error`: Error handling and fallback

**Conditional Edges**:
- `should_retry_extraction`: Decide retry or proceed after extraction
- `should_proceed_to_matching`: Decide whether to proceed to matching
- `should_retry_matching`: Decide retry or proceed after matching

**State Management**:
- Uses `AgentState` Pydantic model
- Shared state flows between all agents
- Tracks errors, warnings, retry counts
- Records trace IDs for monitoring

### 2. Resume Extraction Agent (`resume_extraction_agent.py`)

**Role**: Extract and structure resume data from PDF files.

**Capabilities**:
- **Multi-Method PDF Extraction** (5-method cascade):
  1. PyPDFLoader (LangChain) - Primary
  2. PyMuPDF (fitz) - Secondary
  3. pdfplumber - Tertiary
  4. pypdf - Quaternary
  5. Tesseract OCR - Final fallback for scanned PDFs

- **LLM Structuring**:
  - Uses GPT-4o-mini with temperature=0 (deterministic)
  - JSON output with Pydantic schema validation
  - Extracts: Personal info, Skills, Education, Experience, Projects, Certifications

- **Quality Scoring**:
  - Confidence score calculation (0.0 - 1.0)
  - Weighted scoring: Personal info (40%), Skills (20%), Education (20%), Experience/Projects (20%)
  - Status: "success" (>= 0.7), "partial_success" (>= 0.4), "failed" (< 0.4)

**Input**: PDF file path
**Output**: `ResumeExtractionResult` with structured data and metadata

### 3. Job Matching Agent (`job_matching_agent.py`)

**Role**: Match student resumes with relevant job postings.

**Capabilities**:
- **Job Fetching**: Retrieves active jobs from MongoDB
- **Eligibility Filtering**:
  - CGPA requirements
  - Branch/department requirements
  - Experience level matching (fresher, intern, senior)

- **Skill Similarity Calculation**:
  - Jaccard similarity for skill overlap
  - Case-insensitive matching
  - Weighted scoring (70% skill match + 30% eligibility)

- **LLM-Powered Explanations**:
  - Uses GPT-4o-mini to analyze matches
  - Generates reasons for recommendations
  - Identifies matching and missing skills
  - Provides actionable feedback

- **Top-K Ranking**: Returns top 5 job recommendations with scores

**Input**: `ExtractedResume` + user preferences
**Output**: `JobMatchingResult` with ranked jobs and explanations

---

## Installation

### Prerequisites

- Python 3.10+
- MongoDB 4.4+
- OpenAI API Key
- LangSmith API Key (optional, for tracing)

### Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Step 2: Verify Installation

```bash
python -c "import langgraph; import langsmith; print('LangGraph and LangSmith installed successfully')"
```

---

## Configuration

### Environment Variables

Create or update `backend/.env`:

```env
# OpenAI API (Required)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx

# LangSmith Tracing (Optional but Recommended)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_API_KEY=lsv2_pt_xxxxxxxxxxxxxxxxxxxxx
LANGCHAIN_PROJECT=smarthire-portal

# MongoDB
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=placement_db

# Other settings
UPLOAD_DIR=uploads
```

### Get API Keys

1. **OpenAI API Key**:
   - Sign up at https://platform.openai.com/
   - Navigate to API Keys section
   - Create new secret key
   - Cost: ~$0.01 per resume analysis with gpt-4o-mini

2. **LangSmith API Key** (Optional):
   - Sign up at https://smith.langchain.com/
   - Create new project: "smarthire-portal"
   - Generate API key from settings
   - Free tier: 5,000 traces/month

### Configuration Validation

Run configuration test:

```bash
python test_multi_agent_system.py
```

Expected output:
```
[PASS] OpenAI API Key configured
[PASS] LangSmith tracing enabled
[PASS] MongoDB URL configured
```

---

## API Endpoints

### 1. Analyze Resume with Multi-Agent System

**Endpoint**: `POST /api/v1/multi-agent/analyze`

**Authentication**: Required (Student role)

**Request Body**:
```json
{
  "job_description": "Looking for Python backend developer with Django experience",
  "preferences": {
    "min_salary": 50000,
    "location": "Remote",
    "job_type": "Full-Time"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "resume_analysis": {
    "personal_info": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "location": "New York",
      "linkedin": "linkedin.com/in/johndoe",
      "github": "github.com/johndoe"
    },
    "skills": ["Python", "Django", "React", "PostgreSQL", "Docker"],
    "education": [
      {
        "degree": "B.Tech in Computer Science",
        "institution": "MIT",
        "year": "2024",
        "cgpa": 8.5
      }
    ],
    "experience": [
      {
        "title": "Software Engineer Intern",
        "company": "Tech Corp",
        "duration": "Jun 2023 - Aug 2023",
        "description": "Developed backend APIs using Django"
      }
    ],
    "projects": [
      {
        "title": "E-commerce Platform",
        "description": "Built full-stack e-commerce app",
        "technologies": ["Django", "React", "PostgreSQL"],
        "link": "github.com/johndoe/ecommerce"
      }
    ],
    "certifications": ["AWS Certified Developer"]
  },
  "job_recommendations": [
    {
      "job_id": "507f1f77bcf86cd799439011",
      "job_title": "Backend Developer",
      "company_name": "Acme Corp",
      "match_score": 0.87,
      "skill_match_score": 0.82,
      "experience_match": true,
      "education_match": true,
      "reasons": [
        "Strong match for required Python and Django skills",
        "Previous internship experience aligns with role",
        "Portfolio projects demonstrate relevant expertise"
      ],
      "missing_skills": ["Kubernetes", "AWS Lambda"],
      "matching_skills": ["Python", "Django", "Docker"]
    }
  ],
  "metadata": {
    "trace_id": "abc123-def456-ghi789",
    "trace_url": "https://smith.langchain.com/o/default/projects/smarthire-portal/r/abc123-def456-ghi789",
    "timestamp": "2026-03-03T10:30:00Z",
    "extraction_method": "pypdfloader",
    "extraction_confidence": 0.92,
    "ocr_used": false,
    "total_jobs_evaluated": 150,
    "jobs_matched": 5
  },
  "errors": [],
  "warnings": []
}
```

**Error Response** (400 Bad Request):
```json
{
  "detail": "No resume uploaded. Please upload your resume first."
}
```

**Error Response** (500 Internal Server Error):
```json
{
  "detail": "Multi-agent analysis failed: OpenAI API timeout"
}
```

### 2. Health Check

**Endpoint**: `GET /api/v1/multi-agent/health`

**Authentication**: None

**Response** (200 OK):
```json
{
  "status": "healthy",
  "service": "multi_agent_system",
  "components": {
    "supervisor_agent": "available",
    "resume_extraction_agent": "available",
    "job_matching_agent": "available",
    "langsmith_tracing": "enabled"
  },
  "models": {
    "llm": "gpt-4o-mini",
    "embeddings": "text-embedding-3-small"
  },
  "configuration": {
    "openai_api_key_configured": true,
    "langsmith_api_key_configured": true,
    "langsmith_project": "smarthire-portal"
  }
}
```

### 3. Get Trace Information

**Endpoint**: `GET /api/v1/multi-agent/trace/{trace_id}`

**Authentication**: None

**Response** (200 OK):
```json
{
  "trace_id": "abc123-def456-ghi789",
  "trace_url": "https://smith.langchain.com/o/default/projects/smarthire-portal/r/abc123-def456-ghi789",
  "message": "View detailed trace in LangSmith dashboard"
}
```

---

## Agent Details

### Resume Extraction Agent

**File**: `app/agents/resume_extraction_agent.py`

**Key Methods**:

```python
async def extract_and_structure(file_path: str) -> ResumeExtractionResult
```
- Main entry point
- Orchestrates extraction and structuring
- Returns structured result with confidence score

```python
def extract_text_from_pdf(file_path: str) -> Tuple[str, str]
```
- 5-method extraction cascade
- Returns (extracted_text, method_used)
- Raises ValueError if all methods fail

```python
def calculate_confidence_score(extracted: ExtractedResume, raw_text: str) -> float
```
- Weighted scoring algorithm
- Returns score between 0.0 and 1.0

**Configuration**:
- Model: `gpt-4o-mini`
- Temperature: `0` (deterministic)
- Timeout: `60 seconds`
- Max Retries: `2`
- Token Limit: `8000 characters` (truncation)

### Job Matching Agent

**File**: `app/agents/job_matching_agent.py`

**Key Methods**:

```python
async def match_jobs(resume: ExtractedResume, user_preferences: Dict) -> JobMatchingResult
```
- Main entry point
- Orchestrates fetching, filtering, scoring, ranking
- Returns top 5 job recommendations

```python
async def fetch_active_jobs() -> List[Dict]
```
- Queries MongoDB for active jobs
- Returns all jobs with status="ACTIVE"

```python
def calculate_skill_similarity(resume_skills: List[str], job_skills: List[str]) -> float
```
- Jaccard similarity calculation
- Case-insensitive matching
- Returns score between 0.0 and 1.0

```python
def check_education_match(resume: ExtractedResume, job: Dict) -> bool
```
- Validates CGPA requirements
- Validates branch requirements
- Returns True if eligible

```python
def check_experience_match(resume: ExtractedResume, job: Dict) -> bool
```
- Checks experience level (fresher, intern, senior)
- Returns True if experience aligns with job

```python
async def analyze_job_match_with_llm(resume: ExtractedResume, job: Dict) -> Dict
```
- Uses GPT-4o-mini for detailed analysis
- Generates reasons, matching_skills, missing_skills
- Returns JSON with explanations

**Configuration**:
- Model: `gpt-4o-mini`
- Temperature: `0`
- Timeout: `60 seconds`
- Max Retries: `2`
- Embeddings: `text-embedding-3-small`
- Top K: `5 recommendations`

### Supervisor Agent

**File**: `app/agents/supervisor_agent.py`

**Key Methods**:

```python
async def execute(user_id: str, resume_pdf_path: str, job_description: str, user_preferences: Dict) -> AgentState
```
- Main entry point
- Initializes AgentState
- Executes LangGraph workflow
- Returns final state with results

**LangGraph Workflow**:

```python
def _build_workflow() -> StateGraph
```
- Constructs StateGraph with nodes and edges
- Defines conditional routing logic
- Returns compiled graph

**Node Functions**:
- `resume_extraction_node`: Execute extraction agent
- `validate_extraction_node`: Check extraction quality
- `job_matching_node`: Execute matching agent
- `validate_matches_node`: Check matching results
- `handle_error_node`: Error handling

**Edge Functions**:
- `should_retry_extraction`: Retry logic after extraction
- `should_proceed_to_matching`: Decide to proceed or retry
- `should_retry_matching`: Retry logic after matching

**State Object** (`AgentState`):
```python
class AgentState(BaseModel):
    request_id: str
    user_id: str
    resume_pdf_path: str
    job_description: Optional[str]
    user_preferences: Dict[str, Any]
    current_step: str
    next_agent: Optional[str]
    retry_count: int
    max_retries: int = 3
    resume_extraction_result: Optional[ResumeExtractionResult]
    job_matching_result: Optional[JobMatchingResult]
    errors: List[str]
    warnings: List[str]
    trace_id: Optional[str]
    trace_url: Optional[str]
```

---

## LangSmith Integration

### What is LangSmith?

LangSmith is LangChain's observability platform for:
- **Tracing**: View detailed execution traces of agent workflows
- **Monitoring**: Track latency, token usage, errors
- **Evaluation**: A/B test different prompts and models
- **Debugging**: Drill into failed runs and identify issues

### Enabling LangSmith

1. **Sign up**: https://smith.langchain.com/
2. **Create project**: "smarthire-portal"
3. **Get API key**: Settings → API Keys
4. **Configure in `.env`**:
   ```env
   LANGCHAIN_TRACING_V2=true
   LANGCHAIN_API_KEY=lsv2_pt_xxxxxxxxxxxxxxxxxxxxx
   LANGCHAIN_PROJECT=smarthire-portal
   ```

### Viewing Traces

1. **From API Response**:
   ```json
   {
     "metadata": {
       "trace_url": "https://smith.langchain.com/o/default/projects/smarthire-portal/r/abc123..."
     }
   }
   ```

2. **Click trace URL** to open in LangSmith dashboard

3. **Explore trace tree**:
   - Root: "smarthire_multi_agent_{request_id}"
   - Children: Resume Extraction, Validation, Job Matching, etc.
   - Each node shows: Input, Output, Latency, Token Usage, Errors

### Trace Structure Example

```
smarthire_multi_agent_abc123 (4.2s, $0.008)
├── resume_extraction (2.1s, $0.004)
│   ├── pdf_load (0.8s)
│   ├── llm_structure (1.2s, 1,200 tokens)
│   └── validation (0.1s)
├── validate_extraction (0.2s)
├── job_matching (1.8s, $0.004)
│   ├── db_query (0.3s)
│   ├── skill_similarity (0.4s)
│   └── llm_ranking (1.0s, 2,100 tokens)
└── validate_matches (0.1s)
```

### Monitoring Metrics

**Key Metrics to Track**:
- **Latency (P50, P95, P99)**: Target < 8 seconds for full workflow
- **Token Usage**: Track cost per request (target < $0.01)
- **Success Rate**: Target > 95%
- **Retry Rate**: Monitor extraction/matching failures
- **Confidence Scores**: Track extraction quality distribution

**Dashboard Setup**:
1. Go to LangSmith project
2. Click "Metrics" tab
3. Create custom charts:
   - Latency over time (line chart)
   - Token usage histogram
   - Success rate by agent (pie chart)
   - Error breakdown (bar chart)

### Debugging Workflow

**Scenario**: Resume extraction fails

1. **Find trace**: Filter by status="error" in LangSmith
2. **Open trace**: Click on failed run
3. **Drill into extraction node**:
   - Check input: Is PDF path valid?
   - Check PDF load span: Did it timeout?
   - Check LLM span: Is prompt correct? Any API errors?
4. **Identify root cause**: e.g., "Encrypted PDF not supported"
5. **Fix**: Add encryption detection before processing

---

## Testing

### Running Tests

```bash
cd backend
python test_multi_agent_system.py
```

### Test Suite

The test script validates:

1. **Configuration**:
   - OpenAI API key present
   - LangSmith configuration
   - MongoDB connection

2. **Resume Extraction Agent**:
   - Agent initialization
   - PDF extraction (all methods)
   - LLM structuring
   - Confidence scoring

3. **Job Matching Agent**:
   - Agent initialization
   - Job fetching from database
   - Skill similarity calculation
   - Job ranking and explanations

4. **Supervisor Agent**:
   - Workflow orchestration
   - State management
   - Error handling
   - LangSmith tracing

### Expected Output

```
================================================================================
  MULTI-AGENT AI SYSTEM - COMPREHENSIVE TEST SUITE
================================================================================

================================================================================
  TEST 1: Configuration Validation
================================================================================

[PASS] OpenAI API Key configured
      Key length: 51
[PASS] LangSmith tracing enabled
      Enabled: True
[PASS] LangSmith project configured
      Project: smarthire-portal
[PASS] MongoDB URL configured
      URL: mongodb://localhost:27017

================================================================================
  TEST 2: Resume Extraction Agent
================================================================================

[PASS] Resume Extraction Agent initialized
[PASS] Test resume found
      File: uploads/resumes/student_123/resume.pdf
[PASS] Extraction completed
[PASS] Status returned
[PASS] Extraction method recorded
[PASS] Confidence score valid
[PASS] Resume data extracted
[PASS] Personal info extracted
[PASS] Skills extracted
[PASS] Raw text extracted

  Extraction Results:
    - Name: John Doe
    - Email: john@example.com
    - Skills: 15 found
    - Education: 1 entries
    - Experience: 2 entries
    - Projects: 3 entries
    - Confidence: 0.92
    - Method: pypdfloader
    - OCR used: False

[... Test 3 and 4 outputs ...]

================================================================================
  FINAL SUMMARY
================================================================================

[PASS] Configuration
[PASS] Resume Extraction Agent
[PASS] Job Matching Agent
[PASS] Supervisor Agent

  Total: 4 | Passed: 4 | Failed: 0

  [SUCCESS] All tests passed! Multi-Agent System is operational.
```

### Manual API Testing

Using curl:

```bash
# 1. Login as student
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "student@test.com", "password": "password123"}'

# Copy access_token from response

# 2. Call multi-agent analyze endpoint
curl -X POST http://localhost:8000/api/v1/multi-agent/analyze \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "job_description": "Python backend developer",
    "preferences": {"location": "Remote"}
  }'

# 3. View trace (copy trace_id from response)
curl http://localhost:8000/api/v1/multi-agent/trace/{TRACE_ID}
```

---

## Deployment

### Production Checklist

- [ ] OpenAI API key configured in production `.env`
- [ ] LangSmith API key configured for monitoring
- [ ] MongoDB connection string updated for production
- [ ] Environment set to "production" in config
- [ ] CORS origins configured for frontend domain
- [ ] SSL certificates installed
- [ ] Rate limiting configured (10 req/hour per user)
- [ ] Monitoring alerts set up (Sentry, CloudWatch)
- [ ] Backup strategy for MongoDB
- [ ] Load balancer configured (if multiple instances)

### Deployment Steps

#### Option 1: Docker Deployment

1. **Build Docker image**:
   ```bash
   docker build -t smarthire-backend .
   ```

2. **Run container**:
   ```bash
   docker run -d \
     --name smarthire-backend \
     -p 8000:8000 \
     -e OPENAI_API_KEY=sk-xxx \
     -e LANGCHAIN_API_KEY=lsv2_pt_xxx \
     -e MONGODB_URL=mongodb://mongo:27017 \
     --network smarthire-network \
     smarthire-backend
   ```

#### Option 2: AWS Deployment

1. **ECS/Fargate**:
   - Upload Docker image to ECR
   - Create ECS task definition with environment variables
   - Deploy service with auto-scaling (2-10 instances)
   - Configure ALB with health checks

2. **Environment Variables** (AWS Secrets Manager):
   - Store API keys securely
   - Reference in ECS task definition

3. **MongoDB Atlas**:
   - Use managed MongoDB Atlas cluster
   - Configure IP whitelist for ECS IPs
   - Enable replica set for high availability

#### Option 3: Kubernetes Deployment

1. **Create Kubernetes manifests**:
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: smarthire-backend
   spec:
     replicas: 3
     template:
       spec:
         containers:
         - name: backend
           image: smarthire-backend:latest
           env:
           - name: OPENAI_API_KEY
             valueFrom:
               secretKeyRef:
                 name: openai-secret
                 key: api-key
   ```

2. **Deploy**:
   ```bash
   kubectl apply -f k8s/
   ```

### Monitoring

1. **LangSmith Dashboard**:
   - Monitor trace volume
   - Set up alerts for error rate > 5%
   - Track latency trends

2. **Application Logs**:
   - Use structured logging (JSON format)
   - Ship logs to CloudWatch/Datadog
   - Set up alerts for ERROR level logs

3. **Infrastructure Metrics**:
   - CPU/Memory usage (target < 70%)
   - Request rate and latency
   - Database connections

---

## Troubleshooting

### Common Issues

#### 1. "OPENAI_API_KEY is required"

**Cause**: API key not configured in `.env`

**Solution**:
```bash
echo "OPENAI_API_KEY=sk-proj-xxx" >> backend/.env
```

#### 2. "Could not extract text from PDF"

**Cause**: All extraction methods failed (encrypted PDF, corrupt file)

**Solution**:
- Check if PDF is password-protected (unsupported)
- Try opening PDF manually to verify it's not corrupt
- Re-export PDF from source application
- Check logs for specific error details

#### 3. "No active jobs available"

**Cause**: No jobs in database with status="ACTIVE"

**Solution**:
```python
# Add test jobs via MongoDB shell
db.jobs.insertOne({
  "title": "Software Engineer",
  "company_id": "...",
  "status": "ACTIVE",
  "required_skills": ["Python", "Django"],
  ...
})
```

#### 4. "Job matching failed: OpenAI API timeout"

**Cause**: LLM call taking too long or API issue

**Solution**:
- Check OpenAI API status: https://status.openai.com/
- Increase timeout in agent configuration
- Reduce job description length (limit to 500 chars)
- Wait and retry (automatic retry logic handles transient failures)

#### 5. LangSmith traces not appearing

**Cause**: API key invalid or tracing disabled

**Solution**:
1. Verify API key: `echo $LANGCHAIN_API_KEY`
2. Check project name matches: `LANGCHAIN_PROJECT=smarthire-portal`
3. Ensure `LANGCHAIN_TRACING_V2=true`
4. Restart backend: `uvicorn app.main:app --reload`

#### 6. "Resume file not found"

**Cause**: File path mismatch or file deleted

**Solution**:
- Check `uploads/` directory structure
- Verify student profile has `resume_url` field
- Ensure file permissions allow read access
- Re-upload resume via `/students/resume` endpoint

---

## Performance Optimization

### 1. Caching

**Implement Redis caching for**:
- Job recommendations (TTL: 1 hour)
- Resume embeddings (invalidate on re-upload)
- Active jobs list (TTL: 10 minutes)

### 2. Batch Processing

For bulk operations (recruiter screening 50 resumes):
- Use Celery background tasks
- Process 5 resumes in parallel
- Send email notification when complete

### 3. Database Indexing

```javascript
// MongoDB indexes
db.jobs.createIndex({ "status": 1, "required_skills": 1 })
db.jobs.createIndex({ "company_id": 1 })
db.student_profiles.createIndex({ "user_id": 1 }, { unique: true })
```

### 4. LLM Call Optimization

- **Reduce prompt length**: Summarize job descriptions > 500 chars
- **Batch embeddings**: Generate embeddings for all jobs at once
- **Use streaming**: Stream LLM responses for better UX (not yet implemented)

---

## Cost Analysis

### OpenAI API Costs (per request)

**Resume Extraction**:
- Input: ~1,500 tokens (resume text)
- Output: ~500 tokens (structured JSON)
- Cost: ~$0.004 (gpt-4o-mini pricing)

**Job Matching** (per 5 jobs):
- Input: ~2,500 tokens (resume + job descriptions)
- Output: ~600 tokens (explanations)
- Cost: ~$0.004

**Total per analysis**: ~$0.008

**Monthly estimate** (1,000 students, 2 analyses each):
- Total requests: 2,000
- Total cost: $16/month

### LangSmith Costs

- Free tier: 5,000 traces/month
- Paid: $39/month for 50,000 traces
- Recommended: Start with free tier

---

## Security Considerations

### 1. API Key Management

- **Never commit** `.env` file to Git
- Use **environment variables** in production
- **Rotate keys** quarterly
- Use **separate keys** for dev/staging/prod

### 2. Rate Limiting

```python
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)

@app.post("/multi-agent/analyze")
@limiter.limit("10/hour")  # 10 requests per hour per user
async def analyze_resume(...):
    ...
```

### 3. Data Privacy

- **Encrypt resumes** at rest (S3 encryption)
- **Scrub PII** from LangSmith traces (mask emails, phone numbers)
- **GDPR compliance**: Allow resume deletion
- **Access control**: Only student can access their own analysis

---

## Future Enhancements

### Phase 2 (Planned)

1. **Vector Database Integration**:
   - Replace simple skill matching with semantic search
   - Use Pinecone for fast vector similarity
   - Enable fuzzy matching ("React" ~ "ReactJS")

2. **Streaming Responses**:
   - Stream LLM output in real-time
   - Show progress: "Extracting resume... 30%"
   - Better UX for long-running requests

3. **Multi-Modal Agents**:
   - Analyze resume formatting (not just text)
   - Extract from images (screenshots of resumes)
   - Support video resumes

4. **Feedback Loop**:
   - Track which recommendations lead to applications
   - Use feedback to fine-tune matching algorithm
   - A/B test different prompts

5. **Cover Letter Generation Agent**:
   - New agent to generate tailored cover letters
   - Integrate into application workflow
   - Use resume + job description as context

---

## Support

### Documentation

- **LangGraph**: https://langchain-ai.github.io/langgraph/
- **LangChain**: https://python.langchain.com/
- **LangSmith**: https://docs.smith.langchain.com/
- **OpenAI API**: https://platform.openai.com/docs/

### Contact

For issues or questions:
- GitHub Issues: [Create Issue](https://github.com/your-org/smarthire/issues)
- Email: support@smarthire.com
- Slack: #ai-agents channel

---

## License

MIT License - See LICENSE file for details

---

## Changelog

### Version 1.0.0 (2026-03-03)

- Initial release of Multi-Agent AI System
- Supervisor Agent with LangGraph orchestration
- Resume Extraction Agent with 5-method cascade
- Job Matching Agent with semantic similarity
- LangSmith integration for tracing
- Complete API endpoints and documentation
- Comprehensive test suite

---

**Built with ❤️ by SmartHire Team**
