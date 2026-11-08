
def _normalize_skills(name: str, skills: list[str]) -> set[str]:
    """Validate and normalize a list of skills."""

    if not isinstance(skills, list):
        raise ValueError(f"{name} must be a list.")

    normalized = set()

    for index, skill in enumerate(skills):
        if not isinstance(skill, str):
            raise ValueError(
                f"{name}[{index}] must be a string."
            )

        cleaned = skill.strip().casefold()

        if cleaned:
            normalized.add(cleaned)

    return normalized


def _directional_coverage(
    skills_have: set[str],
    skills_needed: set[str],
) -> dict:
    """Calculate how much of one person's skill needs another can satisfy."""

    if not skills_needed:
        return {
            "score": None,
            "matched": [],
            "unmatched": [],
        }

    matched = sorted(skills_have & skills_needed)
    unmatched = sorted(skills_needed - skills_have)

    score = len(matched) / len(skills_needed) * 100

    return {
        "score": round(score, 1),
        "matched": matched,
        "unmatched": unmatched,
    }


def _average_available_scores(*results: dict) -> float | None:
    """Average available directional scores without penalizing missing data."""

    scores = [
        result["score"]
        for result in results
        if result["score"] is not None
    ]

    if not scores:
        return None

    return round(sum(scores) / len(scores), 1)


def calculate_skill_exchange(
    skills_a_have: list[str],
    skills_a_want: list[str],
    skills_b_have: list[str],
    skills_b_want: list[str],
) -> dict:
    """Calculate how effectively two people can teach each other."""

    a_have = _normalize_skills("skills_a_have", skills_a_have)
    a_want = _normalize_skills("skills_a_want", skills_a_want)

    b_have = _normalize_skills("skills_b_have", skills_b_have)
    b_want = _normalize_skills("skills_b_want", skills_b_want)

    a_to_b = _directional_coverage(a_have, b_want)
    b_to_a = _directional_coverage(b_have, a_want)

    return {
        "score": _average_available_scores(a_to_b, b_to_a),
        "a_teaches_b": a_to_b,
        "b_teaches_a": b_to_a,
    }


def calculate_collaboration_match(
    skills_a_have: list[str],
    skills_a_need: list[str],
    skills_b_have: list[str],
    skills_b_need: list[str],
) -> dict:
    """Calculate how well two people's skills complement each other."""

    a_have = _normalize_skills("skills_a_have", skills_a_have)
    a_need = _normalize_skills("skills_a_need", skills_a_need)

    b_have = _normalize_skills("skills_b_have", skills_b_have)
    b_need = _normalize_skills("skills_b_need", skills_b_need)

    a_to_b = _directional_coverage(a_have, b_need)
    b_to_a = _directional_coverage(b_have, a_need)

    return {
        "score": _average_available_scores(a_to_b, b_to_a),
        "a_supports_b": a_to_b,
        "b_supports_a": b_to_a,
    }


def calculate_learning_partner_match(
    skills_a_want: list[str],
    skills_b_want: list[str],
) -> dict:
    """Calculate how closely two people share learning goals."""

    a_want = _normalize_skills("skills_a_want", skills_a_want)
    b_want = _normalize_skills("skills_b_want", skills_b_want)

    a_to_b = _directional_coverage(b_want, a_want)
    b_to_a = _directional_coverage(a_want, b_want)

    return {
        "score": _average_available_scores(a_to_b, b_to_a),
        "shared_skills": sorted(a_want & b_want),
        "unique_to_a": sorted(a_want - b_want),
        "unique_to_b": sorted(b_want - a_want),
    }
