import ast
import json
from pathlib import Path
import pytest
import runpy
import sys
import types
import binascii
from firmware_protocol import user_code, encode_ir, decode_ir, encode_beacon, decode_beacon, display_rows, LineBuffer

ROOT = Path(__file__).resolve().parents[1]


def test_every_six_digit_id_roundtrips_in_both_ir_directions():
    # Includes 0 commands, leading zeroes, and NEC8-looking 16-bit address patterns.
    for number in range(1_000_000):
        code = f'{number:06d}'
        assert decode_ir(*encode_ir(code)) == (code, False)
        assert decode_ir(*encode_ir(code, True)) == (code, True)


@pytest.mark.parametrize('bad', [123456, '12345', '1234567', 'ABC1234', '１２３４５６'])
def test_invalid_codes_rejected(bad):
    with pytest.raises(ValueError):
        user_code(bad)


def test_beacons_fit_legacy_advertising_and_decode():
    for code in ['000000', '001234', '065280', '999999', None]:
        manufacturer = encode_beacon(code)
        advertisement = b'\x02\x01\x06' + bytes([17, 7]) + bytes(16) + bytes([9, 255]) + manufacturer
        assert len(advertisement) == 31
        assert decode_beacon(advertisement) == code
    assert decode_beacon(b'\xff\xff') is None


def test_uart_chunking_multiple_frames_and_overflow_recovery():
    buffer = LineBuffer()
    wire = json.dumps({'v': 1, 'type': 'scores', 'percentages': [72.5, 85]}).encode() + b'\n'
    output = []
    for index in range(0, len(wire), 7):
        output.extend(buffer.push(wire[index:index + 7]))
    assert output[0]['percentages'] == [72.5, 85]
    assert len(buffer.push(wire + wire)) == 2
    with pytest.raises(ValueError):
        buffer.push(b'x' * 1025)
    assert len(buffer.push(wire)) == 1


def test_two_labelled_rows_fit_128_by_32_at_scale_two():
    assert display_rows([100, 72.5]) == ['I 100.0%', 'S 72.5%']
    assert display_rows([None, 0]) == ['I --', 'S 0.0%']
    assert all(len(row) * 8 * 2 <= 128 for row in display_rows([100, 100]))
    for scores in [[101, 0], [float('nan'), 0], [True, 1], [None], '75,85']:
        with pytest.raises(ValueError):
            display_rows(scores)


def test_all_first_party_python_parses():
    files = [*ROOT.glob('*.py'), *ROOT.joinpath('python').glob('*.py'), *ROOT.joinpath('backend').rglob('*.py')]
    for path in files:
        ast.parse(path.read_text(encoding='utf-8-sig'), filename=str(path))


def test_controller_button_ir_self_echo_reply_buzzer_and_display(monkeypatch, tmp_path):
    class EndSimulation(BaseException):
        pass
    state = {'now': 0, 'frames': [], 'transmissions': [], 'events': [], 'buzz': [], 'receiver': None}
    clock = types.ModuleType('time')
    clock.ticks_ms = lambda: state['now']
    clock.ticks_us = lambda: state['now'] * 1000
    clock.ticks_add = lambda a, b: a + b
    clock.ticks_diff = lambda a, b: a - b
    def sleep_ms(delay):
        state['now'] += delay
        if state['now'] > 1100:
            raise EndSimulation()
    clock.sleep_ms = sleep_ms
    class Pin:
        IN, OUT, PULL_UP = 0, 1, 2
        def __init__(self, number, *_args, **_kwargs): self.number = number
        def value(self): return 0 if self.number == 4 and 20 <= state['now'] < 120 else 1
    class PWM:
        def __init__(self, *_args, **_kwargs): pass
        def duty_u16(self, value): state['buzz'].append(value)
    machine = types.ModuleType('machine')
    machine.Pin, machine.PWM = Pin, PWM
    machine.unique_id = lambda: b'abcdef'
    machine.I2C = lambda *_args, **_kwargs: None
    class OLED:
        def __init__(self, *_args, **_kwargs): self.rows = []
        def fill(self, _value): self.rows = []
        def text(self, value, *_args): self.rows.append(value)
        def large_text(self, value, *_args, **_kwargs): self.rows.append(value)
        def show(self): state['frames'].append(self.rows[:])
    class Receiver:
        def __init__(self, _pin, callback): self.callback = callback; self.paused = False; state['receiver'] = self
        def pause(self): self.paused = True
        def resume(self): self.paused = False
    class Transmitter:
        def __init__(self, _pin): pass
        def transmit(self, address, data, **_kwargs):
            state['transmissions'].append((address, data))
            # Inject a self echo even though real hardware reception has been detached.
            state['receiver'].callback(data, address, 0)
    class Radio:
        def __init__(self, *_args): self.incoming = []; self.nearby = []; self.outgoing = []; self.injected = set()
        def configure(self, code, searching): state['configured'] = (code, searching)
        def is_connected(self): return True
        def queue(self, value): state['events'].append(value)
        def poll(self, now):
            if now == 0: self.incoming.append(json.dumps({'v': 1, 'type': 'configure', 'user_code': '001234', 'self_search': True}).encode() + b'\n')
            if now in (200, 300): self.nearby.append('999999')
            if now == 400:
                address, command = encode_ir('065280')
                state['receiver'].callback(command, address, 0)
            if now == 900: self.incoming.append(b'{"v":1,"type":"scores","percentages":[100,0]}\n')
    modules = {
        'time': clock, 'machine': machine, 'bluetooth': types.SimpleNamespace(BLE=lambda: None),
        'ubinascii': binascii, 'BLE': types.SimpleNamespace(BLESimplePeripheral=Radio),
        'ir_rx': types.SimpleNamespace(NEC_16=Receiver), 'ir_tx': types.SimpleNamespace(NEC16=Transmitter),
        'ssd1306': types.SimpleNamespace(SSD1306_I2C=OLED),
    }
    for name, module in modules.items(): monkeypatch.setitem(sys.modules, name, module)
    monkeypatch.chdir(tmp_path)
    with pytest.raises(EndSimulation): runpy.run_path(str(ROOT / 'main.py'))
    found = [event for event in state['events'] if event.get('type') == 'found']
    assert sorted((event['user_code'], event['source']) for event in found) == [('065280', 'infrared'), ('999999', 'bluetooth')]
    assert [decode_ir(*packet) for packet in state['transmissions']] == [('001234', False), ('001234', True)]
    assert state['buzz'].count(20000) == 1
    assert state['buzz'][-1] == 0
    assert ['I 100.0%', 'S 0.0%'] in state['frames']


