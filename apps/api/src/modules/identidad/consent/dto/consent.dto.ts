import { acceptConsentSchema, consentStatusSchema, dataConsentSchema } from '@gns/shared';
import { createZodDto } from '../../../../shared/http/zod-dto';

export class AcceptConsentDto extends createZodDto(acceptConsentSchema) {}
export class ConsentStatusDto extends createZodDto(consentStatusSchema, { codec: true }) {}
export class DataConsentDto extends createZodDto(dataConsentSchema, { codec: true }) {}
