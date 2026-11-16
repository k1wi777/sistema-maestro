'use client';

import type { ModuleFilePurpose, TrainingModule } from '@gns/shared';
import { useCallback, useState } from 'react';

import type { ApiResult } from '@/shared/api';

import { confirmUpload, removeFile, requestUpload, uploadToStorage } from '../api/files';
import { fileProblem } from '../model/file-check';
import type { ModuleEditor } from './use-module-editor';

const MAX_NAME_LENGTH = 160;

export interface FileUpload {
  /** Subiendo o quitando: la navegación entre pasos está bloqueada mientras tanto. */
  busy: 'uploading' | 'removing' | null;
  /** Motivo del último rechazo (del archivo o de la API); `null` si no hay. */
  error: string | null;
  upload: (file: File) => Promise<void>;
  remove: () => Promise<void>;
  clearError: () => void;
}

/**
 * Subida de un archivo del módulo: valida tipo y tamaño antes de tocar la red, pide la URL firmada
 * a la API, sube el archivo al almacenamiento y confirma. El nuevo origen reemplaza al anterior
 * (la API suelta el enlace o el archivo que había). Sin barra de progreso: `fetch` no la ofrece.
 */
export function useFileUpload(editor: ModuleEditor, purpose: ModuleFilePurpose): FileUpload {
  const [busy, setBusy] = useState<FileUpload['busy']>(null);
  const [error, setError] = useState<string | null>(null);
  const { detail, track, mergeModule, setBusy: blockSteps } = editor;
  const moduleId = detail.id;

  const run = useCallback(
    async (
      phase: 'uploading' | 'removing',
      call: () => Promise<ApiResult<TrainingModule>>,
    ): Promise<void> => {
      setBusy(phase);
      blockSteps(true);
      setError(null);
      const result = await track(call);
      if (result.ok) {
        mergeModule(result.data);
      } else {
        setError(result.error.message);
      }
      blockSteps(false);
      setBusy(null);
    },
    [blockSteps, mergeModule, track],
  );

  const upload = useCallback(
    async (file: File): Promise<void> => {
      const problem = fileProblem(purpose, file);
      if (problem) {
        setError(problem);
        return;
      }
      await run('uploading', async () => {
        const requested = await requestUpload(moduleId, {
          purpose,
          name: file.name.slice(0, MAX_NAME_LENGTH),
          contentType: file.type,
          size: file.size,
        });
        if (!requested.ok) {
          return requested;
        }
        const stored = await uploadToStorage(requested.data.upload, file);
        if (!stored.ok) {
          return stored;
        }
        return confirmUpload(moduleId, requested.data.fileId);
      });
    },
    [moduleId, purpose, run],
  );

  const remove = useCallback(
    () => run('removing', () => removeFile(moduleId, purpose)),
    [moduleId, purpose, run],
  );

  const clearError = useCallback(() => setError(null), []);

  return { busy, error, upload, remove, clearError };
}
