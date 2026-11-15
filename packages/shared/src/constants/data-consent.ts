/** Casillas del aviso de datos (`consentimiento_datos.casillas`): identificador en inglés, valor en español. */
export const DataConsentItem = {
  Policy: 'politica',
  Authorization: 'autorizo',
  Terms: 'terminos',
  // `Minors` y `Security` son valores de filas ya guardadas con versiones anteriores del aviso
  // (2026-1): `dataConsentSchema` debe seguir leyéndolas; ya no se piden al aceptar.
  Minors: 'menores',
  Security: 'seguridad',
} as const;
export type DataConsentItem = (typeof DataConsentItem)[keyof typeof DataConsentItem];

/** Las tres casillas vigentes, en el orden en que se muestran y se guardan. */
export const DATA_CONSENT_ITEMS: readonly DataConsentItem[] = [
  DataConsentItem.Policy,
  DataConsentItem.Authorization,
  DataConsentItem.Terms,
];
