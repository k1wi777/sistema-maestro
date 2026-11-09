import {
  createListQuerySchema,
  createPageSchema,
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  updateUserStatusSchema,
  userRoleSchema,
  userSchema,
  userStatusSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { USER_SORT_FIELDS } from '../user.repository';

const userListQuerySchema = createListQuerySchema({
  sortFields: USER_SORT_FIELDS,
  defaultSort: { field: 'fullName', order: 'asc' },
  filters: {
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
    search: z.string().trim().min(1).max(160).optional(),
  },
});

export class UserDto extends createZodDto(userSchema, { codec: true }) {}
export class UserPageDto extends createZodDto(createPageSchema(userSchema), { codec: true }) {}
export class UserListQueryDto extends createZodDto(userListQuerySchema) {}
export class CreateUserDto extends createZodDto(createUserSchema) {}
export class UpdateUserDto extends createZodDto(updateUserSchema) {}
export class UpdateUserStatusDto extends createZodDto(updateUserStatusSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
