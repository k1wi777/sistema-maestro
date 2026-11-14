import { Notice, PageContainer, PageHeader } from '@/shared/ui';

export function CoordinacionScreen() {
  return (
    <PageContainer>
      <PageHeader
        context="Coordinación"
        title="Revisión y seguimiento"
        description="Revisa, ajusta y aprueba los registros de los docentes."
      />
      <Notice tone="info" title="En construcción">
        Esta pantalla se construirá en una etapa posterior; por ahora solo existe la ruta.
      </Notice>
    </PageContainer>
  );
}
