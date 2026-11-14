/** Enlace de YouTube interpretado: el id de 11 caracteres y el segundo de inicio (0 = desde el principio). */
export interface ParsedYouTubeUrl {
  id: string;
  startSeconds: number;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const NOCOOKIE_HOSTS = new Set(['youtube-nocookie.com', 'www.youtube-nocookie.com']);
const SHORT_HOST = 'youtu.be';
// 99 horas: un inicio mayor es un dato corrupto, no un video real.
const MAX_START_SECONDS = 99 * 3600 + 59 * 60 + 59;

/** `90`, `90s`, `1m30s`, `1h2m3s`; todo lo demás (incluido 0) se ignora. */
function parseStart(value: string | null): number {
  if (value === null) {
    return 0;
  }
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(value);
  if (!match || value === '') {
    return 0;
  }
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= MAX_START_SECONDS ? seconds : 0;
}

/** Segmentos de la ruta; una barra final no cuenta (`/embed/<id>/` equivale a `/embed/<id>`). */
function segmentsOf(url: URL): string[] {
  const parts = url.pathname.split('/').slice(1);
  if (parts.length > 1 && parts[parts.length - 1] === '') {
    parts.pop();
  }
  return parts;
}

function idFor(host: string, url: URL): string | null {
  const segments = segmentsOf(url);
  if (host === SHORT_HOST) {
    return segments.length === 1 ? (segments[0] ?? null) : null;
  }
  if (NOCOOKIE_HOSTS.has(host)) {
    return segments.length === 2 && segments[0] === 'embed' ? (segments[1] ?? null) : null;
  }
  if (WATCH_HOSTS.has(host)) {
    if (segments.length === 1 && segments[0] === 'watch') {
      return url.searchParams.get('v');
    }
    if (segments.length === 2 && (segments[0] === 'embed' || segments[0] === 'shorts')) {
      return segments[1] ?? null;
    }
  }
  return null;
}

/**
 * Interpreta un enlace de YouTube. Solo `https`, solo los dominios de YouTube y solo las formas
 * `watch?v=`, `youtu.be/`, `embed/` y `shorts/`; cualquier otra cosa devuelve `null`.
 * Un inicio (`t=` o `start=`) inválido o 0 se ignora y no invalida el enlace.
 */
export function parseYouTubeUrl(value: string): ParsedYouTubeUrl | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.port !== '') {
    return null;
  }
  const id = idFor(url.hostname.toLowerCase(), url);
  if (id === null || !VIDEO_ID.test(id)) {
    return null;
  }
  const start = parseStart(url.searchParams.get('start') ?? url.searchParams.get('t'));
  return { id, startSeconds: start };
}

/** Enlace de inserción sin cookies de seguimiento hasta que el docente reproduce. */
export function toYouTubeEmbedUrl(parsed: ParsedYouTubeUrl): string {
  const base = `https://www.youtube-nocookie.com/embed/${parsed.id}`;
  return parsed.startSeconds > 0 ? `${base}?start=${parsed.startSeconds}` : base;
}

/** Origen del video de un módulo: enlace de YouTube o archivo subido (nunca ambos, R6). */
export const VideoSource = {
  YouTube: 'youtube',
  File: 'archivo',
} as const;
export type VideoSource = (typeof VideoSource)[keyof typeof VideoSource];

export interface ModuleVideoDescription {
  videoSource: VideoSource | null;
  /** Solo con origen YouTube. Un enlace guardado que no se pueda interpretar da `null`: el cliente muestra el original. */
  videoEmbedUrl: string | null;
}

/** Origen y enlace de inserción del video de un módulo (R28). */
export function describeModuleVideo(
  videoUrl: string | null,
  hasVideoFile: boolean,
): ModuleVideoDescription {
  if (videoUrl !== null) {
    const parsed = parseYouTubeUrl(videoUrl);
    return {
      videoSource: VideoSource.YouTube,
      videoEmbedUrl: parsed ? toYouTubeEmbedUrl(parsed) : null,
    };
  }
  return {
    videoSource: hasVideoFile ? VideoSource.File : null,
    videoEmbedUrl: null,
  };
}
