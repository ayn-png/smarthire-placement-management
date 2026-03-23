"""
AI Resume Analyzer Service — OpenAI Integration Only.

Uses OpenAI's GPT-4o-mini via LangChain for production-grade resume analysis.
Requires OPENAI_API_KEY to be set in .env file.
"""

import json
import re
import logging
from typing import Optional, List

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────
OPENAI_MODEL = "gpt-4o-mini"  # Cost-effective, fast, high-quality


# ── Prompt builder ───────────────────────────────────────────────────────────

def _build_prompt(resume_text: str, job_description: Optional[str] = None) -> str:
    """
    Build a structured prompt that instructs the AI to return a fixed JSON schema.
    Includes strengths + weaknesses in addition to the previous fields.
    """
    jd_section = ""
    if job_description:
        jd_section = (
            "\n\n--- JOB DESCRIPTION ---\n"
            f"{job_description}\n"
            "--- END JOB DESCRIPTION ---\n"
            "\nCompare the resume against this job description when scoring and "
            "identifying missing skills."
        )

    return f"""You are an expert ATS (Applicant Tracking System) resume analyst with deep knowledge of hiring practices across industries.

Analyze the following resume text professionally and return a JSON object with EXACTLY these fields:

- "atsScore": realistic integer 0-100 representing ATS compatibility
- "extractedSkills": array of strings listing every technical and soft skill found
- "missingSkills": array of strings listing important industry-standard skills absent from the resume
- "strengths": array of strings (3-5 genuine strengths of this resume)
- "weaknesses": array of strings (3-5 real gaps or areas needing improvement)
- "suggestions": array of strings (5-8 specific, actionable improvement tips)
{jd_section}

Scoring guidelines:
- 0-40: Many critical sections missing, poor formatting, very weak content
- 41-60: Some sections present but lacking depth, keywords, or structure
- 61-75: Solid resume with room for improvement in keywords and quantification
- 76-90: Strong resume with good ATS optimization
- 91-100: Exceptional, nearly perfect ATS optimization (rare)

Rules:
1. Be realistic — most resumes score 40-70; only excellent ones exceed 80.
2. For extractedSkills: list every programming language, framework, tool, methodology, and soft skill.
3. For missingSkills: focus on high-value skills relevant to the candidate's apparent field.
4. For strengths: identify genuine positives (relevant education, strong projects, good formatting, etc.).
5. For weaknesses: point out real gaps (no metrics, missing sections, weak action verbs, etc.).
6. For suggestions: give specific, actionable advice (e.g., "Add bullet points with numbers like 'Improved performance by 40%'").
7. CRITICAL: Respond ONLY with valid JSON. No markdown code fences, no preamble, no extra text.

--- RESUME TEXT ---
{resume_text[:6000]}
--- END RESUME TEXT ---

JSON response:"""


# ── JSON extraction & sanitization ──────────────────────────────────────────

def _extract_json(text: str) -> dict:
    """Robustly extract the first JSON object from an AI response."""
    text = text.strip()

    # Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown code fences (```json ... ```)
    cleaned = re.sub(r"```(?:json)?\s*", "", text)
    cleaned = re.sub(r"```\s*$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Extract first { ... } block
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"AI response was not valid JSON. Got: {text[:200]}")


def _sanitize_result(data: dict) -> dict:
    """
    Normalise the AI result to our fixed schema.
    Handles both camelCase and snake_case field names from different models.
    Adds default empty lists for any missing fields.
    """

    def _clean_list(key_candidates: List[str], limit: int) -> List[str]:
        """Try multiple key names and return the first non-empty list found."""
        for key in key_candidates:
            value = data.get(key, [])
            if isinstance(value, list) and value:
                return [
                    re.sub(r"<[^>]+>", "", str(v)).strip()
                    for v in value
                    if v
                ][:limit]
        return []

    # atsScore — try camelCase and snake_case
    raw_score = data.get("atsScore") or data.get("ats_score", 0)
    try:
        ats_score = max(0, min(100, int(raw_score)))
    except (ValueError, TypeError):
        ats_score = 0

    return {
        "atsScore": ats_score,
        "extractedSkills": _clean_list(["extractedSkills", "extracted_skills", "skills"], 30),
        "missingSkills": _clean_list(["missingSkills", "missing_skills"], 20),
        "strengths": _clean_list(["strengths"], 10),
        "weaknesses": _clean_list(["weaknesses", "areas_for_improvement"], 10),
        "suggestions": _clean_list(["suggestions", "improvements", "recommendations"], 15),
    }


# ── OpenAI Integration ───────────────────────────────────────────────────────

async def _call_openai_langchain(prompt: str, api_key: str) -> dict:
    """
    Call OpenAI via LangChain.
    Uses gpt-4o-mini — fast, cost-effective, and highly reliable.
    """
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage
    except ImportError as e:
        raise ImportError(
            f"langchain-openai is not installed. "
            f"Run: pip install langchain-openai>=0.2.0  ({e})"
        )

    llm = ChatOpenAI(
        model=OPENAI_MODEL,
        openai_api_key=api_key,
        temperature=0.0,  # Deterministic output for consistent JSON
        max_tokens=1500,
        timeout=60,
    )

    # ainvoke is the async entry-point for LangChain chat models
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    text = response.content

    if not text or not text.strip():
        raise RuntimeError("OpenAI returned an empty response")

    parsed = _extract_json(text)
    logger.info("AI analysis succeeded via OpenAI (LangChain)")
    return _sanitize_result(parsed)


# ── Job Role Matching ────────────────────────────────────────────────────────

