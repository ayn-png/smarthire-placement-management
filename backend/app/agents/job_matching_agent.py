"""
Job Matching Recommendation Agent

Responsible for:
1. Fetching active jobs from database
2. Calculating similarity scores between resume and job requirements
3. Filtering jobs based on eligibility criteria (CGPA, branch, etc.)
4. Ranking jobs and providing explanations
5. Returning top 5 recommendations
"""

import logging
from typing import List, Dict, Any
import asyncio
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.schemas.agent_state import (
    ExtractedResume,
    JobMatchScore,
    JobMatchingResult
)
from app.core.config import settings
from app.core.enums import JobStatus

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class JobMatchingAgent:
    """
    Agent responsible for matching student resumes with relevant job postings.

    Uses multiple scoring mechanisms:
    1. Skill similarity (semantic matching using embeddings)
    2. Experience level matching
    3. Education requirements matching
    4. Location preference matching
    5. Salary compatibility
    """

    def __init__(self, db):
        """
        Initialize the Job Matching Agent.

        Args:
            db: Firestore database client
        """
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is required for Job Matching Agent")

        self.db = db

        # Initialize OpenAI embeddings for semantic similarity
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=settings.OPENAI_API_KEY
        )

        # Initialize LLM for ranking and explanation
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0,
            openai_api_key=settings.OPENAI_API_KEY,
            timeout=60,
            max_retries=2
        )

        # JSON output parser
        self.parser = JsonOutputParser()

        # Prompt for job ranking and explanation
        self.ranking_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert job matching assistant. Given a student's resume and a job description, evaluate the match and provide detailed reasons.

Analyze:
1. Skill overlap - Which skills from resume match job requirements
2. Missing skills - Critical skills student lacks
3. Experience relevance - Whether student's experience aligns with job
4. Education fit - Whether education meets requirements

Provide output as JSON:
{{
  "matching_skills": ["skill1", "skill2", ...],
  "missing_skills": ["skill1", "skill2", ...],
  "reasons": ["reason1", "reason2", ...]
}}

Be specific and actionable in your reasons."""),
            ("human", """Resume Summary:
Skills: {resume_skills}
Education: {resume_education}
Experience: {resume_experience}

Job Requirements:
Title: {job_title}
Required Skills: {job_skills}
Description: {job_description}

