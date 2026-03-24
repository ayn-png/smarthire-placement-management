from fastapi import HTTPException, status
from app.schemas.interview import (
    InterviewQuestionRequest, InterviewQuestionsResponse, InterviewQuestion,
    MockInterviewRequest, MockInterviewResponse, InterviewType
)
from typing import List
import random
import logging

logger = logging.getLogger(__name__)


# ── Curated question bank ────────────────────────────────────────────────────
QUESTION_BANK = {
    InterviewType.HR: {
        "easy": [
            {"question": "Tell me about yourself.", "hint": "Structure: Present, Past, Future", "sample_answer": "I am a final year Computer Science student with strong problem-solving skills..."},
            {"question": "Why do you want to work for this company?", "hint": "Research the company beforehand", "sample_answer": "I admire your company's commitment to innovation..."},
            {"question": "What are your strengths?", "hint": "Be specific and give examples", "sample_answer": "My greatest strength is my ability to learn quickly..."},
            {"question": "What are your weaknesses?", "hint": "Turn weakness into growth story", "sample_answer": "I used to struggle with public speaking but have been actively working on it..."},
            {"question": "Where do you see yourself in 5 years?", "hint": "Align with company growth", "sample_answer": "I see myself growing into a senior engineer role..."},
        ],
        "medium": [
            {"question": "Describe a challenge you faced and how you overcame it.", "hint": "Use STAR method", "sample_answer": None},
            {"question": "How do you handle conflict with a team member?", "hint": "Show collaboration skills", "sample_answer": None},
            {"question": "Tell me about a time you demonstrated leadership.", "hint": "Be specific with outcomes", "sample_answer": None},
            {"question": "How do you prioritize tasks under pressure?", "hint": "Mention time management techniques", "sample_answer": None},
        ],
        "hard": [
            {"question": "Why should we hire you over other candidates?", "hint": "Differentiate your value proposition", "sample_answer": None},
            {"question": "Describe a failure and what you learned from it.", "hint": "Show growth mindset", "sample_answer": None},
        ],
    },
    InterviewType.TECHNICAL: {
        "easy": [
            {"question": "What is the difference between stack and queue?", "hint": "LIFO vs FIFO", "sample_answer": "A stack follows LIFO (Last In First Out)..."},
            {"question": "Explain Object Oriented Programming principles.", "hint": "SOLID, Encapsulation, Inheritance, Polymorphism, Abstraction", "sample_answer": None},
            {"question": "What is a RESTful API?", "hint": "Stateless, HTTP verbs, Resources", "sample_answer": None},
            {"question": "Explain the difference between SQL and NoSQL databases.", "hint": "Structure, scalability, use cases", "sample_answer": None},
            {"question": "What is Big O notation?", "hint": "Time and space complexity", "sample_answer": None},
        ],
        "medium": [
            {"question": "Explain how a hash table works and its time complexity.", "hint": "Hashing function, collision resolution", "sample_answer": None},
            {"question": "What is the difference between process and thread?", "hint": "Memory isolation, communication overhead", "sample_answer": None},
            {"question": "Explain SOLID principles in software design.", "hint": "SRP, OCP, LSP, ISP, DIP", "sample_answer": None},
            {"question": "How does garbage collection work in modern languages?", "hint": "Mark and sweep, reference counting", "sample_answer": None},
            {"question": "What are design patterns? Name a few common ones.", "hint": "Creational, structural, behavioral", "sample_answer": None},
        ],
        "hard": [
            {"question": "Design a URL shortening service like bit.ly.", "hint": "System design: hashing, DB, caching, scaling", "sample_answer": None},
            {"question": "Explain CAP theorem and how it affects distributed systems.", "hint": "Consistency, Availability, Partition Tolerance", "sample_answer": None},
            {"question": "How would you design a scalable chat application?", "hint": "WebSockets, message queues, horizontal scaling", "sample_answer": None},
        ],
    },
    InterviewType.MANAGERIAL: {
        "medium": [
            {"question": "How do you motivate a team that is struggling with a project?", "hint": "Leadership, empathy, goal-setting", "sample_answer": None},
            {"question": "Describe your approach to project planning.", "hint": "Agile, milestones, risk management", "sample_answer": None},
            {"question": "How do you handle underperforming team members?", "hint": "Feedback, mentoring, accountability", "sample_answer": None},
        ],
        "hard": [
            {"question": "How would you handle a situation where your team disagrees with management's decision?", "hint": "Diplomacy, escalation path, alignment", "sample_answer": None},
        ],
    },

    # FIX 3 — CASE_STUDY was declared in InterviewType enum but had NO entries
    # in QUESTION_BANK, causing silent empty-list responses.
    # Added easy / medium / hard questions covering core case-study frameworks.
    InterviewType.CASE_STUDY: {
        "easy": [
            {"question": "Estimate the number of petrol stations in India.", "hint": "Top-down: population → vehicle ownership → fuel-up frequency → station capacity", "sample_answer": None},
            {"question": "How would you increase revenue for a coffee shop losing customers?", "hint": "Diagnose first (footfall, pricing, competition), then propose targeted levers", "sample_answer": None},
            {"question": "A supermarket chain wants to open a new store. Which city would you choose and why?", "hint": "Evaluate market size, competition density, logistics, demographics", "sample_answer": None},
        ],
        "medium": [
            {"question": "A retail company's sales dropped 20% last quarter. How do you diagnose the problem?", "hint": "Use MECE / issue tree: internal (product, price, ops) vs external (market, competition, macro)", "sample_answer": None},
            {"question": "Estimate the market size for food delivery apps in India.", "hint": "Top-down: population → internet users → delivery adopters → order frequency → average spend", "sample_answer": None},
            {"question": "Your client wants to enter the electric vehicle market. How would you advise them?", "hint": "Market attractiveness (size, growth, profitability), competitive landscape, entry modes (build/buy/partner)", "sample_answer": None},
            {"question": "A hospital is experiencing long patient wait times. How would you fix it?", "hint": "Map the patient journey, identify bottleneck stages, apply lean/process improvement techniques", "sample_answer": None},
        ],
        "hard": [
            {"question": "A telecom company is losing customers to a new low-cost competitor. What strategy would you recommend?", "hint": "Segment by price sensitivity, evaluate value vs price response, retention vs acquisition trade-off", "sample_answer": None},
            {"question": "Design a pricing strategy for a SaaS startup entering the enterprise market.", "hint": "Value-based pricing, tiered plans, CAC vs LTV, freemium trade-offs, contract & renewal structure", "sample_answer": None},
            {"question": "A global consumer goods brand wants to expand into rural India. Structure the go-to-market plan.", "hint": "Distribution channels, last-mile logistics, product localisation, price points, partnership ecosystem", "sample_answer": None},
        ],
    },
}


