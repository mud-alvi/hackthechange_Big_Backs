# Interest matching: the new phone-based version

Your current work is in `HackVillage/src/features/interests/`. It is TypeScript
for the Expo phone app. The older `python/` files belong to the earlier design
where the board calculated the score. They have been preserved, but should not
be called by the new app. In particular their five-interest limit and defaults
do not apply to the new code.

The frontend is on `front_end`. These new files use the same `HackVillage/`
folder name so the team can merge both branches. This branch contains the
interest feature, not a second copy of the frontend or its screens.

## What works now

- Local interest matching in TypeScript, including one-to-one pairings.
- 20-25 interests and larger profiles; the technical guard is 100 entries.
- No forced defaults. Selected and self-written interests use the same format.
- Duplicate standard IDs count once. A missing profile/list produces no score,
  represented by `null`, instead of a misleading 0%.
- Bluetooth discovery is ignored while self-search is off. Infrared still works.
- Interests, skills, or both. Skills are supplied by your friend's function.
- Separate interest and skill percentages; they are never averaged.
- Automatic notification decision when either selected score is >= the minimum.
- Manual discovery always suggests a request, even below the minimum.
- Repeated automatic notifications for the same code/mode are suppressed for 60s.
- Supabase profile save/lookup adapter and an authenticated AI server function.

The scores are interest-overlap estimates, not probabilities of compatibility.
The pairing method uses the same weights: same standard_id = 100 points,
same narrow group inside the same category = 25, same broad category = 5.
The percentage is `2 * total_points / (number_of_A_interests + number_of_B_interests)`.
The final number is rounded to one decimal. Both phones use this same code.

## Connect the frontend

The frontend developer can reuse their existing `lib/supabase.ts` instance:

```typescript
import {createSupabaseStore, createDiscoveryHandler} from './src/features/interests/index';
import {supabase} from './lib/supabase';

const store = createSupabaseStore({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    getSession: async () => {
        const {data, error} = await supabase.auth.getSession();
        if (error) throw error;
        return data.session;
    }
});

//Do this when the person saves/edits their profile, not on each encounter.
const tags = await store.normalize(['Gaming', 'snow surfing', 'pottery']);
//Show tags for review. When the user confirms sharing them for matching:
await store.saveMyInterests(tags, true);

//Pass your friend's TypeScript skills function as the second argument later.
//It accepts the other public code and returns a score from 0-100, or null.
const discovery = createDiscoveryHandler(store);
const result = await discovery.handle(
    {user_code: 'ABC1234', source: 'infrared'},
    {self_search: false, mode: 'interests', minimum_score: 60}
);
```

Adjust import paths for the screen where this is called. Create the store and
discovery object once for the signed-in app session, not on every render.
Call `discovery.reset()` on logout/account switch, profile edits, mode changes,
minimum changes, and self-search toggles. This discards old pending results and
resets notification cooldowns. Discard an old instance on logout.

`saveMyInterests([], false)` clears and hides interest tags. The sharing flag
is not the self-search toggle: turning off automatic scanning should not make
manual encounters impossible. Pass only the interest fields here; skills have
their own storage and logic.

`exactTextInterests(labels)` is an explicit offline alternative to AI. It only
matches the same cleaned text. It gives no category or synonym understanding.
Do not mix these fallback IDs with AI IDs and expect semantic matches. Once
online, normalize and save the profile again. There is no silent AI fallback.

## Messages for the hardware and notification teammate

The controller sends the phone an event like:

```json
{"user_code":"ABC1234","source":"infrared"}
```

The app passes it to `discovery.handle()`. The result includes:

```json
{"user_code":"ABC1234","source":"infrared","mode":"both","interest_score":72,"skill_score":85,"should_notify":true,"requires_mutual_acceptance":true,"warnings":[]}
```

This is an example result, not a hardcoded response. Send the labelled scores
to the controller display. `null` means unavailable: display a dash, not 0%.
In interests-only mode skill_score stays null; skills-only leaves interest_score
null. In both mode, one missing/failed score does not erase the other score.

