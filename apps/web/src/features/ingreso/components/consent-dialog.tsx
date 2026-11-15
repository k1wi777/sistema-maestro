'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import {
  CONSENT_BOXES,
  LEGAL_DOCUMENTS_VERSION,
  LegalBlocks,
  LegalLinks,
  PRIVACY_NOTICE,
} from '@/shared/legal';
import { useSession } from '@/shared/session';
import { Button, Checkbox, Icon, Notice } from '@/shared/ui';

import { missingConsentMessage, type ConsentChecks } from '../missing-consent';
import styles from './consent-dialog.module.css';

const NOTHING_CHECKED: ConsentChecks = { policy: false, authorization: false, terms: false };

/**
 * Aviso de tratamiento de datos: diálogo modal sobre el fondo del ingreso. No usa `<dialog>` nativo
 * porque Escape lo cerraría y el aviso no se puede descartar; el resto de la pantalla queda `inert`.
 */
export function ConsentDialog() {
  const { state, acceptConsent, signOut } = useSession();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [checked, setChecked] = useState<ConsentChecks>(NOTHING_CHECKED);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Falla cerrada: nunca se registra una versión de textos que el usuario no vio.
  const outdated =
    state.status === 'authenticated' && state.policyVersion !== LEGAL_DOCUMENTS_VERSION;
  const missing = missingConsentMessage(CONSENT_BOXES, checked);
  const canAccept = missing === null && !outdated && !saving;
  const hint = outdated
    ? 'El aviso se está actualizando. Inténtalo más tarde.'
    : (missing ?? 'Todo listo para continuar.');

  async function handleAccept() {
    setSaving(true);
    setError(null);
    const result = await acceptConsent(LEGAL_DOCUMENTS_VERSION);
    if (!result.ok) {
      // Las casillas se conservan: solo se informa el fallo.
      setSaving(false);
      setError(result.error.message);
    }
  }

  async function handleDecline() {
    setSaving(true);
    await signOut();
  }

  return (
    <div className={styles.veil}>
      <div
        className={styles.box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-description"
      >
        <div className={styles.titleBar}>
          <Image
            src="/escudo-gns.webp"
            alt=""
            width={34}
            height={34}
            className={styles.seal}
            aria-hidden="true"
          />
          <div>
            <h2 id="consent-title" ref={titleRef} tabIndex={-1} className={styles.title}>
              {PRIVACY_NOTICE.title}
            </h2>
            <p className={styles.subtitle}>{PRIVACY_NOTICE.subtitle}</p>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.message}>
            <span className={styles.infoIcon} aria-hidden="true">
              <Icon name="info" size={24} fill="tone" />
            </span>
            <p id="consent-description" className={styles.intro}>
              {PRIVACY_NOTICE.intro}
            </p>
          </div>
          <div className={styles.summary}>
            <LegalBlocks blocks={PRIVACY_NOTICE.summary} />
          </div>
          <div className={styles.documents}>
            <p className={styles.documentsLead}>{PRIVACY_NOTICE.readMore}</p>
            <LegalLinks newTab />
          </div>
          {outdated ? (
            <Notice tone="warning">
              El aviso se está actualizando; por ahora no se puede aceptar. Inténtalo más tarde.
            </Notice>
          ) : null}
          <fieldset className={styles.checks}>
            <legend className="sr-only">Confirmaciones requeridas</legend>
            {CONSENT_BOXES.map((box) => (
              <div key={box.key} className={styles.check}>
                <Checkbox
                  label={box.label}
                  checked={checked[box.key]}
                  disabled={saving}
                  onChange={(event) =>
                    setChecked((previous) => ({ ...previous, [box.key]: event.target.checked }))
                  }
                />
              </div>
            ))}
          </fieldset>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <p className={styles.note}>{PRIVACY_NOTICE.note}</p>
        </div>
        <div className={styles.footer}>
          <p id="consent-hint" className={styles.hint} aria-live="polite">
            <Icon name={canAccept ? 'check' : 'candado'} size={16} fill="none" />
            <span>{hint}</span>
          </p>
          <Button variant="outline" disabled={saving} onClick={() => void handleDecline()}>
            No acepto
          </Button>
          <Button
            disabled={!canAccept}
            aria-describedby="consent-hint"
            onClick={() => void handleAccept()}
          >
            Acepto y continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
