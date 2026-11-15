'use client';

import { PPTX_CONTENT_TYPE, type TeacherModule } from '@gns/shared';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import type { ApiError } from '@/shared/api';
import { LoadError, Loading, useRemote } from '@/shared/data';
import { Button, ButtonLink, StatusBadge } from '@/shared/ui';

import { getModuleFileUrl } from '../api/route';
import { MarkControls, MarkError } from './mark-controls';
import styles from './media.module.css';

type Slide = TeacherModule['slides'][number];

/** Las ideas clave llegan como texto: cada línea es una idea. */
const ideasOf = (slide: Slide): string[] =>
  (slide.keyIdeas ?? '')
    .split('\n')
    .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
    .filter((line) => line.length > 0);

/**
 * Visor de diapositivas con «Anterior», «Siguiente» y «Diapositiva n de m». Al mostrar la última
 * se marca la presentación como revisada, una sola vez por visita. Un fallo de la marca se
 * muestra con reintento.
 */
function SlideDeck({
  title,
  slides,
  viewed,
  onMark,
}: {
  title: string;
  slides: Slide[];
  viewed: boolean;
  onMark: () => Promise<ApiError | null>;
}) {
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [marking, setMarking] = useState(false);
  const sent = useRef(false);
  const last = slides.length - 1;
  const slide = slides[index];

  async function mark() {
    setMarking(true);
    setError(null);
    setError(await onMark());
    setMarking(false);
  }

  const markRef = useRef(mark);
  useEffect(() => {
    markRef.current = mark;
  });

  useEffect(() => {
    if (index === last && !viewed && !sent.current) {
      sent.current = true;
      void markRef.current();
    }
  }, [index, last, viewed]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      setIndex((current) => Math.min(last, current + 1));
    } else if (event.key === 'ArrowLeft') {
      setIndex((current) => Math.max(0, current - 1));
    }
  }

  if (!slide) {
    return null;
  }
  return (
    <div
      className={styles.deck}
      tabIndex={0}
      role="group"
      aria-label="Presentación sugerida; usa las flechas del teclado para avanzar"
      onKeyDown={onKeyDown}
    >
      <article className={styles.slide} aria-live="polite">
        <div className={styles.slideHead}>
          <span>{title}</span>
          <span>{`${index + 1} / ${slides.length}`}</span>
        </div>
        <h3 className={styles.slideTitle}>{slide.title ?? `Diapositiva ${index + 1}`}</h3>
        <ul className={styles.slideIdeas}>
          {ideasOf(slide).map((idea) => (
            <li key={idea}>{idea}</li>
          ))}
        </ul>
        <span className={styles.slideBar} aria-hidden="true" />
      </article>
      <div className={styles.controls}>
        <Button
          variant="outline"
          size="sm"
          startIcon="volver"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          Anterior
        </Button>
        <span className={styles.count}>{`Diapositiva ${index + 1} de ${slides.length}`}</span>
        <Button
          variant="secondary"
          size="sm"
          endIcon="siguiente"
          disabled={index === last}
          onClick={() => setIndex(index + 1)}
        >
          Siguiente
        </Button>
      </div>
      {viewed ? (
        <div className={styles.actions}>
          <StatusBadge tone="success">Presentación revisada</StatusBadge>
        </div>
      ) : null}
      {error ? <MarkError error={error} busy={marking} onRetry={() => void mark()} /> : null}
    </div>
  );
}

/**
 * PPTX: solo se descarga. La URL se pide al pulsar (caduca pronto), así que no se pide al abrir la
 * sección ni llega vencida.
 */
function PptxDownload({ module, name }: { module: TeacherModule; name: string }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

  async function download() {
    setBusy(true);
    setFailure(null);
    const result = await getModuleFileUrl(module.id, 'presentacion');
    setBusy(false);
    if (result.ok) {
      window.location.assign(result.data.url);
    } else {
      setFailure(result.error);
    }
  }

  return (
    <>
      <div className={styles.actions}>
        <Button startIcon="bajar" disabled={busy} onClick={() => void download()}>
          {busy ? 'Preparando…' : 'Descargar presentación'}
        </Button>
        <span className={styles.fileName}>{name}</span>
      </div>
      {failure ? (
        <MarkError
          error={failure}
          busy={busy}
          title="No pudimos descargar la presentación"
          onRetry={() => void download()}
        />
      ) : null}
    </>
  );
}

/** PDF o imagen dentro de la plataforma, con la URL de visualización pedida al abrir. */
function InlineFile({
  module,
  name,
  image,
}: {
  module: TeacherModule;
  name: string;
  image: boolean;
}) {
  const { state, reload } = useRemote(
    () => getModuleFileUrl(module.id, 'presentacion'),
    `presentation-url:${module.id}`,
  );

  if (state.status === 'loading') {
    return <Loading>Preparando la presentación…</Loading>;
  }
  if (state.status === 'error') {
    return (
      <LoadError error={state.error} title="No pudimos preparar la presentación" onRetry={reload} />
    );
  }
  const { url } = state.data;
  if (image) {
    // La URL firmada es de otro origen y caduca: `next/image` no aporta nada aquí.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.image} src={url} alt={`Presentación: ${name}`} />;
  }
  return <iframe className={styles.frame} src={url} title={`Presentación: ${name}`} />;
}

/** Archivo de la presentación: PDF o imagen dentro de la plataforma; PPTX como descarga. */
function FilePresentation({ module }: { module: TeacherModule }) {
  const file = module.presentationFile;
  if (!file) {
    return null;
  }
  const name = file.name ?? 'Presentación';
  if (file.contentType === PPTX_CONTENT_TYPE) {
    return <PptxDownload module={module} name={name} />;
  }
  return <InlineFile module={module} name={name} image={file.contentType.startsWith('image/')} />;
}

/** Sección «Presentación sugerida»: diapositivas, archivo o enlace, con su marca de revisada. */
export function PresentationSection({
  module,
  onMark,
}: {
  module: TeacherModule;
  onMark: () => Promise<ApiError | null>;
}) {
  const viewed = module.progress.presentationViewedAt !== null;
  const hasSlides = module.slides.length > 0;
  const hasMaterial = module.presentationFile !== null || module.presentationUrl !== null;

  return (
    <>
      {hasSlides ? (
        <SlideDeck title={module.title} slides={module.slides} viewed={viewed} onMark={onMark} />
      ) : null}
      {hasMaterial ? (
        <div className={hasSlides ? styles.complement : undefined}>
          {hasSlides ? <p className={styles.text}>Material complementario</p> : null}
          {module.presentationFile ? <FilePresentation module={module} /> : null}
          {module.presentationUrl ? (
            <div className={styles.actions}>
              <ButtonLink
                href={module.presentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                endIcon="externo"
              >
                Abrir la presentación
              </ButtonLink>
            </div>
          ) : null}
          {!hasSlides ? (
            <MarkControls
              viewed={viewed}
              label="Marcar como revisada"
              doneLabel="Presentación revisada"
              onMark={onMark}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
