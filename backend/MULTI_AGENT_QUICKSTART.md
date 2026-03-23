# Multi-Agent AI System - Quick Start Guide

## 🚀 Get Started in 5 Minutes

---

## Prerequisites

- Python 3.10+
- MongoDB running on localhost:27017
- OpenAI API Key

---

## Step 1: Install Dependencies

```bash
cd backend
pip install langgraph>=0.2.0 langsmith>=0.1.0
```

---

## Step 2: Configure Environment

Create `backend/.env` file:

```env
# Required
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx

# Optional (for tracing)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_pt_xxxxxxxxxxxxxxxxxxxxx
LANGCHAIN_PROJECT=smarthire-portal

# Database
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=placement_db
```

**Get OpenAI API Key**: https://platform.openai.com/api-keys

**Get LangSmith API Key** (optional): https://smith.langchain.com/

---

## Step 3: Test the System

```bash
python test_multi_agent_system.py
```

Expected output:
```
[PASS] Configuration
[PASS] Resume Extraction Agent
[PASS] Job Matching Agent
[PASS] Supervisor Agent

[SUCCESS] All tests passed!
```

---

## Step 4: Start the Backend

```bash
uvicorn app.main:app --reload --port 8000
```

---

## Step 5: Test the API

### Health Check

```bash
curl http://localhost:8000/api/v1/multi-agent/health
```

### Analyze Resume (requires authentication)

1. **Login as student**:
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "student@test.com", "password": "password123"}'
```

2. **Copy `access_token` from response**

3. **Call multi-agent endpoint**:
```bash
curl -X POST http://localhost:8000/api/v1/multi-agent/analyze \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "job_description": "Python backend developer",
    "preferences": {"location": "Remote"}
  }'
```

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│   API: /multi-agent/analyze         │
├─────────────────────────────────────┤
│   Supervisor Agent (LangGraph)      │
│   ├── Resume Extraction Agent       │
│   │   └── Extract & Structure PDF   │
│   └── Job Matching Agent            │
│       └── Rank & Recommend Jobs     │
├─────────────────────────────────────┤
│   LangChain + OpenAI (GPT-4o-mini) │
├─────────────────────────────────────┤
│   LangSmith Tracing (Optional)      │
└─────────────────────────────────────┘
```

---

## Key Features

✅ **Resume Extraction**
- 5-method PDF extraction cascade
- OCR fallback for scanned PDFs
- Structured JSON output with confidence scoring

✅ **Job Matching**
- Skill similarity scoring
- Eligibility filtering (CGPA, branch, experience)
- LLM-powered explanations

✅ **LangGraph Orchestration**
- Automatic workflow management
- Error recovery with retry logic
- State management across agents

✅ **LangSmith Monitoring**
- Full trace visibility
- Latency and token tracking
- Debugging and evaluation

---

## Project Structure

```
backend/
├── app/
│   ├── agents/
│   │   ├── supervisor_agent.py      # Main orchestrator
│   │   ├── resume_extraction_agent.py
│   │   └── job_matching_agent.py
│   ├── api/v1/endpoints/
│   │   └── multi_agent.py           # API endpoints
│   ├── schemas/
│   │   └── agent_state.py           # State models
│   └── core/
│       └── langsmith_config.py      # Tracing config
├── test_multi_agent_system.py       # Test suite
├── MULTI_AGENT_SYSTEM_DOCUMENTATION.md  # Full docs
└── MULTI_AGENT_QUICKSTART.md        # This file
```

---

## Common Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run tests
python test_multi_agent_system.py

# Start backend
uvicorn app.main:app --reload

# Check health
curl http://localhost:8000/api/v1/multi-agent/health

# View API docs
open http://localhost:8000/api/docs
```

---

## Troubleshooting

### "OPENAI_API_KEY is required"
→ Add OpenAI API key to `backend/.env`

### "No active jobs available"
→ Add jobs to MongoDB via admin panel

### "Resume file not found"
→ Upload resume via `/api/v1/students/resume` endpoint first

### LangSmith traces not appearing
→ Check `LANGCHAIN_API_KEY` in `.env`

---

## Cost Estimate

- **Per analysis**: ~$0.008 (OpenAI gpt-4o-mini)
- **1,000 students × 2 analyses**: ~$16/month
- **LangSmith**: Free tier (5,000 traces/month)

---

## Next Steps

1. **Read full documentation**: `MULTI_AGENT_SYSTEM_DOCUMENTATION.md`
2. **Explore LangSmith dashboard**: https://smith.langchain.com/
3. **View API docs**: http://localhost:8000/api/docs
4. **Customize prompts**: Edit agents in `app/agents/`
5. **Add more agents**: Extend Supervisor workflow

---

## API Example Response

```json
{
  "success": true,
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "resume_analysis": {
    "personal_info": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "skills": ["Python", "Django", "React"],
    "education": [{"degree": "B.Tech CS", "cgpa": 8.5}]
  },
  "job_recommendations": [
    {
      "job_title": "Backend Developer",
      "company_name": "Acme Corp",
      "match_score": 0.87,
      "reasons": [
        "Strong Python and Django skills",
        "Previous experience aligns well"
      ]
    }
  ],
  "metadata": {
    "trace_url": "https://smith.langchain.com/...",
    "extraction_confidence": 0.92
  }
}
```

---

## Support

- **Full Documentation**: `MULTI_AGENT_SYSTEM_DOCUMENTATION.md`
- **GitHub Issues**: [Create Issue](https://github.com/your-org/smarthire/issues)
- **LangChain Docs**: https://python.langchain.com/
- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/

---

**🎉 You're all set! Start analyzing resumes with AI.**
