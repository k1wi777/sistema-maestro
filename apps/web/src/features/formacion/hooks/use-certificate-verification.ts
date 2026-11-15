'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { verifyCertificate } from '../api/certificates';
import { toVerificationOutcome, type VerificationOutcome } from '../model/verification';

/**
 * Verificación pública de un código. Con un código inicial (`?codigo=`) lo verifica al abrir la
 * página, una sola vez; una respuesta que llega tarde (se verificó otro código después) se descarta.
 */
export function useCertificateVerification(initialCode: string) {
  const [outcome, setOutcome] = useState<VerificationOutcome>(
    initialCode ? { status: 'loading' } : { status: 'idle' },
  );
  const latest = useRef(0);
  const started = useRef(false);

  const verify = useCallback(async (code: string) => {
    const request = ++latest.current;
    setOutcome({ status: 'loading' });
    const result = await verifyCertificate(code.trim());
    if (request === latest.current) {
      setOutcome(toVerificationOutcome(result));
    }
  }, []);

  useEffect(() => {
    if (initialCode && !started.current) {
      started.current = true;
      void verify(initialCode);
    }
  }, [initialCode, verify]);

  return { outcome, verify };
}
