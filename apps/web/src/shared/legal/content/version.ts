/**
 * Versión única de la política de tratamiento y de los términos de uso: identifica a la vez
 * ambos documentos y el aviso corto. Al cambiar cualquier texto legal se sube aquí y en
 * `DATA_POLICY_VERSION` de la API (`apps/api/.env.example` y el entorno de despliegue): la
 * API exige entonces aceptar de nuevo y el aviso se bloquea mientras las dos no coincidan.
 */
export const LEGAL_DOCUMENTS_VERSION = '2026-2';
