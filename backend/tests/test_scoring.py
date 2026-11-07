
import pytest

from app.scoring.models import UserProfile
from app.scoring.engine import (
    calculate_compatibility,
    jaccard_similarity,
    skill_complementarity,
)


def test_identical_interests():
    assert jaccard_similarity(
        ["Python", "AI"],
        ["Python", "AI"]
    ) == 1.0


def test_no_shared_interests():
    assert jaccard_similarity(
        ["Python"],
        ["Design"]
    ) == 0.0


def test_case_insensitive_interests():
    assert jaccard_similarity(
        ["Python", "AI"],
        ["python", "ai"]
    ) == 1.0


def test_complementary_skills():
    alex = UserProfile(
        user_id="alex",
        skills_have=["Python", "FastAPI"],
        skills_need=["React"]
    )

    sam = UserProfile(
        user_id="sam",
        skills_have=["React"],
        skills_need=["FastAPI"]
    )

    assert skill_complementarity(alex, sam) == 1.0


def test_no_complementary_skills():
    alex = UserProfile(
        user_id="alex",
        skills_have=["Python"],
        skills_need=["Design"]
    )

    sam = UserProfile(
        user_id="sam",
        skills_have=["Java"],
        skills_need=["React"]
    )

    assert skill_complementarity(alex, sam) == 0.0


def test_same_user_cannot_match():
    alex = UserProfile(user_id="alex")

    with pytest.raises(ValueError):
        calculate_compatibility(alex, alex)


def test_score_is_bounded():
    alex = UserProfile(
        user_id="alex",
        interests=["AI", "Python"],
        purpose="Build an AI project",
        skills_have=["Python"],
        skills_need=["React"]
    )

    sam = UserProfile(
        user_id="sam",
        interests=["AI", "Python"],
        purpose="Build an AI project",
        skills_have=["React"],
        skills_need=["Python"]
    )

    result = calculate_compatibility(alex, sam)

    assert 0 <= result.total <= 100


def test_empty_profiles_do_not_crash():
    alex = UserProfile(user_id="alex")
    sam = UserProfile(user_id="sam")

    result = calculate_compatibility(alex, sam)

    assert result.total == 0.0
def test_missing_skills_do_not_penalize_match():
    alex = UserProfile(
        user_id="alex",
        interests=["AI", "Python"],
        purpose="Build an AI project",
    )
    sam = UserProfile(
        user_id="sam",
        interests=["AI", "Python"],
        purpose="Build an AI project",
    )

    result = calculate_compatibility(alex, sam)

    assert result.interests == 1.0
    assert result.purpose == 1.0
    assert result.complementarity == 0.0
    assert result.total == 100.0


def test_missing_purpose_is_excluded():
    alex = UserProfile(
        user_id="alex",
        interests=["AI", "Python"],
        purpose="",
    )
    sam = UserProfile(
        user_id="sam",
        interests=["AI", "Python"],
        purpose="Build an AI startup",
    )

    result = calculate_compatibility(alex, sam)

    assert result.total == 100.0


def test_one_directional_skill_match_is_used():
    alex = UserProfile(
        user_id="alex",
        skills_have=["Python"],
        skills_need=["React"],
    )
    sam = UserProfile(
        user_id="sam",
        skills_have=["React"],
        skills_need=[],
    )

    result = calculate_compatibility(alex, sam)

    assert result.complementarity == 1.0
    assert result.total == 100.0


def test_compatibility_is_symmetric():
    alex = UserProfile(
        user_id="alex",
        interests=["AI", "Python"],
        purpose="Build an AI project",
        skills_have=["Python"],
        skills_need=["React"],
    )
    sam = UserProfile(
        user_id="sam",
        interests=["AI", "Design"],
        purpose="Build an AI product",
        skills_have=["React"],
        skills_need=["Python"],
    )

    forward = calculate_compatibility(alex, sam)
    reverse = calculate_compatibility(sam, alex)

    assert forward.total == reverse.total