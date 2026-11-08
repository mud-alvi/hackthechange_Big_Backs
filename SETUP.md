# HackVillage integration setup

The public discovery ID is a **six-character numeric string**, including leading zeroes. Supabase Auth still uses its UUID internally. Boards exchange public codes; authentication, both users' acceptance, and message access are enforced in Supabase.

## Current deployment (8 November 2026)

The integration migration, `networking`, `dispatch-push`, encrypted worker configuration, and the once-per-minute retry schedule are deployed in `uzcjllyojjsyzshkbatu`. Do not rerun the initial migration on this project. All six integration tables have row-level security enabled. The existing `profiles` and `connections` tables are preserved; the existing profile has a valid six-digit code. Integration profiles are created when their owners first sign in to the updated app.

Live checks confirmed that networking without a bearer token and dispatch without its secret return HTTP 401. Dispatch with its secret and an automatic scheduled invocation both returned HTTP 200 with an empty queue. An actual signed-in app flow and physical push delivery still require development builds on phones. The optional AI endpoint has not been deployed or given an OpenAI key; keep AI normalization off to use exact-text matching.

The remaining deployment steps are phone signing/push credentials, installing the development builds, and loading/testing firmware on the boards. Sections 1–2 below document the database/server setup for review or deployment to another project; sections 3 onward cover the remaining device setup.

## 1. Database: use the project that already handles login

For this app the configured project is `uzcjllyojjsyzshkbatu`. Interests, skills, and chats should use tables in this same project, linked by the Auth UUID. A second independent Supabase project cannot automatically trust the first project's authenticated sessions.

Open its SQL Editor and review/run `supabase/migrations/202611080001_village.sql` once. The file is also suitable for a normal Supabase migration workflow. It creates `village_*` integration tables and authenticated RPCs. It leaves the existing `profiles` and `connections` tables unchanged.

On first signed-in load, `village_ensure_profile()` reads the existing `profiles` row by Auth UUID and reuses `username`, `total_xp`, and `user_code`, `usercode`, or `userCode`. The code must already be a six-digit string. An existing invalid or duplicate code causes an explicit error instead of quietly changing someone's identity. A genuinely new account without a code receives a unique code, permanently assigned by the server.

Existing legacy connections are preserved in their original table. Importing those rows into the new mutual-acceptance model requires their actual schema and consent history; the app does not assume an old row establishes both users' approval.

New tables:

| Table | Purpose |
| --- | --- |
| `village_profiles` | Auth UUID, permanent six-digit code, display name, avatar, XP |
| `village_matching` | Interests, skills, sharing choice, discovery preferences |
| `village_requests` | One row per user pair, separate approvals, expiry, separate scores |
| `village_messages` | Messages available only to participants who both accepted |
| `village_devices` | Private push tokens, registered to the signed-in account |
| `village_notification_jobs` | Private notification retry queue |

The migration enables Realtime for requests and messages if `supabase_realtime` exists. Check Database → Replication if that publication is absent. Email verification remains managed by the existing Supabase Auth configuration. Passwords are never stored in a new profile table.

## 2. Deploy server functions

Install/use the Supabase CLI, sign in, and link the existing project. From the repository root:

```text
supabase link --project-ref uzcjllyojjsyzshkbatu
supabase functions deploy networking
supabase functions deploy dispatch-push
```

Use the checked-in `verify_jwt = false` configuration for these functions. In the dashboard this is the switch named **Verify JWT with legacy secret**. The project's ES256 user tokens are incompatible with that legacy gateway verifier. `networking` and `normalize-interests` still require a bearer token and verify it with Supabase Auth in their handlers. `networking` calls the database using that user's JWT; its service-role credential is used only for the private notification queue. `dispatch-push` requires its separate dispatch secret. Supabase normally supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. Never put a service-role credential in the phone app.

Create a long random server secret named `PUSH_DISPATCH_SECRET`. Set it through the dashboard's Edge Function secrets interface or Supabase CLI. If Expo push security is enabled for the Expo project, also set `EXPO_ACCESS_TOKEN` on the server.

