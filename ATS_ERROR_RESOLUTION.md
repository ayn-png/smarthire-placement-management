## ATS Analysis Error Resolution

### Root Cause Analysis

The user experienced two errors when running ATS analysis:

1. **403 Forbidden** - Authentication/Role issue
2. **500 Internal Server Error** - OpenAI API key invalid

### Error Details

#### Error #1: OpenAI API Key Invalid (401)
- **Location**: `backend/app/services/ai_resume_service.py`, line 368
- **Cause**: The OpenAI API key in `.env` is invalid, expired, or revoked
- **Message**: `Error code: 401 - 'Incorrect API key provided'`
- **Status**: Fallback to OpenRouter worked successfully

#### Error #2: 403 Forbidden (Possible Causes)
- Missing or incorrect `role` field in Firestore user document
- User not properly authenticated or role not set to "STUDENT"
- CORS preflight issue on frontend

### Solution

#### Step 1: Update OpenAI API Key (Optional)
If you want to use OpenAI directly:

1. Generate a new API key at: https://platform.openai.com/api-keys
2. Update `backend/.env` line 13:
   ```
   OPENAI_API_KEY=sk-proj-YOUR-NEW-KEY-HERE
   ```
3. Restart the backend server

#### Step 2: Rely on OpenRouter (Recommended)
OpenRouter is working as a fallback. To use it exclusively:

1. Comment out or remove the invalid OpenAI key in `backend/.env`
2. The system will automatically use OpenRouter

#### Step 3: Verify Authentication
If you're still getting 403 errors:

1. Ensure you're logged in as a Student
2. Check your Firestore user document has `role: "STUDENT"`
3. Verify the resume is actually uploaded in your profile

### Implementation Changes Made

1. **Enhanced Error Handling** in `backend/app/api/v1/endpoints/ai_resume.py`:
   - Added specific HTTP status codes for different failure scenarios
   - Added comprehensive logging with user ID tracking
   - Better error messages for user-facing responses

2. **Resume Analyzer Error Handling** in `backend/app/api/v1/endpoints/resume_analyzer.py`:
   - Added try/except for HTTP request errors
   - Added try/except for analyzer initialization
   - More specific HTTP status codes (502, 504)

3. **AI Service Diagnostics**:
   - Created `backend/tests/test_ats_endpoint.py` with diagnostic tests
   - Tests verify API key configuration and AI service integration
   - OpenRouter fallback chain working correctly

### HTTP Status Codes Reference

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Bad Request | Resume not uploaded or file too large |
| 403 | Forbidden | Not authenticated as a STUDENT or account deactivated |
| 404 | Not Found | Resume file not found |
| 502 | Bad Gateway | AI service failed or network error |
| 503 | Service Unavailable | AI API keys not configured |
| 500 | Internal Server Error | Unexpected error (check server logs) |
| 422 | Unprocessable Entity | Could not extract text from PDF |

### Testing

Run diagnostic tests:
```bash
cd backend
python -m pytest tests/test_ats_endpoint.py -s
```

Expected output:
- ✓ API KEYS CONFIGURED (both OpenAI and OpenRouter)
- ✓ PDF extraction works
- ✓ AI Service responded successfully (via OpenRouter fallback)

### Next Steps

1. Update your OpenAI API key or rely on OpenRouter
2. Restart the backend server: `python -m uvicorn app.main:app --reload --port 8000`
3. Try "Run ATS Analysis" again in the frontend
4. If still getting 403, check Firestore to verify `role: "STUDENT"`

### Logs to Check

If errors persist, check:
- Backend logs: `backend/logs/app.log` (if file logging is enabled)
- Console output when running `uvicorn app.main:app --reload`
- Browser DevTools Console for frontend errors
