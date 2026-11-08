from dataclasses import dataclass

from app.scoring.models import UserProfile


INTEREST_WEIGHT = 0.30
PURPOSE_WEIGHT = 0.40
COMPLEMENTARITY_WEIGHT = 0.30


@dataclass
class ScoreBreakdown:
    interests: float
    purpose: float
    complementarity: float
    total: float


def normalize(value: str) -> str:
    return value.strip().casefold()


def jaccard_similarity(items_a: list[str], items_b: list[str]) -> float:
    set_a = {normalize(item) for item in items_a if normalize(item)}
    set_b = {normalize(item) for item in items_b if normalize(item)}

    if not set_a and not set_b:
        return 0.0

    return len(set_a & set_b) / len(set_a | set_b)


def purpose_words(purpose: str) -> set[str]:
    stop_words = {
        "a", "an", "the", "and", "or", "to", "for", "of",
        "in", "on", "with", "my", "i", "want", "looking",
        "meet", "people", "someone",
    }

    words = set(normalize(purpose).split())
    return words - stop_words


def purpose_similarity(purpose_a: str, purpose_b: str) -> float:
    words_a = purpose_words(purpose_a)
    words_b = purpose_words(purpose_b)

    if not words_a or not words_b:
        return 0.0

    return len(words_a & words_b) / len(words_a | words_b)


def directional_complementarity(
    skills_have: list[str],
    skills_needed: list[str],
) -> float | None:
    have = {normalize(skill) for skill in skills_have if normalize(skill)}
    needed = {normalize(skill) for skill in skills_needed if normalize(skill)}

    if not needed:
        return None

    return len(have & needed) / len(needed)


def skill_complementarity(
    person_a: UserProfile,
    person_b: UserProfile,
) -> float | None:
    a_helps_b = directional_complementarity(
        person_a.skills_have, person_b.skills_need
    )
    b_helps_a = directional_complementarity(
        person_b.skills_have, person_a.skills_need
    )

    available_scores = [
        score
        for score in (a_helps_b, b_helps_a)
        if score is not None
    ]

    if not available_scores:
        return None

    return sum(available_scores) / len(available_scores)


def calculate_compatibility(
    person_a: UserProfile,
    person_b: UserProfile,
) -> ScoreBreakdown:
    if person_a.user_id == person_b.user_id:
        raise ValueError("A person cannot be matched with themselves.")

    # Only compare dimensions where both profiles provide usable information.
    dimensions = {}

    interests_a = [item for item in person_a.interests if normalize(item)]
    interests_b = [item for item in person_b.interests if normalize(item)]

    if interests_a and interests_b:
        dimensions["interests"] = (
            jaccard_similarity(interests_a, interests_b),
            INTEREST_WEIGHT,
        )

    purpose_a = purpose_words(person_a.purpose)
    purpose_b = purpose_words(person_b.purpose)

    if purpose_a and purpose_b:
        dimensions["purpose"] = (
            purpose_similarity(person_a.purpose, person_b.purpose),
            PURPOSE_WEIGHT,
        )

    complementarity = skill_complementarity(person_a, person_b)

    if complementarity is not None:
        dimensions["complementarity"] = (
            complementarity,
            COMPLEMENTARITY_WEIGHT,
        )

    if not dimensions:
        return ScoreBreakdown(
            interests=0.0,
            purpose=0.0,
            complementarity=0.0,
            total=0.0,
        )

    # Reweight available dimensions so their weights add up to 100%.
    available_weight = sum(weight for _, weight in dimensions.values())

    total = sum(
        score * weight
        for score, weight in dimensions.values()
    ) / available_weight

    return ScoreBreakdown(
        interests=round(dimensions.get("interests", (0.0, 0.0))[0], 4),
        purpose=round(dimensions.get("purpose", (0.0, 0.0))[0], 4),
        complementarity=round(
            dimensions.get("complementarity", (0.0, 0.0))[0], 4
        ),
        total=round(total * 100, 2),
    )