In Supabase Vault, create `village_project_url` (the project's HTTPS API URL) and `village_push_dispatch_secret` (the same value as `PUSH_DISPATCH_SECRET`). Run `supabase/setup_push_retry.sql`. This invokes the protected retry worker every minute. Most notifications are dispatched immediately by `networking`; the scheduled worker retries interrupted/failed deliveries. Delivery is at least once, so a transient failure can occasionally produce a duplicate OS notification. Inspect jobs with `attempts >= 6` and no `delivered_at` if credentials or delivery remain broken.

AI normalization is optional. To enable the editor's AI switch, set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`, then deploy `normalize-interests`. The existing server implementation uses the Responses API with structured tags. Interest labels are sent to OpenAI only when this option is explicitly used. Add provider spending limits/request quotas before broader public use. With the switch off, exact-text matching works without an OpenAI key or AI function.

## 3. Install a development build on each phone

Expo Go can preview the screens but cannot connect to this BLE library or provide this project's remote push setup. Use physical Android and iPhone devices with development builds.

```text
cd HackVillage
npm ci --legacy-peer-deps
npx expo start --dev-client
```

For the first installation, build with EAS using the included `eas.json` development profile:

```text
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios
```

The existing EAS project ID is retained. The application IDs are `com.hackvillage.app`. The Expo project owner must configure FCM v1 credentials for Android, APNs credentials for iOS, and iOS device provisioning. Creating signing credentials and installing the resulting builds require the relevant account/device access. A local Android/iOS build is also supported through `npm run android` / `npm run ios` when the native toolchain is installed.

Keep the existing `.env.local`, or copy `.env.example` to `.env.local` and set the project's public URL and publishable key. These are the only Supabase values the app needs.

## 4. Install identical firmware on the ESP32-C3 boards

Use MicroPython **1.28** for ESP32-C3. Copy these repository-root files to each board:

```text
main.py
BLE.py
firmware_protocol.py
ir_tx.py
ir_rx.py
ssd1306.py
```

Keep the existing wiring: OLED SDA 8/SCL 9, buzzer 7, active-low button 4, IR receiver 10, IR LED transmitter 20. The OLED is 128×32. Check LED drive/current-limiting hardware against your physical circuit.

Each board shows an `HV-xxxxxx` name derived from its chip ID. Sign in, open Settings → Find my board, and choose that exact name. The phone provisions the owner's permanent six-digit code. After pairing once, it remembers the selected board and reconnects while signed in. Hold the board button for 3 seconds to open a 30-second window for reassignment to another owner. Signing out or disconnecting through the app clears the board's owner when the link is reachable.

Do not copy another board's generated `village_settings.json`. It is written by provisioning, not shipped with firmware. Public beacons and IR codes are discovery information, not authentication or proof of consent.

## 5. Exercise the complete flow

1. Sign two verified accounts into the installed phone builds. Confirm each has a different six-digit code.
2. On each profile, save interests/skills and explicitly enable sharing for matching.
3. Pair one board to each phone and enable request notifications.
4. Turn on self-search. The microcontrollers advertise and observe each other's IDs; phones look up profiles, calculate scores, and send display results back.
5. Turn self-search off on both. The phone-controller link remains. Point the boards at each other and press one button. The receiving board replies with its own ID. Each board beeps only after receiving the other's valid ID. Transmitting boards disable reception temporarily and filter their own ID, preventing self-echo encounters.
6. Both OLEDs should show two rows: e.g. `I 72.5%` and `S 85.0%`. A dash means missing/unshared data, never an invented zero.
7. Open Chats. Accept on only one phone: chat must remain closed. Accept on the second: the conversation appears on both.
8. Send a message each way. Background one phone and repeat an encounter/message. Verify a request/message notification arrives and opens Chats.
9. Test Bluetooth off/on, board power loss, internet loss, repeated IR packets, and logout/account switching.

Android uses a visible connected-device foreground service to keep the board link alive. iOS uses the Bluetooth central background mode and state restoration. These capabilities support background operation; they do not guarantee new encounters can be processed after the user force-stops the app, revokes permissions, or the OS prevents execution. Already-created server requests can still produce push notifications when the platform delivers them. Pending board events remain in a bounded RAM retry queue while the board stays powered. Power loss clears unacknowledged RAM events.

## Validation commands

```text
# From repository root
python -m pip install -r backend/requirements.txt
python -m pytest

# From HackVillage
npm run typecheck
npm run lint
npm test
npx tsc --project tsconfig.tests.json --noEmit
npx tsc --project ../supabase/tsconfig.json
```

For database authorization tests, point `VILLAGE_TEST_DATABASE_URL` at a disposable **local** PostgreSQL server and run `npm run test:database`. The test creates a separate database, authenticates three simulated users, and checks preservation, RLS, consent, idempotency, and outbox permissions. It deliberately refuses non-local database URLs. It creates local test roles/databases; do not point it at a server containing valuable data.

Host tests use hardware mocks and protocol checks. They cannot establish electrical wiring, optical range, native phone permissions, APNs/FCM delivery, or deployment correctness. Physical two-board/two-phone checks remain required after setup.

## Relevant documentation

- https://docs.expo.dev/versions/v58.0.0/
- https://docs.expo.dev/develop/development-builds/introduction/
- https://docs.expo.dev/push-notifications/push-notifications-setup/
- https://github.com/dotintent/react-native-ble-plx/wiki/Expo
- https://docs.micropython.org/en/v1.28.0/library/bluetooth.html
- https://docs.micropython.org/en/v1.28.0/library/esp32.html
- https://supabase.com/docs/guides/functions/schedule-functions
