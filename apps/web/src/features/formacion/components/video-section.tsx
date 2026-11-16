'use client';

import { VideoSource, type TeacherModule } from '@gns/shared';
import { useRef, useState } from 'react';

import type { ApiError } from '@/shared/api';
import { LoadError, Loading, useRemote } from '@/shared/data';
import { ButtonLink, YouTubeEmbed, youTubeEmbedSrc } from '@/shared/ui';

import { getModuleFileUrl } from '../api/route';
import { MarkControls } from './mark-controls';
import styles from './media.module.css';

/**
 * Video archivado: la API da una URL firmada con caducidad. Si el reproductor falla (la URL pudo
 * vencer) se pide otra una sola vez por interrupción y se retoma en el mismo segundo.
 */
function FileVideo({
  module,
  viewed,
  onMark,
}: {
  module: TeacherModule;
  viewed: boolean;
  onMark: () => Promise<ApiError | null>;
}) {
  const { state, reload, refresh } = useRemote(
    () => getModuleFileUrl(module.id, 'video'),
    `video-url:${module.id}`,
  );
  const player = useRef<HTMLVideoElement>(null);
  const resumeAt = useRef(0);
  const wasPlaying = useRef(false);
  const renewed = useRef(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

  async function renew() {
    if (renewed.current) {
      setFailure({
        statusCode: 0,
        code: 'error_red',
        message: 'No pudimos reproducir el video. Inténtalo de nuevo.',
      });
      return;
    }
    renewed.current = true;
    resumeAt.current = player.current?.currentTime ?? resumeAt.current;
    wasPlaying.current = player.current ? !player.current.paused : false;
    const error = await refresh();
    if (error) {
      setFailure(error);
    }
  }

  function retry() {
    setFailure(null);
    renewed.current = false;
    reload();
  }

  if (state.status === 'loading') {
    return <Loading>Preparando el video…</Loading>;
  }
  if (state.status === 'error') {
    return <LoadError error={state.error} title="No pudimos preparar el video" onRetry={reload} />;
  }

  return (
    <>
      <video
        ref={player}
        className={styles.video}
        src={state.data.url}
        controls
        preload="metadata"
        aria-label={module.videoTitle ?? `Video del módulo ${module.title}`}
        onTimeUpdate={(event) => {
          resumeAt.current = event.currentTarget.currentTime;
        }}
        onPlaying={() => {
          renewed.current = false;
        }}
        onLoadedMetadata={(event) => {
          const element = event.currentTarget;
          if (resumeAt.current > 0 && Math.abs(element.currentTime - resumeAt.current) > 0.5) {
            element.currentTime = resumeAt.current;
            if (wasPlaying.current) {
              void element.play().catch(() => undefined);
            }
          }
        }}
        onEnded={() => void onMark()}
        onError={() => void renew()}
      />
      {failure ? (
        <LoadError error={failure} title="No pudimos reproducir el video" onRetry={retry} />
      ) : null}
      <MarkControls
        viewed={viewed}
        label="Marcar como visto"
        doneLabel="Video visto"
        onMark={onMark}
      />
    </>
  );
}

/** Sección «Video»: YouTube (incrustado) y los archivos se reproducen dentro de la plataforma. */
export function VideoSection({
  module,
  onMark,
}: {
  module: TeacherModule;
  onMark: () => Promise<ApiError | null>;
}) {
  const viewed = module.progress.videoViewedAt !== null;

  if (module.videoSource === VideoSource.File) {
    return <FileVideo module={module} viewed={viewed} onMark={onMark} />;
  }
  const embedSrc = youTubeEmbedSrc(module.videoEmbedUrl, module.videoUrl);
  return (
    <>
      {embedSrc ? (
        <>
          {module.videoTitle ? (
            <p className={styles.text}>
              <strong>{module.videoTitle}</strong>
            </p>
          ) : null}
          <YouTubeEmbed
            src={embedSrc}
            title={module.videoTitle ?? `Video del módulo ${module.title}`}
          />
          <p className={styles.text}>Cuando lo termines, márcalo como visto.</p>
        </>
      ) : (
        <p className={styles.text}>
          {module.videoTitle ? <strong>{module.videoTitle}. </strong> : null}
          Se abre en YouTube, en otra pestaña. Cuando lo termines, vuelve aquí y márcalo como visto.
        </p>
      )}
      {module.videoUrl ? (
        <div className={styles.actions}>
          <ButtonLink
            href={module.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant={embedSrc ? 'outline' : 'primary'}
            endIcon="externo"
          >
            {embedSrc ? 'Ver en YouTube' : 'Ver el video en YouTube'}
          </ButtonLink>
        </div>
      ) : null}
      <MarkControls
        viewed={viewed}
        label="Marcar como visto"
        doneLabel="Video visto"
        onMark={onMark}
      />
    </>
  );
}
