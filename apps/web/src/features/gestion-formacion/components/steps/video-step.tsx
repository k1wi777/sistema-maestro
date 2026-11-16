'use client';

import { useState } from 'react';

import { Button, Card, SegmentedFilter, TextInput } from '@/shared/ui';

import type { Confirmation } from '../../model/module-actions';
import { FileField } from '../file-field';
import { ModuleActionDialog } from '../module-action-dialog';
import styles from './steps.module.css';
import type { StepProps } from './step-types';

type VideoOrigin = 'enlace' | 'archivo';

const ORIGIN_OPTIONS = [
  { value: 'enlace' as const, label: 'Enlace' },
  { value: 'archivo' as const, label: 'Archivo' },
];

function switchConfirmation(to: VideoOrigin): Confirmation {
  return to === 'enlace'
    ? {
        title: '¿Cambiar a un enlace de YouTube?',
        description:
          'El video actual es un archivo. Cuando guardes el enlace, reemplaza al archivo; mientras tanto no se pierde nada.',
        confirmLabel: 'Cambiar a enlace',
      }
    : {
        title: '¿Cambiar a un archivo?',
        description:
          'El video actual es un enlace de YouTube. Cuando subas el archivo, reemplaza al enlace; mientras tanto no se pierde nada.',
        confirmLabel: 'Cambiar a archivo',
      };
}

/** Paso «Video»: un título y un origen, enlace de YouTube o archivo; el origen nuevo reemplaza al anterior. */
export function VideoStep({ editor, number }: StepProps) {
  const { detail, draft, errors } = editor;
  const hasFile = detail.videoFile !== null;
  const hasLink = detail.videoUrl !== null;
  const [origin, setOrigin] = useState<VideoOrigin>(hasFile ? 'archivo' : 'enlace');
  const [switchingTo, setSwitchingTo] = useState<VideoOrigin | null>(null);
  const [removing, setRemoving] = useState(false);

  function chooseOrigin(next: VideoOrigin) {
    if (next === origin) {
      return;
    }
    const leavingContent = origin === 'enlace' ? hasLink : hasFile;
    if (leavingContent) {
      setSwitchingTo(next);
    } else {
      setOrigin(next);
    }
  }

  async function removeLink() {
    setRemoving(true);
    editor.setField('videoUrl', '');
    await editor.saveFields(['videoUrl']);
    setRemoving(false);
  }

  return (
    <Card title="Video" step={number}>
      <div className={styles.fields}>
        <p className={styles.text}>
          El video es opcional. Puedes poner un enlace de YouTube o subir un archivo propio.
        </p>
        <TextInput
          label="Título del video"
          value={draft.videoTitle}
          error={errors.videoTitle}
          autoComplete="off"
          onChange={(event) => editor.setField('videoTitle', event.target.value)}
        />
        <SegmentedFilter
          label="Origen del video"
          options={ORIGIN_OPTIONS}
          value={origin}
          onChange={chooseOrigin}
        />
        {origin === 'enlace' ? (
          <>
            <TextInput
              label="Enlace de YouTube"
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={draft.videoUrl}
              error={errors.videoUrl}
              autoComplete="off"
              help={
                hasFile
                  ? 'Hay un archivo guardado: este enlace lo reemplaza cuando se guarda.'
                  : 'Pega un enlace de youtube.com o youtu.be.'
              }
              onChange={(event) => editor.setField('videoUrl', event.target.value)}
            />
            {hasLink ? (
              <div className={styles.row}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={removing || editor.busy}
                  onClick={() => void removeLink()}
                >
                  {removing ? 'Quitando…' : 'Quitar el video'}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {hasLink ? (
              <p className={styles.hint}>
                Hay un enlace de YouTube guardado: el archivo lo reemplaza al subirse.
              </p>
            ) : null}
            <FileField
              editor={editor}
              purpose="video"
              label="Archivo de video"
              current={detail.videoFile}
              removeLabel="Quitar el video"
            />
          </>
        )}
      </div>

      {switchingTo ? (
        <ModuleActionDialog
          confirmation={switchConfirmation(switchingTo)}
          variant="primary"
          busy={false}
          onClose={() => setSwitchingTo(null)}
          onConfirm={() => {
            setOrigin(switchingTo);
            setSwitchingTo(null);
          }}
        />
      ) : null}
    </Card>
  );
}
