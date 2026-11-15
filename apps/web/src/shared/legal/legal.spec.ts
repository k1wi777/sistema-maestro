import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  it.each(Object.keys(LEGAL_PENDING))('«%s» figura en docs/legal/pendientes.md', (id) => {
    expect(file).toContain(`\`${id}\``);
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
