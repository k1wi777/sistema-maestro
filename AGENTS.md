# AGENTS.md — REI Harness

> Este archivo es el **punto de entrada universal** para cualquier agente de IA que trabaje en este repositorio.
>
> Su objetivo es proporcionar únicamente el contexto esencial para orientarse dentro del proyecto y saber dónde encontrar información adicional. **No debe contener toda la documentación del proyecto.**
>Carga únicamente el contexto necesario para la tarea actual.
> Las responsabilidades específicas de cada rol se encuentran en `.rei/agents/`.
> Cada rol se define en `.rei/agents/<rol>.md` con frontmatter, un `## Contrato`
> autosuficiente y una `## Referencia` opcional; a los subagentes se les
> transmite únicamente el `## Contrato`. Consulta `.rei/docs/harness/adapters.md`.

**No ignores estas reglas.**

---

# 1. Antes de comenzar

Antes de realizar cualquier modificación en el proyecto:

1. Ejecuta `rei check --quiet`.
2. Si falla, DETENTE e informa el problema.
3. Carga únicamente la documentación necesaria para la tarea actual siguiendo el orden de la Sección 8.

No continúes hasta completar estos pasos.

---

# 2. Propósito del proyecto

## Qué construimos

La **Plataforma GNS**: la plataforma web institucional de George Noble School
(Montería, Colombia) que centraliza la planeación de clases con el modelo
pedagógico GNS, los formatos institucionales (diario de campo F-PA-05 y
observador del estudiante), el plan de formación docente (inducción y planes por
área, con Desafío GNS y certificados), un asistente de preguntas frecuentes y la
revisión y auditoría por coordinación académica. Sustituye documentos sueltos,
formularios y correos, y deja trazabilidad de cada acción.

Contexto completo: `CONTEXTO_Plataforma_GNS.md`. Tareas en orden:
`Backlog_de_desarrollo_Plataforma_GNS.md`.

## Para quién

- **Docentes** de todos los niveles (preescolar, primaria y bachillerato): planean, registran formatos, hacen su formación y consultan el asistente.
- **Coordinación académica**: revisa, ajusta, aprueba o devuelve registros; asigna grados y áreas; crea planes de formación por área; consulta la bitácora. Es el auditor de la plataforma.
- **Administrador** de la plataforma: crea los usuarios y asigna sus roles (nadie se registra solo).

## Principios

*Todas las decisiones deben respetar estos principios. Son reglas no negociables.*

- **Privacidad de menores** — De los estudiantes solo se registra el **nombre de pila**. Nunca documentos de identidad, direcciones, teléfonos, datos de salud, diagnósticos ni fotos. Los datos demo usan nombres inventados.
- **Bitácora inmutable** — La bitácora nunca se borra ni se modifica: es de solo inserción y la base de datos rechaza UPDATE, DELETE y TRUNCATE con triggers. Cada acción relevante queda registrada (fecha, hora, usuario, rol y detalle).
- **Nada se borra físicamente** — Los registros pedagógicos pasan a estado `anulado` y queda constancia; no se usan DELETE físicos sobre ellos.
- **Sin IA en esta fase** — Ninguna integración de inteligencia artificial: ni en el asistente (usa preguntas programadas), ni en la planeación, ni en los módulos, ni en el PIAR.
- **Consentimiento previo** — Sin aceptación vigente del aviso de tratamiento de datos (Ley 1581 de 2012) no se puede usar la plataforma; la aceptación queda registrada con fecha y versión.
- **Todo pasa por la API** — El frontend nunca habla directamente con la base de datos ni con el almacenamiento de archivos; la API valida permisos y deja constancia en la bitácora.

## Qué NO es

- No incluye en esta fase: despliegue (pruebas y producción), dominio, PIAR, control de notas, reporte a coordinación ni IA.
- No es un sistema de gestión de estudiantes: no guarda datos personales de menores más allá del nombre de pila.
- No permite autorregistro: los usuarios los crea el administrador.
- No es el prototipo de claude.ai: ese prototipo es solo referencia visual y funcional; el almacenamiento definitivo es PostgreSQL.

---

# 3. Stack técnico

## Tecnologías principales