`should_notify` tells the phone notification code whether to show a request.
It does not send a notification or accept a request. The frontend/chat backend
must record both authenticated users' approvals and enforce access to chat.
An incoming permanent code is discovery data, not proof of identity or consent.

The hardware teammate must keep the phone-controller data link while disabling
automatic discovery. They handle scanning, broadcasting, IR, buttons, framing,
reconnects, screen updates and phone background notifications. For IR, send one
event per button press; repeated packets from one press must be deduplicated
by the transport. Manual events intentionally bypass the automatic cooldown.

The skills code currently published in `feature/compatibility-scoring` is
Python. Your friend needs to provide a TypeScript function for on-phone use.
Until then, skills returns null plus a clear warning. No substitute algorithm
is silently used. The friend owns which skills sub-mode is selected.

## Supabase assumptions: confirm before connecting real data

The frontend already reads `profiles.id` and `profiles.user_code`. We reuse that
identity; no new public code is generated by this feature. Codes are currently
validated as 3 letters and 4 numbers. Change `readUserCode()` and the draft SQL
if the team's actual format differs. Supabase must enforce public-code uniqueness
and permanent assignment, and the profiles table must link IDs to Auth users.

All database names are in `supabase_store.ts` under `DATABASE`. The proposed
new table is `user_interests(owner_id, interests, share_for_matching)`.
The proposed `lookup_interest_profile(code)` function returns only a public
code and shared interest tags. This allows signed-in code lookup, not proof of
proximity. Private interest lists come back empty; unknown user codes come back
null. Neither case is presented as a calculated zero score.

`supabase/drafts/interest_tables.sql` is intentionally OUTSIDE migrations.
It has not been applied. Wait for your friend's schema/access rules, compare
them, and adjust this draft and the adapter together before applying anything.
Do not replace their profiles or skill tables. Review the policies and public
code constraints with them. SQL should be applied once after review.

## AI function setup

`supabase/functions/normalize-interests/index.ts` is the server entry point.
The handler verifies the session using Supabase Auth and then calls OpenAI's
Responses API with Structured Outputs. It requests matching tags for all
user-entered labels, without a fixed catalogue. Tags are returned for review;
the app explicitly saves them afterward.

Set server secrets `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default:
`gpt-4o-mini`). The runtime also needs `SUPABASE_URL` and `SUPABASE_ANON_KEY`
or `SUPABASE_PUBLISHABLE_KEY`. Do not put the OpenAI key or a Supabase service
role/secret key in the app. The app uses the existing public configuration and
signed-in session. Provider/model access and live API calls are not verified.

Keep the function's user JWT verification enabled. After reviewing the schema,
the project owner can deploy `normalize-interests` with Supabase tooling or the
dashboard. This task did not link a Supabase project, deploy a function or change
the live database. Add request quotas/rate limits before wider use; authentication
alone does not limit API spending. An authenticated request can normalize up to
100 entries; AI results for entirely new interests can still be inconsistent.

Custom text is sent to OpenAI. `store: false` is set; this is not a promise of
zero provider retention. The app should make this processing clear to its users.
Matching encounters themselves make no AI calls.

References:
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://supabase.com/docs/reference/javascript/upsert
- https://supabase.com/docs/guides/functions/auth

## Files to focus on

- `HackVillage/src/features/interests/`: matching, lookup and discovery logic.
- `supabase/functions/normalize-interests/`: the AI server function.
- `supabase/drafts/interest_tables.sql`: proposed database setup; review first.
- This guide: setup and the interface for teammates.

Separate tests, demos and checking tools have been removed. The new files
passed type checking, lint and ten automated checks before this cleanup.
The old `python/` folder is preserved as earlier work and is not used by the
new phone app. It still contains the original CLI examples.

Live Supabase, AI, phone and Bluetooth integration still need to be checked
when the team connects them. Nothing has been deployed by this cleanup.