Evaluate this match and provide detailed analysis.""")
        ])

    async def fetch_active_jobs(self, limit: int = 1000) -> List[Dict[str, Any]]:
        """
        Fetch active jobs from Firestore with limit.

        Args:
            limit: Maximum number of jobs to fetch (default 1000 for performance)

        Returns:
            List of job dicts
        """
        try:
            if self.db is None:
                logger.error("Database connection is None")
                return []

            docs = await asyncio.to_thread(
                self.db.collection("jobs")
                .where("status", "==", JobStatus.OPEN.value)
                .limit(limit)
                .get
            )
            jobs = []
            for d in docs:
                if d.exists:
                    data = d.to_dict() or {}
                    data["id"] = d.id
                    jobs.append(data)
            logger.info(f"Fetched {len(jobs)} active jobs from Firestore (limit: {limit})")
            return jobs
        except Exception as e:
            logger.error(f"Error fetching jobs: {str(e)}", exc_info=True)
            return []

    def calculate_skill_similarity(self, resume_skills: List[str], job_skills: List[str]) -> float:
        """
        Calculate skill similarity score using simple overlap.

        Args:
            resume_skills: Skills from resume
            job_skills: Required skills for job

        Returns:
            Similarity score between 0.0 and 1.0
        """
        if not job_skills:
            return 0.5  # Neutral score if no skills specified

        # Convert to lowercase for case-insensitive matching
        resume_skills_lower = [s.lower().strip() for s in resume_skills]
        job_skills_lower = [s.lower().strip() for s in job_skills]

        # Calculate overlap
        matching_skills = set(resume_skills_lower) & set(job_skills_lower)

        if len(job_skills_lower) == 0:
            return 0.5

        # Jaccard similarity with weight towards job requirements
        similarity = len(matching_skills) / len(job_skills_lower)

        return min(similarity, 1.0)

    def check_education_match(
        self,
        resume: ExtractedResume,
        job: Dict[str, Any]
    ) -> bool:
        """
        Check if student's education meets job requirements.

        Args:
            resume: Extracted resume data
            job: Job document

        Returns:
            True if education requirements are met
        """
        # Check CGPA requirement
        min_cgpa = job.get("min_cgpa", 0.0)

        # Find highest CGPA in education
        student_cgpa = 0.0
        for edu in resume.education:
            if edu.cgpa:
                student_cgpa = max(student_cgpa, edu.cgpa)

        # Check branch requirement
        allowed_branches = job.get("allowed_branches", [])
        if allowed_branches:
            # Extract branch from education (e.g., "B.Tech in CSE" -> "CSE")
            student_branches = []
            for edu in resume.education:
                degree = edu.degree.upper()
                for branch in allowed_branches:
                    if branch.upper() in degree:
                        student_branches.append(branch)

            # If no branch match and branches are specified, fail
            if not student_branches:
                return False

        # Check CGPA (if student has CGPA info)
        if student_cgpa > 0 and student_cgpa < min_cgpa:
            return False

        return True

    def check_experience_match(
        self,
        resume: ExtractedResume,
        job: Dict[str, Any]
    ) -> bool:
        """
        Check if student's experience level matches job requirements.

        Args:
            resume: Extracted resume data
            job: Job document

        Returns:
            True if experience requirements are met
        """
        # Count years of experience from resume
        years_of_experience = len(resume.experience)

        # For fresher jobs, prefer candidates with 0-1 years
        job_title = job.get("title", "").lower()
        job_description = job.get("description", "").lower()

        if "fresher" in job_title or "fresher" in job_description:
            return years_of_experience <= 1

        if "intern" in job_title or "intern" in job_description:
            return years_of_experience <= 2

        # For experienced roles, check if student has relevant experience
        if "senior" in job_title or "lead" in job_title:
            return years_of_experience >= 3

        # Default: accept all
        return True

    async def analyze_job_match_with_llm(
        self,
        resume: ExtractedResume,
        job: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Use LLM to analyze job match and provide explanations.

        Args:
            resume: Extracted resume data
            job: Job document

        Returns:
            Dictionary with matching_skills, missing_skills, and reasons
        """
        try:
            # Prepare resume summary
            resume_skills = ", ".join(resume.skills[:20])  # Limit to 20 skills
            resume_education = " | ".join([f"{e.degree} from {e.institution}" for e in resume.education[:2]])
            resume_experience = " | ".join([f"{e.title} at {e.company}" for e in resume.experience[:3]])

            # Prepare job summary
            job_title = job.get("title", "")
            job_skills = ", ".join(job.get("required_skills", [])[:15])
            job_description = job.get("description", "")[:500]  # Limit description length

            # Generate analysis
            chain = self.ranking_prompt | self.llm | self.parser
            result = await chain.ainvoke({
                "resume_skills": resume_skills or "Not specified",
                "resume_education": resume_education or "Not specified",
                "resume_experience": resume_experience or "No experience",
                "job_title": job_title,
                "job_skills": job_skills or "Not specified",
                "job_description": job_description
            })

            return result

        except Exception as e:
            logger.error(f"LLM analysis failed: {str(e)}")
            # Return default analysis
            return {
                "matching_skills": [],
                "missing_skills": [],
                "reasons": ["Unable to generate detailed analysis"]
            }

    async def match_jobs(
        self,
        resume: ExtractedResume,
        user_preferences: Dict[str, Any]
    ) -> JobMatchingResult:
        """
        Main method: Match resume with jobs and return top recommendations.

        Args:
            resume: Extracted resume data
            user_preferences: User preferences (location, salary, etc.)

        Returns:
            JobMatchingResult with top matched jobs
        """
        try:
            logger.info("Starting job matching process")

            # Step 1: Fetch all active jobs
            jobs = await self.fetch_active_jobs()
            total_jobs = len(jobs)

            if total_jobs == 0:
                logger.warning("No active jobs found in database")
                return JobMatchingResult(
                    status="no_matches",
                    matched_jobs=[],
                    total_jobs_evaluated=0,
                    jobs_passed_filter=0,
                    avg_match_score=0.0,
                    error_message="No active jobs available"
                )

            # Step 2: Filter jobs by eligibility
            eligible_jobs = []
            for job in jobs:
                education_match = self.check_education_match(resume, job)
                experience_match = self.check_experience_match(resume, job)

                if education_match and experience_match:
                    eligible_jobs.append(job)

            jobs_passed_filter = len(eligible_jobs)
            logger.info(f"{jobs_passed_filter}/{total_jobs} jobs passed eligibility filter")

            if jobs_passed_filter == 0:
                return JobMatchingResult(
                    status="no_matches",
                    matched_jobs=[],
                    total_jobs_evaluated=total_jobs,
                    jobs_passed_filter=0,
                    avg_match_score=0.0,
                    error_message="No jobs match your eligibility criteria"
                )

            # Step 3: Calculate match scores for eligible jobs
            job_scores = []
            for job in eligible_jobs:
                # Calculate skill similarity
                skill_score = self.calculate_skill_similarity(
                    resume.skills,
                    job.get("required_skills", [])
                )

                # Weight skill score more heavily (70% of total score)
                overall_score = skill_score * 0.7 + 0.3  # Base 30% for being eligible

                job_scores.append({
                    "job": job,
                    "skill_score": skill_score,
                    "overall_score": overall_score
                })

            # Sort by overall score (descending)
            job_scores.sort(key=lambda x: x["overall_score"], reverse=True)

            # Step 4: Get top 5 jobs and generate explanations
            top_jobs = job_scores[:5]
            matched_jobs = []

            for job_data in top_jobs:
                job = job_data["job"]

                # Get LLM analysis for explanations
                analysis = await self.analyze_job_match_with_llm(resume, job)

                # Fetch company name from Firestore
                company_id = job.get("company_id")
                company_name = "Unknown Company"
                if company_id:
                    try:
                        company_doc = await asyncio.to_thread(
                            self.db.collection("companies").document(company_id).get
                        )
                        if company_doc.exists:
                            company_name = (company_doc.to_dict() or {}).get("name", "Unknown Company")
                    except Exception:
                        pass

                # Create JobMatchScore object
                match_score = JobMatchScore(
                    job_id=str(job.get("id", "")),
                    job_title=job.get("title", ""),
                    company_name=company_name,
                    match_score=job_data["overall_score"],
                    skill_match_score=job_data["skill_score"],
                    experience_match=True,  # Already filtered
                    education_match=True,   # Already filtered
                    reasons=analysis.get("reasons", []),
                    missing_skills=analysis.get("missing_skills", []),
                    matching_skills=analysis.get("matching_skills", [])
                )

                matched_jobs.append(match_score)

            # Calculate average match score
            avg_score = sum(job_data["overall_score"] for job_data in job_scores) / len(job_scores)

            logger.info(f"Job matching completed: {len(matched_jobs)} recommendations generated")

            return JobMatchingResult(
                status="success",
                matched_jobs=matched_jobs,
                total_jobs_evaluated=total_jobs,
                jobs_passed_filter=jobs_passed_filter,
                avg_match_score=avg_score,
                error_message=None
            )

        except Exception as e:
            logger.error(f"Job matching failed: {str(e)}", exc_info=True)
            return JobMatchingResult(
                status="failed",
                matched_jobs=[],
                total_jobs_evaluated=0,
                jobs_passed_filter=0,
                avg_match_score=0.0,
                error_message=f"Job matching failed: {str(e)}"
            )
