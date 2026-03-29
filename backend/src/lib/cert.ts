import fs from 'fs';
import path from 'path';
import selfsigned from 'selfsigned';
import { log } from './logger';

interface CertBundle {
  key: Buffer;
  cert: Buffer;
}

/**
 * Returns the TLS key+cert bundle for the HTTPS server.
 *
 * - If `certsDir` already contains `key.pem` + `cert.pem`, loads them from disk.
 * - Otherwise generates a new self-signed RSA-2048 / SHA-256 certificate valid
 *   for 10 years, persists both files, and returns the bundle.
 *
 * @param certsDir - Absolute path to the directory where certs are stored.
 */
export async function getOrCreateCert(certsDir: string): Promise<CertBundle> {
  const keyPath  = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    log.debug('cert.ts', 'Loading existing TLS certificate', { certsDir });
    return {
      key:  fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }

  log.info('cert.ts', 'Generating self-signed TLS certificate', { certsDir });

  const tenYears = new Date();
  tenYears.setFullYear(tenYears.getFullYear() + 10);

  const attrs = [{ name: 'commonName', value: 'SrvFiles' }];
  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    keyType: 'rsa',
    notAfterDate: tenYears,
  });

  fs.mkdirSync(certsDir, { recursive: true });
  fs.writeFileSync(keyPath,  pems.private, { mode: 0o600 });
  fs.writeFileSync(certPath, pems.cert);

  log.info('cert.ts', 'TLS certificate saved', { keyPath, certPath });

  return {
    key:  Buffer.from(pems.private),
    cert: Buffer.from(pems.cert),
  };
}
