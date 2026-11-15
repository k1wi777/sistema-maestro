import { paragraph, type LegalBlock } from './document';
import { INSTITUTION as school } from './institution';

/** Casillas del aviso; `key` coincide con las de la API (`items`). */
export type ConsentBoxKey = 'policy' | 'authorization' | 'terms';

export interface ConsentBox {
  readonly key: ConsentBoxKey;
  readonly label: string;
  /** Nombre corto para decir qué falta por marcar. */
  readonly shortName: string;
}

/** Las tres casillas, en el orden en que se muestran. */
export const CONSENT_BOXES: readonly ConsentBox[] = [
  {
    key: 'policy',
    label: 'He leído y entiendo este aviso y la política de tratamiento de la información.',
    shortName: 'lectura del aviso y la política',
  },
  {
    key: 'authorization',
    label:
      'Autorizo de manera previa, expresa e informada el tratamiento de mis datos personales para las finalidades descritas.',
    shortName: 'autorización',
  },
  {
    key: 'terms',
    label: 'Acepto los términos de uso de la plataforma.',
    shortName: 'términos de uso',
  },
];

const summary: readonly LegalBlock[] = [
  paragraph('Responsable: ', school.legalName, `, NIT ${school.nit}. Contacto: ${school.email}.`),
  paragraph(
    'Datos que se tratan: los tuyos (nombre, correo institucional, rol, tus registros pedagógicos y tu avance en la formación) y, de los estudiantes, solo el nombre de pila.',
  ),
  paragraph(
    'Finalidades: planeación, formatos institucionales, formación docente, revisión por coordinación y trazabilidad de las acciones.',
  ),
  paragraph(
    'Tus derechos: conocer, actualizar y rectificar tus datos, pedir prueba de la autorización, revocarla y presentar quejas ante la Superintendencia de Industria y Comercio.',
  ),
  paragraph(`Canal para ejercerlos: ${school.email} o el buzón de PQRS del sitio web del colegio.`),
];

/** Aviso de privacidad corto que se muestra antes de usar la plataforma. */
export const PRIVACY_NOTICE = {
  title: 'Aviso de tratamiento de datos personales',
  subtitle: 'Autorización requerida · Ley 1581 de 2012',
  intro: `Antes de usar la plataforma, ${school.displayName} necesita tu autorización para tratar tus datos personales, conforme al artículo 15 de la Constitución Política, la Ley 1581 de 2012 y el Decreto 1074 de 2015.`,
  summary,
  readMore: 'Lee los documentos completos (se abren en otra pestaña):',
  note: 'Tu aceptación queda registrada con la fecha, la hora y la versión de los textos. Si cambian, se te pedirá aceptar de nuevo.',
} as const;
