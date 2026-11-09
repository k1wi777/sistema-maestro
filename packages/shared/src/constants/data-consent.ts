/** Casillas del aviso de datos (`consentimiento_datos.casillas`): identificador en inglés, valor en español. */
export const DataConsentItem = {
  Policy: 'politica',
  Authorization: 'autorizo',
  Minors: 'menores',
  Security: 'seguridad',
} as const;
export type DataConsentItem = (typeof DataConsentItem)[keyof typeof DataConsentItem];

/** Las cuatro casillas, en el orden en que se muestran y se guardan. */
export const DATA_CONSENT_ITEMS: readonly DataConsentItem[] = [
  DataConsentItem.Policy,
  DataConsentItem.Authorization,
  DataConsentItem.Minors,
  DataConsentItem.Security,
];
