'use client';

import { PPTX_CONTENT_TYPE, VideoSource, type ModuleFilePurpose } from '@gns/shared';

import { LoadError, Loading, useRemote } from '@/shared/data';
import { ButtonLink, Card, Notice, StatusBadge } from '@/shared/ui';

import { fileUrl } from '../../api/files';
import { activeActivities, moduleContents } from '../../model/editor-steps';
import { ACTIVITY_TYPE_LABEL, moduleTitleWithNumber } from '../../model/labels';
import { keyIdeaLines } from '../../model/slide-form';
import styles from './steps.module.css';
import type { StepProps } from './step-types';

/** URL firmada del archivo del módulo, pedida al abrir la vista previa. */
function useModuleFileUrl(moduleId: string, purpose: ModuleFilePurpose, fileId: string) {
  return useRemote(
    () => fileUrl(moduleId, purpose),
    `gestion-formacion:preview:${moduleId}:${purpose}:${fileId}`,
  );
}

function VideoFile({
  moduleId,
  fileId,
  title,
}: {
  moduleId: string;
  fileId: string;
  title: string;
}) {
  const remote = useModuleFileUrl(moduleId, 'video', fileId);
  if (remote.state.status === 'loading') {
    return <Loading>Preparando el video…</Loading>;
  }
  if (remote.state.status === 'error') {
    return (
      <LoadError
        error={remote.state.error}
        title="No pudimos preparar el video"
        onRetry={remote.reload}
      />
    );
  }
  return (
    <video
      className={styles.video}
      src={remote.state.data.url}
      controls
      preload="metadata"
      aria-label={title}
    />
  );
}

function PresentationFile({
  moduleId,
  fileId,
  contentType,
}: {
  moduleId: string;
  fileId: string;
  contentType: string;
}) {
  const remote = useModuleFileUrl(moduleId, 'presentacion', fileId);
  if (remote.state.status === 'loading') {
    return <Loading>Preparando la presentación…</Loading>;
  }
  if (remote.state.status === 'error') {
    return (
      <LoadError
        error={remote.state.error}
        title="No pudimos preparar la presentación"
        onRetry={remote.reload}
      />
    );
  }
  return (
    <div>
      <ButtonLink
        href={remote.state.data.url}
        target="_blank"
        rel="noopener noreferrer"
        variant="outline"
        startIcon={contentType === PPTX_CONTENT_TYPE ? 'bajar' : 'externo'}
      >
        {contentType === PPTX_CONTENT_TYPE
          ? 'Descargar la presentación (PPTX)'
          : 'Abrir la presentación'}
      </ButtonLink>
    </div>
  );
}

/**
 * Paso «Vista previa» («Así lo verá el docente»): solo los pasos con contenido, en el orden en que
 * los recorre el docente. Es estática: no se juega el Desafío ni se guarda progreso, porque los
 * juegos se califican en el servidor solo para un docente con el módulo en su ruta.
 */
export function PreviewStep({ editor, number }: StepProps) {
  const { detail, tree } = editor;
  const contents = moduleContents(detail);
  const activities = activeActivities(detail);
  const section = tree.sections.find((item) => item.id === detail.sectionId);
  const hasAnything = Object.values(contents).some(Boolean);

  return (
    <Card title="Vista previa" step={number}>
      <Notice tone="info" title="Así lo verá el docente">
        La vista previa no se juega ni guarda progreso: es solo para revisar el contenido.
      </Notice>

      <div className={styles.previewHead}>
        <p className={styles.previewKicker}>
          {tree.plan.areaId === null && section ? section.title : tree.plan.name}
        </p>
        <h3 className={styles.previewTitle}>{moduleTitleWithNumber(detail)}</h3>
        {detail.summary ? <p className={styles.previewDescription}>{detail.summary}</p> : null}
      </div>

      {!hasAnything ? (
        <p className={styles.text}>
          Este módulo todavía no tiene contenidos: agrégalos en los pasos anteriores.
        </p>
      ) : null}

      {contents.video ? (
        <section className={styles.previewBlock} aria-labelledby="preview-video">
          <h4 id="preview-video" className={styles.previewBlockTitle}>
            {detail.videoTitle ?? 'Video'}
          </h4>
          {detail.videoSource === VideoSource.File && detail.videoFile ? (
            <VideoFile
              moduleId={detail.id}
              fileId={detail.videoFile.id}
              title={detail.videoTitle ?? `Video del módulo ${detail.title}`}
            />
          ) : detail.videoEmbedUrl ? (
            <iframe
              className={styles.frame}
              src={detail.videoEmbedUrl}
              title={detail.videoTitle ?? `Video del módulo ${detail.title}`}
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : detail.videoUrl ? (
            <div>
              <ButtonLink
                href={detail.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                endIcon="externo"
              >
                Ver el video
              </ButtonLink>
            </div>
          ) : null}
        </section>
      ) : null}

      {contents.challenge ? (
        <section className={styles.previewBlock} aria-labelledby="preview-challenge">
          <h4 id="preview-challenge" className={styles.previewBlockTitle}>
            Desafío GNS
          </h4>
          <p className={styles.text}>
            {detail.questions.length === 1 ? '1 pregunta' : `${detail.questions.length} preguntas`}.
            Para aprobar se necesita {detail.approvalThreshold}%. Las respuestas no se muestran
            aquí.
          </p>
        </section>
      ) : null}

      {contents.presentation ? (
        <section className={styles.previewBlock} aria-labelledby="preview-presentation">
          <h4 id="preview-presentation" className={styles.previewBlockTitle}>
            Presentación
          </h4>
          {detail.slides.length > 0 ? (
            <ol className={styles.slides}>
              {detail.slides.map((slide, index) => (
                <li key={slide.id} className={styles.slide}>
                  <span className={styles.slideNumber}>{`Diapositiva ${index + 1}`}</span>
                  {slide.title ? <h5 className={styles.slideTitle}>{slide.title}</h5> : null}
                  <ul className={styles.slideIdeas}>
                    {keyIdeaLines(slide.keyIdeas).map((line, position) => (
                      <li key={position}>{line}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          ) : null}
          {detail.presentationUrl ? (
            <div>
              <ButtonLink
                href={detail.presentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                endIcon="externo"
              >
                Abrir la presentación
              </ButtonLink>
            </div>
          ) : null}
          {detail.presentationFile ? (
            <PresentationFile
              moduleId={detail.id}
              fileId={detail.presentationFile.id}
              contentType={detail.presentationFile.contentType}
            />
          ) : null}
        </section>
      ) : null}

      {contents.activities ? (
        <section className={styles.previewBlock} aria-labelledby="preview-activities">
          <h4 id="preview-activities" className={styles.previewBlockTitle}>
            Actividades
          </h4>
          <ul className={styles.previewActivities}>
            {activities.map((activity) => (
              <li key={activity.id} className={styles.previewActivity}>
                <span>{activity.title}</span>
                <span className={styles.hint}>{ACTIVITY_TYPE_LABEL[activity.type]}</span>
                <StatusBadge tone={activity.isRequired ? 'info' : 'neutral'}>
                  {activity.isRequired ? 'Obligatoria' : 'Opcional'}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Card>
  );
}
