#Run a demo or save the owner's interests on this board.

import argparse
import json
import tempfile
import uuid
from board_backend import BoardBackend
from interest_normalizer import normalize_interests

def run_demo():
    #Two backend objects stand in for two boards. No Bluetooth or AI calls here.
    with tempfile.TemporaryDirectory() as folder:
        board_a = BoardBackend(folder + "/a")
        board_b = BoardBackend(folder + "/b")
        board_a.update_profile(["Football", "Gaming", "AI", "Snowboarding", "Cooking"], use_ai=False)
        board_b.update_profile(["Basketball", "Gaming", "AI", "Snowboarding", "Cooking"], use_ai=False)
        board_a.set_searching(True)
        board_b.set_searching(True)
        encounter_id = str(uuid.uuid4())
        match_a = board_a.receive_profile(board_b.profile, encounter_id)
        match_b = board_b.receive_profile(board_a.profile, encounter_id)
        request_id = match_a["request_id"]
        print("SIMULATED nearby match:", match_a["score"], "%")
        print("Board B calculated:", match_b["score"], "%")
        board_a.answer_on_phone(request_id, True)
        board_b.receive_answer(request_id, True, board_a.profile["board_id"])
        print("After only A accepts:", board_b.connections.get_request(request_id)["status"])
        board_b.answer_on_phone(request_id, True)
        result = board_a.receive_answer(request_id, True, board_b.profile["board_id"])
        print("After both accept:", result["status"])
        print("Conversation can start:", result["can_chat"])

def main():
    parser = argparse.ArgumentParser(description="Connect backend demo")
    parser.add_argument("action", choices=["demo", "normalize", "save-profile", "show-profile"])
    parser.add_argument("interests", nargs="*")
    parser.add_argument("--offline", action="store_true", help="Use exact text for unknown interests; no AI calls")
    args = parser.parse_args()
    try:
        if args.action == "demo":
            run_demo()
        elif args.action == "normalize":
            print(json.dumps(normalize_interests(args.interests, use_ai=not args.offline), indent=4))
        elif args.action == "save-profile":
            print(json.dumps(BoardBackend().update_profile(args.interests, use_ai=not args.offline), indent=4))
        else:
            print(json.dumps(BoardBackend().profile, indent=4))
    except (ValueError, RuntimeError, OSError) as error:
        parser.exit(1, str(error) + "\n")

if __name__ == "__main__":
    main()
