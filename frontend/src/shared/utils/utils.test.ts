import { describe, it, expect } from 'vitest';
import { normalizeServerUrl, sameHost, serverUrlFor } from './serverUrl';
import { formatBytes } from './format';
import { getFileIcon } from './fileIcons';

describe('normalizeServerUrl', () => {
  it('adds scheme and default port, strips paths', () => {
    expect(normalizeServerUrl('192.168.1.5')).toBe('http://192.168.1.5:3001');
    expect(normalizeServerUrl(' 192.168.1.5:8080/ ')).toBe('http://192.168.1.5:8080');
    expect(normalizeServerUrl('https://host:3002/ruta')).toBe('https://host:3002');
    expect(normalizeServerUrl('')).toBeNull();
    expect(normalizeServerUrl('ftp://host')).toBeNull();
  });
});

describe('sameHost', () => {
  // Antes se comparaba con includes(): 192.168.1.1 "coincidía" con 192.168.1.10.
  it('compares hostnames exactly', () => {
    expect(sameHost('http://192.168.1.1:3001', 'http://192.168.1.10:3001')).toBe(false);
    expect(sameHost('http://192.168.1.1:3001', 'https://192.168.1.1:3002')).toBe(true);
  });
});

it('serverUrlFor uses the announced port', () => {
  expect(serverUrlFor('10.0.0.2', 3011)).toBe('http://10.0.0.2:3011');
  expect(serverUrlFor('10.0.0.2')).toBe('http://10.0.0.2:3001');
});

it('formatBytes handles edge cases', () => {
  expect(formatBytes(0)).toBe('0 B');
  expect(formatBytes(-1)).toBe('0 B');
  expect(formatBytes(1536)).toBe('1.5 KB');
  expect(formatBytes(2 ** 62)).toMatch(/EB$/);
});

// Antes .md y cualquier extensión desconocida mostraban una carpeta.
it('getFileIcon: markdown is text and unknown files are not folders', () => {
  expect(getFileIcon('README.md')).toBe(getFileIcon('notas.txt'));
  expect(getFileIcon('Guía.MARKDOWN')).toBe(getFileIcon('notas.txt'));
  expect(getFileIcon('datos.xyz')).not.toBe('📁');
  expect(getFileIcon('sin-extension')).not.toBe('📁');
});
