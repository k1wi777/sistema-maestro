# Datos legales pendientes de confirmar

Lista para la entrega final de la Plataforma GNS. Las páginas «Política de tratamiento de la
información» y «Términos de uso» (`apps/web/src/shared/legal/`) marcan cada uno de estos datos
como **Pendiente** mientras no se confirme; ningún dato legal se completa con un valor supuesto.
La columna «Quién lo confirma (propuesta)» es solo una sugerencia de este trabajo, no un dato confirmado: el colegio la valida.
La prueba `legal.spec.ts` comprueba que cada id de `LEGAL_PENDING` figure en esta tabla.

Versión de los textos: `2026-3` (`LEGAL_DOCUMENTS_VERSION` en el frontend y
`DATA_POLICY_VERSION` en la API; al cambiar un texto se suben las dos).

| Id | Dato pendiente | Dónde aparece | Quién lo confirma (propuesta) | Estado |
|----|----------------|---------------|-------------------|--------|
| `legal-name` | Nombre legal exacto del colegio (George’s Noble School o George Noble School; el NIT 900.358.305-3 está confirmado). | Política: responsable del tratamiento. | Rectoría | Pendiente |
| `claims-area` | Área responsable de atender las consultas y los reclamos. | Política: consultas y reclamos. | Rectoría | Pendiente |
| `effective-date` | Fecha de vigencia de la política y de los términos. | Política y términos: vigencia. | Rectoría | Pendiente |
| `processors` | Encargados del tratamiento (alojamiento y almacenamiento de archivos), según el despliegue, que aún no está definido. | Política: encargados del tratamiento. | Coordinación y quien despliegue la plataforma | Pendiente |
| `rnbd` | Si aplica el registro de la base de datos ante la Superintendencia de Industria y Comercio (RNBD). | No se pinta en las páginas. | Rectoría y asesoría jurídica | Pendiente |
| `legal-review` | Revisión jurídica del colegio de los textos legales antes de publicarlos. | No se pinta en las páginas. | Asesoría jurídica del colegio | Pendiente |
