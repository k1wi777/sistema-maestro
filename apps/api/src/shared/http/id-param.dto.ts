import { idParamSchema } from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

/** Parámetro de ruta `:id` (UUID) para los endpoints de un recurso. */
export class IdParamDto extends createZodDto(idParamSchema) {}
