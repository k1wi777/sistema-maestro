import {
  createGroupSchema,
  createPageSchema,
  groupListQuerySchema,
  groupSchema,
  updateGroupSchema,
} from '@gns/shared';
import { createZodDto } from '../../../../../shared/http/zod-dto';

export class GroupDto extends createZodDto(groupSchema, { codec: true }) {}
export class GroupPageDto extends createZodDto(createPageSchema(groupSchema), { codec: true }) {}
export class GroupListQueryDto extends createZodDto(groupListQuerySchema) {}
export class CreateGroupDto extends createZodDto(createGroupSchema) {}
export class UpdateGroupDto extends createZodDto(updateGroupSchema) {}
