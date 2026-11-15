'use client';

import { useSearchParams } from 'next/navigation';

import { NewLessonPlan } from './new-lesson-plan';

/** Lee `?actividad=<id>` de la URL y abre el formulario de una planeación nueva. */
export function NewLessonPlanScreen() {
  const params = useSearchParams();
  return <NewLessonPlan activityId={params.get('actividad')} />;
}
