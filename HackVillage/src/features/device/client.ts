import type { BoardCallbacks } from './types';
// Metro selects client.native.ts for iOS and Android; web stays usable without a native BLE module.
export class BoardClient {
  readonly supported = false;
  constructor(private callbacks: BoardCallbacks) {}
  async scan(): Promise<void> { throw new Error('Connect a board using the Android or iPhone development build.'); }
  stopScan() {}
  async connect(_id: string): Promise<void> { throw new Error('Bluetooth requires a phone development build.'); }
  async send(_value: unknown): Promise<void> {}
  async disconnect(): Promise<void> {}
  async dispose(): Promise<void> {}
}
