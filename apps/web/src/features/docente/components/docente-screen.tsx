import { Notice, PageContainer, PageHeader } from '@/shared/ui';

export function DocenteScreen() {
  return (
    <PageContainer>
      <PageHeader
        context="Docente"
        title="Tu espacio de trabajo"
        description="Planeaciones, formatos y formación en un solo lugar."
      />
      <Notice tone="info" title="En construcción">
        Esta pantalla se construirá en una etapa posterior; por ahora solo existe la ruta.
      </Notice>
    </PageContainer>
  );
}
