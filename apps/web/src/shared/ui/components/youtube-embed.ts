import { parseYouTubeUrl, toYouTubeEmbedUrl } from '@gns/shared';

/**
 * Dirección de inserción de un video de YouTube. Parte de `videoEmbedUrl` y, si falta, de
 * `videoUrl`; en ambos casos se reconstruye desde el id validado y el segundo de inicio, de modo
 * que el `src` siempre es `https://www.youtube-nocookie.com/embed/<id>` sin `autoplay`.
 * Devuelve `null` si el enlace no se puede interpretar.
 */
export function youTubeEmbedSrc(
  embedUrl: string | null | undefined,
  videoUrl: string | null | undefined,
): string | null {
  const source = embedUrl ?? videoUrl;
  if (!source) {
    return null;
  }
  const parsed = parseYouTubeUrl(source);
  return parsed ? toYouTubeEmbedUrl(parsed) : null;
}
