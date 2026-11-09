import { changePasswordSchema, currentUserSchema, loginSchema } from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class LoginDto extends createZodDto(loginSchema) {}
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
export class CurrentUserDto extends createZodDto(currentUserSchema) {}
