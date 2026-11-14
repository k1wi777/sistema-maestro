import { ButtonLink, PageContainer, PageHeader } from '@/shared/ui';

export default function NotFound() {
  return (
    <PageContainer>
      <PageHeader
        context="Error 404"
        title="No encontramos esa página"
        description="La dirección no existe o ya no está disponible."
        actions={<ButtonLink href="/ingreso">Ir al ingreso</ButtonLink>}
      />
    </PageContainer>
  );
}
