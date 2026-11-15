'use client';

import { LessonPlanEditor } from './lesson-plan-editor';

/** Punto de entrada de la página del editor: recibe el id de la ruta. */
export function LessonPlanEditorScreen({ id }: { id: string }) {
  return <LessonPlanEditor id={id} />;
}
