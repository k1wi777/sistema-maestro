'use client';

import { useState, type SyntheticEvent } from 'react';

import { Loading, useQueryParams } from '@/shared/data';
import { formatDateTime } from '@/shared/format/dates';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Notice,
  PageContainer,
  PageHeader,
  StatusBadge,
  TextInput,
} from '@/shared/ui';

import { useCertificateVerification } from '../hooks/use-certificate-verification';
import { CERTIFICATE_KIND_LABEL } from '../model/labels';
import type { VerificationOutcome } from '../model/verification';
import styles from './verification-screen.module.css';

interface OutcomeProps {
  outcome: VerificationOutcome;
  code: string;
  onRetry: () => void;
}

function Outcome({ outcome, code, onRetry }: OutcomeProps) {
  switch (outcome.status) {
    case 'idle':
      return (
        <EmptyState icon="candado" title="El resultado aparece aquí">
          Escribe el código y pulsa Verificar para ver a quién pertenece el certificado.
        </EmptyState>
      );
    case 'loading':
      return <Loading>Verificando el código…</Loading>;
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
          <div className={styles.retry}>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        </Notice>
      );
    case 'found': {
      const { data } = outcome;
      return (
        <section className={styles.valid}>
          <header className={styles.validHeader}>
            <Icon name="check" size={20} className={styles.validIcon} />
            <h2 className={styles.validTitle}>Certificado válido</h2>
            <StatusBadge tone="success">Auténtico</StatusBadge>
          </header>
          <dl className={styles.facts}>
            <div>
              <dt>Código</dt>
              <dd className={styles.code}>{code}</dd>
            </div>
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
        </section>
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
      <Card className={styles.formCard}>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <TextInput
            className={styles.codeInput}
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
      </Card>
      <div className={styles.result} aria-live="polite">
        <Outcome outcome={outcome} code={lastCode} onRetry={() => void verify(lastCode)} />
      </div>
    </PageContainer>
  );
}
