"""ESP32-C3 / MicroPython 1.28. Original wiring, 128x32 OLED."""
import bluetooth
import json
import machine
import time
import ubinascii
from machine import Pin, PWM
from BLE import BLESimplePeripheral
from firmware_protocol import LineBuffer, user_code, encode_ir, decode_ir, display_rows
from ir_rx import NEC_16
from ir_tx import NEC16
from ssd1306 import SSD1306_I2C

DEVICE_ID = ubinascii.hexlify(machine.unique_id()).decode()
BOOT_ID = DEVICE_ID[-6:] + '-%x' % time.ticks_us()
SETTINGS_FILE = 'village_settings.json'
i2c = machine.I2C(0, scl=Pin(9), sda=Pin(8))
buzzer = PWM(Pin(7), freq=1000, duty_u16=0)
button = Pin(4, Pin.IN, Pin.PULL_UP)
try:
    oled = SSD1306_I2C(128, 32, i2c, addr=0x3c)
except OSError:
    oled = SSD1306_I2C(128, 32, i2c, addr=0x3d)


def status(top, bottom=''):
    oled.fill(0)
    oled.text(top[:16], 0, 0)
    oled.text(bottom[:16], 0, 16)
    oled.show()


try:
    with open(SETTINGS_FILE) as stream:
        saved = json.load(stream)
    settings = {'user_code': user_code(saved['user_code']), 'self_search': saved.get('self_search') is True}
except (OSError, ValueError, KeyError, TypeError):
    settings = {'user_code': None, 'self_search': False}
radio = BLESimplePeripheral(bluetooth.BLE(), DEVICE_ID)
radio.configure(settings['user_code'], settings['self_search'])
parser = LineBuffer()
ir_events, pending, recent = [], {}, {}
sequence, attempts = 0, 0
muted_until = reply_at = request_at = pair_until = beep_until = None
last_raw = stable = button.value()
changed_at, pressed_at, held = time.ticks_ms(), None, False
was_connected = False


def ir_callback(data, address, _):
    if data >= 0 and len(ir_events) < 8:
        ir_events.append((address, data))


receiver = NEC_16(Pin(10, Pin.IN), ir_callback)
transmitter = NEC16(Pin(20, Pin.OUT, value=0))


def transmit(response, now):
    global muted_until
    if settings['user_code']:
        receiver.pause()  # Physically disable reception, including partial frames.
        ir_events.clear()
        muted_until = time.ticks_add(now, 180)
        address, command = encode_ir(settings['user_code'], response)
        transmitter.transmit(address, command, validate=True)


def found(code, source, now):
    global sequence, beep_until
    if code == settings['user_code']:
        return
    key = code + ':' + source
    if key in recent and time.ticks_diff(now, recent[key]) < (2000 if source == 'infrared' else 60000):
        return
    if len(recent) >= 128 and key not in recent:
        oldest = max(recent, key=lambda item: time.ticks_diff(now, recent[item]))
        del recent[oldest]
    recent[key] = now
    if source == 'infrared':
        buzzer.duty_u16(20000)
        beep_until = time.ticks_add(now, 100)
    if len(pending) >= 32:
        status('Queue full', 'Connect phone')
        return
    sequence += 1
    event = {'v': 1, 'type': 'found', 'event_id': '%s:%d' % (BOOT_ID, sequence),
             'user_code': code, 'source': source}
    pending[event['event_id']] = [event, None]
    status('Found ' + code, 'Calculating...')


