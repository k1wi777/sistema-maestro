import { FormatCard, PageContainer, PageHeader } from '@/shared/ui';

import { FORMAT_CARDS } from '../model/format-cards';
import styles from './formats-hub-screen.module.css';

/** Hub de «Formatos»: una tarjeta por formato; cada una abre su pantalla (PIAR aún no existe). */
export function FormatsHubScreen() {
  return (
    <PageContainer>
      <PageHeader
        context="Formatos institucionales"
        title="Formatos"
        description="Planeación GNS, diario de campo (F-PA-05), observador del estudiante y PIAR: elige el formato con el que quieres trabajar."
      />
      <ul className={styles.grid}>
        {FORMAT_CARDS.map((card) => (
          <li key={card.id}>
            <FormatCard
              title={card.title}
              description={card.description}
              icon={card.icon}
              href={card.href}
              soon={card.soon}
            />
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
