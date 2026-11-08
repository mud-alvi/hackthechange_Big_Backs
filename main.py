import machine
from machine import Pin, PWM
import ssd1306
import time
import sys
import select
import bluetooth
import BLE as low
from ir_rx import NEC_16
from ir_tx import NEC

# ---- Display ----
SCREEN_WIDTH = 128
SCREEN_HEIGHT = 32

i2c = machine.I2C(0, scl=Pin(9), sda=Pin(8))
buzz = PWM(Pin(7))
buzz.freq(1000)    # pitch in Hz
buzz.duty_u16(0)   # start silent
button = Pin(4, Pin.IN, Pin.PULL_UP)
identifier = '123456'


try:
    oled = ssd1306.SSD1306_I2C(SCREEN_WIDTH, SCREEN_HEIGHT, i2c, addr=0x3C)
except OSError:
    print("OLED not found at 0x3C, trying 0x3D")
    oled = ssd1306.SSD1306_I2C(SCREEN_WIDTH, SCREEN_HEIGHT, i2c, addr=0x3D)

# ---- Shared state (callbacks write, main loop reads) ----
ir_code = None    # latest IR code as (data, addr), or None if nothing received yet
ble_event = None  # raw bytes written by the BLE client

# ---- Callbacks: just record what happened ----
def ir_callback(data, addr, ctrl):
    global ir_code
    if data > 0:  # negative values are repeat codes / errors
        ir_code = (data, addr)

def on_rx(rx_data):
    global ble_event
    ble_event = rx_data

# ---- IR + BLE setup ----
ir = NEC_16(Pin(10, Pin.IN), ir_callback)
nec = NEC(Pin(20, Pin.OUT, value = 0))

ble = bluetooth.BLE()
p = low.BLESimplePeripheral(ble)
p.on_write(on_rx)

print("Please connect to ESP32.")

# ---- Main loop ----
while True:
    if ir_code is not None:
        data, addr = ir_code
        buzz.duty_u16(32768)
        time.sleep(0.1)
        print('Data {} Addr {}'.format(data, addr))
        buzz.duty_u16(0)
        identifier = str(addr) + str(data)
        if p.is_connected():
            p.send(identifier)
        else:
            time.sleep_ms(10)
        
        ir_code = None
    # BLE event: show received text large
    if ble_event is not None:
        rx = ble_event
        ble_event = None
        print(rx)
        oled.fill(0)
        oled.large_text(rx.decode('utf-8', 'ignore').strip() + "%", 0, 0, size=4)
        oled.show()

    # Send typed text over BLE (blocks until you press Enter)
    
        
    last_val = button.value()
    if button.value() == 0 and button.value() != last_val:
        nec.transmit(8, 10)

        
