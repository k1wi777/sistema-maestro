/**
 * Dirección de la API. Se lee con acceso literal a `process.env.NEXT_PUBLIC_API_URL` para que
 * Next la incruste en el navegador; un valor ausente o inválido detiene `next dev` y `next build`.
 */
export function parseApiUrl(value: string | undefined): string {
  if (!value) {
    throw new Error(
      'Falta NEXT_PUBLIC_API_URL: copia apps/web/.env.example a apps/web/.env.local (por ejemplo, http://localhost:3000).',
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    url = new URL('invalid:');
  }
  const validShape =
    (url.protocol === 'http:' || url.protocol === 'https:') && !value.endsWith('/');
  if (!validShape) {
    throw new Error(
      `NEXT_PUBLIC_API_URL no es válida (${value}): debe ser una URL http o https sin barra final, por ejemplo http://localhost:3000.`,
    );
  }
  return value;
}

export const env = {
  apiUrl: parseApiUrl(process.env.NEXT_PUBLIC_API_URL),
} as const;
