import { z } from 'zod';

const uuid = z.uuid({ error: 'debe ser un UUID' });

// Rutas anidadas de coordinación: `:id` es siempre el módulo (el padre que se audita).
export const slideParamsSchema = z.object({ id: uuid, slideId: uuid });
export const questionParamsSchema = z.object({ id: uuid, questionId: uuid });
export const activityParamsSchema = z.object({ id: uuid, activityId: uuid });

// Rutas del docente: sin `@Audited`, por eso llevan el nombre del recurso.
export const teacherModuleParamsSchema = z.object({ moduleId: uuid });
export const teacherActivityParamsSchema = z.object({ activityId: uuid });
