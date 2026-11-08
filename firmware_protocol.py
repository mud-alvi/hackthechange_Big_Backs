"""Pure protocol helpers shared by ESP32 firmware and host-side tests."""
import json

VERSION = 1
MAX_LINE = 1024


def user_code(value):
    if not isinstance(value, str) or len(value) != 6 or any(c < '0' or c > '9' for c in value):
        raise ValueError('User code must be exactly six ASCII digits')
    return value


def encode_ir(code, response=False):
    number = int(user_code(code))
    return number & 0xffff, (0xb0 if response else 0xa0) | (number >> 16)


def decode_ir(address, command):
    if not 0 <= address <= 0xffff or command & 0xe0 != 0xa0:
        return None
    number = ((command & 15) << 16) | address
    if number > 999999:
        return None
    return '%06d' % number, bool(command & 0x10)


def encode_beacon(code):
    number = int(user_code(code)) if code is not None else 0xffffff
    return b'\xff\xffHV\x01' + bytes((number >> 16, (number >> 8) & 255, number & 255))


def decode_beacon(advertisement):
    index = 0
    while index < len(advertisement):
        size = advertisement[index]
        if not size or index + size >= len(advertisement):
            return None
        if advertisement[index + 1] == 0xff:
            value = advertisement[index + 2:index + size + 1]
            if len(value) == 8 and value[:5] == b'\xff\xffHV\x01':
                number = (value[5] << 16) | (value[6] << 8) | value[7]
                return '%06d' % number if number <= 999999 else None
        index += size + 1
    return None


def display_rows(percentages):
    if not isinstance(percentages, (list, tuple)) or len(percentages) != 2:
        raise ValueError('Expected [interest_percentage, skill_percentage]')
    rows = []
    for label, score in zip(('I', 'S'), percentages):
        if score is None:
            rows.append(label + ' --')
        elif isinstance(score, (int, float)) and not isinstance(score, bool) and 0 <= score <= 100:
            rows.append('%s %.1f%%' % (label, score))
        else:
            raise ValueError('Percentage must be null or 0 through 100')
    return rows


class LineBuffer:
    def __init__(self):
        self.buffer = b''

    def push(self, chunk):
        self.buffer += chunk
        lines = []
        while b'\n' in self.buffer:
            line, self.buffer = self.buffer.split(b'\n', 1)
            if len(line) > MAX_LINE:
                self.buffer = b''
                raise ValueError('BLE frame is too long')
            if line.strip():
                lines.append(json.loads(line))
        if len(self.buffer) > MAX_LINE:
            self.buffer = b''
            raise ValueError('BLE frame is too long')
        return lines
