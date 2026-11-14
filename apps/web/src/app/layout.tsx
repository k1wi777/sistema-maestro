import { PRODUCT_NAME } from '@gns/shared';
import type { Metadata, Viewport } from 'next';
import { Inter, Josefin_Sans, Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

import { THEME_INIT_SCRIPT } from '@/shared/ui';
import '@/shared/ui/styles/tokens.css';
import '@/shared/ui/styles/base.css';

// next/font descarga las fuentes en el build y las sirve desde la propia aplicación:
// el navegador no contacta a Google. Josefin Sans solo para la marca.
const brandFont = Josefin_Sans({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-brand',
  display: 'swap',
});
const displayFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});
const bodyFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: 'Plataforma institucional de George Noble School.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: el script del tema fija data-theme antes de hidratar.
    <html
      lang="es"
      className={`${brandFont.variable} ${displayFont.variable} ${bodyFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
