import { readUserCode } from '../interests/interest_data';

export const UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const UART_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const UART_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
export type FoundEvent = { type: 'found'; v: 1; event_id: string; user_code: string; source: 'bluetooth' | 'infrared' };
export type BoardEvent = FoundEvent | { type: 'hello'; v: 1; device_id: string; user_code: string | null } | { type: 'ack'; v: 1; command: string } | { type: 'error'; v: 1; message: string };
export function parseBoardEvent(line: string): BoardEvent {
  const value = JSON.parse(line);
  if (!value || value.v !== 1) throw new Error('Unsupported board protocol. Install the matching firmware.');
  if (value.type === 'found') {
    if (!['bluetooth', 'infrared'].includes(value.source) || typeof value.event_id !== 'string' || !value.event_id || value.event_id.length > 100) throw new Error('Invalid discovery event.');
    return { ...value, user_code: readUserCode(value.user_code) };
  }
  if (value.type === 'hello' && typeof value.device_id === 'string') {
    return { ...value, user_code: value.user_code === null ? null : readUserCode(value.user_code) };
  }
  if (value.type === 'ack' && typeof value.command === 'string') return value;
  if (value.type === 'error' && typeof value.message === 'string') return value;
  throw new Error('Unknown board event.');
}
export function createLineDecoder(onLine: (line: string) => void, maxLength = 4096) {
  let buffer = '';
  return {
    push(text: string) {
      buffer += text;
      if (buffer.length > maxLength && !buffer.includes('\n')) { buffer = ''; throw new Error('Board message is too long.'); }
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1);
        if (line.length > maxLength) { buffer = ''; throw new Error('Board message is too long.'); }
        if (line) onLine(line);
      }
      if (buffer.length > maxLength) { buffer = ''; throw new Error('Board message is too long.'); }
    },
    reset() { buffer = ''; },
  };
}
export function scoreCommand(eventId: string, interest: number | null, skill: number | null) {
  for (const score of [interest, skill]) if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) throw new Error('Invalid display score.');
  return { v: 1, type: 'scores', event_id: eventId, percentages: [interest, skill] };
}
