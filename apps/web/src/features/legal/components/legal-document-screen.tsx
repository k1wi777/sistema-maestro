import { LegalBlocks, type LegalDocument } from '@/shared/legal';
import { PageContainer, PageHeader } from '@/shared/ui';

import styles from './legal-document-screen.module.css';

export interface LegalDocumentScreenProps {
  document: LegalDocument;
  /** Versión única de los textos legales. */
  version: string;
}

/** Documento legal público: título, versión, índice de secciones y el cuerpo. */
export function LegalDocumentScreen({ document, version }: LegalDocumentScreenProps) {
  return (
    <PageContainer>
      <PageHeader
        context="Documento legal"
        title={document.title}
        description={document.summary}
        actions={<p className={styles.version}>Versión {version}</p>}
      />
      <div className={styles.layout}>
        <nav aria-label="Contenido del documento" className={styles.index}>
          <p className={styles.indexTitle}>Contenido</p>
          <ol className={styles.indexList}>
            {document.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.heading}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className={styles.body}>
          {document.sections.map((section) => (
            <section key={section.id} id={section.id} className={styles.section}>
              <h2 className={styles.heading}>{section.heading}</h2>
              <LegalBlocks blocks={section.blocks} />
            </section>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
