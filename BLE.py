"""Phone UART peripheral and simultaneous microcontroller beacon discovery."""
import bluetooth
import json
import time
from firmware_protocol import encode_beacon, decode_beacon

UART_UUID = bluetooth.UUID('6E400001-B5A3-F393-E0A9-E50E24DCCA9E')
TX_UUID = bluetooth.UUID('6E400003-B5A3-F393-E0A9-E50E24DCCA9E')
RX_UUID = bluetooth.UUID('6E400002-B5A3-F393-E0A9-E50E24DCCA9E')


class BLESimplePeripheral:
    def __init__(self, ble, device_id):
        self.ble, self.device_id = ble, device_id
        self.code, self.connection = None, None
        self.searching, self.scanning = False, False
        self.incoming, self.nearby, self.outgoing = [], [], []
        self.tx, self.tx_offset, self.next_tx = None, 0, 0
        self.dirty_advertisement = True
        ble.active(True)
        ble.config(rxbuf=2048)
        ((self.tx_handle, self.rx_handle),) = ble.gatts_register_services(((UART_UUID, (
            (TX_UUID, bluetooth.FLAG_READ | bluetooth.FLAG_NOTIFY),
            (RX_UUID, bluetooth.FLAG_WRITE | bluetooth.FLAG_WRITE_NO_RESPONSE),
        )),))
        ble.gatts_set_buffer(self.rx_handle, 512, True)
        ble.irq(self._irq)

    def _irq(self, event, data):
        if event == 1:
            handle, _, _ = data
            if self.connection is not None:
                self.ble.gap_disconnect(handle)
                return
            self.connection = handle
            self.incoming, self.outgoing, self.tx = [], [], None
            self.queue({'v': 1, 'type': 'hello', 'device_id': self.device_id, 'user_code': self.code})
            self.dirty_advertisement = True
        elif event == 2 and data[0] == self.connection:
            self.connection = None
            self.incoming, self.outgoing, self.tx = [], [], None
            self.dirty_advertisement = True
        elif event == 3 and data[1] == self.rx_handle and data[0] == self.connection:
            chunk = self.ble.gatts_read(self.rx_handle)
            if len(self.incoming) < 32:
                self.incoming.append(bytes(chunk))
        elif event == 5 and self.searching:
            _, _, _, rssi, advertisement = data
            code = decode_beacon(advertisement)
            if code and code != self.code and rssi >= -75 and len(self.nearby) < 16:
                self.nearby.append(code)
        elif event == 6:
            self.scanning = False

    def configure(self, code, searching):
        if code != self.code or searching != self.searching:
            self.code, self.searching = code, bool(searching and code)
            self.dirty_advertisement = True

    def queue(self, message):
        if self.connection is not None and len(self.outgoing) < 40:
            self.outgoing.append(json.dumps(message).encode() + b'\n')

    def poll(self, now):
        if self.dirty_advertisement:
            # Exactly 31 bytes. Advertising continues while the phone is connected.
            payload = b'\x02\x01\x06' + bytes((17, 7)) + bytes(UART_UUID)
            manufacturer = encode_beacon(self.code if self.searching else None)
            payload += bytes((len(manufacturer) + 1, 255)) + manufacturer
            name = ('HV-' + self.device_id[-6:]).encode()
            response = bytes((len(name) + 1, 9)) + name
            self.ble.gap_advertise(300000, adv_data=payload, resp_data=response,
                                   connectable=self.connection is None)
            self.dirty_advertisement = False
        if self.searching and not self.scanning:
            self.ble.gap_scan(5000, 120000, 60000, False)
            self.scanning = True
        elif not self.searching and self.scanning:
            self.ble.gap_scan(None)
            self.scanning = False
        if self.connection is None or time.ticks_diff(now, self.next_tx) < 0:
            return
        if self.tx is None and self.outgoing:
            self.tx, self.tx_offset = self.outgoing.pop(0), 0
        if self.tx is not None:
            chunk = self.tx[self.tx_offset:self.tx_offset + 20]
            try:
                self.ble.gatts_notify(self.connection, self.tx_handle, chunk)
            except OSError:
                self.next_tx = time.ticks_add(now, 100)
                return
            self.tx_offset += len(chunk)
            if self.tx_offset >= len(self.tx):
                self.tx = None
            self.next_tx = time.ticks_add(now, 15)

    def is_connected(self):
        return self.connection is not None