def command(value, now):
    global settings
    if not isinstance(value, dict) or value.get('v') != 1:
        raise ValueError('Unsupported protocol')
    kind = value.get('type')
    if kind == 'hello':
        radio.queue({'v': 1, 'type': 'hello', 'device_id': DEVICE_ID, 'user_code': settings['user_code']})
    elif kind == 'configure':
        code = value.get('user_code')
        if code is not None:
            code = user_code(code)
        searching = value.get('self_search')
        if not isinstance(searching, bool):
            raise ValueError('self_search must be boolean')
        if code and code != settings['user_code'] and settings['user_code'] and (pair_until is None or time.ticks_diff(now, pair_until) >= 0):
            raise ValueError('Hold button 3s to change owner')
        next_settings = {'user_code': code, 'self_search': searching if code else False}
        if next_settings != settings:
            if code != settings['user_code']:
                pending.clear()
                recent.clear()
                radio.outgoing = []
            settings = next_settings
            import os
            with open(SETTINGS_FILE + '.tmp', 'w') as stream:
                json.dump(settings, stream)
            os.rename(SETTINGS_FILE + '.tmp', SETTINGS_FILE)
        radio.configure(settings['user_code'], settings['self_search'])
        status('ID ' + (code or 'unassigned'), 'Auto on' if settings['self_search'] else 'Press for IR')
        radio.queue({'v': 1, 'type': 'ack', 'command': 'configure'})
    elif kind == 'scores':
        rows = display_rows(value.get('percentages'))
        oled.fill(0)
        for index, text in enumerate(rows):
            oled.large_text(text, 0, index * 16, size=2)
        oled.show()
    elif kind == 'ack_event':
        pending.pop(value.get('event_id'), None)
    else:
        raise ValueError('Unknown command')


status('HV-' + DEVICE_ID[-6:], 'Connect phone')
while True:
    now = time.ticks_ms()
    try:
        radio.poll(now)
        connected = radio.is_connected()
        if connected != was_connected:
            parser.buffer = b''
            if connected:
                for item in pending.values():
                    item[1] = None
            was_connected = connected
        while radio.incoming:
            for value in parser.push(radio.incoming.pop(0)):
                try:
                    command(value, now)
                except (ValueError, TypeError, KeyError) as error:
                    radio.queue({'v': 1, 'type': 'error', 'message': str(error)})
        if muted_until is not None and time.ticks_diff(now, muted_until) >= 0:
            receiver.resume()
            muted_until = None
        while ir_events:
            decoded = decode_ir(*ir_events.pop(0))
            if decoded and settings['user_code'] and muted_until is None:
                code, is_reply = decoded
                if code != settings['user_code']:
                    found(code, 'infrared', now)
                    request_at = None
                    if not is_reply:
                        reply_at = time.ticks_add(now, 230 + int(settings['user_code']) % 60)
        if reply_at is not None and time.ticks_diff(now, reply_at) >= 0 and muted_until is None:
            transmit(True, now)
            reply_at = None
        if request_at is not None and time.ticks_diff(now, request_at) >= 0 and muted_until is None:
            if attempts < 3:
                transmit(False, now)
                attempts += 1
                request_at = time.ticks_add(now, 1000 + int(settings['user_code']) % 7 * 90)
            else:
                request_at = None
                status('No IR response', 'Try again')
        while radio.nearby:
            found(radio.nearby.pop(0), 'bluetooth', now)
        raw = button.value()
        if raw != last_raw:
            changed_at, last_raw = now, raw
        if raw != stable and time.ticks_diff(now, changed_at) >= 40:
            stable = raw
            if stable == 0:
                pressed_at, held = now, False
                if settings['user_code']:
                    request_at, attempts = now, 0
                else:
                    status('Pair in app', 'HV-' + DEVICE_ID[-6:])
            else:
                pressed_at = None
        if pressed_at is not None and not held and time.ticks_diff(now, pressed_at) >= 3000:
            pair_until, held = time.ticks_add(now, 30000), True
            status('Pairing: 30 sec', 'HV-' + DEVICE_ID[-6:])
        if beep_until is not None and time.ticks_diff(now, beep_until) >= 0:
            buzzer.duty_u16(0)
            beep_until = None
        if connected:
            for item in pending.values():
                if item[1] is None or time.ticks_diff(now, item[1]) >= 4000:
                    radio.queue(item[0])
                    item[1] = now
        for key in list(recent):
            if time.ticks_diff(now, recent[key]) >= 60000:
                del recent[key]
    except (OSError, ValueError) as error:
        print('Recoverable error:', error)
        radio.queue({'v': 1, 'type': 'error', 'message': str(error)})
    time.sleep_ms(10)
