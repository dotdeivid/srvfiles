// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { TransferConnection } from './transfer.api';
import { createE2EKeyPair, E2ESession } from '../../lib/e2e';

/**
 * Prueba de interoperabilidad contra un backend Go real (CI: job "interop").
 * Se activa con SRVFILES_INTEROP_URL=http://localhost:<puerto>.
 */
const SERVER = import.meta.env.SRVFILES_INTEROP_URL as string | undefined;

async function login(): Promise<string> {
  const { pin } = await (await fetch(`${SERVER}/api/pin`)).json();
  const res = await fetch(`${SERVER}/api/auth`, { method: 'POST', body: JSON.stringify({ pin }) });
  return (await res.json()).token;
}

function connect(name: string): Promise<{ conn: TransferConnection; id: string }> {
  return login().then((token) => new Promise((resolve, reject) => {
    const conn = new TransferConnection(SERVER!);
    conn.ws.onopen = () => conn.auth(token);
    conn.onReady = () => conn.register(name);
    conn.on('welcome', (m) => resolve({ conn, id: m.clientId }));
    setTimeout(() => reject(new Error(`${name}: no welcome`)), 10_000);
  }));
}

describe.skipIf(!SERVER)('interop with the Go relay', () => {
  it('transfers a file end-to-end encrypted with matching verification codes', async () => {
    const sender = await connect('Interop emisor');
    const receiver = await connect('Interop receptor');
    expect(sender.conn.encrypted).toBe(true); // cifrado del canal con Go

    const data = new Uint8Array(600_000).map((_, i) => (i * 7) % 256);
    const file = new File([data], 'interop.bin');
    const transferId = crypto.randomUUID();
    const senderKeys = await createE2EKeyPair();

    const received: Uint8Array[] = [];
    let receiverSession: E2ESession | null = null;
    let index = 0;
    const done = new Promise<{ final?: string }>((resolve) => {
      receiver.conn.on('send-request', async (msg) => {
        const own = await createE2EKeyPair();
        receiverSession = await E2ESession.derive(own.privateKey, msg.e2e!.publicKey!, msg.e2e!.publicKey!, own.publicKey, msg.transferId);
        receiver.conn.sendKey(msg.transferId, own.publicKey);
        receiver.conn.accept(msg.transferId);
      });
      receiver.conn.onBinary((buf) => received.push(new Uint8Array(buf.slice(36))));
      receiver.conn.on('send-complete', (msg) => resolve(msg.e2e ?? {}));
    });

    let senderSession: E2ESession | null = null;
    sender.conn.on('send-key', async (msg) => {
      senderSession = await E2ESession.derive(senderKeys.privateKey, msg.publicKey, senderKeys.publicKey, msg.publicKey, transferId);
    });
    sender.conn.on('send-accept', async () => {
      await new Promise((r) => setTimeout(r, 50));
      await sender.conn.sendFile(transferId, file, senderSession!);
    });
    sender.conn.sendRequest(receiver.id, file, transferId, senderKeys.publicKey);

    const e2e = await done;
    expect(senderSession!.sas).toBe(receiverSession!.sas);
    const plain: Uint8Array[] = [];
    for (const chunk of received) plain.push(await receiverSession!.decryptChunk(index++, chunk as Uint8Array<ArrayBuffer>));
    const final = await receiverSession!.decryptFinal(index, e2e.final!);
    const joined = new Uint8Array(plain.reduce((n, c) => n + c.length, 0));
    plain.reduce((off, c) => { joined.set(c, off); return off + c.length; }, 0);
    expect(final).toEqual({ chunks: index, size: data.length, name: 'interop.bin' });
    expect(joined).toEqual(data);

    sender.conn.close();
    receiver.conn.close();
  }, 30_000);
});
