import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const argon2Async = promisify(argon2);

// Parámetros recomendados por OWASP para argon2id. Se guardan en el propio hash (PHC),
// así que subirlos no exige migrar: la verificación lee los del hash almacenado.
const MEMORY_KIB = 19456;
const PASSES = 2;
const PARALLELISM = 1;
const TAG_LENGTH = 32;
const SALT_LENGTH = 16;
const VERSION = 19;

// Tope defensivo al leer parámetros de un hash almacenado: un valor corrupto no debe
// poder agotar la memoria del proceso.
const MAX_MEMORY_KIB = 262144;
const MAX_PASSES = 10;
const MAX_PARALLELISM = 8;

const PHC_PATTERN =
  /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

/**
 * Hash de contraseñas con argon2id de `node:crypto` (sin dependencias). El resultado
 * es una cadena PHC: `$argon2id$v=19$m=19456,t=2,p=1$<sal>$<hash>` (base64 sin relleno).
 */
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const tag = await derive(password, salt, MEMORY_KIB, PASSES, PARALLELISM, TAG_LENGTH);
    const params = `m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM}`;
    return `$argon2id$v=${VERSION}$${params}$${toBase64(salt)}$${toBase64(tag)}`;
  }

  /** Devuelve `false` (nunca lanza) si el hash almacenado no es un PHC argon2id válido. */
  async verify(password: string, stored: string): Promise<boolean> {
    const parsed = PHC_PATTERN.exec(stored);
    if (!parsed) {
      return false;
    }
    const [, version, memory, passes, parallelism, salt, expected] = parsed;
    const m = Number(memory);
    const t = Number(passes);
    const p = Number(parallelism);
    if (
      Number(version) !== VERSION ||
      m < 8 * p ||
      m > MAX_MEMORY_KIB ||
      t < 1 ||
      t > MAX_PASSES ||
      p < 1 ||
      p > MAX_PARALLELISM
    ) {
      return false;
    }
    const expectedTag = Buffer.from(expected ?? '', 'base64');
    if (expectedTag.length < 4) {
      return false;
    }
    const actual = await derive(
      password,
      Buffer.from(salt ?? '', 'base64'),
      m,
      t,
      p,
      expectedTag.length,
    );
    return timingSafeEqual(actual, expectedTag);
  }
}

function derive(
  password: string,
  nonce: Buffer,
  memory: number,
  passes: number,
  parallelism: number,
  tagLength: number,
): Promise<Buffer> {
  return argon2Async('argon2id', {
    message: password,
    nonce,
    memory,
    passes,
    parallelism,
    tagLength,
  });
}

function toBase64(value: Buffer): string {
  return value.toString('base64').replaceAll('=', '');
}
