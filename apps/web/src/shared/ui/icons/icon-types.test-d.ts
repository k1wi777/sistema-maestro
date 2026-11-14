import { Icon } from './Icon';

// Comprobación en compilación de la regla de relleno: `pnpm typecheck` falla si alguna
// de las líneas marcadas con @ts-expect-error deja de ser un error de tipos.
export const rejectedAndAccepted = [
  // @ts-expect-error — un icono de trazo abierto no admite relleno
  Icon({ name: 'check', fill: 'tone' }),
  // @ts-expect-error — tampoco relleno sólido
  Icon({ name: 'flecha', fill: 'solid' }),
  Icon({ name: 'check' }),
  Icon({ name: 'check', fill: 'none' }),
  Icon({ name: 'plan', fill: 'tone' }),
  Icon({ name: 'llama', fill: 'solid' }),
];