def test_actual_nec_drivers_preserve_all_extended_address_bits(monkeypatch):
    class Pin:
        IRQ_FALLING, IRQ_RISING = 1, 2
        def irq(self, **_kwargs): pass
    class Timer:
        ONE_SHOT = 1
        def __init__(self, timer_id): assert timer_id == 0
        def init(self, **_kwargs): pass
        def deinit(self): pass
    pulses = []
    class RMT:
        def __init__(self, **kwargs): assert kwargs['resolution_hz'] == 1000000
        def write_pulses(self, values): pulses[:] = values
    machine = types.SimpleNamespace(Pin=Pin, PWM=lambda *_args: None, Timer=Timer)
    clock = types.SimpleNamespace(ticks_us=lambda: 0, ticks_diff=lambda a, b: a-b)
    with monkeypatch.context() as patch:
        patch.setattr(sys, 'platform', 'esp32')
        for name, module in {'machine': machine, 'esp32': types.SimpleNamespace(RMT=RMT),
                             'micropython': types.SimpleNamespace(const=lambda value: value),
                             'time': clock, 'utime': clock}.items(): patch.setitem(sys.modules, name, module)
        tx = runpy.run_path(str(ROOT / 'ir_tx.py'))['NEC16'](Pin())
        received = []
        rx = runpy.run_path(str(ROOT / 'ir_rx.py'))['NEC_16'](Pin(), lambda data, addr, _ctrl: received.append((addr, data)))
        for code in ['000000', '000255', '065280', '999999']:
            address, command = encode_ir(code)
            tx.transmit(address, command, validate=True)
            rx._times[0] = 0
            for index, duration in enumerate(pulses): rx._times[index+1] = rx._times[index]+duration
            rx.edge = len(pulses)+1
            rx.decode(None)
            assert received[-1] == (address, command)


def test_ble_discovers_peers_while_preserving_the_phone_connection(monkeypatch):
    class UUID:
        def __init__(self, _value): pass
        def __bytes__(self): return bytes(16)
    class Radio:
        def __init__(self): self.advertisements=[]; self.scans=[]; self.sent=[]
        def active(self, _value): pass
        def config(self, **_kwargs): pass
        def gatts_register_services(self, _services): return ((12, 13),)
        def gatts_set_buffer(self, *_args): pass
        def irq(self, callback): self.callback=callback
        def gap_advertise(self, *_args, **kwargs): self.advertisements.append(kwargs)
        def gap_scan(self, *args): self.scans.append(args)
        def gatts_notify(self, connection, handle, chunk): self.sent.append(chunk)
    bluetooth = types.SimpleNamespace(UUID=UUID, FLAG_READ=2, FLAG_NOTIFY=16, FLAG_WRITE=8, FLAG_WRITE_NO_RESPONSE=4)
    monkeypatch.setitem(sys.modules, 'bluetooth', bluetooth)
    monkeypatch.setitem(sys.modules, 'time', types.SimpleNamespace(ticks_diff=lambda a,b:a-b, ticks_add=lambda a,b:a+b))
    implementation = runpy.run_path(str(ROOT/'BLE.py'))['BLESimplePeripheral']
    radio=Radio(); board=implementation(radio,'board-abcdef'); board.configure('001234',True); board.poll(0)
    assert len(radio.advertisements[-1]['adv_data'])==31
    assert decode_beacon(radio.advertisements[-1]['adv_data'])=='001234'
    board._irq(1,(7,None,None)); board.poll(20)
    assert board.is_connected() and radio.advertisements[-1]['connectable'] is False
    own=radio.advertisements[-1]['adv_data']; board._irq(5,(0,b'',3,-30,own)); assert board.nearby==[]
    peer=b'\x09\xff'+encode_beacon('999999'); board._irq(5,(0,b'',3,-30,peer)); assert board.nearby==['999999']
    board.configure('001234',False); board.poll(40)
    assert board.is_connected() and radio.scans[-1]==(None,)
    assert decode_beacon(radio.advertisements[-1]['adv_data']) is None
    for now in range(60,1000,20): board.poll(now)
    assert all(len(chunk)<=20 for chunk in radio.sent)
    assert json.loads(b''.join(radio.sent).split(b'\n')[0])['type']=='hello'
