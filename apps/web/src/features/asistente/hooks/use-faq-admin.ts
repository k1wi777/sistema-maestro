'use client';

import type { FaqAdminView, UnansweredQuestion } from '@gns/shared';

import { useRemote, type Remote } from '@/shared/data';

import { listAllFaqs, listPendingQuestions } from '../api/faq-admin';

/** Todas las preguntas programadas, activas e inactivas. */
export function useAdminFaqs(): Remote<FaqAdminView[]> {
  return useRemote(listAllFaqs, 'faq-admin');
}

/** Preguntas sin respuesta pendientes. */
export function usePendingQuestions(): Remote<UnansweredQuestion[]> {
  return useRemote(listPendingQuestions, 'faq-pending');
}
