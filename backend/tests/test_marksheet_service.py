"""Unit tests for marksheet regex fallback extraction variants."""

from app.services.marksheet_service import _fallback_regex_extract


def test_fallback_extracts_name_enrollement_sgpa_cgpa_and_semester_roman():
    text = """
    Name of the Student: RIYA SHARMA
    Enrollement Number = 23CS-045/2023
    Branch: Computer Science and Engineering
    Semester IV
    SGPA (Semester GPA) = 8.71
    CGPA - 8.35
    """

    extracted = _fallback_regex_extract(text)

    assert extracted["full_name"] == "Riya Sharma"
    assert extracted["roll_number"] == "23CS-045/2023"
    assert extracted["branch"] == "CSE"
    assert extracted["semester"] == 4
    assert extracted["sgpa"] == 8.71
    assert extracted["cgpa"] == 8.35


def test_fallback_extracts_enrolment_semester_ordinal_and_ai_branch():
    text = """
    FULL NAME : AMAN VERMA
    Enrolment No = 123 456 789
    4th Semester
    Program: Artificial Intelligence and Machine Learning
    SGPA - 9.10
    CGPA = 8.88
    """

    extracted = _fallback_regex_extract(text)

    assert extracted["full_name"] == "Aman Verma"
    assert extracted["roll_number"] == "123456789"
    assert extracted["semester"] == 4
    assert extracted["branch"] == "AI"
    assert extracted["sgpa"] == 9.1
    assert extracted["cgpa"] == 8.88


def test_fallback_rejects_out_of_range_sgpa_and_cgpa():
    text = """
    Student Name: KIRAN DAS
    Roll No: 123456789
    Sem 2
    SGPA = 12.4
    CGPA - 11
    """

    extracted = _fallback_regex_extract(text)

    assert extracted["full_name"] == "Kiran Das"
    assert extracted["roll_number"] == "123456789"
    assert extracted["semester"] == 2
    assert extracted["sgpa"] is None
    assert extracted["cgpa"] is None


def test_fallback_supports_reg_no_alias_and_legacy_keys():
    text = """
    Reg No: AB-12/456
    Student Name: ANJALI RAO
    Sem 6
    SGPA: 8.2
    CGPA: 7.9
    """

    extracted = _fallback_regex_extract(text)

    # Legacy flat aliases used by frontend must stay present.
    assert extracted["roll_number"] == "AB-12/456"
    assert extracted["full_name"] == "Anjali Rao"
    assert extracted["semester"] == 6
    assert extracted["sgpa"] == 8.2
    assert extracted["cgpa"] == 7.9

    # Structured keys must also remain available.
    assert extracted["student_profile"]["roll_number"] == "AB-12/456"
    assert extracted["student_profile"]["current_semester"] == 6