- **Lenguaje:** TypeScript en modo estricto en todo el proyecto.
- **Framework:** NestJS (backend, `apps/api`, modular con patrón repository) y Next.js App Router (frontend, `apps/web`, feature first). Monorepo con pnpm workspaces y Turborepo; tipos y esquemas Zod comunes en `packages/shared`. API documentada con OpenAPI (Swagger).
- **Base de datos:** PostgreSQL 16 con Prisma (esquema, migraciones y seeds en `apps/api/prisma/`). Archivos en Cloudflare R2 (MinIO en local).
- **Autenticación:** JWT en cookie httpOnly con proveedor intercambiable (usuario y contraseña; Google Workspace por decidir).
- **Testing:** Jest y Supertest con Testcontainers (PostgreSQL real) en el backend; Playwright en el frontend.
- **Despliegue:** fuera de esta fase; todo corre en local con Docker Compose (PostgreSQL + MinIO) y datos demo. CI con GitHub Actions (lint, pruebas y build).
- **Idioma:** código (clases, funciones, variables, tipos y archivos) en inglés; base de datos en español y snake_case, con mapeo Prisma (`@@map` / `@map`); textos visibles para el usuario en español. Commits con Conventional Commits más el ID del backlog. Ver `.rei/docs/project/conventions.md`.
- **Entorno de desarrollo verificado:** Windows 10, Node 26.13 (nvm), pnpm 12.18, Docker Desktop con Compose v5.6.

## Comandos principales

Todos se ejecutan desde la raíz del repositorio.

- `pnpm install` — Instalar dependencias; al terminar compila `@gns/shared` (necesario para el lint con tipos).
- `pnpm dev` — Desarrollo: arranca la API en modo observación (recarga ante cambios en `apps/api/src`).
- `pnpm build` — Build de todo el monorepo con Turborepo.
- `pnpm lint` — ESLint + Prettier (solo comprobación); también corre en el hook de pre-commit sobre los archivos en stage.
- `pnpm format` — Aplica el formato de Prettier.
- `pnpm test` — Tests; hoy ejecuta las pruebas unitarias (Jest). La integración con PostgreSQL real (Testcontainers) llega en BE-27.
- `docker compose up -d` — Levantar PostgreSQL 16 y MinIO en local.

---

# 4. Estructura del repositorio

*Utiliza este mapa para orientarte dentro del proyecto.*

| Ruta | Propósito |
|------|-----------|
| `apps/api/` | API NestJS (`@gns/api`); pruebas `*.spec.ts` junto al código. |
| `apps/api/src/core/` | Núcleo transversal de la API; hoy, la configuración (variables de entorno validadas con Zod). |
| `apps/web/` | Frontend (`@gns/web`); esqueleto TypeScript hasta FE-01 (Next.js). |
| `packages/shared/` | Tipos, esquemas Zod y constantes compartidos (`@gns/shared`). |
| `docker-compose.yml` | Entorno local: PostgreSQL 16 y MinIO. |
| `.github/workflows/` | CI con GitHub Actions: lint, pruebas y build en cada pull request. |
| `.rei/specs/` | Work Items y planificación del REI Harness. |
| `.rei/progress/` | Estado actual (`current.md`), historial general (`history.md`) y detalle de Work Items. |
| `.rei/progress/work-items/` | Registros detallados de cada Work Item, organizados cronológicamente. |
| `.rei/docs/harness/` | Documentación del arnés (workflow, specs, progreso). |
| `.rei/docs/project/` | Documentación específica del proyecto. |
| `.rei/agents/` | Roles y comportamiento de los subagentes (frontmatter + `## Contrato` + `## Referencia`). |
| `.rei/adapters/` | Adaptadores de runtime (plantilla + mapa de herramientas); p. ej. `opencode/`. |
| `.rei/templates/` | Plantillas canónicas (`current.md`, `history.md`, `meta.json`). Fuente única de verdad. |

- **Patrón repository en el backend:** controlador (recibe y valida) → servicio (reglas del negocio) → repository (único que toca la base de datos).
- **Dependencias:** un módulo del backend usa a otro solo por su servicio exportado; una feature del frontend no importa otra feature; lo común va a `shared` (`apps/web/src/shared` o `packages/shared`).
- Detalle de la arquitectura y la estructura prevista: `.rei/docs/project/architecture.md`.

---

# 5. Workflow

Todo Work Item debe seguir el workflow definido por el proyecto.

Antes de comenzar cualquier trabajo consulta:

`.rei/docs/harness/workflow.md`

**No omitas ninguna etapa del workflow.**

### Modo directo autorizado

El **modo directo** es una vía fuera del workflow de Work Items —no un tipo ni un
estado— para que el Leader aplique un cambio trivial solicitado explícitamente.
Solo se activa si el usuario pide un «cambio directo» o «sin Work Item»; el
Leader nunca lo inicia por iniciativa propia.

- **Elegible:** documentación, erratas, formato, comentarios o ajustes triviales
  sin cambio de comportamiento.
- **Negativa:** si afecta comportamiento, seguridad, datos, dependencias, API
  pública, arquitectura, más de un archivo o necesita especificación o revisión,
  el Leader se niega y ofrece Task o Feature. La insistencia del usuario no es
  autorización: no hay override.
- **Autorización:** aun siendo elegible, el Leader pide confirmación explícita e
  informa de que no habrá planificación, rama ni registro. Si duda, avisa y exige
  esa confirmación; el defecto es **no** aplicar el modo directo.
