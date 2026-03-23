"""
Test OCR Setup for AI Resume Analyzer

This script verifies that OCR dependencies are correctly installed.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

print("=" * 70)
print("AI RESUME ANALYZER - OCR SETUP TEST")
print("=" * 70)
print()

# Test 1: Check Python dependencies
print("1. Checking Python Dependencies...")
dependencies = {
    "pytesseract": False,
    "pdf2image": False,
    "PIL (Pillow)": False,
}

try:
    import pytesseract
    dependencies["pytesseract"] = True
    print("   ✓ pytesseract installed")
except ImportError:
    print("   ✗ pytesseract NOT installed")
    print("     Run: pip install pytesseract")

try:
    import pdf2image
    dependencies["pdf2image"] = True
    print("   ✓ pdf2image installed")
except ImportError:
    print("   ✗ pdf2image NOT installed")
    print("     Run: pip install pdf2image")

try:
    from PIL import Image
    dependencies["PIL (Pillow)"] = True
    print("   ✓ PIL (Pillow) installed")
except ImportError:
    print("   ✗ PIL (Pillow) NOT installed")
    print("     Run: pip install pillow")

print()

# Test 2: Check Tesseract installation
print("2. Checking Tesseract OCR...")
tesseract_available = False

if dependencies["pytesseract"]:
    try:
        import pytesseract

        # Try to get Tesseract version
        try:
            version = pytesseract.get_tesseract_version()
            print(f"   ✓ Tesseract found: v{version}")
            tesseract_available = True
        except Exception:
            # Check common Windows paths
            possible_paths = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                r"C:\Tesseract-OCR\tesseract.exe",
            ]

            found_path = None
            for path in possible_paths:
                if os.path.exists(path):
                    pytesseract.pytesseract.tesseract_cmd = path
                    try:
                        version = pytesseract.get_tesseract_version()
                        print(f"   ✓ Tesseract found at: {path}")
                        print(f"     Version: {version}")
                        tesseract_available = True
                        found_path = path
                        break
                    except Exception:
                        continue

            if not found_path:
                print("   ✗ Tesseract NOT found")
                print()
                print("   Installation Instructions:")
                print("   1. Download: https://github.com/UB-Mannheim/tesseract/wiki")
                print("   2. Install to: C:\\Program Files\\Tesseract-OCR")
                print("   3. Restart this test")

    except Exception as e:
        print(f"   ✗ Error checking Tesseract: {e}")
else:
    print("   ⚠ Cannot check Tesseract (pytesseract not installed)")

print()

# Test 3: Check Poppler (for pdf2image)
print("3. Checking Poppler (for PDF to image conversion)...")
if dependencies["pdf2image"]:
    try:
        from pdf2image import convert_from_path

        # Try to check if poppler is available
        # This is just a check, not converting an actual file
        print("   ℹ pdf2image is installed")
        print("   ℹ Poppler check requires an actual PDF to test")
        print()
        print("   If pdf2image fails, install Poppler:")
        print("   - Windows: http://blog.alivate.com.au/poppler-windows/")
        print("   - macOS: brew install poppler")
        print("   - Linux: sudo apt install poppler-utils")
    except Exception as e:
        print(f"   ⚠ pdf2image check: {e}")
else:
    print("   ⚠ Cannot check (pdf2image not installed)")

print()

# Test 4: Check resume_extractor module
print("4. Checking resume_extractor module...")
try:
    from app.services.resume_extractor import extract_resume_text_with_ocr
    print("   ✓ resume_extractor module loaded successfully")
    print("   ✓ extract_resume_text_with_ocr function available")
except ImportError as e:
    print(f"   ✗ Failed to import resume_extractor: {e}")
except Exception as e:
    print(f"   ✗ Error loading module: {e}")

print()

# Summary
print("=" * 70)
print("SUMMARY")
print("=" * 70)

all_deps_installed = all(dependencies.values())
ocr_ready = all_deps_installed and tesseract_available

if ocr_ready:
    print("✓ OCR is READY!")
    print("  Your AI Resume Analyzer can now handle scanned/image-based PDFs.")
    print()
    print("Next steps:")
    print("  1. Upload a scanned PDF to test OCR")
    print("  2. Check server logs for extraction method used")
    print("  3. Monitor extraction times (OCR takes 5-10 seconds)")
else:
    print("⚠ OCR Setup Incomplete")
    print()
    if not all_deps_installed:
        print("Missing Python dependencies:")
        for dep, installed in dependencies.items():
            if not installed:
                print(f"  - {dep}")
        print()
        print("Install: pip install pytesseract pdf2image pillow")

    if all_deps_installed and not tesseract_available:
        print("Tesseract OCR not installed:")
        print("  1. Download: https://github.com/UB-Mannheim/tesseract/wiki")
        print("  2. Install to: C:\\Program Files\\Tesseract-OCR")
        print("  3. Restart the server")

    print()
    print("Note: Text-based PDFs will still work without OCR!")
    print("      OCR is only needed for scanned/image-based PDFs.")

print()
print("=" * 70)
print("For detailed instructions, see: OCR_SETUP_INSTRUCTIONS.md")
print("=" * 70)
