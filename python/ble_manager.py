#Read complete messages after the hardware code joins Bluetooth packets.
#This file does not scan, advertise, connect, or show phone notifications.

import json
import uuid
from profile_store import check_profile

MAX_MESSAGE_BYTES = 8192


def _normalize_uuid(value, field_name):
    if isinstance(value, uuid.UUID):
        value = str(value)
    if not isinstance(value, str):
        raise ValueError(f"Profile message needs a valid {field_name}.")
    try:
        return str(uuid.UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise ValueError(f"Profile message needs a valid {field_name}.") from None


def pack_message(message):
    data = json.dumps(message, separators=(",", ":")).encode("utf-8")
    if len(data) > MAX_MESSAGE_BYTES:
        raise ValueError("Bluetooth message is too large.")
    return data

def profile_message(profile, encounter_id):
    return {"type": "profile","version": 1,"encounter_id": _normalize_uuid(encounter_id, "encounter_id"),"profile": check_profile(profile)}

def answer_message(request_id, accepted):
    if not isinstance(accepted, bool):
        raise ValueError("Accept must be True or False.")
    return {"type": "answer","version": 1,"request_id": request_id,"accepted": accepted}

def receive_message(backend, data, connected_peer_id):
    #The BLE adapter must supply the peer ID from its trusted connection.
    #Do not accept an ID copied from the message as proof of who sent it.
    if not isinstance(data, bytes) or len(data) > MAX_MESSAGE_BYTES:
        raise ValueError("Expected a complete Bluetooth message of at most 8192 bytes.")
    try:
        message = json.loads(data.decode("utf-8"))
    except (ValueError, UnicodeError):
        raise ValueError("Bluetooth message is not valid JSON text.") from None
    if not isinstance(message, dict) or message.get("version") != 1:
        raise ValueError("Bluetooth message needs version 1.")
    if message.get("type") == "profile":
        profile = check_profile(message.get("profile"))
        if profile["board_id"] != connected_peer_id:
            raise ValueError("Profile does not belong to the connected board.")
        try:
            encounter_id = str(uuid.UUID(message.get("encounter_id")))
        except (ValueError, TypeError, AttributeError):
            raise ValueError("Profile message needs a valid encounter_id.") from None
        return backend.receive_profile(profile, encounter_id)
    if message.get("type") == "answer":
        request_id = message.get("request_id")
        if not isinstance(request_id, str):
            raise ValueError("Answer message needs a request_id.")
        return backend.receive_answer(request_id, message.get("accepted"), connected_peer_id)
    raise ValueError("Unknown Bluetooth message type.")
