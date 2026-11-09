import { randomUUID } from 'node:crypto';
import { RefreshTokenCodec } from './refresh-token.codec';

describe('RefreshTokenCodec', () => {
  const codec = new RefreshTokenCodec('secreto-de-prueba-'.padEnd(40, 'a'));
  const sessionId = randomUUID();

  it('round-trips the session id and generation', () => {
    const token = codec.sign(sessionId, 3);

    expect(token.startsWith(`${sessionId}.3.`)).toBe(true);
    expect(codec.parse(token)).toEqual({ sessionId, generation: 3 });
  });

  it('is deterministic, so the current token can be recomputed', () => {
    expect(codec.sign(sessionId, 1)).toBe(codec.sign(sessionId, 1));
    expect(codec.sign(sessionId, 1)).not.toBe(codec.sign(sessionId, 2));
  });

  it('rejects a token signed with another secret', () => {
    const other = new RefreshTokenCodec('otro-secreto-'.padEnd(40, 'b'));

    expect(codec.parse(other.sign(sessionId, 0))).toBeNull();
  });

  it('rejects a tampered generation, session or mac', () => {
    const [sid, generation, mac] = codec.sign(sessionId, 2).split('.') as [string, string, string];

    expect(codec.parse(`${sid}.${Number(generation) + 1}.${mac}`)).toBeNull();
    expect(codec.parse(`${randomUUID()}.${generation}.${mac}`)).toBeNull();
    expect(
      codec.parse(`${sid}.${generation}.${mac.slice(0, -1)}${mac.endsWith('A') ? 'B' : 'A'}`),
    ).toBeNull();
  });

  it.each([
    undefined,
    '',
    'abc',
    'a.b.c',
    `${randomUUID()}.1`,
    `${randomUUID()}.-1.${'a'.repeat(43)}`,
  ])('rejects a malformed token (%p)', (token) => {
    expect(codec.parse(token)).toBeNull();
  });
});
