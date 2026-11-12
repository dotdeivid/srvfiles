import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransferConnection } from './transfer.api';
import { SessionCipher } from '../../lib/crypto';

/** WebSocket falso: los tests empujan mensajes con emit(). */
class FakeWebSocket extends EventTarget {
  static OPEN = 1;
  static last: FakeWebSocket;
  readyState = 1;
  binaryType = 'arraybuffer';
  bufferedAmount = 0;
  sent: unknown[] = [];
  constructor(public url: string) {
    super();
    FakeWebSocket.last = this;
  }
  send(data: unknown) { this.sent.push(data); }
  close() { this.readyState = 3; }
  emit(data: unknown) { this.dispatchEvent(new MessageEvent('message', { data })); }
}

async function newCipher(): Promise<SessionCipher> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return new SessionCipher(key);
}

beforeEach(() => vi.stubGlobal('WebSocket', FakeWebSocket));
afterEach(() => vi.unstubAllGlobals());

describe('TransferConnection', () => {
  // Regresión B1: sin cola, el descifrado asíncrono reordenaba los mensajes y
  // send-complete llegaba antes que los últimos chunks.
  it('processes encrypted messages strictly in arrival order', async () => {
    const conn = new TransferConnection('http://srv:3001');
    const cipher = await newCipher();
    (conn as unknown as { _cipher: SessionCipher })._cipher = cipher;

    const events: string[] = [];
    conn.onBinary((buf) => events.push(`chunk:${new Uint8Array(buf)[36]}`));
    conn.on('send-complete', () => events.push('complete'));

    const ws = FakeWebSocket.last;
    const frames: Uint8Array[] = [];
    for (let i = 0; i < 20; i++) {
      // Tamaños distintos: los más grandes tardan más en descifrar.
      const payload = new Uint8Array(36 + (i % 2 === 0 ? 300_000 : 10));
      payload[36] = i;
      frames.push(await cipher.encryptBinary(payload));
    }
    const complete = await cipher.encryptJson(JSON.stringify({ type: 'send-complete', transferId: 't' }));

    for (const f of frames) ws.emit(f.buffer);
    ws.emit(JSON.stringify({ type: 'encrypted', ...complete }));

    await vi.waitFor(() => expect(events).toContain('complete'));
    expect(events).toEqual([...Array.from({ length: 20 }, (_, i) => `chunk:${i}`), 'complete']);
  });

  it('drops plaintext messages once encryption is active', async () => {
    const conn = new TransferConnection('http://srv:3001');
    (conn as unknown as { _cipher: SessionCipher })._cipher = await newCipher();
    const handler = vi.fn();
    conn.on('files-changed', handler);
    FakeWebSocket.last.emit(JSON.stringify({ type: 'files-changed' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(handler).not.toHaveBeenCalled();
  });
});
