import machine
import ssd1306
import time
import framebuf
import bluetooth
import random
import struct
from ble_advertising import advertising_payload
import BLE as low

# Define screen dimensions
SCREEN_WIDTH = 128
SCREEN_HEIGHT = 32

# Initialize hardware I2C on ESP32 WROOM (SDA=21, SCL=22)
i2c = machine.I2C(0, scl=machine.Pin(9), sda=machine.Pin(8))

# Initialize the OLED display (Default I2C address is usually 0x3C)
try:
    oled = ssd1306.SSD1306_I2C(SCREEN_WIDTH, SCREEN_HEIGHT, i2c, addr=0x3C)
except OSError:
    print("OLED not found. check wiring or I2C address.")
    # Try alternative address if 0x3C fails
    oled = ssd1306.SSD1306_I2C(SCREEN_WIDTH, SCREEN_HEIGHT, i2c, addr=0x3D)


############################

def large_text(display_obj, text, x, y, size=2, color=1):
    """Draws text scaled up by a factor of 'size' (e.g., 2x or 3x)"""
    # Create a small temporary buffer for a single character (8x8 pixels = 8 bytes)
    char_buf = bytearray(8)
    char_fb = framebuf.FrameBuffer(char_buf, 8, 8, framebuf.MONO_HMSB)
    
    current_x = x
    for char in text:
        char_fb.fill(0)
        char_fb.text(char, 0, 0, 1) # Draw character onto temporary buffer
        
        # Scale each pixel of the character up to the main display
        for col in range(8):
            for row in range(8):
                if char_fb.pixel(col, row):
                    # Draw a solid block instead of a single pixel
                    display_obj.fill_rect(current_x + (col * size), y + (row * size), size, size, color)
                    
        current_x += 8 * size # Move cursor to the right for the next character

# ---- Example Usage ----

ble = bluetooth.BLE()
p = low.BLESimplePeripheral(ble)

def on_rx(rx_data):
    oled.fill(0)
    print(rx_data)
    large_text(oled, str(rx_data.decode().strip() + "%"), 0, 0, size=4)
    oled.show()

    

p.on_write(on_rx)
    
print("Please connect to ESP32.")

#########

while True:

    if p.is_connected():
        # Short burst of queued notifications.
        tx_data = input("Enter anything: ")
        print("Send: ", tx_data)
        p.send(tx_data)
        

    
    
    
    
############################

"""
# Clear the screen
oled.fill(0)

# Write text: text(string, x, y, color)
# Color: 1 = White/On, 0 = Black/Off
oled.text("■", 0, 0, 1)
oled.text("MicroPython", 0, 10, 1)
#oled.text("SSD1306 OLED", 0, 2, 1)

# Draw a pixel line under the text: hline(x, y, width, color)
oled.hline(0, 48, 128, 1)

# Push the changes to the actual display hardware
oled.show()

print("Display updated successfully!")
"""