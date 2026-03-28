/**
 * ECDH P-256 + HKDF-SHA-256 + AES-256-GCM session cipher.
 * Used by the frontend WebSocket to encrypt/decrypt messages.
 *
 * Only available in secure contexts (HTTPS or localhost).
 * Use `isCryptoAvailable()` to check before using any other export.
 */

const INFO = new TextEncoder().encode('srvfiles-ws-v1');

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function isCryptoAvailable(): boolean {
  return (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined' &&
    typeof globalThis.crypto.subtle.generateKey === 'function'
  );
}

export class SessionCipher {
  constructor(private readonly key: CryptoKey) {}

  async encryptJson(plaintext: string): Promise<{ iv: string; data: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, encoded);
    return { iv: toBase64(iv), data: toBase64(new Uint8Array(ciphertext)) };
  }

  async decryptJson(iv: string, data: string): Promise<string> {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) },
      this.key,
      fromBase64(data),
    );
    return new TextDecoder().decode(plaintext);
  }

  async encryptBinary(payload: Uint8Array): Promise<Uint8Array> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, payload);
    const result = new Uint8Array(12 + ciphertext.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(ciphertext), 12);
    return result;
  }

  async decryptBinary(data: Uint8Array): Promise<Uint8Array> {
    const iv = data.subarray(0, 12);
    const ciphertext = data.subarray(12);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.key, ciphertext);
    return new Uint8Array(plaintext);
  }
}

export async function generateEcdhKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64(new Uint8Array(raw));
}

export async function deriveCipher(privateKey: CryptoKey, peerPublicKeyB64: string): Promise<SessionCipher> {
  const peerPublicKey = await crypto.subtle.importKey(
    'raw',
    fromBase64(peerPublicKeyB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    256,
  );

  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);

  const aesKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: INFO },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  return new SessionCipher(aesKey);
}
