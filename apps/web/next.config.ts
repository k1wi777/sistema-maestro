import type { NextConfig } from 'next';

import { nextRedirects } from './src/shared/shell/legacy-redirects';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // La plataforma no depende del optimizador de imágenes del proveedor (en la demo agotó su cuota
  // y respondía 402). Las imágenes locales son pequeñas y las subidas a R2 ya usan `<img>` con URL firmada.
  images: { unoptimized: true },
  // Rutas anteriores a «Planeación y PIAR como formatos»: ver `legacy-redirects.ts`.
  redirects: () => Promise.resolve(nextRedirects()),
};

export default nextConfig;
