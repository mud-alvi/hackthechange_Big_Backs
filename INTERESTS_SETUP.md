# Interest and skill integration

The active implementation is in `HackVillage/src/features/`. See [SETUP.md](SETUP.md) for deployment and operation. The old `python/` design is preserved for reference and is not part of the runtime path.

## Matching

Interest tags contain `label`, `standard_id`, `category`, and `subcategory`. Duplicate IDs count once, with a technical maximum of 100 interests. A one-to-one maximum-weight pairing assigns 100 points for the same ID, 25 for a shared narrow group inside the same broad category, and 5 for a shared broad category. The final percentage is `2 * total_points / (count_A + count_B)`, rounded to one decimal. Missing lists yield `null`.

Skills use the existing standalone Python matcher's three modes, ported to TypeScript: exchange, collaboration, and learning partner. Its aliases, directional coverage, missing-data handling, and reciprocity metadata are retained. Interest and skill percentages are never averaged together. The older weighted overall compatibility engine is not used in this flow.

Without AI, the editor explicitly uses exact cleaned text; it does not infer synonyms or categories. The optional authenticated `normalize-interests` function groups labels using AI, then the user reviews and saves the tags.

## Discovery and consent

A public user code is exactly six ASCII digits, e.g. `001234`. Always keep it as a string. Auth UUIDs remain internal database identifiers.

The microcontroller sends a newline-delimited `found` event with `v:1`, a stable `event_id`, `user_code`, and `source` (`bluetooth` or `infrared`). The phone uses `createDiscoveryHandler()` and returns one `scores` command containing `percentages:[interest_score,skill_score]`. The firmware draws `I` and `S` on separate 16-pixel rows; `null` is a dash.

Bluetooth discoveries are ignored when self-search is off. Manual IR encounters can suggest a request below the threshold. Automatic prompts require either selected score to meet the minimum and have a 60-second cooldown. Transport retries retain their calculated result and are acknowledged only after required server actions succeed. Completed event IDs are deduplicated.

`should_notify` is a suggestion to create a shared request, never an acceptance. `networking` and the database require separate authenticated approvals. Messages remain unavailable until both approvals exist. Skill reciprocity (`is_mutual`) describes matching directions and does not establish consent.

Sharing interests/skills and self-search are separate settings. Signed-in lookups return only opted-in matching fields and public profile details. Knowing a code does not prove proximity or authorize chat.
