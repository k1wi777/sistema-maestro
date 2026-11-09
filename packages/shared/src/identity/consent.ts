import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { DataConsentItem } from '../constants/data-consent';

const MAX_POLICY_VERSION = 20;

const checkedBox = z.literal(true, { error: 'debe marcarse' });

/** Aceptación del aviso: la versión vista y las cuatro casillas, todas marcadas. */
export const acceptConsentSchema = z
  .object({
    policyVersion: z
      .string({ error: 'debe ser texto' })
      .min(1, 'no puede estar vacía')
      .max(MAX_POLICY_VERSION, `debe tener como máximo ${MAX_POLICY_VERSION} caracteres`),
    items: z
      .object({
        policy: checkedBox,
        authorization: checkedBox,
        minors: checkedBox,
        security: checkedBox,
      })
      .strict(),
  })
  .strict();
export type AcceptConsentInput = z.output<typeof acceptConsentSchema>;

/** Estado del aviso vigente para el usuario de la sesión. */
export const consentStatusSchema = z.object({
  policyVersion: z.string(),
  accepted: z.boolean(),
  acceptedAt: isoDateTimeSchema.nullable(),
});
export type ConsentStatus = z.output<typeof consentStatusSchema>;

export const dataConsentSchema = z.object({
  id: z.uuid(),
  policyVersion: z.string(),
  acceptedAt: isoDateTimeSchema,
  items: z.array(z.enum(Object.values(DataConsentItem) as [DataConsentItem, ...DataConsentItem[]])),
});
export type DataConsent = z.output<typeof dataConsentSchema>;
