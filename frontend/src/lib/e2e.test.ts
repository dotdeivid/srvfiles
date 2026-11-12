import { describe, it, expect } from 'vitest';
import { E2ESession } from './e2e';
import vectors from './e2e-vectors.json';

const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function importPrivate(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

/** Vectores compartidos con Go y la app móvil (docs/e2e-test-vectors.json). */
describe('E2E test vectors', () => {
  it('sender and receiver derive the same key and verification code', async () => {
    const { transferId, sender, receiver } = vectors;
    const s = await E2ESession.derive(await importPrivate(sender.jwk), receiver.publicKey, sender.publicKey, receiver.publicKey, transferId);
    const r = await E2ESession.derive(await importPrivate(receiver.jwk), sender.publicKey, sender.publicKey, receiver.publicKey, transferId);
    expect(s.sas).toBe(vectors.sas);
    expect(r.sas).toBe(vectors.sas);

    for (const c of vectors.chunks) {
      const sealed = await s.encryptChunk(c.index, fromB64(c.plaintext));
      expect(btoa(String.fromCharCode(...sealed))).toBe(c.ciphertext);
      expect(await r.decryptChunk(c.index, fromB64(c.ciphertext))).toEqual(fromB64(c.plaintext));
    }
    const final = await r.decryptFinal(vectors.final.index, vectors.final.ciphertext);
    expect(final).toEqual(JSON.parse(vectors.final.plaintext));
  });

  it('rejects a chunk with the wrong index (reordering) or tampered data', async () => {
    const { transferId, sender, receiver } = vectors;
    const r = await E2ESession.derive(await importPrivate(receiver.jwk), sender.publicKey, sender.publicKey, receiver.publicKey, transferId);
    const ct = fromB64(vectors.chunks[0].ciphertext);
    await expect(r.decryptChunk(1, ct)).rejects.toThrow();
    ct[0] ^= 1;
    await expect(r.decryptChunk(0, ct)).rejects.toThrow();
  });
});
