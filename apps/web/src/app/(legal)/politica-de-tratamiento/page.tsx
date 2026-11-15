import type { Metadata } from 'next';

import { LegalDocumentScreen } from '@/features/legal';
import { LEGAL_DOCUMENTS_VERSION, PRIVACY_POLICY } from '@/shared/legal';

export const metadata: Metadata = { title: PRIVACY_POLICY.title };

export default function PrivacyPolicyPage() {
  return <LegalDocumentScreen document={PRIVACY_POLICY} version={LEGAL_DOCUMENTS_VERSION} />;
}
