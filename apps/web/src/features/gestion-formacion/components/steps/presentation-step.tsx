'use client';

import type { Slide } from '@gns/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Button,
  Card,
  Notice,
  SegmentedFilter,
  StatusBadge,
  TextArea,
  TextInput,
} from '@/shared/ui';

import { addSlide, removeSlide, updateSlide } from '../../api/modules';
import type { Confirmation } from '../../model/module-actions';
import {
  SLIDE_TITLE_MAX_LENGTH,
  emptySlideForm,
  isSlideDirty,
  toSlideForm,
  validateSlideForm,
  type SlideForm,
  type SlideFormErrors,
} from '../../model/slide-form';
import { FileField } from '../file-field';
import { ModuleActionDialog } from '../module-action-dialog';
import styles from './steps.module.css';
import type { StepProps } from './step-types';

type PresentationOrigin = 'enlace' | 'archivo';

const ORIGIN_OPTIONS = [
  { value: 'enlace' as const, label: 'Enlace' },
  { value: 'archivo' as const, label: 'Archivo' },
];

function switchConfirmation(to: PresentationOrigin): Confirmation {
  return to === 'enlace'
    ? {
        title: '¿Cambiar a un enlace?',
        description:
          'La presentación actual es un archivo. Cuando guardes el enlace, reemplaza al archivo; mientras tanto no se pierde nada.',
        confirmLabel: 'Cambiar a enlace',
      }
    : {
        title: '¿Cambiar a un archivo?',
        description:
          'La presentación actual es un enlace. Cuando subas el archivo, reemplaza al enlace; mientras tanto no se pierde nada.',
        confirmLabel: 'Cambiar a archivo',
      };
}

interface Item {
  key: number;
  form: SlideForm;
  errors: SlideFormErrors | null;
}

