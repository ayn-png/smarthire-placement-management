# SmartHire Portal - Production Deployment Guide

## Critical Security Fixes Implemented

All critical production issues have been addressed:

### ✅ 1. Token Refresh Interceptor
- **Location**: `frontend/src/lib/axios.ts`
- **Status**: Already implemented
- **Features**:
  - Automatic token refresh on 401 errors
  - Retry failed requests with new access token
  - Automatic logout on refresh failure

### ✅ 2. Rate Limiting
- **Package**: `slowapi==0.1.9`
- **Endpoints Protected**:
  - `/auth/register`: 5 requests/hour
  - `/auth/login`: 10 requests/minute
  - `/auth/refresh`: 20 requests/minute
  - `/auth/forgot-password`: 3 requests/hour
  - `/auth/reset-password`: 5 requests/hour
  - `/multi-agent/analyze`: 10 requests/hour
  - `/ai/analyze-existing-resume`: 20 requests/hour

### ✅ 3. Cloudinary Cloud Storage
- **Package**: `cloudinary==1.41.0`
- **Service**: `backend/app/services/cloudinary_service.py`
- **Features**:
  - Resume PDFs stored in `smarthire/resumes/` folder
  - Profile avatars in `smarthire/avatars/` with auto-optimization (400x400, face detection)
  - Company logos in `smarthire/logos/` with auto-optimization (400x400, fit)
  - Automatic format conversion (WebP, AVIF)
  - CDN delivery for fast global access
  - Legacy local file support for backward compatibility

### ✅ 4. Production Configuration Security
- **File**: `backend/app/core/config.py`
- **Features**:
  - Automatic validation on startup when `ENVIRONMENT=production`
  - Enforces strong SECRET_KEY (min 32 chars, no "changeme")
  - Validates CORS origins (no localhost in production)
  - Validates Cloudinary credentials
  - App exits with clear error messages if validation fails

### ✅ 5. HttpOnly Cookies for Refresh Tokens
- **Location**: `backend/app/api/v1/endpoints/auth.py`
- **Security Improvements**:
  - Refresh tokens stored in httpOnly cookies (XSS-safe)
  - Secure flag enabled in production (HTTPS-only)
  - SameSite=strict (CSRF protection)
  - 7-day expiration
  - Automatic cleanup on logout
  - Backward compatible with request body for smooth migration

---

## Pre-Deployment Checklist

### 1. Install New Dependencies

```bash
cd backend
pip install -r requirements.txt
```

New packages:
- `slowapi==0.1.9` - Rate limiting
- `cloudinary==1.41.0` - Cloud storage

### 2. Configure Environment Variables

Update your `.env` file with production values:

```bash
# CRITICAL: Generate strong secret keys
# Use: python -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY=<GENERATE_32_CHAR_SECRET>
REFRESH_SECRET_KEY=<GENERATE_32_CHAR_SECRET>

# Set production environment
ENVIRONMENT=production

# Configure production CORS (your actual domain)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Cloudinary credentials (REQUIRED in production)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Database
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/
DATABASE_NAME=placement_db_prod

# AI API Keys (if using AI features)
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
LANGCHAIN_API_KEY=...
```

### 3. Generate Secret Keys

Run this command to generate secure secret keys:

```bash
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32)); print('REFRESH_SECRET_KEY=' + secrets.token_urlsafe(32))"
```

### 4. Set Up Cloudinary

1. Sign up at https://cloudinary.com/
2. Get your credentials from the dashboard
3. Add to `.env`:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### 5. Update Frontend Configuration

Update `frontend/.env.production`:

```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NODE_ENV=production
```

### 6. Test Configuration Validation

Start the backend to verify production config:

```bash
cd backend
ENVIRONMENT=production python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

If any security issues exist, the app will exit with clear error messages.

---

## Migration from Local Storage to Cloudinary

### Automatic Migration Process

The system is backward compatible. Old local files will continue to work while new uploads go to Cloudinary.

**File URL Detection**:
- Cloudinary URLs: `https://res.cloudinary.com/...`
- Local URLs: `/uploads/resumes/...`

### Manual Migration (Optional)

To migrate existing local files to Cloudinary:

