'use client';

import { TrainingModuleStatus, type TrainingModuleOutline } from '@gns/shared';
import { useRouter } from 'next/navigation';

import {
  ActionMenu,
  Button,
  ButtonLink,
  RecordCard,
  StatusBadge,
  type ActionMenuItem,
  type RecordTone,
} from '@/shared/ui';

import { MODULE_STATUS_INFO, moduleTitleWithNumber } from '../model/labels';
import { MODULE_ACTION_LABEL, moduleActions, type ModuleActionId } from '../model/module-actions';
import { contentSummary, trackingText } from '../model/module-outline';
import styles from './module-row.module.css';

export const EDITOR_PATH = '/coordinacion/planes/modulos';

const TONE: Record<TrainingModuleStatus, RecordTone> = {
  [TrainingModuleStatus.Draft]: 'warning',
  [TrainingModuleStatus.Active]: 'success',
  [TrainingModuleStatus.OutOfPlan]: 'neutral',
};

interface ModuleRowProps {
  module: TrainingModuleOutline;
  planId: string;
  /** Totales del seguimiento (solo los módulos publicados los tienen) y número de docentes. */
  totals: { inProgress: number; done: number } | null;
  teacherCount: number;
  busy: boolean;
  onPublish: () => void;
  onRestore: () => void;
  onAskWithdraw: () => void;
}

/** Un módulo de la lista: estado, resumen de contenidos y solo las acciones de su estado. */
export function ModuleRow({
  module,
  planId,
  totals,
  teacherCount,
  busy,
  onPublish,
  onRestore,
  onAskWithdraw,
}: ModuleRowProps) {
  const router = useRouter();
  const info = MODULE_STATUS_INFO[module.status];
  const editHref = `${EDITOR_PATH}/${module.id}`;
  const trackingHref = `/coordinacion/avance?plan=${planId}&modulo=${module.id}`;
  const actions = moduleActions(module.status);
  const name = moduleTitleWithNumber(module);

  function itemFor(action: ModuleActionId): ActionMenuItem {
    switch (action) {
      case 'edit':
        return {
          id: action,
          label: MODULE_ACTION_LABEL.edit,
          icon: 'lapiz',
          onSelect: () => router.push(editHref),
        };
      case 'tracking':
        return {
          id: action,
          label: MODULE_ACTION_LABEL.tracking,
          icon: 'grafica',
          onSelect: () => router.push(trackingHref),
        };
      case 'publish':
        return {
          id: action,
          label: MODULE_ACTION_LABEL.publish,
          icon: 'enviar',
          onSelect: onPublish,
        };
      case 'withdraw':
        return {
          id: action,
          label: MODULE_ACTION_LABEL.withdraw,
          icon: 'salir',
          onSelect: onAskWithdraw,
        };
      case 'restore':
        return {
          id: action,
          label: MODULE_ACTION_LABEL.restore,
          icon: 'historial',
          onSelect: onRestore,
        };
    }
  }

  function buttonFor(action: ModuleActionId) {
    const label = MODULE_ACTION_LABEL[action];
    const hidden = <span className="sr-only">{`: ${name}`}</span>;
    switch (action) {
      case 'edit':
        return (
          <ButtonLink key={action} href={editHref} variant="outline" size="sm">
            {label}
            {hidden}
          </ButtonLink>
        );
      case 'tracking':
        return (
          <ButtonLink key={action} href={trackingHref} variant="outline" size="sm">
            {label}
            {hidden}
          </ButtonLink>
        );
      case 'publish':
        return (
          <Button key={action} size="sm" disabled={busy} onClick={onPublish}>
            {busy ? 'Publicando…' : label}
            {hidden}
          </Button>
        );
      case 'withdraw':
        return (
          <Button key={action} variant="outline" size="sm" disabled={busy} onClick={onAskWithdraw}>
            {label}
            {hidden}
          </Button>
        );
      case 'restore':
        return (
          <Button key={action} size="sm" disabled={busy} onClick={onRestore}>
            {busy ? 'Restaurando…' : label}
            {hidden}
          </Button>
        );
    }
  }

  const meta = [
    contentSummary(module),
    ...(module.status === TrainingModuleStatus.Active && totals
      ? [trackingText(totals, teacherCount)]
      : []),
  ];

  return (
    <RecordCard
      title={name}
      tone={TONE[module.status]}
      status={<StatusBadge tone={info.tone}>{info.label}</StatusBadge>}
      meta={meta}
      actions={
        <>
          <div className={styles.desktop}>{actions.map(buttonFor)}</div>
          <div className={styles.mobile}>
            <ActionMenu
              label="Acciones"
              ariaLabel={`Acciones de ${name}`}
              icon="puntos"
              size="sm"
              items={actions.map((action) => ({ ...itemFor(action), disabled: busy }))}
            />
          </div>
        </>
      }
    />
  );
}
