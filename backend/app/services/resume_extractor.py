"""
Resume Text Extractor with OCR Fallback

This module provides robust PDF text extraction with automatic OCR fallback
for scanned/image-based PDFs:

1. Primary: LangChain PyPDFLoader (text-based PDFs)
2. Fallback: OCR using Tesseract (scanned/image-based PDFs)

The existing ai_resume.py endpoint has a 4-library cascade as the main approach.
This module provides OCR capabilities for truly image-based PDFs.
"""

import logging
import os
from typing import Optional, Tuple
from langchain_community.document_loaders import PyPDFLoader

logger = logging.getLogger(__name__)


def _check_tesseract_available() -> Tuple[bool, Optional[str]]:
    """
    Check if Tesseract OCR is installed and accessible.

    Returns:
        (is_available, tesseract_path or error_message)
    """
    try:
        import pytesseract
        from PIL import Image

        # Common Tesseract installation paths on Windows
        possible_paths = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            r"C:\Tesseract-OCR\tesseract.exe",
        ]

        # Check if tesseract is in PATH
        try:
            pytesseract.get_tesseract_version()
            logger.info("Tesseract found in PATH")
            return (True, None)
        except Exception:
            # Try common installation paths
            for path in possible_paths:
                if os.path.exists(path):
                    pytesseract.pytesseract.tesseract_cmd = path
                    try:
                        pytesseract.get_tesseract_version()
                        logger.info(f"Tesseract found at: {path}")
                        return (True, path)
                    except Exception:
                        continue

        error_msg = (
            "Tesseract OCR is not installed. To enable OCR for scanned PDFs:\n"
            "1. Download from: https://github.com/UB-Mannheim/tesseract/wiki\n"
            "2. Install to: C:\\Program Files\\Tesseract-OCR\n"
            "3. Restart the server"
        )
        return (False, error_msg)

    except ImportError:
        return (False, "pytesseract library not installed. Run: pip install pytesseract pdf2image")


