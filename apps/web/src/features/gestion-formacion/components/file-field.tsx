'use client';

import type { ModuleFilePurpose, ModuleFileSummary } from '@gns/shared';
import { useState } from 'react';

import { Button, Field, Notice } from '@/shared/ui';

import { useFileUpload } from '../hooks/use-file-upload';
import type { ModuleEditor } from '../hooks/use-module-editor';
import {
  ACCEPTED_FORMATS,
  acceptAttribute,
  formatFileSize,
  maxMegabytes,
} from '../model/file-check';
import styles from './steps/steps.module.css';

interface FileFieldProps {
  editor: ModuleEditor;
  purpose: ModuleFilePurpose;
  label: string;
  /** Archivo guardado en el módulo, si hay. */
  current: ModuleFileSummary | null;
  removeLabel: string;
}

/**
 * Selector de archivo del módulo: rechaza lo que no cumple antes de subir, muestra el archivo
 * actual (nombre y tamaño) y permite quitarlo. Subir uno nuevo reemplaza al anterior.
 */
export function FileField({ editor, purpose, label, current, removeLabel }: FileFieldProps) {
  const uploader = useFileUpload(editor, purpose);
  // Cambia la clave del input para poder volver a elegir el mismo archivo tras un rechazo.
  const [inputKey, setInputKey] = useState(0);

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }
    void uploader.upload(file).then(() => setInputKey((key) => key + 1));
  }

  return (
    <div className={styles.fields}>
      {current ? (
        <div className={styles.file}>
          <div>
            <p className={styles.fileName}>{current.name ?? 'Archivo sin nombre'}</p>
            <p className={styles.fileMeta}>{formatFileSize(current.size)}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={uploader.busy !== null}
            onClick={() => void uploader.remove()}
          >
            {uploader.busy === 'removing' ? 'Quitando…' : removeLabel}
          </Button>
        </div>
      ) : null}
      <Field
        label={current ? `${label} (reemplaza al actual)` : label}
        help={`${ACCEPTED_FORMATS[purpose]}, de hasta ${maxMegabytes(purpose)} MB.`}
        error={uploader.error ?? undefined}
      >
        {(control) => (
          <input
            {...control}
            key={inputKey}
            type="file"
            className={styles.fileInput}
            accept={acceptAttribute(purpose)}
            disabled={uploader.busy !== null}
            onChange={(event) => onPick(event.target.files)}
          />
        )}
      </Field>
      {uploader.busy === 'uploading' ? (
        <Notice tone="info">
          <span aria-busy="true">Subiendo el archivo… No cierres esta pantalla.</span>
        </Notice>
      ) : null}
    </div>
  );
}
