import type { NextConfig } from 'next';

import { nextRedirects } from './src/shared/shell/legacy-redirects';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Rutas anteriores a «Planeación y PIAR como formatos»: ver `legacy-redirects.ts`.
  redirects: () => Promise.resolve(nextRedirects()),
};

export default nextConfig;
