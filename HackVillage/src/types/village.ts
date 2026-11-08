export type AvatarLook = {
  face: 'smirk' | 'happy' | 'sleepy' | 'blank';
  shirt: 'none' | 'violet' | 'mint' | 'pink' | 'ink';
  headwear: 'none' | 'cap' | 'beanie' | 'hair';
};

export const BASE_LOOK: AvatarLook = { face: 'smirk', shirt: 'none', headwear: 'none' };
export type Message = { id: string; text: string; sender: 'me' | 'them'; createdAt: string };
export type Encounter = {
  id: string;
  peerId: string;
  name: string;
  metAt: string;
  look: AvatarLook;
  messages: Message[];
  unread: number;
};
export type VillageData = {
  look: AvatarLook;
  encounters: Encounter[];
  motion: boolean;
};

// The backend/BLE adapter should call recordEncounter with this shape.
// IDs must be stable across repeated beeps. Never pass a display name as an ID.
export type EncounterInput = {
  encounterId: string;
  peerId: string;
  name: string;
  occurredAt: string;
  look?: AvatarLook;
};
