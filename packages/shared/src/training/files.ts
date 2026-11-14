import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { StoredFilePurpose } from '../constants/training';
import { shortText } from '../training-activities/common';

/** Propósito de un archivo de módulo en la API (en la base: `StoredFilePurpose`). */
export const ModuleFilePurpose = {
  Video: 'video',
  Presentation: 'presentacion',
} as const;
export type ModuleFilePurpose = (typeof ModuleFilePurpose)[keyof typeof ModuleFilePurpose];

const MEGABYTE = 1024 * 1024;

export const PPTX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export interface ModuleFilePolicy {
  /** Propósito con el que se guarda el objeto. */
  storedPurpose: StoredFilePurpose;
  /** Tipos de contenido permitidos. */
  contentTypes: readonly string[];
  maxBytes: number;
}

/** Tipos y tamaños permitidos por propósito. Un archivo por propósito y módulo. */
export const MODULE_FILE_POLICY: Record<ModuleFilePurpose, ModuleFilePolicy> = {
  [ModuleFilePurpose.Video]: {
    storedPurpose: StoredFilePurpose.ModuleVideo,
    contentTypes: ['video/mp4', 'video/webm'],
    maxBytes: 500 * MEGABYTE,
  },
  [ModuleFilePurpose.Presentation]: {
    storedPurpose: StoredFilePurpose.ModulePresentation,
    contentTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', PPTX_CONTENT_TYPE],
    maxBytes: 50 * MEGABYTE,
  },
};

/** El navegador no muestra un PPTX: solo se ofrece como descarga; el resto se ve dentro del módulo. */
export function dispositionForContentType(contentType: string): 'inline' | 'attachment' {
  return contentType === PPTX_CONTENT_TYPE ? 'attachment' : 'inline';
}

/** Valida tipo y tamaño de un archivo contra la política de su propósito; devuelve el motivo o `null`. */
export function moduleFileViolation(
  purpose: ModuleFilePurpose,
  contentType: string,
  size: number,
): { field: 'contentType' | 'size'; reason: string } | null {
  const policy = MODULE_FILE_POLICY[purpose];
  if (!policy.contentTypes.includes(contentType)) {
    return { field: 'contentType', reason: 'tipo de archivo no permitido' };
  }
  if (size > policy.maxBytes) {
    return {
      field: 'size',
      reason: `supera el máximo de ${Math.round(policy.maxBytes / MEGABYTE)} MB`,
    };
  }
  return null;
}

const purposeEnum = z.enum(
  Object.values(ModuleFilePurpose) as [ModuleFilePurpose, ...ModuleFilePurpose[]],
  {
    error: 'debe ser video o presentacion',
  },
);

/** `:purpose` de las rutas de archivos de módulo. */
export const moduleFilePurposeParamSchema = z.object({ purpose: purposeEnum });

export const moduleFileParamsSchema = z.object({
  id: z.uuid({ error: 'debe ser un UUID' }),
  purpose: purposeEnum,
});

export const confirmModuleFileParamsSchema = z.object({
  id: z.uuid({ error: 'debe ser un UUID' }),
  fileId: z.uuid({ error: 'debe ser un UUID' }),
});

export const teacherModuleFileParamsSchema = z.object({
  moduleId: z.uuid({ error: 'debe ser un UUID' }),
  purpose: purposeEnum,
});

/** Solicitud de subida: la política se aplica antes de tocar la base de datos (R2). */
export const requestModuleFileUploadSchema = z
  .strictObject({
    purpose: purposeEnum,
    name: shortText(160),
    contentType: z.string({ error: 'debe ser texto' }).trim().min(1).max(100),
    size: z
      .number({ error: 'debe ser un número' })
      .int({ error: 'debe ser un entero' })
      .positive({ error: 'debe ser mayor que cero' }),
  })
  .superRefine((value, ctx) => {
    const violation = moduleFileViolation(value.purpose, value.contentType, value.size);
    if (violation) {
      ctx.addIssue({ code: 'custom', path: [violation.field], message: violation.reason });
    }
  });
export type RequestModuleFileUploadInput = z.output<typeof requestModuleFileUploadSchema>;

export const moduleFileSummarySchema = z.strictObject({
  id: z.uuid(),
  name: z.string().nullable(),
  contentType: z.string(),
  size: z.number().int(),
});
export type ModuleFileSummary = z.output<typeof moduleFileSummarySchema>;

export const moduleFileUploadResultSchema = z.strictObject({
  fileId: z.uuid(),
  upload: z.strictObject({
    url: z.url(),
    method: z.literal('PUT'),
    headers: z.record(z.string(), z.string()),
    expiresAt: isoDateTimeSchema,
  }),
});
export type ModuleFileUploadResult = z.output<typeof moduleFileUploadResultSchema>;

/** URL firmada con su caducidad (descarga o visualización). */
export const signedUrlSchema = z.strictObject({
  url: z.url(),
  expiresAt: isoDateTimeSchema,
});
export type SignedUrlResult = z.output<typeof signedUrlSchema>;
