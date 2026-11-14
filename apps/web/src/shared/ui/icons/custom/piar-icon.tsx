import type { SVGProps } from 'react';

// Icono institucional del tablero (persona con marca de verificación): Lucide no trae un
// dibujo equivalente. Mismo contrato visual: 24×24, trazo currentColor, extremos redondeados.
export function PiarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 11l2 2 4-4" />
    </svg>
  );
}
