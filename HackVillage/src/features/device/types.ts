import type { BoardEvent } from './protocol';
export type BoardDevice = { id: string; name: string; rssi: number | null };
export type BoardCallbacks = {
  onEvent: (event: BoardEvent) => void;
  onStatus: (status: string) => void;
  onDevices: (devices: BoardDevice[]) => void;
};
