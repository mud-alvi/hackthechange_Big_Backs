
"""Standalone skill matching for skill exchange, collaboration, and learning."""

# Map common abbreviations and variations to canonical skill names.
# Keep this deterministic and conservative to avoid false matches.
_SKILL_ALIASES = {
    "js": "javascript",
    "javascript": "javascript",
    "ts": "typescript",
    "typescript": "typescript",
    "ml": "machine learning",
    "machine learning": "machine learning",
    "ai": "artificial intelligence",
    "artificial intelligence": "artificial intelligence",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "nodejs": "node.js",
    "node.js": "node.js",
    "reactjs": "react",
    "react.js": "react",
    "react": "react",
    "c sharp": "c#",
    "c-sharp": "c#",
    "c#": "c#",
    "dotnet": ".net",
    ".net": ".net",
    "k8s": "kubernetes",
    "kubernetes": "kubernetes",
    "aws": "amazon web services",
    "amazon web services": "amazon web services",
    "html5": "html",
    "html": "html",
    "css3": "css",
    "css": "css",
}


def _canonicalize_skill(skill: str) -> str:
    """Return a canonical name for a skill."""
    cleaned = skill.strip().casefold()
    return _SKILL_ALIASES.get(cleaned, cleaned)


def _normalize_skills(name: str, skills: list[str]) -> set[str]:
    """Validate, canonicalize, and deduplicate a list of skills."""
    if not isinstance(skills, list):
        raise ValueError(f"{name} must be a list.")

    normalized = set()

    for index, skill in enumerate(skills):
        if not isinstance(skill, str):
            raise ValueError(f"{name}[{index}] must be a string.")

        canonical = _canonicalize_skill(skill)

        if canonical:
            normalized.add(canonical)

    return normalized


def _directional_coverage(
    skills_have: set[str],
    skills_needed: set[str],
) -> dict:
    """Calculate how much of one person's skill needs another can satisfy."""
    if not skills_needed:
        return {"score": None, "matched": [], "unmatched": []}

    matched = sorted(skills_have & skills_needed)
    unmatched = sorted(skills_needed - skills_have)

    score = len(matched) / len(skills_needed) * 100

    return {
        "score": round(score, 1),
        "matched": matched,
        "unmatched": unmatched,
    }


def _average_available_scores(*results: dict) -> float | None:
    """Average only the directional scores that can be calculated."""
    scores = [
        result["score"]
        for result in results
        if result["score"] is not None
    ]

    if not scores:
        return None

    return round(sum(scores) / len(scores), 1)


def _match_metadata(*results: dict) -> dict:
    """Describe match reciprocity separately from the compatibility score."""
    available_scores = [
        result["score"]
        for result in results
        if result["score"] is not None
    ]

    matched_directions = sum(score > 0 for score in available_scores)
    available_directions = len(available_scores)

    if matched_directions == 2:
        match_type = "mutual"
    elif matched_directions == 1:
        match_type = "one_direction"
    elif available_directions == 2:
        match_type = "no_match"
    else:
        match_type = "insufficient_data"

    return {
        "match_type": match_type,
        "available_directions": available_directions,
        "matched_directions": matched_directions,
        "is_mutual": match_type == "mutual",
    }


def calculate_skill_exchange(
    skills_a_have: list[str],
    skills_a_want: list[str],
    skills_b_have: list[str],
    skills_b_want: list[str],
) -> dict:
    """Match people who can teach skills the other person wants to learn."""
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
        **_match_metadata(a_to_b, b_to_a),
    }


def calculate_collaboration_match(
    skills_a_have: list[str],
    skills_a_need: list[str],
    skills_b_have: list[str],
    skills_b_need: list[str],
) -> dict:
    """Match people whose existing skills can support each other's needs."""
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
        **_match_metadata(a_to_b, b_to_a),
    }


def calculate_learning_partner_match(
    skills_a_want: list[str],
    skills_b_want: list[str],
) -> dict:
    """Match people based on overlap in the skills they want to learn."""
    a_want = _normalize_skills("skills_a_want", skills_a_want)
    b_want = _normalize_skills("skills_b_want", skills_b_want)

    a_shared = _directional_coverage(b_want, a_want)
    b_shared = _directional_coverage(a_want, b_want)

    return {
        "score": _average_available_scores(a_shared, b_shared),
        "shared_skills": sorted(a_want & b_want),
        "unique_to_a": sorted(a_want - b_want),
        "unique_to_b": sorted(b_want - a_want),
        "a_shared_coverage": a_shared,
        "b_shared_coverage": b_shared,
        **_match_metadata(a_shared, b_shared),
    }
