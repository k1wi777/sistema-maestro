// `env.ts` evalúa `env` al importarse y exige NEXT_PUBLIC_API_URL: se fija antes de cargar el módulo.
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseSiteUrl } = require('./env') as typeof import('./env');

describe('parseSiteUrl', () => {
  it('usa la URL local cuando falta o está vacía', () => {
    expect(parseSiteUrl(undefined)).toBe('http://localhost:3001');
    expect(parseSiteUrl('')).toBe('http://localhost:3001');
  });

  it('acepta una URL http o https sin barra final', () => {
    expect(parseSiteUrl('https://plataforma.example.org')).toBe('https://plataforma.example.org');
    expect(parseSiteUrl('http://localhost:3001')).toBe('http://localhost:3001');
  });

  it('rechaza la barra final, un protocolo inválido y un valor que no es URL', () => {
    expect(() => parseSiteUrl('https://plataforma.example.org/')).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() => parseSiteUrl('ftp://plataforma.example.org')).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() => parseSiteUrl('no es una url')).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
