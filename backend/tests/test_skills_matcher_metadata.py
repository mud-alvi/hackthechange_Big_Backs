
from app.scoring.skills_matcher import (
    calculate_skill_exchange,
    calculate_collaboration_match,
    calculate_learning_partner_match,
)


def test_mutual_skill_exchange_metadata():
    result = calculate_skill_exchange(
        skills_a_have=["Python"],
        skills_a_want=["Docker"],
        skills_b_have=["Docker"],
        skills_b_want=["Python"],
    )
    assert result["match_type"] == "mutual"
    assert result["available_directions"] == 2
    assert result["matched_directions"] == 2
    assert result["is_mutual"] is True


def test_one_direction_skill_exchange_metadata():
    result = calculate_skill_exchange(
        skills_a_have=["Python"],
        skills_a_want=[],
        skills_b_have=[],
        skills_b_want=["Python"],
    )
    assert result["match_type"] == "one_direction"
    assert result["available_directions"] == 1
    assert result["matched_directions"] == 1
    assert result["is_mutual"] is False


def test_no_match_metadata():
    result = calculate_collaboration_match(
        skills_a_have=["Python"],
        skills_a_need=["Docker"],
        skills_b_have=["Java"],
        skills_b_need=["React"],
    )
    assert result["match_type"] == "no_match"
    assert result["available_directions"] == 2
    assert result["matched_directions"] == 0
    assert result["is_mutual"] is False


def test_insufficient_data_metadata():
    result = calculate_skill_exchange(
        skills_a_have=[],
        skills_a_want=[],
        skills_b_have=[],
        skills_b_want=[],
    )
    assert result["match_type"] == "insufficient_data"
    assert result["available_directions"] == 0
    assert result["matched_directions"] == 0
    assert result["is_mutual"] is False


def test_learning_partner_metadata():
    result = calculate_learning_partner_match(
        skills_a_want=["Python", "React"],
        skills_b_want=["Python", "Docker"],
    )
    assert result["match_type"] == "mutual"
    assert result["available_directions"] == 2
    assert result["matched_directions"] == 2
    assert result["is_mutual"] is True


def test_learning_partner_insufficient_data():
    result = calculate_learning_partner_match(
        skills_a_want=["Python"],
        skills_b_want=[],
    )
    assert result["match_type"] == "insufficient_data"
    assert result["available_directions"] == 1
    assert result["matched_directions"] == 0
    assert result["is_mutual"] is False


def test_javascript_aliases_match():
    result = calculate_skill_exchange(
        skills_a_have=["JavaScript"],
        skills_a_want=[],
        skills_b_have=[],
        skills_b_want=["JS"],
    )
    assert result["score"] == 100.0
    assert result["a_teaches_b"]["matched"] == ["javascript"]


def test_react_aliases_match():
    result = calculate_collaboration_match(
        skills_a_have=["React.js"],
        skills_a_need=[],
        skills_b_have=[],
        skills_b_need=["ReactJS"],
    )
    assert result["score"] == 100.0
    assert result["a_supports_b"]["matched"] == ["react"]


def test_postgresql_aliases_match():
    result = calculate_skill_exchange(
        skills_a_have=["Postgres"],
        skills_a_want=[],
        skills_b_have=[],
        skills_b_want=["PostgreSQL"],
    )
    assert result["score"] == 100.0
    assert result["a_teaches_b"]["matched"] == ["postgresql"]


def test_aliases_are_deduplicated():
    result = calculate_skill_exchange(
        skills_a_have=["JS", "JavaScript", "javascript"],
        skills_a_want=[],
        skills_b_have=[],
        skills_b_want=["JavaScript"],
    )
    assert result["score"] == 100.0
    assert result["a_teaches_b"]["matched"] == ["javascript"]


def test_learning_partner_aliases_share_canonical_skill():
    result = calculate_learning_partner_match(
        skills_a_want=["ML", "React.js"],
        skills_b_want=["Machine Learning", "React"],
    )
    assert result["shared_skills"] == ["machine learning", "react"]
    assert result["score"] == 100.0
