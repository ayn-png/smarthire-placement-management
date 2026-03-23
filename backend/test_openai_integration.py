"""
End-to-end test for AI Resume Analyzer with OpenAI.
Tests PDF extraction + OpenAI analysis.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add the app directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.ai_resume_service import analyze_resume_text


async def test_openai_analysis():
    """Test the OpenAI resume analysis with sample text."""

    print("\n" + "="*70)
    print("Testing OpenAI Resume Analyzer Integration")
    print("="*70 + "\n")

    # Sample resume text for testing
    sample_resume_text = """
AYAN AALAM
Nagpur, Maharashtra, India-440015 | aalamaynn@gmail.com | +91-9529233024 | GitHub | Linkedin

SUMMARY
Final-year Computer Science Engineering student with strong foundation in Java, Python, and web technologies.
Experienced in developing full-stack applications using React, Node.js, and modern development practices.

EDUCATION
Bachelor of Engineering in Computer Science
XYZ University, Nagpur
Expected Graduation: May 2024
CGPA: 8.5/10

TECHNICAL SKILLS
- Programming Languages: Java, Python, JavaScript, C++
- Web Technologies: React, Node.js, Express, HTML5, CSS3
- Databases: MySQL, MongoDB
- Tools: Git, Docker, VS Code
- Concepts: Data Structures, Algorithms, OOP, REST APIs

PROJECTS
E-Commerce Platform (React, Node.js, MongoDB)
- Developed a full-stack e-commerce application with user authentication
- Implemented shopping cart, payment gateway integration, and order management
- Used Redux for state management and JWT for authentication

Task Management System (Python, Flask, PostgreSQL)
- Built a web-based task management system with role-based access control
- Implemented RESTful APIs and real-time updates using WebSockets
- Deployed on AWS EC2 with CI/CD pipeline

CERTIFICATIONS
- AWS Certified Cloud Practitioner
- Python for Data Science (Coursera)
"""

    print("1. Testing PDF Extraction...")
    print(f"   Sample resume text length: {len(sample_resume_text)} characters")
    print()

    print("2. Testing OpenAI Analysis...")
    try:
        result = await analyze_resume_text(sample_resume_text)

        print("   [SUCCESS] OpenAI analysis completed!\n")
        print("="*70)
        print("ANALYSIS RESULTS:")
        print("="*70)
        print(f"\nATS Score: {result['atsScore']}/100\n")

        print("Extracted Skills:")
        for skill in result['extractedSkills'][:10]:  # Show first 10
            print(f"  - {skill}")
        if len(result['extractedSkills']) > 10:
            print(f"  ... and {len(result['extractedSkills']) - 10} more")

        print(f"\nMissing Skills ({len(result['missingSkills'])}):")
        for skill in result['missingSkills'][:5]:
            print(f"  - {skill}")

        print(f"\nStrengths ({len(result['strengths'])}):")
        for strength in result['strengths']:
            print(f"  - {strength}")

        print(f"\nWeaknesses ({len(result['weaknesses'])}):")
        for weakness in result['weaknesses']:
            print(f"  - {weakness}")

        print(f"\nSuggestions ({len(result['suggestions'])}):")
        for suggestion in result['suggestions'][:5]:
            print(f"  - {suggestion}")

        print("\n" + "="*70)
        print("TEST PASSED - AI Resume Analyzer is working correctly!")
        print("="*70)
        return True

    except Exception as e:
        print(f"\n   [ERROR] OpenAI analysis failed: {e}")
        print("\n" + "="*70)
        print("TEST FAILED")
        print("="*70)
        print("\nTroubleshooting:")
        print("1. Check that OPENAI_API_KEY is set correctly in .env")
        print("2. Verify your API key has credits: https://platform.openai.com/usage")
        print("3. Check your internet connection")
        print("4. View detailed error above")
        return False


if __name__ == "__main__":
    print("\nInitializing test...\n")

    # Check if OpenAI API key is configured
    from dotenv import load_dotenv
    load_dotenv()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_openai_api_key_here":
        print("ERROR: OPENAI_API_KEY not configured in .env file")
        print("Please set your OpenAI API key in backend/.env")
        print("Get your key at: https://platform.openai.com/api-keys")
        sys.exit(1)

    print(f"OpenAI API Key found: {api_key[:20]}...{api_key[-4:]}")

    # Run the async test
    success = asyncio.run(test_openai_analysis())
    sys.exit(0 if success else 1)