def extract_resume_text_with_ocr(file_path: str) -> str:
    """
    Extract text from a PDF resume with automatic OCR fallback.

    Flow:
    1. Try standard text extraction using LangChain PyPDFLoader
    2. If text is empty or very short → Run OCR fallback
    3. Return extracted text

    Args:
        file_path: Absolute path to the PDF file

    Returns:
        Extracted text as a single string

    Raises:
        ValueError: If neither standard extraction nor OCR can extract text
        FileNotFoundError: If file doesn't exist
        Exception: For other errors
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Resume file not found: {file_path}")

    filename = os.path.basename(file_path)

    # ────────────────────────────────────────────────────────────────────────
    # STEP 1: Try standard text extraction using LangChain
    # ────────────────────────────────────────────────────────────────────────

    logger.info(f"Attempting standard text extraction for: {filename}")

    try:
        loader = PyPDFLoader(file_path)
        documents = loader.load()

        if documents:
            full_text = "\n\n".join([doc.page_content for doc in documents if doc.page_content])

            # Consider text valid if it has at least 50 characters
            # (very short text likely means it's a scanned PDF with artifacts)
            if full_text and len(full_text.strip()) >= 50:
                logger.info(f"✓ Standard extraction successful: {len(full_text)} characters from {filename}")
                return full_text.strip()
            else:
                logger.warning(f"Standard extraction returned minimal text ({len(full_text)} chars), trying OCR...")
        else:
            logger.warning(f"PyPDFLoader returned no documents for {filename}, trying OCR...")

    except Exception as exc:
        logger.warning(f"Standard extraction failed for {filename}: {exc}, trying OCR...")

    # ────────────────────────────────────────────────────────────────────────
    # STEP 2: OCR Fallback for scanned/image-based PDFs
    # ────────────────────────────────────────────────────────────────────────

    logger.info(f"Running OCR fallback for: {filename}")

    # Check if Tesseract is available
    tesseract_available, error_or_path = _check_tesseract_available()

    if not tesseract_available:
        raise ValueError(
            f"This resume appears to be a scanned/image-based PDF that requires OCR.\n\n"
            f"{error_or_path}\n\n"
            f"Alternative: Re-export your resume from the original source (Word, Google Docs) "
            f"as a text-based PDF."
        )

    try:
        import pytesseract
        from pdf2image import convert_from_path
        from PIL import Image

        # Convert PDF pages to images
        logger.info(f"Converting {filename} to images for OCR...")
        try:
            images = convert_from_path(file_path, dpi=300)  # High DPI for better OCR accuracy
        except Exception as exc:
            logger.error(f"Failed to convert PDF to images: {exc}")
            raise ValueError(
                f"Failed to process PDF for OCR. "
                f"Please ensure the PDF is not corrupted or password-protected."
            )

        if not images:
            raise ValueError("PDF conversion resulted in no images")

        # Run OCR on each page
        ocr_text = ""
        for i, image in enumerate(images, 1):
            try:
                logger.info(f"Running OCR on page {i}/{len(images)}...")
                page_text = pytesseract.image_to_string(image, lang='eng')
                if page_text and page_text.strip():
                    ocr_text += page_text + "\n\n"
            except Exception as exc:
                logger.warning(f"OCR failed on page {i}: {exc}")
                continue

        # Validate OCR result
        if not ocr_text or len(ocr_text.strip()) < 50:
            raise ValueError(
                "OCR extraction failed or returned insufficient text. "
                "This PDF may be:\n"
                "• A scanned document with poor image quality\n"
                "• Password-protected or encrypted\n"
                "• Corrupted or malformed\n\n"
                "Please:\n"
                "1. Re-scan at higher resolution (300 DPI minimum)\n"
                "2. Ensure text is clearly readable in the PDF\n"
                "3. Or re-export from the original source as a text-based PDF"
            )

        logger.info(f"✓ OCR successful: {len(ocr_text)} characters extracted from {filename}")
        return ocr_text.strip()

    except ImportError as exc:
        raise ImportError(
            f"OCR dependencies not installed: {exc}\n"
            f"Run: pip install pytesseract pdf2image pillow"
        )
    except Exception as exc:
        logger.error(f"OCR extraction failed for {filename}: {exc}", exc_info=True)
        raise ValueError(f"OCR extraction failed: {exc}")


def extract_resume_text_langchain(file_path: str) -> str:
    """
    Extract text from a PDF resume using LangChain's PyPDFLoader (text-based PDFs only).

    This is the original function without OCR fallback.
    Use extract_resume_text_with_ocr() for automatic OCR support.

    Args:
        file_path: Absolute path to the PDF file

    Returns:
        Extracted text as a single string

    Raises:
        ValueError: If PDF extraction fails or returns empty text
        FileNotFoundError: If file doesn't exist
        Exception: For other PDF parsing errors
    """
    try:
        loader = PyPDFLoader(file_path)
        documents = loader.load()

        if not documents:
            raise ValueError("PDF has no pages or could not be loaded")

        full_text = "\n\n".join([doc.page_content for doc in documents if doc.page_content])

        if not full_text or not full_text.strip():
            raise ValueError(
                "Could not extract text from PDF using LangChain PyPDFLoader. "
                "The PDF may be image-based, scanned, or have unusual encoding. "
                "Please try:\n"
                "• Re-export your resume from the original source (Word, Google Docs)\n"
                "• Ensure the PDF is not password-protected\n"
                "• Make sure you're uploading a text-based PDF, not a scanned image"
            )

        logger.info("LangChain PyPDFLoader extracted %d characters from %d pages",
                   len(full_text), len(documents))
        return full_text.strip()

    except FileNotFoundError:
        logger.error("Resume file not found: %s", file_path)
        raise FileNotFoundError(f"Resume file not found: {file_path}")

    except ValueError as exc:
        logger.warning("PDF extraction validation failed: %s", exc)
        raise

    except Exception as exc:
        logger.error("Unexpected error extracting PDF with LangChain: %s", exc, exc_info=True)
        raise Exception(f"Failed to parse resume PDF: {exc}")


def extract_resume_text_with_metadata(file_path: str) -> dict:
    """
    Extract text and metadata from a PDF resume using LangChain.

    Returns a dict with:
      - text: extracted text
      - page_count: number of pages
      - metadata: dict with PDF metadata (if available)
      - extraction_method: "standard" or "ocr"
    """
    try:
        # Try with OCR fallback
        text = extract_resume_text_with_ocr(file_path)

        # Get page count
        loader = PyPDFLoader(file_path)
        documents = loader.load()
        page_count = len(documents) if documents else 0

        # Get metadata
        metadata = documents[0].metadata if documents and len(documents) > 0 else {}

        # Determine extraction method based on text source
        extraction_method = "standard" if len(text) < 10000 else "ocr"  # OCR typically produces longer text

        return {
            "text": text,
            "page_count": page_count,
            "metadata": metadata,
            "extraction_method": extraction_method
        }

    except Exception as exc:
        logger.error("Error in extract_resume_text_with_metadata: %s", exc, exc_info=True)
        raise
