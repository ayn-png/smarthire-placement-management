# Resume Analyzer API Documentation

## Production-Ready AI Resume Analyzer

Complete FastAPI + LangChain + OpenAI implementation for SmartHire Portal.

---

## Architecture

```
/app
  /api
    /v1
      /endpoints
        resume_analyzer.py     ← New API endpoints
  /services
    resume_analyzer.py         ← Core AI logic
  /core
    config.py                  ← Configuration with .env
```

---

## Configuration

### Environment Variables

Required in `.env`:

```env
OPENAI_API_KEY=sk-proj-your-key-here
```

### Dependencies

All required packages already in `requirements.txt`:
- fastapi
- langchain-openai
- langchain-community
- openai
- pypdf
- python-dotenv
- pydantic

---

## API Endpoints

### 1. Analyze Resume

**Endpoint:** `POST /api/v1/resume-analyzer/analyze`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "job_description": "Optional job description for targeted analysis"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "analysis": {
    "candidate_name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "skills": [
      "Python",
      "JavaScript",
      "React",
      "FastAPI",
      "MongoDB"
    ],
    "experience_years": "3-5 years",
    "education": [
      "B.Tech Computer Science, XYZ University (2018-2022)"
    ],
    "projects": [
      "E-commerce Platform using MERN Stack",
      "AI Chatbot using Python and OpenAI"
    ],
    "strengths": [
      "Strong technical skills across full stack",
      "Relevant project experience",
      "Clear resume structure"
    ],
    "weaknesses": [
      "Lacks quantifiable achievements",
      "No mention of team collaboration",
      "Limited leadership experience"
    ],
    "ats_score": 75,
    "improvement_suggestions": [
      "Add metrics to project descriptions (e.g., 'Increased performance by 40%')",
      "Include soft skills and teamwork examples",
      "Add relevant certifications",
      "Use industry-standard keywords",
      "Quantify your impact with numbers"
    ]
  },
  "error": null
}
```

**Error Response (400/422/500):**
```json
{
  "success": false,
  "analysis": null,
  "error": "No resume uploaded. Please upload your resume first."
}
```

### 2. Health Check

**Endpoint:** `GET /api/v1/resume-analyzer/health`

**Authentication:** Not required

**Response:**
```json
{
  "status": "healthy",
  "service": "resume_analyzer",
  "model": "gpt-4o-mini",
  "configured": true
}
```

---

## Usage Flow

### Backend Flow:

```
1. Student uploads resume → /api/v1/students/resume
2. Resume saved to: uploads/resumes/{user_id}_{hash}.pdf
3. Student clicks "Analyze Resume" button
4. Frontend calls: POST /api/v1/resume-analyzer/analyze
5. Backend:
   a. Authenticates user
   b. Gets resume file path from database
   c. Validates file exists
   d. Extracts text using PyPDFLoader (LangChain)
   e. Sends to OpenAI GPT-4o-mini with structured prompt
   f. Parses JSON response
   g. Validates and sanitizes data
6. Returns structured JSON to frontend
```

### Frontend Integration:

```typescript
// React/Next.js Example
const analyzeResume = async (jobDescription?: string) => {
  const response = await fetch('/api/v1/resume-analyzer/analyze', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      job_description: jobDescription
    })
  });

  const result = await response.json();

  if (result.success) {
    // Display analysis
    const { analysis } = result;
    // Show ATS score: analysis.ats_score
    // Show skills: analysis.skills
    // Show strengths: analysis.strengths
    // etc.
  } else {
    // Show error: result.error
  }
};
```

---

## Features

### ✅ Implemented Features:

1. **PDF Processing**
   - File validation (type, size, existence)
   - Text extraction using LangChain PyPDFLoader
   - Empty PDF detection
   - Token limit protection (8000 chars)

2. **AI Analysis**
   - OpenAI GPT-4o-mini (cost-efficient)
   - Structured JSON output using Pydantic
   - Temperature=0 for consistent results
   - Retry logic (max 2 retries)
   - 60-second timeout

3. **Structured Output**
   - Candidate information extraction
   - Skills identification
   - Experience assessment
   - Education parsing
   - Project extraction
   - Strengths analysis
   - Weaknesses identification
   - ATS score (0-100)
   - Actionable improvement suggestions

4. **Error Handling**
   - File not found errors
   - Empty PDF validation
   - PDF extraction failures
   - AI API errors
   - JSON parsing errors
   - Timeout handling
   - Graceful degradation

5. **Security**
   - Authentication required
   - API key stored in .env
   - File path validation
   - Size limits enforced
   - Rate limit ready

6. **Production Ready**
   - Async implementation
   - Comprehensive logging
   - Input validation
   - Output sanitization
   - Proper HTTP status codes
   - Dependency injection

---

## Testing

### Run Test Script:

```bash
cd backend
python test_resume_analyzer.py
```

Expected output:
```
======================================================================
RESUME ANALYZER - PRODUCTION TEST
======================================================================

1. Configuration Check...
   [OK] API Key configured: sk-proj-...

2. Service Initialization...
   [OK] Model: gpt-4o-mini
   [OK] Temperature: 0
   [OK] Timeout: 60s

3. Finding Test Resume...
   [OK] Test file: resume.pdf
   [OK] Size: 245,678 bytes

