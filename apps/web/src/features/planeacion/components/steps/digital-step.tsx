import {
  DigitalTool,
  LESSON_PLAN_MAX_RESOURCES,
  RESOURCE_NAME_MAX_LENGTH,
  createLessonPlanResourceSchema,
  type LessonPlan,
  type LessonPlanResource,
} from '@gns/shared';
import { useState } from 'react';

import type { ApiResult } from '@/shared/api';
import { Button, Card, Icon, Notice, Select, TextInput } from '@/shared/ui';

import type { CreateResourceBody } from '../../api/lesson-plans';
import { MOMENTS } from '../../model/steps';
import { PrivacyNotice } from '../privacy-notice';
import styles from './digital-step.module.css';

interface ToolLink {
  name: string;
  description: string;
  href: string;
}

/** Accesos para crear un recurso en la herramienta; se abren en otra pestaña. */
const TOOL_LINKS: readonly ToolLink[] = [
  {
    name: 'Canva',
    description: 'Fichas, presentaciones, carteles y flashcards.',
    href: 'https://www.canva.com/',
  },
  {
    name: 'Liveworksheets',
    description: 'Fichas interactivas que se corrigen solas.',
    href: 'https://www.liveworksheets.com/',
  },
  {
    name: 'Kahoot',
    description: 'Juegos de preguntas para repasar en clase.',
    href: 'https://create.kahoot.it/',
  },
  {
    name: 'ClassDojo',
    description: 'Comunicación con familias y evidencias del proceso.',
    href: 'https://www.classdojo.com/',
  },
  {
    name: 'Pinterest',
    description: 'Ideas visuales para rincones y actividades.',
    href: 'https://www.pinterest.com/',
  },
];

const TOOL_OPTIONS = Object.values(DigitalTool).map((tool) => ({ value: tool, label: tool }));

const GENERAL = 'general';
const MOMENT_OPTIONS = [
  { value: GENERAL, label: 'General' },
  ...MOMENTS.map((moment) => ({
    value: String(moment.number),
    label: `${moment.number} · ${moment.short}`,
  })),
];

function momentLabel(moment: number | null): string {
  const found = MOMENTS.find((candidate) => candidate.number === moment);
  return found ? `Momento ${found.number} · ${found.short}` : 'General';
}

/** Solo enlaces http o https se pintan como enlace; cualquier otra cosa queda como texto. */
function safeHref(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

interface ResourceFormValues {
  tool: string;
  name: string;
  url: string;
  moment: string;
}

const EMPTY_FORM: ResourceFormValues = {
  tool: DigitalTool.Canva,
  name: '',
  url: '',
  moment: GENERAL,
};

type ResourceErrors = Partial<Record<keyof ResourceFormValues, string>>;

interface DigitalStepProps {
  plan: LessonPlan;
  readOnly: boolean;
  number: number;
  onAdd: (body: CreateResourceBody) => Promise<ApiResult<LessonPlanResource>>;
  onRemove: (resourceId: string) => Promise<ApiResult<undefined>>;
}

export function DigitalStep({ plan, readOnly, number, onAdd, onRemove }: DigitalStepProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<ResourceErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const full = plan.linkedResources.length >= LESSON_PLAN_MAX_RESOURCES;

  function change(patch: Partial<ResourceFormValues>) {
    setForm((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => {
      const next = { ...previous };
      for (const key of Object.keys(patch) as (keyof ResourceFormValues)[]) {
        delete next[key];
      }
      return next;
    });
  }

  async function handleAdd() {
    const parsed = createLessonPlanResourceSchema.safeParse({
      tool: form.tool,
      name: form.name,
      url: form.url.trim(),
      moment: form.moment === GENERAL ? null : Number(form.moment),
    });
    if (!parsed.success) {
      const found: ResourceErrors = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]) as keyof ResourceFormValues;
        found[field] ??= issue.message;
      }
      setErrors(found);
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await onAdd(parsed.data);
    setBusy(false);
    if (result.ok) {
      setForm(EMPTY_FORM);
      setMessage('Enlace agregado.');
    } else {
      setMessage(result.error.message);
    }
  }

  async function handleRemove(resourceId: string) {
    setBusy(true);
    setMessage(null);
    const result = await onRemove(resourceId);
    setBusy(false);
    setMessage(result.ok ? 'Enlace quitado.' : result.error.message);
  }

  return (
    <Card title="Recursos digitales" step={number}>
      <div className={styles.stack}>
        <p className={styles.lead}>Se abren en otra pestaña; tu planeación sigue aquí.</p>

        <section aria-labelledby="digital-create">
          <h3 id="digital-create" className={styles.subtitle}>
            Crear un recurso
          </h3>
          <ul className={styles.tools}>
            {TOOL_LINKS.map((tool) => (
              <li key={tool.name}>
                <a
                  href={tool.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.tool}
                >
                  <span className={styles.toolName}>
                    {tool.name}
                    <Icon name="externo" size={14} />
                    <span className="sr-only"> (se abre en otra pestaña)</span>
                  </span>
                  <small>{tool.description}</small>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="digital-list">
          <h3 id="digital-list" className={styles.subtitle}>
            Recursos de esta clase
          </h3>
          {readOnly ? null : (
            <form
              className={styles.form}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (!busy && !full) {
                  void handleAdd();
                }
              }}
            >
              <Select
                label="Herramienta"
                options={TOOL_OPTIONS}
                value={form.tool}
                error={errors.tool}
                onChange={(event) => change({ tool: event.target.value })}
              />
              <TextInput
                label="Nombre del recurso"
                maxLength={RESOURCE_NAME_MAX_LENGTH}
                placeholder="Ej. Ficha de emociones"
                value={form.name}
                error={errors.name}
                onChange={(event) => change({ name: event.target.value })}
              />
              <div className={styles.wide}>
                <TextInput
                  label="Enlace"
                  type="url"
                  inputMode="url"
                  placeholder="Pega aquí el enlace para compartir"
                  value={form.url}
                  error={errors.url}
                  onChange={(event) => change({ url: event.target.value })}
                />
              </div>
              <Select
                label="Momento"
                options={MOMENT_OPTIONS}
                value={form.moment}
                error={errors.moment}
                onChange={(event) => change({ moment: event.target.value })}
              />
              <div className={styles.submit}>
                <Button type="submit" variant="secondary" startIcon="mas" disabled={busy || full}>
                  Agregar
                </Button>
              </div>
            </form>
          )}
          {full && !readOnly ? (
            <Notice tone="warning">
              Llegaste al máximo de {LESSON_PLAN_MAX_RESOURCES} enlaces. Quita alguno para agregar
              otro.
            </Notice>
          ) : null}
          {readOnly ? null : <PrivacyNotice context="digital" />}
          <p className={styles.message} role="status">
            {message}
          </p>
          {plan.linkedResources.length === 0 ? (
            <p className={styles.empty}>Esta planeación aún no tiene enlaces.</p>
          ) : (
            <ul className={styles.links}>
              {plan.linkedResources.map((resource) => {
                const href = safeHref(resource.url);
                const label = resource.name ?? resource.url;
                return (
                  <li key={resource.id} className={styles.link}>
                    <span className={styles.tag}>{resource.tool}</span>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {label}
                        <span className="sr-only"> (se abre en otra pestaña)</span>
                      </a>
                    ) : (
                      <span>{label}</span>
                    )}
                    <span className={styles.moment}>{momentLabel(resource.moment)}</span>
                    {readOnly ? null : (
                      <Button
                        variant="void"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleRemove(resource.id)}
                      >
                        Quitar
                        <span className="sr-only">{`: ${label}`}</span>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
}
