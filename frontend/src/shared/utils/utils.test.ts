import { describe, it, expect } from 'vitest';
import { normalizeServerUrl, sameHost, serverUrlFor } from './serverUrl';
import { formatBytes, formatDate } from './format';
import { sortFiles } from '../../features/files/sortFiles';
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

describe('formatDate', () => {
  const now = new Date(2026, 10, 13, 15, 0);
  it('usa hoy / ayer / día / día y año', () => {
    expect(formatDate(new Date(2026, 10, 13, 9, 5).toISOString(), now)).toMatch(/^hoy /);
    expect(formatDate(new Date(2026, 10, 12, 23, 0).toISOString(), now)).toMatch(/^ayer /);
    expect(formatDate(new Date(2026, 2, 1).toISOString(), now)).not.toMatch(/2026/);
    expect(formatDate(new Date(2025, 2, 1).toISOString(), now)).toMatch(/2025/);
  });
  it('devuelve vacío si la fecha no es válida', () => {
    expect(formatDate('nope', now)).toBe('');
  });
});

describe('sortFiles', () => {
  const f = (name: string, size: number, createdAt: string) => ({ name, size, createdAt, downloadUrl: '' });
  const files = [f('b.txt', 10, '2026-01-02T00:00:00Z'), f('a10.txt', 30, '2026-01-01T00:00:00Z'), f('a2.txt', 20, '2026-01-03T00:00:00Z')];
  it('ordena por fecha, nombre natural y tamaño sin mutar', () => {
    expect(sortFiles(files, 'newest').map((x) => x.name)).toEqual(['a2.txt', 'b.txt', 'a10.txt']);
    expect(sortFiles(files, 'oldest').map((x) => x.name)).toEqual(['a10.txt', 'b.txt', 'a2.txt']);
    expect(sortFiles(files, 'name').map((x) => x.name)).toEqual(['a2.txt', 'a10.txt', 'b.txt']);
    expect(sortFiles(files, 'size').map((x) => x.name)).toEqual(['a10.txt', 'a2.txt', 'b.txt']);
    expect(files[0].name).toBe('b.txt');
  });
});
