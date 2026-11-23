// Entrada del worker de pdf.js: al importarse, el worker legacy se registra solo. El cargador la
// abre con `new Worker(new URL('./pdf.worker.ts', import.meta.url))` para que el bundler la emita
// como fragmento propio del mismo origen (sin CDN ni cuenta de terceros).
import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
