import type { Metadata } from 'next';

import { TrainingModuleScreen } from '@/features/formacion';

export const metadata: Metadata = { title: 'Módulo de formación' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrainingModuleScreen id={id} />;
}
