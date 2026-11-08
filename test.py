"""Run INSTEAD OF main.py. Standalone NEC16 sender; no project libraries."""
import sys
import time
from machine import Pin
from esp32 import RMT

USER_CODE = '550163'  # Receiver test main uses DIFFERENT ID 654321.
TX_PIN = 26  # GPIO used by the separate sender's successful hardware test.
SEND_COUNT = 10


def make_frame(code):
    if not isinstance(code, str) or len(code) != 6 or any(c < '0' or c > '9' for c in code):
        raise ValueError('USER_CODE must be a string of exactly six ASCII digits')
    number = int(code)
    address = number & 0xffff
    command = 0xa0 | (number >> 16)
    frame = address | (command << 16) | ((command ^ 0xff) << 24)
    pulses = [9000, 4500]
    for bit in range(32):
        pulses.extend((563, 1687 if frame & (1 << bit) else 563))
    pulses.append(563)
    return address, command, tuple(pulses)


def main():
    print('Firmware:', sys.implementation)
    address, command, pulses = make_frame(USER_CODE)
    print('ID:', USER_CODE, 'TX GPIO:', TX_PIN)
    print('NEC16 address:', address, 'command:', command)
    pin = Pin(TX_PIN, Pin.OUT, value=0)
    rmt = None
    try:
        try:
            rmt = RMT(pin=pin, resolution_hz=1000000, tx_carrier=(38000, 33, 1))
            print('RMT API: resolution_hz')
        except TypeError:
            rmt = RMT(0, pin=pin, clock_div=80, tx_carrier=(38000, 33, 1))
            print('RMT API: clock_div')
        print('Sending starts in 3 seconds. Start the other board receiver.')
        time.sleep_ms(3000)
        for count in range(1, SEND_COUNT + 1):
            rmt.write_pulses(pulses, 1)
            started = time.ticks_ms()
            while not rmt.wait_done():
                if time.ticks_diff(time.ticks_ms(), started) > 1000:
                    raise RuntimeError('IR transmission did not finish within 1 second')
                time.sleep_ms(10)
            print('TX complete', count, '/', SEND_COUNT, 'ID:', USER_CODE)
            if count < SEND_COUNT:
                time.sleep_ms(2000)
        print('Finished. TX complete confirms transmission, not reception.')
    finally:
        if rmt is not None:
            rmt.deinit()
        pin.value(0)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('IR sender stopped.')
    except Exception as error:
        print('SENDER ERROR:')
        sys.print_exception(error)
        raise
