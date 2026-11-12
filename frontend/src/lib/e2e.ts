/**
 * Cifrado de extremo a extremo de una transferencia (ver docs/protocol.md).
 *
 * Emisor y receptor generan claves ECDH P-256 efímeras; el relay solo
 * reenvía las claves públicas y nunca puede descifrar el contenido.
 *
 *   okm  = HKDF-SHA-256(ECDH, salt = transferId, info = "srvfiles-e2e-v1" ‖ pubEmisor ‖ pubReceptor, 36 bytes)
 *   key  = okm[0..32]  → AES-256-GCM
 *   SAS  = uint32(okm[32..36]) mod 1 000 000 → código de 6 dígitos que ambos comparan
 *
 * Chunk i: nonce = 0x00000000 ‖ uint64(i), AAD = transferId. El marcador
 * final usa el índice N (cantidad de chunks) y AAD = transferId + "|end".
 * Así un chunk reordenado, repetido, perdido o alterado no se descifra.
 */

const INFO = new TextEncoder().encode('srvfiles-e2e-v1');
const enc = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function nonce(index: number): Uint8Array<ArrayBuffer> {
  const n = new Uint8Array(12);
  new DataView(n.buffer).setBigUint64(4, BigInt(index));
  return n;
}

/** true si el contexto permite cifrado de extremo a extremo (HTTPS, localhost o la app). */
export function isE2EAvailable(): boolean {
  return typeof globalThis.crypto?.subtle?.deriveBits === 'function';
}

export interface E2EKeyPair {
  privateKey: CryptoKey;
  /** base64 de la clave pública sin comprimir (65 bytes). */
  publicKey: string;
}

export async function createE2EKeyPair(): Promise<E2EKeyPair> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { privateKey: pair.privateKey, publicKey: toBase64(raw) };
}

/** Código de verificación con formato "123 456". */
export function formatSas(sas: string): string {
  return `${sas.slice(0, 3)} ${sas.slice(3)}`;
}

export class E2ESession {
  private constructor(private readonly key: CryptoKey, private readonly transferId: string, readonly sas: string) {}

  /**
   * Deriva la sesión. `senderPublicKey`/`receiverPublicKey` en base64; uno
   * de los dos es la clave propia (la de `ownPrivateKey`).
   */
  static async derive(
    ownPrivateKey: CryptoKey,
    peerPublicKey: string,
    senderPublicKey: string,
    receiverPublicKey: string,
    transferId: string,
  ): Promise<E2ESession> {
    const peer = await crypto.subtle.importKey('raw', fromBase64(peerPublicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, ownPrivateKey, 256);
    const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
    const sp = fromBase64(senderPublicKey);
    const rp = fromBase64(receiverPublicKey);
    const info = new Uint8Array(INFO.length + sp.length + rp.length);
    info.set(INFO, 0);
    info.set(sp, INFO.length);
    info.set(rp, INFO.length + sp.length);
    const okm = new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(transferId), info },
      hkdfKey,
      36 * 8,
    ));
    const key = await crypto.subtle.importKey('raw', okm.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    const sasNum = new DataView(okm.buffer, 32, 4).getUint32(0) % 1_000_000;
    return new E2ESession(key, transferId, String(sasNum).padStart(6, '0'));
  }

  async encryptChunk(index: number, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce(index), additionalData: enc.encode(this.transferId) }, this.key, data,
    ));
  }

  /** Lanza si el chunk fue alterado o no corresponde a ese índice. */
  async decryptChunk(index: number, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce(index), additionalData: enc.encode(this.transferId) }, this.key, data,
    ));
  }

  /** Marcador final: cantidad de chunks, tamaño y nombre, cifrados y autenticados. */
  async encryptFinal(chunks: number, size: number, name: string): Promise<string> {
    const plain = enc.encode(JSON.stringify({ chunks, size, name }));
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce(chunks), additionalData: enc.encode(`${this.transferId}|end`) }, this.key, plain,
    );
    return toBase64(new Uint8Array(ct));
  }

  async decryptFinal(chunks: number, b64: string): Promise<{ chunks: number; size: number; name: string }> {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce(chunks), additionalData: enc.encode(`${this.transferId}|end`) }, this.key, fromBase64(b64),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }
}