```python
# migration script (run once)
import asyncio
import cloudinary.uploader
from motor.motor_asyncio import AsyncIOMotorClient

async def migrate_files():
    client = AsyncIOMotorClient("your_mongodb_url")
    db = client["placement_db"]

    # Migrate student resumes
    async for student in db.student_profiles.find({"resume_url": {"$regex": "^/uploads"}}):
        local_path = f"backend{student['resume_url']}"
        if os.path.exists(local_path):
            result = cloudinary.uploader.upload(
                local_path,
                folder="smarthire/resumes",
                public_id=f"resume_{student['user_id']}",
                resource_type="raw"
            )
            await db.student_profiles.update_one(
                {"_id": student["_id"]},
                {"$set": {"resume_url": result["secure_url"]}}
            )
            print(f"Migrated: {student['user_id']}")

asyncio.run(migrate_files())
```

---

## Deployment Steps

### 1. Backend Deployment (Railway/Render/AWS)

```bash
# Build command
pip install -r requirements.txt

# Start command
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Environment Variables** (set in hosting platform):
- All `.env` variables listed above
- `ENVIRONMENT=production`
- `PORT` (usually auto-set by platform)

### 2. Frontend Deployment (Vercel/Netlify)

```bash
# Build command
npm run build

# Output directory
.next
```

**Environment Variables**:
- `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
- `NODE_ENV=production`

### 3. Database (MongoDB Atlas)

1. Create production cluster
2. Whitelist deployment server IPs
3. Update `MONGODB_URL` in backend `.env`

---

## Post-Deployment Verification

### 1. Test Security

```bash
# Test rate limiting
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  # Run 11 times in 1 minute - should get rate limited

# Test httpOnly cookies
curl -i https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"valid@test.com","password":"validpass"}'
  # Check Set-Cookie header for refresh_token with HttpOnly flag
```

### 2. Test Cloudinary Uploads

1. Register new user
2. Upload resume
3. Verify URL starts with `https://res.cloudinary.com`
4. Check file appears in Cloudinary dashboard

### 3. Monitor Logs

```bash
# Check for security validation errors
# App should exit with errors if config is invalid

# Example error output:
================================================================================
CRITICAL SECURITY ERRORS - Application will not start
================================================================================
  ❌ SECRET_KEY contains 'changeme' - must be changed in production
  ❌ ALLOWED_ORIGINS contains 'localhost' - must use production domain
  ❌ Cloudinary credentials must be configured in production
================================================================================
```

---

## Security Best Practices

1. **Never commit `.env` files** - Use platform environment variables
2. **Rotate secrets regularly** - Change SECRET_KEY every 90 days
3. **Use HTTPS only** - Configure SSL/TLS on production domain
4. **Monitor rate limits** - Check logs for rate limit abuse
5. **Backup database** - MongoDB Atlas automated backups
6. **Enable Cloudinary moderation** - Auto-detect inappropriate content

---

## Postponed for Later

These features were explicitly postponed by the user:

- ❌ HTTPS/SSL Configuration - Configure at hosting platform level
- ❌ SMTP Email Configuration - Set up when ready to enable email features
- ❌ Monitoring (Sentry/APM) - Add when traffic justifies it

---

## Troubleshooting

### Issue: App exits with "CRITICAL SECURITY ERRORS"

**Solution**: Review error messages and update `.env` file with correct values.

### Issue: 503 "Cloud storage not configured"

**Solution**: Add Cloudinary credentials to `.env` and restart backend.

### Issue: Rate limit too strict for testing

**Solution**: Set `ENVIRONMENT=development` in `.env` during testing.

### Issue: Frontend can't refresh tokens

**Solution**: Ensure frontend is sending cookies with requests (`credentials: 'include'` in fetch).

---

## Database Note

The user mentioned "keep firestore database" but the app currently uses **MongoDB**. If migration to Firestore is desired, this requires:

1. Replace Motor with Firestore client
2. Update all database operations
3. Migrate data schema
4. Update authentication queries

**Recommendation**: Confirm database requirement before proceeding. MongoDB is already configured and working.

---

## Support

For issues or questions:
- Check logs for detailed error messages
- Review `.env.example` for required variables
- Verify all dependencies are installed
- Ensure production config passes validation

All critical production issues have been resolved. The application is ready for deployment once environment variables are configured.
