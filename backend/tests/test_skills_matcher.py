
import pytest

from app.scoring.skills_matcher import (
    calculate_collaboration_match,
    calculate_learning_partner_match,
    calculate_skill_exchange,
)


# --------------------------------------------------
# Skill exchange tests
# --------------------------------------------------

def test_mutual_skill_exchange():
    result = calculate_skill_exchange(
        skills_a_have=["Python", "React"],
        skills_a_want=["Docker"],
        skills_b_have=["Docker"],
        skills_b_want=["Python"],
    )

    assert result["score"] == 100.0
    assert result["a_teaches_b"]["matched"] == ["python"]
    assert result["b_teaches_a"]["matched"] == ["docker"]


def test_one_way_skill_exchange():
    result = calculate_skill_exchange(
        skills_a_have=["Python"],
        skills_a_want=[],
        skills_b_have=[],
        skills_b_want=["Python"],
    )

    assert result["score"] == 100.0
    assert result["a_teaches_b"]["score"] == 100.0
    assert result["b_teaches_a"]["score"] is None


def test_no_skill_exchange_match():
    result = calculate_skill_exchange(
        skills_a_have=["Python"],
        skills_a_want=["Docker"],
        skills_b_have=["Java"],
        skills_b_want=["React"],
    )

    assert result["score"] == 0.0


def test_missing_skill_exchange_data():
    result = calculate_skill_exchange([], [], [], [])

    assert result["score"] is None
    assert result["a_teaches_b"]["score"] is None
    assert result["b_teaches_a"]["score"] is None


# --------------------------------------------------
# Collaboration matching tests
# --------------------------------------------------

def test_mutual_collaboration_match():
    result = calculate_collaboration_match(
        skills_a_have=["Python", "SQL"],
        skills_a_need=["Docker"],
        skills_b_have=["Docker"],
        skills_b_need=["Python"],
    )

    assert result["score"] == 100.0
    assert result["a_supports_b"]["matched"] == ["python"]
    assert result["b_supports_a"]["matched"] == ["docker"]


def test_one_way_collaboration_match():
    result = calculate_collaboration_match(
        skills_a_have=["Python"],
        skills_a_need=[],
        skills_b_have=[],
        skills_b_need=["Python"],
    )

    assert result["score"] == 100.0
    assert result["a_supports_b"]["score"] == 100.0
    assert result["b_supports_a"]["score"] is None


def test_unmatched_collaboration_skills():
    result = calculate_collaboration_match(
        skills_a_have=["Python"],
        skills_a_need=["Docker"],
        skills_b_have=["Java"],
        skills_b_need=["React"],
    )

    assert result["score"] == 0.0
    assert result["a_supports_b"]["unmatched"] == ["react"]
    assert result["b_supports_a"]["unmatched"] == ["docker"]


# --------------------------------------------------
# Learning partner tests
# --------------------------------------------------

def test_learning_partner_shared_skills():
    result = calculate_learning_partner_match(
        skills_a_want=["Python", "React"],
        skills_b_want=["Python", "React"],
    )

    assert result["score"] == 100.0
    assert result["shared_skills"] == ["python", "react"]
    assert result["unique_to_a"] == []
    assert result["unique_to_b"] == []


def test_learning_partner_partial_overlap():
    result = calculate_learning_partner_match(
        skills_a_want=["Python", "React"],
        skills_b_want=["Python", "Docker"],
    )

    assert result["score"] == 50.0
    assert result["shared_skills"] == ["python"]
    assert result["unique_to_a"] == ["react"]
    assert result["unique_to_b"] == ["docker"]


def test_learning_partner_no_overlap():
    result = calculate_learning_partner_match(
        skills_a_want=["Python"],
        skills_b_want=["Java"],
    )

    assert result["score"] == 0.0
    assert result["shared_skills"] == []


def test_learning_partner_missing_data():
    result = calculate_learning_partner_match([], [])

    assert result["score"] is None
    assert result["shared_skills"] == []


# --------------------------------------------------
# Input validation and normalization tests
# --------------------------------------------------

def test_skill_normalization_and_duplicate_removal():
    result = calculate_skill_exchange(
        skills_a_have=[" Python ", "PYTHON", "React"],
        skills_a_want=[],
        skills_b_have=[],
        skills_b_want=["python"],
    )

    assert result["score"] == 100.0
    assert result["a_teaches_b"]["matched"] == ["python"]


def test_empty_strings_are_ignored():
    result = calculate_skill_exchange(
        skills_a_have=["", "   "],
        skills_a_want=[],
        skills_b_have=[],
        skills_b_want=["Python"],
    )

    assert result["score"] == 0.0
    assert result["a_teaches_b"]["unmatched"] == ["python"]


def test_non_list_input_raises_value_error():
    with pytest.raises(ValueError):
        calculate_skill_exchange(
            skills_a_have="Python",
            skills_a_want=[],
            skills_b_have=[],
            skills_b_want=[],
        )


def test_non_string_skill_raises_value_error():
    with pytest.raises(ValueError):
        calculate_skill_exchange(
            skills_a_have=["Python", 123],
            skills_a_want=[],
            skills_b_have=[],
            skills_b_want=[],
        )
