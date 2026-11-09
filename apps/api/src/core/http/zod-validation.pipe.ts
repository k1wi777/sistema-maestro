import { createZodValidationPipe } from 'nestjs-zod';
import type { z } from 'zod';
import { RequestValidationException } from './request-validation.exception';
import { toFieldErrors } from './zod-issues';

/** Pipe global: valida con el esquema del DTO `createZodDto` y responde con el formato común. */
export const AppZodValidationPipe = createZodValidationPipe({
  createValidationException: (error) =>
    new RequestValidationException(toFieldErrors((error as z.ZodError).issues)),
});
