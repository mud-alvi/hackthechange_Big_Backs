# Standalone Skill Matcher

## Purpose

This module provides deterministic skill matching between two people.

It supports three independent matching modes:

1. **Skill exchange** — one person can teach skills the other wants to learn.
2. **Collaboration** — one person's existing skills can satisfy the other person's project or collaboration needs.
3. **Learning partner** — both people want to learn overlapping skills.

The module does not handle interests, purpose matching, user profiles, BLE, APIs, databases, or overall compatibility aggregation.

## Module

```
app.scoring.skills_matcher
```

## Public functions

### 1. `calculate_skill_exchange()`

**Inputs:**

- `skills_a_have: list[str]`
- `skills_a_want: list[str]`
- `skills_b_have: list[str]`
- `skills_b_want: list[str]`

**Returns:**

- `score`: average available directional coverage, from 0 to 100, or `None`.
- `a_teaches_b`: how much A can teach B.
- `b_teaches_a`: how much B can teach A.
- `match_type`: reciprocity classification.
- `available_directions`: number of directions with sufficient data.
- `matched_directions`: number of directions with at least one match.
- `is_mutual`: whether both directions have a positive match.

### 2. `calculate_collaboration_match()`

**Inputs:**

- `skills_a_have: list[str]`
- `skills_a_need: list[str]`
- `skills_b_have: list[str]`
- `skills_b_need: list[str]`

Returns the same overall metadata structure as skill exchange, with directional results named:

- `a_supports_b`
- `b_supports_a`

### 3. `calculate_learning_partner_match()`

**Inputs:**

- `skills_a_want: list[str]`
- `skills_b_want: list[str]`

**Returns:**

- `score`: average available directional overlap, from 0 to 100, or `None`.
- `shared_skills`: canonical skills both want to learn.
- `unique_to_a`: skills only A wants to learn.
- `unique_to_b`: skills only B wants to learn.
- `a_shared_coverage`: shared-skill coverage for A.
- `b_shared_coverage`: shared-skill coverage for B.
- Reciprocity metadata.

## Directional result structure

Each directional result contains:

- `score`: directional coverage from 0 to 100, or `None` if the direction cannot be evaluated.
- `matched`: sorted list of canonical skills that overlap.
- `unmatched`: sorted list of required skills that are not covered.

For example:

```json
{
  "score": 66.7,
  "matched": ["python", "react"],
  "unmatched": ["docker"]
}
```

## Scoring semantics

Directional coverage is:

```
matched required skills / total required skills × 100
```

For example, if B wants Python, React, and Docker, and A has Python and React, then A covers 66.7% of B's requirements (`a_teaches_b` in skill exchange, `a_supports_b` in collaboration):

- Matched: Python, React
- Unmatched: Docker
- Directional score: 66.7

The overall score is the arithmetic mean of the available directional scores.

A direction with no requested skills has a `None` score. It is excluded from the average rather than treated as zero.

If neither direction can be evaluated, the overall score is `None`.

## Match types

| Match type | Meaning |
|---|---|
| `mutual` | Both directions have positive coverage |
| `one_direction` | Exactly one available direction has positive coverage |
| `no_match` | Both directions are available, but neither has a positive match |
| `insufficient_data` | There is insufficient information to establish a match |

`is_mutual` is true only for `mutual`.

A high score does not necessarily mean a reciprocal match. Consumers should consider both `score` and `match_type`.

## Normalization and aliases

Matching is case-insensitive, trims whitespace, removes empty entries, and deduplicates skills.

Known aliases map to canonical names, including:

| Input variations | Canonical name |
|---|---|
| JS, JavaScript | `javascript` |
| TS, TypeScript | `typescript` |
| ML, Machine Learning | `machine learning` |
| AI, Artificial Intelligence | `artificial intelligence` |
| Postgres, PostgreSQL | `postgresql` |
| NodeJS, Node.js | `node.js` |
| ReactJS, React.js, React | `react` |
| C Sharp, C-Sharp, C# | `c#` |
| dotnet, .NET | `.net` |
| K8s, Kubernetes | `kubernetes` |
| AWS, Amazon Web Services | `amazon web services` |
| HTML5, HTML | `html` |
| CSS3, CSS | `css` |

Unknown skill names are preserved after trimming and case normalization. No fuzzy matching or AI inference is performed.

## Input validation

Each skill collection must be a Python list containing strings.

Invalid collection types and non-string entries raise `ValueError`.

Empty strings and whitespace-only strings are ignored.

## Integration guidance

The integration layer can call the public functions directly and consume their returned dictionaries.

The module expects normalized skill names as `list[str]`. If the upstream profile model stores skills as objects or dictionaries, the integration layer should extract the appropriate skill labels before calling these functions.

The integration layer remains responsible for combining this result with interest matching, purpose matching, consent, and other compatibility dimensions.

Do not interpret `score=None` as a zero score. It means the direction could not be evaluated from the supplied data.

## Testing

Run the complete backend test suite from the `backend/` directory:

```bash
pytest -v
```

The standalone matcher has dedicated tests for matching behavior, metadata, aliases, and invalid inputs.
