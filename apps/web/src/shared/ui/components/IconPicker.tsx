import {
  emojiIcon,
  hasIconEquivalent,
  iconEmoji,
  PICKABLE_ICONS,
  type PickableIcon,
} from '../icons/emoji-icons';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/registry';
import styles from './IconPicker.module.css';
import { Select, type SelectOption } from './Select';

export interface IconPickerProps {
  label: string;
  /** Emoji guardado en la configuración, o `undefined` si no hay icono. */
  value: string | undefined;
  /** Recibe el emoji equivalente del icono elegido, o `undefined` con «Sin icono». */
  onChange: (emoji: string | undefined) => void;
  /** Ofrece la opción «Sin icono» (pares de Conecta y simulador). */
  allowNone?: boolean;
  error?: string;
}

const NONE = '__none';
const CURRENT = '__current';

function byName(a: PickableIcon, b: PickableIcon): number {
  return a.label.localeCompare(b.label, 'es');
}

/**
 * Selector de icono del sistema de diseño: guarda el emoji equivalente. Un emoji sin equivalente
 * se conserva (y se ve con el icono genérico) hasta que se elija otro.
 */
export function IconPicker({ label, value, onChange, allowNone = false, error }: IconPickerProps) {
  const hasValue = value !== undefined && value !== '';
  const known = hasValue && hasIconEquivalent(value);
  const currentIcon: IconName | undefined = hasValue ? emojiIcon(value) : undefined;

  const options: SelectOption[] = [
    ...(allowNone ? [{ value: NONE, label: 'Sin icono' }] : []),
    ...(hasValue && !known ? [{ value: CURRENT, label: 'Icono actual (sin equivalente)' }] : []),
    ...[...PICKABLE_ICONS].sort(byName).map((item) => ({ value: item.icon, label: item.label })),
  ];
  const selected = !hasValue ? (allowNone ? NONE : '') : known ? (currentIcon as string) : CURRENT;

  function onSelect(next: string) {
    if (next === NONE) {
      onChange(undefined);
    } else if (next === CURRENT) {
      return;
    } else if (known && next === currentIcon) {
      // Mismo icono: se conserva el texto original (p. ej. con selector de variación).
      onChange(value);
    } else {
      onChange(iconEmoji(next as IconName));
    }
  }

  return (
    <div className={styles.row}>
      <Select
        className={styles.select}
        label={label}
        error={error}
        value={selected}
        placeholder={selected === '' ? 'Elige un icono' : undefined}
        options={options}
        onChange={(event) => onSelect(event.target.value)}
      />
      {currentIcon ? (
        <span className={styles.preview} aria-hidden="true">
          <Icon name={currentIcon} size={20} />
        </span>
      ) : null}
    </div>
  );
}
