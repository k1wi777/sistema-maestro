import { acceptConsentSchema, consentStatusSchema, dataConsentSchema } from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class AcceptConsentDto extends createZodDto(acceptConsentSchema) {}
export class ConsentStatusDto extends createZodDto(consentStatusSchema, { codec: true }) {}
export class DataConsentDto extends createZodDto(dataConsentSchema, { codec: true }) {}
