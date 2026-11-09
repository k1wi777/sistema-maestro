import { createHmac, timingSafeEqual } from 'node:crypto';

export interface RefreshTokenClaims {
  sessionId: string;
  generation: number;
}

const TOKEN_PATTERN = /^([0-9a-f-]{36})\.(\d{1,9})\.([A-Za-z0-9_-]{43})$/;

/**
 * Token de renovación derivado: `<sid>.<generacion>.<mac>`, con
 * `mac = HMAC-SHA256(secreto, "<sid>.<generacion>")`. El servidor solo guarda la
 * generación vigente: puede recalcular el token vigente (margen de rotación) sin
 * almacenarlo, y una copia de la base no permite fabricar tokens sin el secreto.
 */
export class RefreshTokenCodec {
  constructor(private readonly secret: string) {}

  sign(sessionId: string, generation: number): string {
    return `${sessionId}.${generation}.${this.mac(sessionId, generation)}`;
  }

  /** Devuelve los datos del token solo si su formato y su MAC son válidos. */
  parse(token: string | undefined): RefreshTokenClaims | null {
    const match = token ? TOKEN_PATTERN.exec(token) : null;
    if (!match) {
      return null;
    }
    const [, sessionId = '', generationText = '', mac = ''] = match;
    const generation = Number(generationText);
    const expected = Buffer.from(this.mac(sessionId, generation));
    const received = Buffer.from(mac);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return null;
    }
    return { sessionId, generation };
  }

  private mac(sessionId: string, generation: number): string {
    return createHmac('sha256', this.secret)
      .update(`${sessionId}.${generation}`)
      .digest('base64url');
  }
}
