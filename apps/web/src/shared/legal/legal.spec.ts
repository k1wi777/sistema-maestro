import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { INSTITUTION } from './content/institution';
import { LEGAL_DOCUMENTS_VERSION } from './content/version';
import { LEGAL_PENDING } from './content/pending';
import { PRIVACY_POLICY } from './content/privacy-policy';
import { TERMS_OF_USE } from './content/terms-of-use';

// De la raíz del repositorio: apps/web/src/shared/legal → ../../../../..
const PENDING_FILE = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'docs',
  'legal',
  'pendientes.md',
);

describe('versión de los textos legales', () => {
  it('cumple el patrón que acepta la API', () => {
    expect(LEGAL_DOCUMENTS_VERSION).toMatch(/^[A-Za-z0-9._-]{1,20}$/);
  });
});

describe('datos legales pendientes', () => {
  const file = readFileSync(PENDING_FILE, 'utf8');
  // Filas de la tabla: | `id` | dato | dónde | quién | estado |
  const rows = [...file.matchAll(/^\|\s*`([a-z-]+)`\s*\|.*\|\s*([^|]+?)\s*\|\s*$/gmu)].map(
    (match) => ({ id: match[1] ?? '', status: match[2] ?? '' }),
  );
  const pendingInFile = rows
    .filter((row) => row.status === 'Pendiente')
    .map((row) => row.id)
    .sort();
  const pendingInCode = Object.keys(LEGAL_PENDING).sort();

  it('la tabla tiene filas con estado «Pendiente» o «Confirmado»', () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(['Pendiente', 'Confirmado']).toContain(row.status);
    }
  });

  it('los ids pendientes del código y de docs/legal/pendientes.md son los mismos', () => {
    expect(pendingInFile).toEqual(pendingInCode);
  });

  it('el nombre legal ya no es un dato pendiente y se muestra completo', () => {
    expect(pendingInCode).not.toContain('legal-name');
    expect(INSTITUTION.legalName).toBe('George Noble School');
    expect(rows.find((row) => row.id === 'legal-name')?.status).toBe('Confirmado');
  });
});

describe('documentos legales', () => {
  it.each([
    ['política', PRIVACY_POLICY],
    ['términos', TERMS_OF_USE],
  ])('%s: las secciones tienen id único', (_name, document) => {
    const ids = document.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
