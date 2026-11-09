import {
  createListQuerySchema,
  createPageSchema,
  idParamSchema,
  isoDateTimeSchema,
  queryBoolean,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { FAQ_EXAMPLE_SORT_FIELDS } from './faq-example.repository';

export const faqExampleSchema = z.object({
  id: z.uuid(),
  category: z.string(),
  question: z.string(),
  answer: z.string(),
  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
});

const faqExampleListQuery = createListQuerySchema({
  sortFields: FAQ_EXAMPLE_SORT_FIELDS,
  defaultSort: { field: 'createdAt', order: 'desc' },
  filters: { category: z.string().min(1).optional(), isActive: queryBoolean.optional() },
});

const faqExampleFields = z.object({
  category: z.string().min(1).max(40),
  question: z.string().min(1).max(200),
  answer: z.string().min(1),
  isActive: z.boolean(),
});
// Sin defaults en el esquema de edición: un PATCH vacío no debe reponer valores.
const createSchema = faqExampleFields.extend({ isActive: z.boolean().default(false) }).strict();
const updateSchema = faqExampleFields.partial().strict();

export class FaqExampleDto extends createZodDto(faqExampleSchema, { codec: true }) {}
export class FaqExamplePageDto extends createZodDto(createPageSchema(faqExampleSchema), {
  codec: true,
}) {}
export class FaqExampleListQueryDto extends createZodDto(faqExampleListQuery) {}
export class IdParamDto extends createZodDto(idParamSchema) {}
export class CreateFaqExampleDto extends createZodDto(createSchema) {}
export class UpdateFaqExampleDto extends createZodDto(updateSchema) {}