class InterviewService:
    async def get_questions(self, data: InterviewQuestionRequest) -> InterviewQuestionsResponse:
        category_bank = QUESTION_BANK.get(data.interview_type, {})

        # FIX 3 — Raise a descriptive error if the bank is empty for this type.
        # Prevents silent empty-list responses when a new enum value is added
        # without a corresponding QUESTION_BANK entry.
        if not category_bank:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"No questions available for interview type '{data.interview_type.value}'. "
                    "Please choose a different type."
                ),
            )

        difficulty_questions = category_bank.get(data.difficulty, [])

        # Mix in all difficulties if not enough at the requested level
        if len(difficulty_questions) < data.count:
            all_questions: list = []
            for level_questions in category_bank.values():
                all_questions.extend(level_questions)
            difficulty_questions = all_questions

        total_available = len(difficulty_questions)

        # Use a deterministic shuffle seeded by offset so pagination returns
        # consistent, non-overlapping batches for the same request type.
        shuffled = difficulty_questions.copy()
        rng = random.Random(hash(data.interview_type.value + data.difficulty))
        rng.shuffle(shuffled)

        # Apply offset + count (wrap around if offset exceeds bank size)
        offset = data.offset % max(total_available, 1)
        paginated = (shuffled + shuffled)[offset: offset + data.count]
        selected = paginated[:data.count]

        questions = [
            InterviewQuestion(
                question=q["question"],
                category=data.interview_type.value,
                difficulty=data.difficulty,
                hint=q.get("hint"),
                sample_answer=q.get("sample_answer"),
            )
            for q in selected
        ]

        return InterviewQuestionsResponse(
            questions=questions,
            interview_type=data.interview_type,
            total=len(questions),
            total_available=total_available,
            offset=data.offset,
        )

    async def mock_interview_chat(self, data: MockInterviewRequest) -> MockInterviewResponse:
        """
        AI-powered mock interview using Mistral (falls back to enhanced rule-based if unavailable).
        """
        messages = data.messages
        if not messages:
            return MockInterviewResponse(
                reply="Welcome to your mock interview! I'm your AI interviewer. Let's begin. Can you please introduce yourself?",
            )

        last_user_message = None
        for msg in reversed(messages):
            if msg.role == "user":
                last_user_message = msg.content
                break

        if not last_user_message:
            return MockInterviewResponse(reply="Please go ahead and answer the question.")

        # Try Mistral AI first; fall back to enhanced rule-based on any failure
        try:
            ai_reply = await self._call_mistral(messages, data.job_title, data.interview_type, data.difficulty)
            if ai_reply:
                logger.info("Mock interview response generated via Mistral AI")
                return MockInterviewResponse(reply=ai_reply)
            else:
                logger.warning("Mistral API not configured - using enhanced rule-based fallback")
        except Exception as e:
            logger.error(f"Mistral API call failed: {str(e)} - using enhanced rule-based fallback")

        # Enhanced rule-based fallback with contextual responses
        reply = self._generate_interview_response(last_user_message, data.job_title, len(messages))
        feedback = self._generate_feedback(last_user_message)
        logger.info("Mock interview response generated via enhanced rule-based system")
        return MockInterviewResponse(reply=reply, feedback=feedback)

    async def _call_mistral(self, messages, job_title: str | None, interview_type: str | None = None, difficulty: str | None = None) -> str | None:
        """Call Mistral via LangChain for a realistic AI interviewer response."""
        from app.core.config import settings
        if not settings.MISTRAL_API_KEY:
            return None

        from langchain_mistralai import ChatMistralAI
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

        title_str = job_title or "a software engineering role"
        type_str = (interview_type or "TECHNICAL").replace("_", " ").title()
        level_str = (difficulty or "medium").lower()
        system_prompt = (
            f"You are a professional interviewer conducting a {level_str}-difficulty {type_str} mock interview "
            f"for a {title_str} position. "
            "Your role: briefly acknowledge the candidate's last answer (1 sentence), then ask ONE relevant follow-up "
            "or next interview question appropriate for this interview type. Keep your entire response under 80 words. "
            "Do NOT give a score or grade. Sound natural and professional."
        )

        # DB#14 — Trim history to last 20 messages (10 turns) before sending to
        # Mistral. Unbounded history grows indefinitely and will hit the model's
        # context-window limit during long sessions, causing API errors.
        MAX_HISTORY = 20
        trimmed = messages[-MAX_HISTORY:] if len(messages) > MAX_HISTORY else messages

        lc_messages = [SystemMessage(content=system_prompt)]
        for m in trimmed:
            if m.role == "user":
                lc_messages.append(HumanMessage(content=m.content))
            elif m.role == "assistant":
                lc_messages.append(AIMessage(content=m.content))

        llm = ChatMistralAI(
            model="mistral-small-latest",
            mistral_api_key=settings.MISTRAL_API_KEY,
            temperature=0.7,
            max_tokens=150,
            timeout=30,
        )
        response = await llm.ainvoke(lc_messages)
        return response.content.strip() or None

    def _generate_interview_response(self, user_answer: str, job_title: str, turn: int) -> str:
        """Enhanced rule-based response generator with contextual awareness."""

        # Contextual acknowledgments based on answer length and keywords
        answer_lower = user_answer.lower()
        word_count = len(user_answer.split())

        # Context-aware acknowledgments
        if word_count > 100:
            ack_phrases = [
                "Thank you for that detailed response.",
                "I appreciate the comprehensive answer.",
                "That's a thorough explanation.",
            ]
        elif any(keyword in answer_lower for keyword in ["project", "team", "developed", "built"]):
            ack_phrases = [
                "That sounds like valuable experience.",
                "Interesting project work.",
                "Good technical experience.",
            ]
        elif any(keyword in answer_lower for keyword in ["challenge", "difficult", "problem"]):
            ack_phrases = [
                "I appreciate your honesty about challenges.",
                "That shows good problem-solving ability.",
                "Interesting approach to overcoming obstacles.",
            ]
        else:
            ack_phrases = [
                "Thank you for sharing that.",
                "Good point.",
                "I see.",
                "Understood.",
            ]

        ack = random.choice(ack_phrases)

        # Progressive question flow with role-specific context
        role_context = f" for {job_title}" if job_title else ""

        questions_flow = [
            f"Tell me about yourself and what makes you a good fit{role_context}.",
            "What motivated you to apply for this position?",
            "Describe a challenging project you worked on. What was your specific contribution?",
            "Tell me about a time you had to work under tight deadlines. How did you manage?",
            "How do you handle constructive criticism or feedback?",
            "What technical skills are you most proud of, and how have you applied them?",
            "How do you stay updated with the latest trends in your field?",
            "Where do you see yourself in 3-5 years?",
            "What are your salary expectations?",
            "Do you have any questions for us?",
        ]

        idx = (turn // 2) % len(questions_flow)

        # Add variety to avoid repetitive responses
        if turn > 0 and random.random() < 0.3:  # 30% chance of follow-up instead of new question
            follow_ups = [
                "Can you elaborate on that?",
                "What was the outcome of that situation?",
                "How did that experience shape your approach to similar situations?",
                "What would you do differently if faced with a similar situation?",
            ]
            return f"{ack} {random.choice(follow_ups)}"

        return f"{ack} {questions_flow[idx]}"

    def _generate_feedback(self, answer: str) -> str:
        """Generate specific, actionable feedback based on answer quality."""
        word_count = len(answer.split())
        answer_lower = answer.lower()

        feedback_points = []

        # Length feedback
        if word_count < 20:
            feedback_points.append("Your answer was brief. Try elaborating with specific examples using the STAR method (Situation, Task, Action, Result).")
        elif word_count > 200:
            feedback_points.append("Good detail! In real interviews, aim to keep responses concise (1-2 minutes) while maintaining impact.")
        else:
            feedback_points.append("Good answer length - clear and concise.")

        # Content quality checks
        has_numbers = any(char.isdigit() for char in answer)
        has_examples = any(word in answer_lower for word in ["example", "instance", "time when", "experience", "project"])
        has_results = any(word in answer_lower for word in ["result", "outcome", "achieved", "delivered", "impact"])

        if has_numbers and has_results:
            feedback_points.append("Excellent use of metrics and outcomes - this shows measurable impact!")
        elif has_examples:
            feedback_points.append("Good use of specific examples. Consider adding quantifiable results to strengthen your answer.")
        else:
            feedback_points.append("Consider adding concrete examples or specific instances to support your points.")

        # Structure feedback
        if "first" in answer_lower and "then" in answer_lower:
            feedback_points.append("Well-structured response with clear sequencing.")
        elif word_count > 30 and "," not in answer[:100]:
            feedback_points.append("Consider using connectors (First, Additionally, Finally) to improve flow.")

        return " ".join(feedback_points)
