#Track a nearby match and wait for both people to accept.

import hashlib
import json
import time
import uuid
from profile_store import check_profile
from python_interest_matcher import calculate_match


def _normalize_uuid(value, field_name):
    if isinstance(value, uuid.UUID):
        value = str(value)
    if not isinstance(value, str):
        raise ValueError(f"{field_name} needs a valid UUID.")
    try:
        return str(uuid.UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise ValueError(f"{field_name} needs a valid UUID.") from None


class ConnectionManager:
    def __init__(self, profile, clock=time.monotonic):
        self.profile = check_profile(profile)
        self.searching = False
        self.requests = {}
        self.clock = clock

    def set_searching(self, enabled):
        if not isinstance(enabled, bool):
            raise ValueError("Searching must be True or False.")
        self.searching = enabled
        if not enabled:
            self.requests.clear()

    def meet(self, other_profile, encounter_id):
        if not self.searching:
            return None
        other = check_profile(other_profile)
        if other["board_id"] == self.profile["board_id"]:
            raise ValueError("A board cannot match with itself.")
        #The BLE caller creates one fresh ID and shares it with the other board.
        encounter_id = _normalize_uuid(encounter_id, "encounter_id")
        pair = sorted([(self.profile["board_id"], self.profile["revision"]), (other["board_id"], other["revision"])])
        request_id = hashlib.sha256(json.dumps([pair, encounter_id]).encode()).hexdigest()
        if request_id not in self.requests:
            if len(self.requests) >= 100:
                self.requests = {key: value for key, value in self.requests.items() if self.clock() < value["expires"]}
            if len(self.requests) >= 100:
                raise ValueError("Too many nearby requests. Try again later.")
            self.requests[request_id] = {"peer_id": other["board_id"],"local": None,"remote": None,
                                         "expires": self.clock() + 120,"match": calculate_match(self.profile["interests"], other["interests"])}
        return self.get_request(request_id)

    def get_request(self, request_id):
        if request_id not in self.requests:
            raise ValueError("This connection request does not exist.")
        request = self.requests[request_id]
        status = "waiting"
        if request["local"] is False or request["remote"] is False:
            status = "rejected"
        elif request["local"] is True and request["remote"] is True:
            status = "connected"
        elif self.clock() >= request["expires"]:
            status = "expired"
        return {"request_id": request_id,"peer_id": request["peer_id"],"score": request["match"]["score"],
                "match": request["match"],"status": status,"can_chat": status == "connected"}

    def decide(self, request_id, accepted, peer_id=None):
        if not isinstance(accepted, bool):
            raise ValueError("Accept must be True or False.")
        result = self.get_request(request_id)
        request = self.requests[request_id]
        #Only the trusted BLE connection may provide the remote board's identity.
        if peer_id is not None and peer_id != request["peer_id"]:
            raise ValueError("The reply came from a different board.")
        if result["status"] != "waiting":
            return result
        side = "local" if peer_id is None else "remote"
        if request[side] is not None and request[side] != accepted:
            raise ValueError("This person has already answered.")
        request[side] = accepted
        return self.get_request(request_id)
