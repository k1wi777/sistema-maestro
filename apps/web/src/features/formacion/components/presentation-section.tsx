'use client';

import { PPTX_CONTENT_TYPE, type TeacherModule } from '@gns/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError } from '@/shared/api';
import { LoadError, Loading, useRemote } from '@/shared/data';
import { DeckFrame, PDF_CONTENT_TYPE, PdfDeck } from '@/shared/presentation';
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
 * Marca de «presentación revisada»: se envía una sola vez por visita y un fallo se muestra con
 * reintento. La comparten el visor de diapositivas y el de PDF.
 */
function useReviewMark(onMark: () => Promise<ApiError | null>) {
  const [error, setError] = useState<ApiError | null>(null);
  const [marking, setMarking] = useState(false);
  const sent = useRef(false);

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

  /** Marca la primera vez que se llama; las siguientes no hacen nada. */
  const markOnce = useCallback(() => {
    if (!sent.current) {
      sent.current = true;
      void markRef.current();
    }
  }, []);

  return { error, marking, mark, markOnce };
}

/**
 * Visor de diapositivas sobre el marco común (flechas, «Anterior», «Siguiente», «Diapositiva n de
 * m» y pantalla completa). Al mostrar la última se marca la presentación como revisada.
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
  const { error, marking, mark, markOnce } = useReviewMark(onMark);
  const last = slides.length - 1;
  const slide = slides[index];

  useEffect(() => {
    if (index === last && !viewed) {
      markOnce();
    }
  }, [index, last, viewed, markOnce]);

  if (!slide) {
    return null;
  }
  return (
    <DeckFrame
      name={title}
      index={index}
      total={slides.length}
      counterLabel={`Diapositiva ${index + 1} de ${slides.length}`}
      onGo={setIndex}
      below={
        <>
          {viewed ? (
            <div className={styles.actions}>
              <StatusBadge tone="success">Presentación revisada</StatusBadge>
            </div>
          ) : null}
          {error ? <MarkError error={error} busy={marking} onRetry={() => void mark()} /> : null}
        </>
      }
    >
      {(fullscreen) => (
        <article className={fullscreen ? `${styles.slide} ${styles.slideFull}` : styles.slide}>
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
      )}
    </DeckFrame>
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

/** Imagen dentro de la plataforma, con la URL de visualización pedida al abrir. */
function ImageFile({ module, name }: { module: TeacherModule; name: string }) {
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
  // La URL firmada es de otro origen y caduca: `next/image` no aporta nada aquí.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.image} src={state.data.url} alt={`Presentación: ${name}`} />;
}

/**
 * PDF como diapositivas. Si es la presentación del módulo (`markable`), llegar a la última página
 * la marca como revisada y, si el visor falla, queda la marca manual; como material complementario
 * de unas diapositivas no marca nada (esa marca la da el visor de diapositivas).
 */
function PdfPresentation({
  module,
  name,
  fileId,
  viewed,
  onMark,
  markable,
}: {
  module: TeacherModule;
  name: string;
  fileId: string;
  viewed: boolean;
  onMark: () => Promise<ApiError | null>;
  markable: boolean;
}) {
  const { error, marking, mark, markOnce } = useReviewMark(onMark);
  return (
    <>
      <PdfDeck
        name={name}
        sourceKey={`presentation:${module.id}:${fileId}`}
        fetchUrl={() => getModuleFileUrl(module.id, 'presentacion')}
        onLastPage={markable && !viewed ? markOnce : undefined}
        errorExtra={
          markable ? (
            <MarkControls
              viewed={viewed}
              label="Marcar como revisada"
              doneLabel="Presentación revisada"
              onMark={onMark}
            />
          ) : undefined
        }
      />
      {markable && viewed ? (
        <div className={styles.actions}>
          <StatusBadge tone="success">Presentación revisada</StatusBadge>
        </div>
      ) : null}
      {markable && error ? (
        <MarkError error={error} busy={marking} onRetry={() => void mark()} />
      ) : null}
    </>
  );
}

/** Archivo de la presentación: PDF como diapositivas, imagen en la plataforma y PPTX como descarga. */
function FilePresentation({
  module,
  viewed,
  onMark,
  markable,
}: {
  module: TeacherModule;
  viewed: boolean;
  onMark: () => Promise<ApiError | null>;
  markable: boolean;
}) {
  const file = module.presentationFile;
  if (!file) {
    return null;
  }
  const name = file.name ?? 'Presentación';
  if (file.contentType === PPTX_CONTENT_TYPE) {
    return <PptxDownload module={module} name={name} />;
  }
  if (file.contentType.startsWith('image/')) {
    return <ImageFile module={module} name={name} />;
  }
  return (
    <PdfPresentation
      module={module}
      name={name}
      fileId={file.id}
      viewed={viewed}
      onMark={onMark}
      markable={markable}
    />
  );
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
  // Un PDF se marca solo al llegar al final (y, si falla, con su propia marca manual); el resto
  // de materiales, con el botón de siempre.
  const isPdf = module.presentationFile?.contentType === PDF_CONTENT_TYPE;

  return (
    <>
      {hasSlides ? (
        <SlideDeck title={module.title} slides={module.slides} viewed={viewed} onMark={onMark} />
      ) : null}
      {hasMaterial ? (
        <div className={hasSlides ? styles.complement : undefined}>
          {hasSlides ? <p className={styles.text}>Material complementario</p> : null}
          {module.presentationFile ? (
            <FilePresentation
              module={module}
              viewed={viewed}
              onMark={onMark}
              markable={!hasSlides}
            />
          ) : null}
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
          {!hasSlides && !isPdf ? (
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
