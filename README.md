# HackVillage

ESP32-C3 devices discover each other through Bluetooth or a manual IR handshake. Each phone resolves the other account by its six-digit string code, calculates separate interest and skill scores, and returns both to a 128x32 OLED. Supabase authenticates users and opens chat only after both accept.

Read [SETUP.md](SETUP.md) for database deployment, push notifications, Android/iPhone development builds, firmware installation, and verification.

- `HackVillage/`: Expo app, matching, board client, profile editor, requests and messaging.
- Root Python files: MicroPython 1.28 firmware and protocol helpers.
- `supabase/`: additive schema, authenticated networking and optional AI normalization functions, notification worker.
- `backend/`: original deterministic Python skill/scoring algorithms and their tests. The phone uses the port of the standalone skill matcher.
- `python/`: preserved earlier board-side prototype; not loaded by the current app or firmware.
- `tests/`: host-side firmware/protocol tests.

Do not use Expo Go for BLE/push validation. Do not apply the old SQL draft in `supabase/drafts/`; use the integration migration in SETUP.md.
