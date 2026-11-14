import { Notice, PageContainer, PageHeader } from '@/shared/ui';

export function IngresoScreen() {
  return (
    <PageContainer>
      <PageHeader
        context="Ingreso"
        title="Bienvenida a la Plataforma GNS"
        description="Aquí podrás ingresar con tu cuenta institucional."
      />
      <Notice tone="info" title="En construcción">
        Esta pantalla se construirá en una etapa posterior; por ahora solo existe la ruta.
      </Notice>
    </PageContainer>
  );
}
