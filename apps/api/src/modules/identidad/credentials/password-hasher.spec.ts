import { PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();
  // Contraseña de prueba sin valor real.
  const password = 'contraseña-de-prueba-123';

  it('produces an argon2id PHC string with the documented parameters', async () => {
    const hash = await hasher.hash(password);

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
    expect(hash).not.toContain(password);
  });

  it('uses a different salt each time', async () => {
    expect(await hasher.hash(password)).not.toBe(await hasher.hash(password));
  });

  it('accepts the right password and rejects any other', async () => {
    const hash = await hasher.hash(password);

    expect(await hasher.verify(password, hash)).toBe(true);
    expect(await hasher.verify(`${password}x`, hash)).toBe(false);
    expect(await hasher.verify('', hash)).toBe(false);
  });

  it('verifies with the parameters stored in the hash', async () => {
    const hash = await hasher.hash(password);
    const other = hash.replace('m=19456,t=2,p=1', 'm=19456,t=3,p=1');

    // Con otros parámetros el resultado es distinto: se leen del hash, no de constantes.
    expect(await hasher.verify(password, other)).toBe(false);
  });

  it.each([
    '',
    'texto-en-claro',
    '$argon2i$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNo',
    '$argon2id$v=19$m=19456,t=2,p=1$%%%$aGFzaA',
    '$argon2id$v=19$m=99999999,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNo',
    '$argon2id$v=19$m=19456,t=999,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNo',
  ])('returns false for a malformed or unsafe stored hash', async (stored) => {
    expect(await hasher.verify(password, stored)).toBe(false);
  });
});
