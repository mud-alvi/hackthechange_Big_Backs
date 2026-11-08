/* eslint-disable @typescript-eslint/no-require-imports -- Native BLE modules must remain unloaded inside Expo Go. */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { fromByteArray, toByteArray } from 'base64-js';
import type { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { createLineDecoder, parseBoardEvent, UART_RX, UART_SERVICE, UART_TX } from './protocol';
import type { BoardCallbacks } from './types';

export class BoardClient {
  readonly supported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private subscriptions: Subscription[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private wantedId: string | null = null;
  private disposed = false;
  private connectionVersion = 0;
  private writes: Promise<void> = Promise.resolve();
  private decoder;
  private background: typeof import('react-native-background-actions').default | null = null;

  constructor(private callbacks: BoardCallbacks) {
    this.decoder = createLineDecoder(line => {
      try { callbacks.onEvent(parseBoardEvent(line)); }
      catch (error) { callbacks.onStatus(error instanceof Error ? error.message : 'Invalid board message.'); }
    });
    if (this.supported) {
      const { BleManager: Manager } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
      this.manager = new Manager({ restoreStateIdentifier: 'hackvillage-board', restoreStateFunction: state => {
        const restored = state?.connectedPeripherals[0];
        if (restored) {
          this.wantedId = restored.id;
          void this.attach(restored).catch(error => callbacks.onStatus(String(error)));
        }
      } });
    }
  }
  private async permissions() {
    if (!this.manager) throw new Error('Install the HackVillage development build to use Bluetooth.');
    if (Platform.OS === 'android') {
      const required = Number(Platform.Version) >= 31
        ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const result = await PermissionsAndroid.requestMultiple(required);
      if (required.some(permission => result[permission] !== PermissionsAndroid.RESULTS.GRANTED)) throw new Error('Bluetooth permission is required to connect your board.');
    }
    const state = await this.manager.state();
    if (state !== 'PoweredOn') throw new Error('Turn on Bluetooth and try again.');
  }
  async scan() {
    await this.permissions();
    this.stopScan();
    const found = new Map<string, { id: string; name: string; rssi: number | null }>();
    this.callbacks.onDevices([]);
    this.callbacks.onStatus('Looking for your board…');
    this.manager!.startDeviceScan([UART_SERVICE], { allowDuplicates: false }, (error, device) => {
      if (error) { this.stopScan(); this.callbacks.onStatus(error.message); return; }
      if (device) {
        found.set(device.id, { id: device.id, name: device.localName || device.name || 'HackVillage board', rssi: device.rssi });
        this.callbacks.onDevices([...found.values()]);
      }
    });
    this.scanTimer = setTimeout(() => { this.stopScan(); this.callbacks.onStatus(found.size ? 'Choose your board below.' : 'No boards found. Check power and firmware.'); }, 10000);
  }
  stopScan() {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.scanTimer = null;
    this.manager?.stopDeviceScan();
  }
  async connect(id: string) {
    await this.permissions();
    this.stopScan();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.wantedId = id;
    const version = ++this.connectionVersion;
    this.callbacks.onStatus('Connecting…');
    try {
      const device = await this.manager!.connectToDevice(id, { timeout: 12000 });
      if (version !== this.connectionVersion || this.disposed) {
        await device.cancelConnection().catch(() => {});
        throw new Error('Board selection changed.');
      }
      await this.attach(device);
      await this.startBackground();
    } catch (error) {
      if (version === this.connectionVersion) this.scheduleReconnect();
      throw error;
    }
  }
  private async attach(device: Device) {
    const ready = await device.discoverAllServicesAndCharacteristics();
    if (this.disposed || ready.id !== this.wantedId) {
      await ready.cancelConnection().catch(() => {});
      throw new Error('Board selection changed.');
    }
    for (const subscription of this.subscriptions) subscription.remove();
    this.subscriptions = [];
    this.decoder.reset();
    this.device = ready;
    this.subscriptions.push(ready.monitorCharacteristicForService(UART_SERVICE, UART_TX, (error, characteristic) => {
      if (error) { this.callbacks.onStatus('Board link interrupted. Reconnecting…'); return; }
      if (characteristic?.value) {
        try { this.decoder.push(String.fromCharCode(...toByteArray(characteristic.value))); }
        catch (failure) { this.callbacks.onStatus(String(failure)); }
      }
    }));
    this.subscriptions.push(ready.onDisconnected(() => {
      this.device = null;
      this.callbacks.onStatus(this.wantedId ? 'Board disconnected. Reconnecting…' : 'Board disconnected.');
      this.scheduleReconnect();
    }));
    this.callbacks.onStatus('Connected');
    await this.send({ v: 1, type: 'hello' });
  }
  private scheduleReconnect() {
    if (this.disposed || !this.wantedId || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const id = this.wantedId;
      if (!id || !this.manager) return;
      const version = this.connectionVersion;
      void this.manager.connectToDevice(id, { timeout: 12000 }).then(async device => {
        if (version !== this.connectionVersion || this.disposed) { await device.cancelConnection().catch(() => {}); return; }
        await this.attach(device);
      }).catch(() => { if (version === this.connectionVersion) this.scheduleReconnect(); });
    }, 3000);
  }
  send(value: unknown): Promise<void> {
    const device = this.device;
    if (!device) return Promise.reject(new Error('Your board is disconnected.'));
    const text = JSON.stringify(value) + '\n';
    const operation = this.writes.catch(() => {}).then(async () => {
      if (this.disposed || this.device?.id !== device.id) throw new Error('Board connection changed.');
      for (let offset = 0; offset < text.length; offset += 20) {
        const bytes = Uint8Array.from(text.slice(offset, offset + 20), character => character.charCodeAt(0));
        await device.writeCharacteristicWithResponseForService(UART_SERVICE, UART_RX, fromByteArray(bytes));
      }
    });
    this.writes = operation;
    return operation;
  }
  private async startBackground() {
    if (Platform.OS !== 'android' || AppState.currentState !== 'active') return;
    this.background = (require('react-native-background-actions') as typeof import('react-native-background-actions')).default;
    if (this.background.isRunning()) return;
    await this.background.start(async () => {
      while (!this.disposed && this.wantedId) await new Promise(resolve => setTimeout(resolve, 1000));
    }, { taskName: 'HackVillageBoard', taskTitle: 'HackVillage board connected',
      taskDesc: 'Receiving encounters from your board', taskIcon: { name: 'ic_launcher', type: 'mipmap' },
      color: '#6952E8', linkingURI: 'hackvillage://home', foregroundServiceType: ['connectedDevice'] });
  }
  async disconnect() {
    this.connectionVersion++;
    this.wantedId = null;
    this.stopScan();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    for (const subscription of this.subscriptions) subscription.remove();
    this.subscriptions = [];
    const device = this.device;
    this.device = null;
    if (device) await device.cancelConnection().catch(() => {});
    if (this.background?.isRunning()) await this.background.stop();
    this.callbacks.onStatus('Board disconnected.');
  }
  async dispose() {
    this.disposed = true;
    const disconnecting = this.disconnect();
    // Destroy the native manager before another account can construct its replacement.
    const destroying = this.manager?.destroy();
    this.manager = null;
    await Promise.all([disconnecting, destroying]);
  }
}