function shorten(text: string): string {
  const clean = text.trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

function upsert(slides: Slide[], saved: Slide): Slide[] {
  const exists = slides.some((slide) => slide.id === saved.id);
  const next = exists
    ? slides.map((slide) => (slide.id === saved.id ? saved : slide))
    : [...slides, saved];
  return next.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Paso «Presentación»: un enlace https o un archivo PDF, imagen o PPTX, y las diapositivas con
 * título e ideas clave (una por línea). Las diapositivas se guardan igual que las preguntas.
 */
export function PresentationStep({ editor, number }: StepProps) {
  const { detail, draft, errors, track, updateDetail, registerSaver, setStepDirty } = editor;
  const hasFile = detail.presentationFile !== null;
  const hasLink = detail.presentationUrl !== null;
  const [origin, setOrigin] = useState<PresentationOrigin>(hasFile ? 'archivo' : 'enlace');
  const [switchingTo, setSwitchingTo] = useState<PresentationOrigin | null>(null);
  const [removingLink, setRemovingLink] = useState(false);

  const nextKey = useRef(detail.slides.length);
  const [items, setItems] = useState<Item[]>(() =>
    detail.slides.map((slide, index) => ({ key: index, form: toSlideForm(slide), errors: null })),
  );
  const [removing, setRemoving] = useState<Item | null>(null);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const savedById = useMemo(
    () => new Map(detail.slides.map((slide) => [slide.id, toSlideForm(slide)])),
    [detail.slides],
  );
  const isDirty = useCallback(
    (item: Item) =>
      isSlideDirty(item.form.id ? (savedById.get(item.form.id) ?? null) : null, item.form),
    [savedById],
  );
  const anyDirty = items.some(isDirty);

  const saveItem = useCallback(
    async (item: Item): Promise<boolean> => {
      const validation = validateSlideForm(item.form);
      if (!validation.ok) {
        setItems((current) =>
          current.map((other) =>
            other.key === item.key ? { ...other, errors: validation.errors } : other,
          ),
        );
        return false;
      }
      const moduleId = detail.id;
      const result = await track(() =>
        item.form.id
          ? updateSlide(moduleId, item.form.id, validation.input)
          : addSlide(moduleId, validation.input),
      );
      if (!result.ok) {
        setFailure(result.error.message);
        return false;
      }
      setFailure(null);
      updateDetail((current) => ({ ...current, slides: upsert(current.slides, result.data) }));
      setItems((current) =>
        current.map((other) =>
          other.key === item.key
            ? { ...other, form: { ...other.form, id: result.data.id }, errors: null }
            : other,
        ),
      );
      return true;
    },
    [detail.id, track, updateDetail],
  );

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });
  useEffect(() => {
    registerSaver('presentacion', {
      save: async () => {
        let allSaved = true;
        for (const item of itemsRef.current) {
          const dirty = isSlideDirty(
            item.form.id ? (savedById.get(item.form.id) ?? null) : null,
            item.form,
          );
          if (dirty && !(await saveItem(item))) {
            allSaved = false;
          }
        }
        return allSaved;
      },
    });
    return () => registerSaver('presentacion', null);
  }, [registerSaver, saveItem, savedById]);
  useEffect(() => {
    setStepDirty('presentacion', anyDirty);
    return () => setStepDirty('presentacion', false);
  }, [anyDirty, setStepDirty]);

  function chooseOrigin(next: PresentationOrigin) {
    if (next === origin) {
      return;
    }
    const leavingContent = origin === 'enlace' ? hasLink : hasFile;
    if (leavingContent) {
      setSwitchingTo(next);
    } else {
      setOrigin(next);
    }
  }

  async function removeLink() {
    setRemovingLink(true);
    editor.setField('presentationUrl', '');
    await editor.saveFields(['presentationUrl']);
    setRemovingLink(false);
  }

  function change(key: number, form: SlideForm) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, form, errors: null } : item)),
    );
  }

  function add() {
    const key = nextKey.current;
    nextKey.current += 1;
    setItems((current) => [...current, { key, form: emptySlideForm(), errors: null }]);
  }

  async function saveOne(item: Item) {
    setWorking(true);
    await saveItem(item);
    setWorking(false);
  }

  function discard(item: Item) {
    if (item.form.id === null) {
      setItems((current) => current.filter((other) => other.key !== item.key));
    } else {
      setRemoving(item);
    }
  }

  async function confirmRemove() {
    if (!removing?.form.id) {
      return;
    }
    const slideId = removing.form.id;
    setWorking(true);
    const result = await track(() => removeSlide(detail.id, slideId));
    setWorking(false);
    if (result.ok) {
      updateDetail((current) => ({
        ...current,
        slides: current.slides.filter((slide) => slide.id !== slideId),
      }));
      setItems((current) => current.filter((item) => item.key !== removing.key));
      setFailure(null);
    } else {
      setFailure(result.error.message);
    }
    setRemoving(null);
  }

  return (
    <Card title="Presentación" step={number}>
      <div className={styles.fields}>
        <p className={styles.text}>
          La presentación es opcional. Puede ser un enlace, un archivo y diapositivas propias.
        </p>
        <SegmentedFilter
          label="Origen de la presentación"
          options={ORIGIN_OPTIONS}
          value={origin}
          onChange={chooseOrigin}
        />
        {origin === 'enlace' ? (
          <>
            <TextInput
              label="Enlace de la presentación"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={draft.presentationUrl}
              error={errors.presentationUrl}
              autoComplete="off"
              help={
                hasFile
                  ? 'Hay un archivo guardado: este enlace lo reemplaza cuando se guarda.'
                  : 'Debe empezar por https://.'
              }
              onChange={(event) => editor.setField('presentationUrl', event.target.value)}
            />
            {hasLink ? (
              <div className={styles.row}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={removingLink || editor.busy}
                  onClick={() => void removeLink()}
                >
                  {removingLink ? 'Quitando…' : 'Quitar el enlace'}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {hasLink ? (
              <p className={styles.hint}>
                Hay un enlace guardado: el archivo lo reemplaza al subirse.
              </p>
            ) : null}
            <FileField
              editor={editor}
              purpose="presentacion"
              label="Archivo de la presentación"
              current={detail.presentationFile}
              removeLabel="Quitar el archivo"
            />
          </>
        )}
      </div>

      <h3 className={styles.sectionTitle}>Diapositivas</h3>
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          {items.length === 1 ? '1 diapositiva.' : `${items.length} diapositivas.`} Una idea clave
          por línea.
        </p>
        <Button startIcon="mas" disabled={working} onClick={add}>
          Agregar diapositiva
        </Button>
      </div>
      {failure ? (
        <Notice tone="error" title="No se pudo completar la acción">
          {failure}
        </Notice>
      ) : null}
      {items.length === 0 ? (
        <p className={styles.text}>Este módulo todavía no tiene diapositivas.</p>
      ) : (
        <ol className={styles.items}>
          {items.map((item, index) => {
            const dirty = isDirty(item);
            return (
              <li key={item.key} className={styles.item}>
                <details open={item.form.id === null || undefined}>
                  <summary className={styles.itemSummary}>
                    <span className={styles.itemName}>
                      {`Diapositiva ${index + 1}${item.form.title.trim() ? ` · ${shorten(item.form.title)}` : ''}`}
                    </span>
                    {dirty ? (
                      <StatusBadge tone="warning">
                        {item.form.id === null ? 'Sin guardar' : 'Cambios sin guardar'}
                      </StatusBadge>
                    ) : null}
                  </summary>
                  <div className={styles.itemBody}>
                    <TextInput
                      label="Título"
                      value={item.form.title}
                      maxLength={SLIDE_TITLE_MAX_LENGTH}
                      error={item.errors?.title}
                      disabled={working}
                      autoComplete="off"
                      onChange={(event) =>
                        change(item.key, { ...item.form, title: event.target.value })
                      }
                    />
                    <TextArea
                      label="Ideas clave"
                      help="Una por línea."
                      rows={4}
                      value={item.form.keyIdeas}
                      error={item.errors?.keyIdeas}
                      disabled={working}
                      onChange={(event) =>
                        change(item.key, { ...item.form, keyIdeas: event.target.value })
                      }
                    />
                    <div className={styles.itemActions}>
                      <Button
                        size="sm"
                        startIcon="guardar"
                        disabled={working || !dirty}
                        onClick={() => void saveOne(item)}
                      >
                        Guardar diapositiva
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={working}
                        onClick={() => discard(item)}
                      >
                        {item.form.id === null ? 'Descartar' : 'Quitar diapositiva'}
                      </Button>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}

      {switchingTo ? (
        <ModuleActionDialog
          confirmation={switchConfirmation(switchingTo)}
          variant="primary"
          busy={false}
          onClose={() => setSwitchingTo(null)}
          onConfirm={() => {
            setOrigin(switchingTo);
            setSwitchingTo(null);
          }}
        />
      ) : null}
      {removing ? (
        <ModuleActionDialog
          confirmation={{
            title: '¿Quitar esta diapositiva?',
            description:
              'La diapositiva deja de verse en la presentación del módulo. Esta acción no se puede deshacer.',
            confirmLabel: 'Quitar diapositiva',
          }}
          busy={working}
          onClose={() => setRemoving(null)}
          onConfirm={() => void confirmRemove()}
        />
      ) : null}
    </Card>
  );
}