# Define job role skill mappings
JOB_ROLE_SKILLS = {
    "Frontend Developer": {
        "skills": ["JavaScript", "React", "Vue", "Angular", "HTML", "CSS", "TypeScript", "Redux", "Webpack", "Next.js", "Tailwind", "SASS", "Bootstrap"],
        "min_match": 3
    },
    "Backend Developer": {
        "skills": ["Node.js", "Python", "Java", "Django", "Flask", "FastAPI", "Spring Boot", "Express", "MongoDB", "PostgreSQL", "MySQL", "Redis", "Docker", "Kubernetes"],
        "min_match": 3
    },
    "Full Stack Developer": {
        "skills": ["JavaScript", "React", "Node.js", "Express", "MongoDB", "Python", "Django", "Flask", "PostgreSQL", "MySQL", "HTML", "CSS", "Docker", "Git", "TypeScript"],
        "min_match": 4
    },
    "Data Analyst": {
        "skills": ["Python", "R", "SQL", "Excel", "Tableau", "Power BI", "Pandas", "NumPy", "Matplotlib", "Seaborn", "Statistics", "Data Visualization", "ETL"],
        "min_match": 3
    },
    "AI/ML Engineer": {
        "skills": ["Python", "TensorFlow", "PyTorch", "Keras", "Scikit-learn", "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "Data Science", "NumPy", "Pandas"],
        "min_match": 3
    },
    "DevOps Engineer": {
        "skills": ["Docker", "Kubernetes", "Jenkins", "CI/CD", "AWS", "Azure", "GCP", "Terraform", "Ansible", "Linux", "Git", "Monitoring", "Shell Scripting"],
        "min_match": 3
    },
    "Software Engineer": {
        "skills": ["Python", "Java", "C++", "JavaScript", "Git", "Data Structures", "Algorithms", "OOP", "System Design", "Testing", "Debugging"],
        "min_match": 3
    },
    "Cloud Engineer": {
        "skills": ["AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "CloudFormation", "Lambda", "S3", "EC2", "Serverless", "Networking"],
        "min_match": 3
    },
    "Mobile Developer": {
        "skills": ["React Native", "Flutter", "Swift", "Kotlin", "Java", "iOS", "Android", "Firebase", "Mobile UI/UX", "API Integration"],
        "min_match": 3
    },
    "QA Engineer": {
        "skills": ["Selenium", "Testing", "Automation", "Jest", "Pytest", "Cypress", "Test Planning", "Bug Tracking", "CI/CD", "Quality Assurance"],
        "min_match": 3
    }
}


def _generate_job_suggestions(extracted_skills: List[str]) -> List[dict]:
    """
    Generate job role suggestions based on extracted skills.

    Args:
        extracted_skills: List of skills extracted from the resume

    Returns:
        List of job suggestions with role, matchScore, and requiredSkills
    """
    if not extracted_skills:
        return []

    # Normalize extracted skills for case-insensitive matching
    normalized_extracted = [skill.lower() for skill in extracted_skills]

    job_matches = []

    for role, role_data in JOB_ROLE_SKILLS.items():
        role_skills = role_data["skills"]
        min_match = role_data["min_match"]

        # Find matching skills (case-insensitive)
        matching_skills = []
        for role_skill in role_skills:
            if role_skill.lower() in normalized_extracted:
                matching_skills.append(role_skill)

        # Calculate match score
        match_count = len(matching_skills)
        total_role_skills = len(role_skills)

        if match_count >= min_match:
            # Calculate percentage match
            match_percentage = int((match_count / total_role_skills) * 100)

            job_matches.append({
                "role": role,
                "matchScore": f"{match_percentage}%",
                "requiredSkills": matching_skills[:8],  # Limit to top 8 matching skills
                "match_count": match_count  # For sorting
            })

    # Sort by match count (descending) and return top 8
    job_matches.sort(key=lambda x: x["match_count"], reverse=True)

    # Remove the match_count field before returning
    for match in job_matches:
        del match["match_count"]

    return job_matches[:8]


# ── Public entry-point ───────────────────────────────────────────────────────

async def analyze_resume_text(
    resume_text: str, job_description: Optional[str] = None
) -> dict:
    """
    Analyze a resume using OpenAI's GPT-4o-mini via LangChain.

    Args:
        resume_text: The extracted text from the resume PDF
        job_description: Optional job description to compare against

    Returns:
        Dict with: atsScore, extractedSkills, missingSkills, strengths, weaknesses, suggestions

    Raises:
        RuntimeError: If OpenAI API key is not configured or analysis fails
    """
    if not resume_text or not resume_text.strip():
        raise RuntimeError("Resume text is empty — cannot analyze.")

    openai_key = settings.OPENAI_API_KEY

    if not openai_key:
        raise RuntimeError(
            "OpenAI API key not configured. "
            "Please set OPENAI_API_KEY in your .env file. "
            "Get your key at: https://platform.openai.com/api-keys"
        )

    prompt = _build_prompt(resume_text, job_description)

    try:
        result = await _call_openai_langchain(prompt, openai_key)

        # Generate job suggestions based on extracted skills
        extracted_skills = result.get("extractedSkills", [])
        job_suggestions = _generate_job_suggestions(extracted_skills)

        # Add job suggestions to the result
        result["jobSuggestions"] = job_suggestions

        logger.info(f"Generated {len(job_suggestions)} job role suggestions")
        return result

    except ImportError as e:
        logger.error(f"LangChain OpenAI not installed: {e}")
        raise RuntimeError(f"Missing required package: {e}")
    except Exception as exc:
        logger.error(f"OpenAI analysis failed: {exc}", exc_info=True)
        raise RuntimeError(f"AI analysis failed: {exc}")
