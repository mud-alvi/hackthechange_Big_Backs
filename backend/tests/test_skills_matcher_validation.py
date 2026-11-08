
import pytest

from app.scoring.skills_matcher import calculate_skill_exchange


@pytest.mark.parametrize(
    "argument_name",
    [
        "skills_a_have",
        "skills_a_want",
        "skills_b_have",
        "skills_b_want",
    ],
)
@pytest.mark.parametrize(
    "invalid_value",
    [
        None,
        (),
        "Python",
        42,
    ],
)
def test_invalid_skill_collection_raises_value_error(
    argument_name,
    invalid_value,
):
    arguments = {
        "skills_a_have": ["Python"],
        "skills_a_want": ["Docker"],
        "skills_b_have": ["Java"],
        "skills_b_want": ["React"],
    }

    arguments[argument_name] = invalid_value

    with pytest.raises(ValueError):
        calculate_skill_exchange(**arguments)


@pytest.mark.parametrize(
    "invalid_skill",
    [
        None,
        42,
        ["Python"],
    ],
)
def test_invalid_skill_item_raises_value_error(invalid_skill):
    with pytest.raises(ValueError):
        calculate_skill_exchange(
            skills_a_have=[invalid_skill],
            skills_a_want=[],
            skills_b_have=[],
            skills_b_want=[],
        )


def test_whitespace_only_skills_are_ignored():
    result = calculate_skill_exchange(
        skills_a_have=["   ", "\t"],
        skills_a_want=[],
        skills_b_have=[],
        skills_b_want=["   "],
    )

    assert result["score"] is None
    assert result["match_type"] == "insufficient_data"
