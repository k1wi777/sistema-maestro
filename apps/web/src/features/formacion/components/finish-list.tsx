import { Icon } from '@/shared/ui';

import type { FinishList as FinishListModel } from '../model/module-steps';
import styles from './finish-list.module.css';

/** «Para terminar»: lo que falta para cerrar el módulo, con el estado de cada elemento. */
export function FinishList({ list }: { list: FinishListModel }) {
  return (
    <section className={styles.box} aria-labelledby="finish-title">
      <h2 id="finish-title" className={styles.title}>
        Para terminar
      </h2>
      {list.hasRequired ? null : (
        <p className={styles.note}>
          Este módulo no tiene elementos obligatorios: se da por terminado con tu primer avance en
          cualquiera de sus actividades.
        </p>
      )}
      {list.items.length > 0 ? (
        <ul className={styles.list}>
          {list.items.map((item) => (
            <li key={item.key} className={item.done ? styles.done : styles.item}>
              {item.done ? <Icon name="check" size={14} /> : null}
              {item.label}
              <span className="sr-only">{item.done ? ' (listo)' : ' (pendiente)'}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {list.hasOptionalNote ? (
        <p className={styles.note}>Las actividades opcionales no bloquean tu certificado.</p>
      ) : null}
    </section>
  );
}
