/**
 * Per-connection WebSocket session with ECDH P-256 key exchange and AES-256-GCM encryption.
 *
 * Usage:
 *   const session = new WsSession();
 *   const serverPubKey = await session.handleKeyExchange(clientPubKeyB64);
 *   // now session.cipher is ready; session.keyExchangeDone === true
 */

import { webcrypto } from 'node:crypto';
import type { webcrypto as WebCryptoNS } from 'node:crypto';

type CryptoKey = WebCryptoNS.CryptoKey;

const { subtle } = webcrypto;
const INFO = Buffer.from('srvfiles-ws-v1', 'utf-8');

export class SessionCipher {
  constructor(private readonly key: CryptoKey) {}

  async encryptJson(plaintext: string): Promise<{ iv: string; data: string }> {
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      Buffer.from(plaintext, 'utf-8'),
    );
    return {
      iv: Buffer.from(iv).toString('base64'),
      data: Buffer.from(ciphertext).toString('base64'),
    };
  }

  async decryptJson(iv: string, data: string): Promise<string> {
    const plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') },
      this.key,
      Buffer.from(data, 'base64'),
    );
    return Buffer.from(plaintext).toString('utf-8');
  }

  async encryptBinary(payload: Buffer): Promise<Buffer> {
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, this.key, payload);
    return Buffer.concat([Buffer.from(iv), Buffer.from(ciphertext)]);
  }

  async decryptBinary(data: Buffer): Promise<Buffer> {
    const iv = data.subarray(0, 12);
    const ciphertext = data.subarray(12);
    const plaintext = await subtle.decrypt({ name: 'AES-GCM', iv }, this.key, ciphertext);
    return Buffer.from(plaintext);
  }
}

export class WsSession {
  keyExchangeDone = false;
  cipher: SessionCipher | null = null;

  /**
   * Performs the server side of the ECDH key exchange.
   * Generates an ephemeral key pair, derives the shared AES-256-GCM key via HKDF,
   * and returns the server's base64-encoded public key to send back to the client.
   */
  async handleKeyExchange(clientPublicKeyB64: string): Promise<string> {
    const serverKeyPair = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey', 'deriveBits'],
    );

    const clientPublicKey = await subtle.importKey(
      'raw',
      Buffer.from(clientPublicKeyB64, 'base64'),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );

    const sharedBits = await subtle.deriveBits(
      { name: 'ECDH', public: clientPublicKey },
      serverKeyPair.privateKey,
      256,
    );

    const hkdfKey = await subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
    const aesKey = await subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(0),
        info: INFO,
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );

    this.cipher = new SessionCipher(aesKey);
    this.keyExchangeDone = true;

    const serverPubKeyRaw = await subtle.exportKey('raw', serverKeyPair.publicKey);
    return Buffer.from(serverPubKeyRaw).toString('base64');
  }
}
