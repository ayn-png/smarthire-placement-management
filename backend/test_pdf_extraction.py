"""
Diagnostic script to test PDF extraction on existing resume files.
"""
import os
import sys

def test_extraction(file_path):
    print(f"\n{'='*70}")
    print(f"Testing PDF: {os.path.basename(file_path)}")
    print(f"File size: {os.path.getsize(file_path)} bytes")
    print(f"{'='*70}\n")

    # Test 1: PyMuPDF (fitz)
    print("1. Testing PyMuPDF (fitz)...")
    try:
        import fitz
        pages_text = []
        with fitz.open(file_path) as doc:
            print(f"   - Page count: {doc.page_count}")
            for page_num, page in enumerate(doc):
                text = page.get_text("text")
                print(f"   - Page {page_num+1}: {len(text) if text else 0} chars")
                if text and text.strip():
                    pages_text.append(text.strip())

        full_text = "\n\n".join(pages_text).strip()
        if full_text:
            print(f"   [SUCCESS] Extracted {len(full_text)} characters")
            print(f"   - First 200 chars: {full_text[:200]}...")
            return full_text
        else:
            print("   [FAILED] No text extracted")
    except Exception as e:
        print(f"   [ERROR] {e}")

    # Test 2: pdfplumber
    print("\n2. Testing pdfplumber...")
    try:
        import pdfplumber
        pages_text = []
        with pdfplumber.open(file_path) as pdf:
            print(f"   - Page count: {len(pdf.pages)}")
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                print(f"   - Page {i+1}: {len(text) if text else 0} chars")
                if text and text.strip():
                    pages_text.append(text.strip())

        full_text = "\n\n".join(pages_text).strip()
        if full_text:
            print(f"   [SUCCESS] Extracted {len(full_text)} characters")
            return full_text
        else:
            print("   [FAILED] No text extracted")
    except Exception as e:
        print(f"   [ERROR] {e}")

    print("\n[RESULT] ALL METHODS FAILED - PDF might be image-based")
    return None


if __name__ == "__main__":
    resume_dir = "uploads/resumes"

    if not os.path.exists(resume_dir):
        print(f"Error: Resume directory not found: {resume_dir}")
        sys.exit(1)

    pdf_files = [f for f in os.listdir(resume_dir) if f.endswith('.pdf')]

    if not pdf_files:
        print(f"Error: No PDF files found in {resume_dir}")
        sys.exit(1)

    test_file = os.path.join(resume_dir, pdf_files[0])
    result = test_extraction(test_file)

    if result:
        print(f"\n{'='*70}")
        print("EXTRACTION SUCCESSFUL - PDF libraries are working correctly!")
        print(f"{'='*70}")
        sys.exit(0)
    else:
        print(f"\n{'='*70}")
        print("EXTRACTION FAILED - The PDF appears to be image-based")
        print(f"{'='*70}")
        sys.exit(1)
