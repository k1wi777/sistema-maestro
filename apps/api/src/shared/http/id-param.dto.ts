import { idParamSchema } from '@gns/shared';
import { createZodDto } from './zod-dto';

/** Parámetro de ruta `:id` (UUID) para los endpoints de un recurso. */
export class IdParamDto extends createZodDto(idParamSchema) {}
