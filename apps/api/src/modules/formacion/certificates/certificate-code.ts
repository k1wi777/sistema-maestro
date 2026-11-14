import { randomBytes } from 'node:crypto';

/**
 * Alfabeto Crockford base32: sin I, L, O ni U, para que un código dictado o transcrito no se
 * confunda con 1 o 0 ni forme palabras.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 16;
const GROUP = 4;
const BITS_PER_CHAR = 5;

/** Bits de aleatoriedad criptográfica de cada código (16 caracteres × 5 bits). */
export const CERTIFICATE_CODE_BITS = CODE_LENGTH * BITS_PER_CHAR;

const NORMALIZED = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

function format(chars: string): string {
  return chars.match(new RegExp(`.{${GROUP}}`, 'g'))?.join('-') ?? chars;
}

/**
 * Código de verificación `XXXX-XXXX-XXXX-XXXX` con 80 bits de `crypto.randomBytes`. No se deriva de
 * ningún identificador interno: quien conoce el código no puede deducir ids ni otros códigos.
 */
export function generateCertificateCode(): string {
  const bytes = randomBytes((CODE_LENGTH * BITS_PER_CHAR) / 8);
  let bits = 0n;
  for (const byte of bytes) {
    bits = (bits << 8n) | BigInt(byte);
  }
  let chars = '';
  for (let index = CODE_LENGTH - 1; index >= 0; index -= 1) {
    chars += ALPHABET[Number((bits >> BigInt(index * BITS_PER_CHAR)) & 31n)];
  }
  return format(chars);
}

/**
 * Forma canónica de un código escrito por una persona (mayúsculas, sin espacios ni guiones,
 * O→0 e I/L→1) o `null` si no tiene el formato: se responde igual que un código inexistente.
 */
export function normalizeCertificateCode(input: string): string | null {
  const chars = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return NORMALIZED.test(chars) ? format(chars) : null;
}
