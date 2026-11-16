import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const API_PORT = 3000;
export const WEB_PORT = 3001;

const WEB_ROOT = join(__dirname, '..', '..');
export const API_MAIN = join(WEB_ROOT, '..', 'api', 'dist', 'main.js');
const WEB_BUILD_ID = join(WEB_ROOT, '.next', 'BUILD_ID');

// Intenta conectar a `localhost` por IPv4 e IPv6: una conexión aceptada significa puerto ocupado.
const PROBE = `
const net = require('node:net');
const port = Number(process.argv[1]);
let pending = 2;
let busy = false;
const done = () => { pending -= 1; if (pending === 0) process.exit(busy ? 1 : 0); };
for (const host of ['127.0.0.1', '::1']) {
  const socket = net.connect({ port, host, timeout: 2000 });
  socket.on('connect', () => { busy = true; socket.destroy(); done(); });
  socket.on('timeout', () => { socket.destroy(); done(); });
  socket.on('error', () => done());
}
`;

function portIsBusy(port: number): boolean {
  return spawnSync(process.execPath, ['-e', PROBE, String(port)]).status === 1;
}

/**
 * Requisitos previos que se comprueban antes de arrancar nada (R6): puertos libres y las dos
 * compilaciones. Es síncrona porque Playwright arranca el servidor web justo después de leer la
 * configuración. Docker lo comprueba el propio arranque del entorno efímero.
 */
export function assertPrerequisites(): void {
  for (const [port, what] of [
    [API_PORT, 'la API'],
    [WEB_PORT, 'la web'],
  ] as const) {
    if (portIsBusy(port)) {
      throw new Error(
        `El puerto ${port} (${what} de las pruebas) está ocupado. Detén el proceso que lo usa ` +
          '(por ejemplo `pnpm dev`) y vuelve a ejecutar las pruebas de navegador.',
      );
    }
  }
  if (!existsSync(API_MAIN)) {
    throw new Error('Falta la compilación de la API: ejecuta `pnpm build` y vuelve a intentarlo.');
  }
  if (!existsSync(WEB_BUILD_ID)) {
    throw new Error('Falta la compilación de la web: ejecuta `pnpm build` y vuelve a intentarlo.');
  }
}
