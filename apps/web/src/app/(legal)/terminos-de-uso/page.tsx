import type { Metadata } from 'next';

import { LegalDocumentScreen } from '@/features/legal';
import { LEGAL_DOCUMENTS_VERSION, TERMS_OF_USE } from '@/shared/legal';

export const metadata: Metadata = { title: TERMS_OF_USE.title };

export default function TermsOfUsePage() {
  return <LegalDocumentScreen document={TERMS_OF_USE} version={LEGAL_DOCUMENTS_VERSION} />;
}
