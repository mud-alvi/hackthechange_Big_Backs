#These functions are the entry points for the phone and hardware code.

from interest_normalizer import normalize_interests
from profile_store import load_profile, save_profile
from connection_manager import ConnectionManager

class BoardBackend:
    def __init__(self, folder=None):
        self.folder = folder
        self.profile = load_profile(folder)
        self.connections = ConnectionManager(self.profile) if self.profile else None

    def update_profile(self, interests, use_ai=True):
        tags = normalize_interests(interests, use_ai)
        self.profile = save_profile(tags, self.folder)
        #Old requests belong to the old profile. Start again with searching off.
        self.connections = ConnectionManager(self.profile)
        return self.profile

    def _ready(self):
        if self.connections is None:
            raise ValueError("Save your interests first.")
        return self.connections

    def set_searching(self, enabled):
        self._ready().set_searching(enabled)

    def receive_profile(self, profile, encounter_id):
        return self._ready().meet(profile, encounter_id)

    def answer_on_phone(self, request_id, accepted):
        return self._ready().decide(request_id, accepted)

    def receive_answer(self, request_id, accepted, peer_id):
        if not isinstance(peer_id, str) or not peer_id:
            raise ValueError("A remote reply needs the connected board's ID.")
        return self._ready().decide(request_id, accepted, peer_id)
