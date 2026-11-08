#Keep the owner's profile on their board.

import json
import os
import uuid
from pathlib import Path
from interest_normalizer import check_tags

DATA_FOLDER = Path(os.environ.get("CONNECT_DATA_DIR", str(Path(__file__).parent / "data")))


def _normalize_uuid(value, field_name):
    if isinstance(value, uuid.UUID):
        value = str(value)
    if not isinstance(value, str):
        raise ValueError(f"The profile needs valid {field_name}.")
    try:
        return str(uuid.UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise ValueError(f"The profile needs valid {field_name}.") from None


def check_profile(profile):
    if not isinstance(profile, dict) or profile.get("version") != 1:
        raise ValueError("This profile needs version 1.")
    board_id = _normalize_uuid(profile.get("board_id"), "board_id")
    revision = _normalize_uuid(profile.get("revision"), "revision")
    return {"version": 1,"board_id": board_id,"revision": revision,"interests": check_tags(profile.get("interests"))}

def load_profile(folder=None):
    path = Path(folder or DATA_FOLDER) / "profile.json"
    if not path.exists():
        return None
    return check_profile(json.loads(path.read_text(encoding="utf-8")))

def save_profile(interests, folder=None):
    folder = Path(folder or DATA_FOLDER)
    old = load_profile(folder)
    board_id = old["board_id"] if old else str(uuid.uuid4())
    profile = check_profile({"version": 1,"board_id": board_id,"revision": str(uuid.uuid4()),"interests": interests})
    folder.mkdir(parents=True, exist_ok=True)
    temporary = folder / "profile.tmp"
    temporary.write_text(json.dumps(profile, indent=4), encoding="utf-8")
    temporary.replace(folder / "profile.json")
    return profile