4. PDF Text Extraction...
   [OK] Extracted 2,456 characters
   [OK] Preview: John Doe | Software Engineer...

5. AI Resume Analysis...
   This may take 10-15 seconds...

======================================================================
ANALYSIS RESULTS
======================================================================

Candidate: John Doe
Email: john@example.com
Phone: +1234567890
Experience: 3-5 years

ATS Score: 75/100

Skills (15):
  - Python
  - JavaScript
  ...

[SUCCESS] Resume Analyzer Working Perfectly!
```

### Manual API Test:

```bash
# 1. Get auth token (login first)
TOKEN="your_jwt_token"

# 2. Test health endpoint
curl http://localhost:8000/api/v1/resume-analyzer/health

# 3. Analyze resume
curl -X POST http://localhost:8000/api/v1/resume-analyzer/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Error Scenarios

### 1. No Resume Uploaded
```json
{
  "success": false,
  "error": "No resume uploaded. Please upload your resume first."
}
```

### 2. Resume File Not Found
```json
{
  "success": false,
  "error": "Resume file not found on server. Please re-upload your resume."
}
```

### 3. Empty PDF
```json
{
  "success": false,
  "error": "PDF file is empty"
}
```

### 4. PDF Extraction Failed
```json
{
  "success": false,
  "error": "Failed to extract text from PDF: [details]"
}
```

### 5. AI Analysis Failed
```json
{
  "success": false,
  "error": "Failed to analyze resume. Please try again later."
}
```

### 6. OpenAI API Key Missing
```json
{
  "detail": "Internal server error"
}
```
*Note: Server will fail to start if API key not configured*

---

## Performance

### Metrics:

- **PDF Extraction:** 1-2 seconds
- **AI Analysis:** 8-15 seconds
- **Total Response Time:** 10-20 seconds
- **Token Usage:** ~1000-2000 tokens per analysis
- **Cost:** ~$0.001-0.002 per analysis (GPT-4o-mini)

### Optimization:

- Uses gpt-4o-mini (10x cheaper than GPT-4)
- Temperature=0 for faster responses
- Text limited to 8000 chars (token protection)
- Async implementation (non-blocking)
- Connection pooling enabled

---

## Frontend Display Components

Suggested UI structure at `http://localhost:3000/student/resume`:

```tsx
<ResumeAnalyzer>
  <ATSScoreCard score={analysis.ats_score} />

  <CandidateInfo
    name={analysis.candidate_name}
    email={analysis.email}
    phone={analysis.phone}
    experience={analysis.experience_years}
  />

  <SkillsSection skills={analysis.skills} />

  <EducationSection education={analysis.education} />

  <ProjectsSection projects={analysis.projects} />

  <StrengthsCard strengths={analysis.strengths} />

  <WeaknessesCard weaknesses={analysis.weaknesses} />

  <SuggestionsCard suggestions={analysis.improvement_suggestions} />
</ResumeAnalyzer>
```

---

## Troubleshooting

### Issue: "OPENAI_API_KEY not configured"

**Solution:**
```bash
# Add to .env file
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

### Issue: "No resume uploaded"

**Solution:**
1. Go to http://localhost:3000/student/resume
2. Upload a PDF resume
3. Then try analysis

### Issue: "Failed to extract text from PDF"

**Causes:**
- PDF is scanned/image-based
- PDF is corrupted
- PDF is password-protected

**Solution:**
- Re-export from Word/Google Docs
- Use text-based PDF (not scanned)
- Remove password protection

### Issue: Slow response

**Normal:** 10-20 seconds is expected for AI analysis

**If slower:**
- Check OpenAI API status
- Check network connection
- Review server logs

---

## Production Deployment

### Checklist:

- [ ] OPENAI_API_KEY configured in production .env
- [ ] OpenAI account has sufficient credits
- [ ] All dependencies installed
- [ ] Server restart after configuration
- [ ] Test with sample resumes
- [ ] Monitor API usage costs
- [ ] Set up error logging
- [ ] Configure rate limiting

### Environment Variables:

```env
# Production
ENVIRONMENT=production
OPENAI_API_KEY=sk-proj-production-key
```

---

## API Costs

### OpenAI Pricing (GPT-4o-mini):

- Input: $0.150 per 1M tokens
- Output: $0.600 per 1M tokens

### Estimated Costs:

- **Per Analysis:** $0.001-0.002
- **1000 analyses:** $1-2
- **Monthly (5000 analyses):** $5-10

Very cost-effective for production use.

---

## Support

### Logs Location:

```bash
# Check application logs
tail -f backend/server.log | grep "resume_analyzer"

# Check for errors
tail -f backend/server.log | grep "ERROR"
```

### Debug Mode:

```python
# In resume_analyzer.py, add:
logging.basicConfig(level=logging.DEBUG)
```

---

## Summary

✅ **Production-Ready Implementation**

- FastAPI backend
- LangChain integration
- OpenAI GPT-4o-mini
- PyPDF text extraction
- Structured JSON output
- Comprehensive error handling
- Async/await support
- Full validation
- Proper logging
- Cost-efficient
- Easy to test
- Frontend compatible

**Status:** Ready for production deployment
**Endpoint:** `/api/v1/resume-analyzer/analyze`
**Frontend Route:** `http://localhost:3000/student/resume`
