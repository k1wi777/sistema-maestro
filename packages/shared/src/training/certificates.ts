import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { CertificateKind } from '../constants/training';

const kinds = Object.values(CertificateKind) as [CertificateKind, ...CertificateKind[]];

/** Certificado de un docente tal como lo ve él o coordinación: sin claves de objeto ni URL. */
export const certificateSummarySchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(kinds),
  title: z.string(),
  planName: z.string().nullable(),
  code: z.string(),
  issuedAt: isoDateTimeSchema,
});
export type CertificateSummary = z.output<typeof certificateSummarySchema>;

export const certificateListSchema = z.strictObject({
  items: z.array(certificateSummarySchema),
});
export type CertificateList = z.output<typeof certificateListSchema>;

/** Coordinación lista los certificados de un docente (`GET /training-certificates?teacherId=`). */
export const certificateListQuerySchema = z.strictObject({
  teacherId: z.uuid({ error: 'debe ser un UUID' }),
});
export type CertificateListQuery = z.output<typeof certificateListQuerySchema>;

/**
 * Código tal como lo escribe una persona: la forma y el formato se validan en el servicio, que
 * responde 404 igual que para un código inexistente (sin pistas), también si es demasiado largo.
 */
export const certificateCodeParamSchema = z.object({
  code: z.string().min(1),
});

/** Verificación pública: solo lo que ya muestra el PDF, sin ningún otro dato (R19). */
export const certificateVerificationSchema = z.strictObject({
  valid: z.literal(true),
  teacherName: z.string(),
  kind: z.enum(kinds),
  title: z.string(),
  planName: z.string().nullable(),
  issuedAt: isoDateTimeSchema,
});
export type CertificateVerification = z.output<typeof certificateVerificationSchema>;
