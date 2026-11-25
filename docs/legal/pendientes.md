# Datos legales pendientes de confirmar

Lista para la entrega final de la Plataforma GNS. Las páginas «Política de tratamiento de la
información» y «Términos de uso» (`apps/web/src/shared/legal/`) marcan cada uno de estos datos
como **Pendiente** mientras no se confirme; ningún dato legal se completa con un valor supuesto.
La columna «Quién lo confirma (propuesta)» es solo una sugerencia de este trabajo, no un dato confirmado: el colegio la valida.
La prueba `legal.spec.ts` compara en ambos sentidos: los ids de las filas con estado «Pendiente» de esta tabla
son exactamente las claves de `LEGAL_PENDING`. Un dato confirmado conserva su fila con estado «Confirmado» y
sale de `LEGAL_PENDING`.

Versión de los textos: `2026-5` (`LEGAL_DOCUMENTS_VERSION` en el frontend y
`DATA_POLICY_VERSION` en la API; al cambiar un texto se suben las dos).

| Id | Dato pendiente | Dónde aparece | Quién lo confirma (propuesta) | Estado |
|----|----------------|---------------|-------------------|--------|
| `legal-name` | Nombre legal del colegio: **George Noble School** (confirmado por el usuario el 2026-11-25; el NIT 900.358.305-3 también está confirmado). | Política y aviso: responsable del tratamiento. | Rectoría | Confirmado |
| `claims-area` | Área responsable de atender las consultas y los reclamos. | Política: consultas y reclamos. | Rectoría | Pendiente |
| `effective-date` | Fecha de vigencia de la política y de los términos. | Política y términos: vigencia. | Rectoría | Pendiente |
| `processors` | Encargados del tratamiento (alojamiento y almacenamiento de archivos), según el despliegue, que aún no está definido. | Política: encargados del tratamiento. | Coordinación y quien despliegue la plataforma | Pendiente |
| `rnbd` | Si aplica el registro de la base de datos ante la Superintendencia de Industria y Comercio (RNBD). | No se pinta en las páginas. | Rectoría y asesoría jurídica | Pendiente |
| `legal-review` | Revisión jurídica del colegio de los textos legales antes de publicarlos. | No se pinta en las páginas. | Asesoría jurídica del colegio | Pendiente |
