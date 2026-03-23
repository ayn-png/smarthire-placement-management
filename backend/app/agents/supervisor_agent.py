"""
Supervisor Agent - Main Orchestrator

Uses LangGraph to manage workflow between sub-agents:
1. Resume Extraction Agent
2. Job Matching Recommendation Agent

Responsibilities:
- Control workflow and agent transitions
- Validate outputs from each agent
- Handle error recovery and retries
- Maintain shared state across agents
- Provide tracing and monitoring via LangSmith
"""

import logging
import uuid
from typing import Dict, Any, Literal
from datetime import datetime
from langgraph.graph import StateGraph, END
from langchain_core.runnables import RunnableConfig

from app.schemas.agent_state import AgentState
from app.agents.resume_extraction_agent import ResumeExtractionAgent
from app.agents.job_matching_agent import JobMatchingAgent
from app.core.langsmith_config import get_trace_url

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SupervisorAgent:
    """
    Main orchestrator agent that manages the multi-agent workflow using LangGraph.

    Workflow:
    START → Resume Extraction → Validate Extraction → Job Matching → Validate Matches → END
    """

    def __init__(self, db):
        """
        Initialize Supervisor Agent with database and sub-agents.

        Args:
            db: Firestore database client
        """
        self.db = db

        # Initialize sub-agents
        self.resume_agent = ResumeExtractionAgent()
        self.job_matching_agent = JobMatchingAgent(db)

        # Build the LangGraph workflow
        self.workflow = self._build_workflow()

    def _build_workflow(self) -> StateGraph:
        """
        Build the LangGraph StateGraph for agent orchestration.

        Returns:
            Compiled StateGraph ready for execution
        """
        # Create the graph
        workflow = StateGraph(AgentState)

        # Add nodes (agent steps)
        workflow.add_node("resume_extraction", self.resume_extraction_node)
        workflow.add_node("validate_extraction", self.validate_extraction_node)
        workflow.add_node("job_matching", self.job_matching_node)
        workflow.add_node("validate_matches", self.validate_matches_node)
        workflow.add_node("handle_error", self.handle_error_node)

        # Define entry point
        workflow.set_entry_point("resume_extraction")

        # Add conditional edges
        workflow.add_conditional_edges(
            "resume_extraction",
            self.should_retry_extraction,
            {
                "validate": "validate_extraction",
                "retry": "resume_extraction",
                "error": "handle_error"
            }
        )

        workflow.add_conditional_edges(
            "validate_extraction",
            self.should_proceed_to_matching,
            {
                "proceed": "job_matching",
                "retry": "resume_extraction",
                "skip": END
            }
        )

        workflow.add_conditional_edges(
            "job_matching",
            self.should_retry_matching,
            {
                "validate": "validate_matches",
                "retry": "job_matching",
                "error": "handle_error"
            }
        )

        workflow.add_edge("validate_matches", END)
        workflow.add_edge("handle_error", END)

        # Compile the graph
        return workflow.compile()

    # ==================== NODE FUNCTIONS ====================

    async def resume_extraction_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Node: Execute Resume Extraction Agent.

        Args:
            state: Current agent state

        Returns:
            Updated state with extraction results
        """
        logger.info(f"[Node: Resume Extraction] Starting for request {state.request_id}")

        updates = {
            "current_step": "resume_extraction",
            "errors": state.errors.copy(),
            "warnings": state.warnings.copy()
        }

        try:
            # Execute resume extraction
            result = await self.resume_agent.extract_and_structure(state.resume_pdf_path)

            # Update state
            updates["resume_extraction_result"] = result

            if result.status == "failed":
                updates["errors"].append(f"Resume extraction failed: {result.error_message}")
                # Increment retry count for failures
                updates["retry_count"] = state.retry_count + 1
            elif result.status == "partial_success":
                updates["warnings"].append(f"Resume extraction partially successful (confidence: {result.confidence_score:.2f})")
                # Reset retry count on success
                updates["retry_count"] = 0
            else:
                # Reset retry count on success
                updates["retry_count"] = 0

            logger.info(f"[Node: Resume Extraction] Completed with status: {result.status}")

        except Exception as e:
            logger.error(f"[Node: Resume Extraction] Error: {str(e)}", exc_info=True)
            updates["errors"].append(f"Resume extraction node error: {str(e)}")
            updates["retry_count"] = state.retry_count + 1

        return updates

    async def validate_extraction_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Node: Validate resume extraction results.

        Args:
            state: Current agent state

        Returns:
            Updated state after validation
        """
        logger.info(f"[Node: Validate Extraction] Validating for request {state.request_id}")

        updates = {
            "current_step": "validate_extraction",
            "warnings": state.warnings.copy(),
            "errors": state.errors.copy()
        }

        if state.resume_extraction_result:
            result = state.resume_extraction_result

            # Check if extraction was successful enough to proceed
            if result.status == "success" or result.status == "partial_success":
                if result.confidence_score >= 0.4:
                    logger.info(f"[Node: Validate Extraction] Validation passed (confidence: {result.confidence_score:.2f})")
                    updates["next_agent"] = "job_matching"
                else:
                    logger.warning(f"[Node: Validate Extraction] Confidence too low: {result.confidence_score:.2f}")
                    updates["warnings"].append(f"Low confidence extraction: {result.confidence_score:.2f}")
                    updates["next_agent"] = "job_matching"  # Proceed anyway
            else:
                logger.error("[Node: Validate Extraction] Validation failed")
                updates["next_agent"] = None
        else:
            logger.error("[Node: Validate Extraction] No extraction result found")
            updates["errors"].append("No extraction result to validate")
            updates["next_agent"] = None

        return updates

    async def job_matching_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Node: Execute Job Matching Agent.

        Args:
            state: Current agent state

        Returns:
            Updated state with matching results
        """
        logger.info(f"[Node: Job Matching] Starting for request {state.request_id}")

        updates = {
            "current_step": "job_matching",
            "errors": state.errors.copy(),
            "warnings": state.warnings.copy()
        }

        try:
            # Check if we have valid resume data
            if not state.resume_extraction_result or not state.resume_extraction_result.extracted_resume:
                logger.error("[Node: Job Matching] No resume data available")
                updates["errors"].append("Cannot match jobs without valid resume data")
                return updates

            # Execute job matching
            result = await self.job_matching_agent.match_jobs(
                resume=state.resume_extraction_result.extracted_resume,
                user_preferences=state.user_preferences
            )

            # Update state
            updates["job_matching_result"] = result

            if result.status == "failed":
                updates["errors"].append(f"Job matching failed: {result.error_message}")
                updates["retry_count"] = state.retry_count + 1
            elif result.status == "no_matches":
                updates["warnings"].append("No matching jobs found")
                updates["retry_count"] = 0
            else:
                updates["retry_count"] = 0

            logger.info(f"[Node: Job Matching] Completed with status: {result.status}")

        except Exception as e:
            logger.error(f"[Node: Job Matching] Error: {str(e)}", exc_info=True)
            updates["errors"].append(f"Job matching node error: {str(e)}")
            updates["retry_count"] = state.retry_count + 1

        return updates

    async def validate_matches_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Node: Validate job matching results.

        Args:
            state: Current agent state

        Returns:
            Updated state after validation
        """
        logger.info(f"[Node: Validate Matches] Validating for request {state.request_id}")

        updates = {
            "current_step": "validate_matches",
            "errors": state.errors.copy()
        }

        if state.job_matching_result:
            result = state.job_matching_result

            if result.status == "success" and len(result.matched_jobs) > 0:
                logger.info(f"[Node: Validate Matches] Validation passed ({len(result.matched_jobs)} jobs)")
            elif result.status == "no_matches":
                logger.warning("[Node: Validate Matches] No matches found")
            else:
                logger.error("[Node: Validate Matches] Validation failed")
        else:
            logger.error("[Node: Validate Matches] No matching result found")
            updates["errors"].append("No matching result to validate")

        return updates

    async def handle_error_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Node: Handle errors and provide fallback.

        Args:
            state: Current agent state

        Returns:
            Updated state with error handling
        """
        logger.error(f"[Node: Handle Error] Processing errors for request {state.request_id}")

        # Log all errors
        for error in state.errors:
            logger.error(f"  - {error}")

        return {"current_step": "error_handling"}

    # ==================== CONDITIONAL EDGE FUNCTIONS ====================

    def should_retry_extraction(self, state: AgentState) -> Literal["validate", "retry", "error"]:
        """
        Decide whether to retry resume extraction, proceed to validation, or error out.

        Args:
            state: Current agent state

        Returns:
            Next step: "validate", "retry", or "error"
        """
        if not state.resume_extraction_result:
            return "error"

        result = state.resume_extraction_result

        # If successful or partial success, proceed to validation
        if result.status in ["success", "partial_success"]:
            return "validate"

        # If failed and retries remaining, retry
        if result.status == "failed" and state.retry_count < state.max_retries:
            # Note: We can't mutate state here, but we log for tracking
            logger.info(f"[Decision] Retrying extraction (attempt {state.retry_count + 1}/{state.max_retries})")
            return "retry"

        # Otherwise, error out
        logger.error("[Decision] Max retries exceeded for extraction")
        return "error"

    def should_proceed_to_matching(self, state: AgentState) -> Literal["proceed", "retry", "skip"]:
        """
        Decide whether to proceed to job matching or retry extraction.

        Args:
            state: Current agent state

        Returns:
            Next step: "proceed", "retry", or "skip"
        """
        if not state.resume_extraction_result:
            return "skip"

        result = state.resume_extraction_result

        # If confidence is acceptable, proceed
        if result.confidence_score >= 0.4:
            return "proceed"

        # If confidence is too low and retries remaining, retry
        if state.retry_count < state.max_retries:
            logger.info(f"[Decision] Low confidence, retrying extraction (attempt {state.retry_count + 1}/{state.max_retries})")
            return "retry"

        # Otherwise, proceed anyway (best effort)
        logger.warning("[Decision] Max retries exceeded, proceeding with low confidence")
        return "proceed"

    def should_retry_matching(self, state: AgentState) -> Literal["validate", "retry", "error"]:
        """
        Decide whether to retry job matching, proceed to validation, or error out.

        Args:
            state: Current agent state

        Returns:
            Next step: "validate", "retry", or "error"
        """
        if not state.job_matching_result:
            return "error"

        result = state.job_matching_result

        # If successful or no matches, proceed to validation
        if result.status in ["success", "no_matches"]:
            return "validate"

        # If failed and retries remaining, retry
        if result.status == "failed" and state.retry_count < state.max_retries:
            logger.info(f"[Decision] Retrying matching (attempt {state.retry_count + 1}/{state.max_retries})")
            return "retry"

        # Otherwise, error out
        logger.error("[Decision] Max retries exceeded for matching")
        return "error"

    # ==================== MAIN EXECUTION ====================

    async def execute(
        self,
        user_id: str,
        resume_pdf_path: str,
        job_description: str = None,
        user_preferences: Dict[str, Any] = None
    ) -> AgentState:
        """
        Execute the full multi-agent workflow.

        Args:
            user_id: Student/user ID
            resume_pdf_path: Path to resume PDF file
            job_description: Optional job description for targeted matching
            user_preferences: Optional user preferences

        Returns:
            Final AgentState with all results
        """
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        logger.info(f"[Supervisor] Starting execution for request {request_id}")

        # Initialize state
        initial_state = AgentState(
            request_id=request_id,
            user_id=user_id,
            resume_pdf_path=resume_pdf_path,
            job_description=job_description,
            user_preferences=user_preferences or {},
            timestamp=datetime.utcnow()
        )

        try:
            # Execute workflow
            config = RunnableConfig(
                run_name=f"smarthire_multi_agent_{request_id}",
                tags=["smarthire", "multi-agent", "supervisor"],
                metadata={
                    "user_id": user_id,
                    "request_id": request_id
                }
            )

            final_state_dict = await self.workflow.ainvoke(initial_state, config=config)

            # Convert dict back to AgentState (LangGraph returns dict)
            final_state = AgentState(**final_state_dict)

            # Extract trace ID from config (if LangSmith enabled)
            if hasattr(config, "run_id"):
                final_state.trace_id = str(config.run_id)
                final_state.trace_url = get_trace_url(final_state.trace_id)

            logger.info(f"[Supervisor] Execution completed for request {request_id}")

            return final_state

        except Exception as e:
            logger.error(f"[Supervisor] Execution failed: {str(e)}", exc_info=True)
            initial_state.errors.append(f"Supervisor execution error: {str(e)}")
            return initial_state
