import {
  moduleFileUploadResultSchema,
  signedUrlSchema,
  trainingModuleSchema,
  type ModuleFilePurpose,
  type ModuleFileUploadResult,
  type SignedUrlResult,
  type TrainingModule,
} from '@gns/shared';

import { api, callApi, networkError, parseResult, type ApiResult } from '@/shared/api';

/** Pide a la API la URL firmada de subida; la política de tipo y tamaño se aplica allí también. */
export async function requestUpload(
  moduleId: string,
  file: { purpose: ModuleFilePurpose; name: string; contentType: string; size: number },
): Promise<ApiResult<ModuleFileUploadResult>> {
  const result = await callApi(() =>
    api.POST('/training-modules/{id}/files', { params: { path: { id: moduleId } }, body: file }),
  );
  return parseResult(result, moduleFileUploadResultSchema);
}

/**
 * Sube el archivo directamente a la URL firmada con los encabezados que devolvió la API. Es la
 * única llamada fuera del cliente tipado: va a otro origen (el almacenamiento), sin cookies ni
 * credenciales. Un fallo de red o un rechazo del almacenamiento se normaliza a un error local.
 */
export async function uploadToStorage(
  upload: ModuleFileUploadResult['upload'],
  file: File,
): Promise<ApiResult<undefined>> {
  try {
    const response = await fetch(upload.url, {
      method: upload.method,
      headers: upload.headers,
      body: file,
      credentials: 'omit',
    });
    return response.ok ? { ok: true, data: undefined } : { ok: false, error: networkError() };
  } catch {
    return { ok: false, error: networkError() };
  }
}

/** La API comprueba el objeto subido y lo asocia al módulo (reemplaza el enlace o el archivo). */
export async function confirmUpload(
  moduleId: string,
  fileId: string,
): Promise<ApiResult<TrainingModule>> {
  const result = await callApi(() =>
    api.POST('/training-modules/{id}/files/{fileId}/confirm', {
      params: { path: { id: moduleId, fileId } },
    }),
  );
  return parseResult(result, trainingModuleSchema);
}

export async function removeFile(
  moduleId: string,
  purpose: ModuleFilePurpose,
): Promise<ApiResult<TrainingModule>> {
  const result = await callApi(() =>
    api.DELETE('/training-modules/{id}/files/{purpose}', {
      params: { path: { id: moduleId, purpose } },
    }),
  );
  return parseResult(result, trainingModuleSchema);
}

/** URL firmada y con caducidad para ver o descargar el archivo del módulo. */
export async function fileUrl(
  moduleId: string,
  purpose: ModuleFilePurpose,
): Promise<ApiResult<SignedUrlResult>> {
  const result = await callApi(() =>
    api.POST('/training-modules/{id}/files/{purpose}/url', {
      params: { path: { id: moduleId, purpose } },
    }),
  );
  return parseResult(result, signedUrlSchema);
}
