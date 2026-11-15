import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CertificateVerificationScreen } from '@/features/formacion';

export const metadata: Metadata = { title: 'Verificar un certificado' };

export default function Page() {
  // useSearchParams (?codigo=) exige Suspense para poder prerenderizar la página.
  return (
    <Suspense>
      <CertificateVerificationScreen />
    </Suspense>
  );
}