- **Sin registro:** no crea Work Item, spec, `meta.json`, `current.md`,
  `history.md`, `direct.md`, sesión, issue ni rama, ni altera Work Items
  existentes; opera sobre la rama y el árbol actuales y su única traza es el
  diff/commit y la conversación.
- **Verificación:** siempre `rei check` y, según el cambio, los checks del
  proyecto declarados en `.rei/config.json`/`verification.md`; el Leader reporta
  comandos y resultado. Sin Reviewer salvo petición explícita del usuario.
- **Entrega:** sin una orden explícita no hay commit, push, PR ni merge.

Esta es la única excepción a «no omitas etapas» y a la prohibición de implementar
del rol Leader; el resto de reglas duras sigue vigente. Ver
`.rei/docs/harness/workflow.md`.

---

# 6. Rol del agente principal

El agente que recibe directamente las solicitudes del usuario actúa siempre como **Leader**.

Antes de comenzar cualquier tarea DEBE consultar:

`.rei/agents/leader.md`

El Leader es el único responsable de:

- comprender la solicitud del usuario;
- seleccionar el workflow adecuado;
- coordinar a los demás subagentes.

Ningún otro agente debe asumir estas responsabilidades.

Al delegar en un subagente, el Leader transmite únicamente la sección `## Contrato`
del rol correspondiente, nunca el archivo completo (`## Referencia` es detalle
opcional y no se envía). Si el runtime dispone de un adaptador nativo
(`rei init opencode`), el subagente recibe ese mismo Contrato como system prompt.

Si el usuario pide personalizar el proyecto (por ejemplo, «personaliza mi
proyecto»), el Leader NO crea un Work Item: delega directamente en el rol
`initializer` (`.rei/agents/initializer.md`) transmitiéndole su `## Contrato` y
espera a que finalice. En un runtime con adaptador nativo, el comando
`/personalize` ejecuta este mismo camino.

---

# 7. Documentación

Consulta únicamente la documentación necesaria para la tarea actual.

## Documentación de REI Harness

Define cómo funciona el arnés. No requiere personalización por proyecto.

| Si necesitas... | Consulta... |
|-----------------|-------------|
| Workflow | `.rei/docs/harness/workflow.md` |
| Spec Driven Development | `.rei/docs/harness/specs.md` |
| Sistema de progreso | `.rei/docs/harness/progress.md` |
| Estructura de `meta.json` | `.rei/docs/harness/meta.md` |
| Roles y adaptadores | `.rei/docs/harness/adapters.md` |
| El comportamiento de un agente | `.rei/agents/<role>.md` |

## Documentación del proyecto

Describe las reglas de **este repositorio**. Debe personalizarse al implementar REI Harness.

| Si necesitas... | Consulta... | Quién lo lee por defecto |
|-----------------|-------------|--------------------------|
| Arquitectura | `.rei/docs/project/architecture.md` | Implementer, Spec Author (diseño) |
| Convenciones | `.rei/docs/project/conventions.md` | Implementer |
| Verificación | `.rei/docs/project/verification.md` | Reviewer |

## Work Items

| Si necesitas... | Consulta... |
|-----------------|-------------|
| Un Work Item concreto | `.rei/specs/<work-item-id>/` |
| El comportamiento de un agente | `.rei/agents/<role>.md` |
No cargues documentación que no aporte contexto a la tarea actual.

---

# 8. Carga de contexto

Prioriza siempre la carga de información en el siguiente orden:

1. `AGENTS.md`
2. `.rei/agents/<role>.md`
3. `docs/...`
4. `.rei/specs/<work-item-id>/`

Carga únicamente el contexto necesario para completar la tarea actual.

---

# 9. Principios generales

Estas reglas aplican a cualquier agente del repositorio.

- La documentación es la fuente de verdad.
- Trabaja sobre un único Work Item por sesión. El **modo directo autorizado**
  (§5) es la excepción: no abre ni modifica Work Items ni sesión, y solo se usa
  con disparador y confirmación explícitos.
- No omitas etapas del workflow.
- Consulta la documentación antes de asumir comportamientos no especificados.
- Si encuentras documentación contradictoria, DETENTE y repórtala.
- Para conocer el estado de la sesión o de los Work Items, usa el CLI (`rei session`, `rei items status`); no escanees `meta.json` manualmente.
- No releas un archivo que ya esté en tu contexto; para localizar un dato concreto usa búsquedas en lugar de releer el archivo completo.
- En caso de conflicto entre documentos, prevalece el orden inverso de la Sección 8:
  `.rei/specs/<work-item-id>/` > `.rei/docs/...` > `.rei/agents/<role>.md` > `AGENTS.md`.
