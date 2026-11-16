import { Button } from '@/shared/ui';

import styles from './activity-editor.module.css';

/** Subir, Bajar y Quitar de un elemento de lista, con su nombre accesible (p. ej. «tarjeta 2»). */
export function ListControls({
  name,
  index,
  count,
  disabled,
  canRemove = true,
  onMove,
  onRemove,
}: {
  /** Nombre del elemento para lectores de pantalla: «tarjeta 2», «par 1»… */
  name: string;
  index: number;
  count: number;
  disabled: boolean;
  canRemove?: boolean;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.controls}>
      <Button
        context={`${name}`}
        variant="outline"
        size="sm"
        startIcon="arriba"
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
      >
        Subir
      </Button>
      <Button
        context={`${name}`}
        variant="outline"
        size="sm"
        startIcon="abajo"
        disabled={disabled || index === count - 1}
        onClick={() => onMove(1)}
      >
        Bajar
      </Button>
      <Button
        context={`${name}`}
        variant="outline"
        size="sm"
        disabled={disabled || !canRemove}
        onClick={onRemove}
      >
        Quitar
      </Button>
    </div>
  );
}

/** Lista con el elemento `from` movido `offset` posiciones; si no se puede, la misma lista. */
export function moveItem<Item>(items: readonly Item[], from: number, offset: -1 | 1): Item[] {
  const to = from + offset;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined || to < 0 || to > items.length - 1) {
    return [...items];
  }
  next.splice(to, 0, moved);
  return next;
}

/** Reemplaza el elemento `index` de la lista. */
export function replaceItem<Item>(items: readonly Item[], index: number, item: Item): Item[] {
  return items.map((current, position) => (position === index ? item : current));
}

/** Quita el elemento `index` de la lista. */
export function removeItem<Item>(items: readonly Item[], index: number): Item[] {
  return items.filter((_, position) => position !== index);
}

/** Propiedades comunes de los formularios de cada tipo. */
export interface TypeFormProps<Form> {
  form: Form;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (form: Form) => void;
  /** Aviso R5 ya mostrado por el editor: los formularios solo lo repiten donde hace falta. */
  existing: boolean;
}
