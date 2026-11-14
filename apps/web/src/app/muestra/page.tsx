import type { Metadata } from 'next';

import { Showcase } from './showcase';

export const metadata: Metadata = { title: 'Muestra del sistema de diseño' };

export default function ShowcasePage() {
  return <Showcase />;
}
