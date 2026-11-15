'use client';

import { useState, type SyntheticEvent } from 'react';

import { useQueryParams } from '@/shared/data';
import { formatDateTime } from '@/shared/format/dates';
import { Button, Card, Notice, PageContainer, PageHeader, TextInput } from '@/shared/ui';

import { useCertificateVerification } from '../hooks/use-certificate-verification';
import { CERTIFICATE_KIND_LABEL } from '../model/labels';
import type { VerificationOutcome } from '../model/verification';
import styles from './verification-screen.module.css';

function Outcome({ outcome, onRetry }: { outcome: VerificationOutcome; onRetry: () => void }) {
  switch (outcome.status) {
    case 'loading':
      return (
        <Notice tone="info">
          <span aria-busy="true">Verificando el código…</span>
        </Notice>
      );
    case 'not_found':
      return (
        <Notice tone="warning" title="No encontramos un certificado con ese código">
          Revisa que esté escrito tal como aparece en el certificado.
        </Notice>
      );
    case 'too_many':
      return (
        <Notice tone="warning" title="Demasiados intentos">
          Espera un momento antes de volver a intentarlo.
        </Notice>
      );
    case 'error':
      return (
        <Notice tone="error" title="No pudimos verificar el código">
          <p>{outcome.message}</p>
          <p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Reintentar
            </Button>
          </p>
        </Notice>
      );
    case 'found': {
      const { data } = outcome;
      return (
        <Card title="Certificado válido">
          <dl className={styles.facts}>
            <div>
              <dt>Nombre del docente</dt>
              <dd>{data.teacherName}</dd>
            </div>
            <div>
              <dt>Tipo de certificado</dt>
              <dd>{CERTIFICATE_KIND_LABEL[data.kind]}</dd>
            </div>
            <div>
              <dt>Título</dt>
              <dd>{data.title}</dd>
            </div>
            {data.planName ? (
              <div>
                <dt>Plan de formación</dt>
                <dd>{data.planName}</dd>
              </div>
            ) : null}
            <div>
              <dt>Fecha de emisión</dt>
              <dd>{formatDateTime(data.issuedAt)}</dd>
            </div>
          </dl>
        </Card>
      );
    }
    default:
      return null;
  }
}

/**
 * Verificación pública de un certificado por su código, sin sesión. Solo pinta lo que devuelve la
 * API (lo mismo que ya muestra el PDF). Acepta `?codigo=` para llegar con el código escrito.
 */
export function CertificateVerificationScreen() {
  const { params, update } = useQueryParams();
  const initialCode = params.get('codigo') ?? '';
  const { outcome, verify } = useCertificateVerification(initialCode);
  const [code, setCode] = useState(initialCode);
  const [lastCode, setLastCode] = useState(initialCode);

  function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (!value) {
      return;
    }
    setLastCode(value);
    update({ codigo: value });
    void verify(value);
  }

  return (
    <PageContainer>
      <PageHeader
        context="Plan de formación docente"
        title="Verificar un certificado"
        description="Escribe el código que aparece en el certificado para comprobar que es auténtico."
      />
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextInput
          label="Código del certificado"
          help="Tiene la forma XXXX-XXXX-XXXX-XXXX."
          name="codigo"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <Button type="submit" disabled={code.trim() === '' || outcome.status === 'loading'}>
          Verificar
        </Button>
      </form>
      <div className={styles.result} aria-live="polite">
        <Outcome outcome={outcome} onRetry={() => void verify(lastCode)} />
      </div>
    </PageContainer>
  );
}
