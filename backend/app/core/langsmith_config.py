"""
LangSmith Configuration for Tracing and Monitoring
Provides centralized configuration for LangSmith integration across all agents.
"""

import os
from app.core.config import settings


def configure_langsmith():
    """
    Configure LangSmith environment variables for tracing and monitoring.

    This function sets up:
    - Tracing enablement (LANGCHAIN_TRACING_V2)
    - LangSmith API endpoint
    - API key for authentication
    - Project name for organizing traces

    Returns:
        dict: Configuration status with enabled flag and project name
    """
    # Set environment variables for LangChain/LangSmith
    if settings.LANGCHAIN_API_KEY:
        os.environ["LANGCHAIN_TRACING_V2"] = str(settings.LANGCHAIN_TRACING_V2).lower()
        os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGCHAIN_ENDPOINT
        os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
        os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT

        return {
            "enabled": True,
            "project": settings.LANGCHAIN_PROJECT,
            "endpoint": settings.LANGCHAIN_ENDPOINT
        }
    else:
        # Disable tracing if no API key provided (development mode)
        os.environ["LANGCHAIN_TRACING_V2"] = "false"
        return {
            "enabled": False,
            "project": None,
            "endpoint": None
        }


def get_trace_url(run_id: str) -> str:
    """
    Generate LangSmith trace URL for a specific run.

    Args:
        run_id: The unique run identifier from LangSmith

    Returns:
        str: Full URL to view the trace in LangSmith dashboard
    """
    if settings.LANGCHAIN_API_KEY:
        return f"https://smith.langchain.com/o/default/projects/{settings.LANGCHAIN_PROJECT}/r/{run_id}"
    return ""


# Initialize LangSmith configuration on module import
langsmith_config = configure_langsmith()
