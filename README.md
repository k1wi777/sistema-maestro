# Plataforma GNS

Plataforma web institucional de **George Noble School** (Montería, Colombia). Reúne en un solo lugar la planeación de clases con el modelo pedagógico GNS, los formatos institucionales (diario de campo F-PA-05 y observador del estudiante), el plan de formación docente con Desafío GNS y certificados, un asistente de preguntas frecuentes, la revisión por coordinación académica y la auditoría por administración. Sustituye documentos sueltos, formularios y correos, y deja constancia de cada acción.

> Proyecto privado de uso institucional. No tiene licencia de uso público.

## Contenido

- [Funcionalidades](#funcionalidades)
- [Roles](#roles)
- [Principios del proyecto](#principios-del-proyecto)
- [Stack técnico](#stack-técnico)
- [Arquitectura](#arquitectura)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Requisitos](#requisitos)
- [Puesta en marcha local](#puesta-en-marcha-local)
- [Variables de entorno](#variables-de-entorno)
- [Comandos](#comandos)
- [Pruebas y calidad](#pruebas-y-calidad)
- [Flujo de trabajo y contribución](#flujo-de-trabajo-y-contribución)
- [Seguridad y privacidad](#seguridad-y-privacidad)
- [Despliegue](#despliegue)
- [Documentación](#documentación)
- [Alcance de esta fase](#alcance-de-esta-fase)

## Funcionalidades

| Módulo | Qué permite |
|---|---|
| **Planeación GNS** | Crear, enviar y corregir planeaciones de clase por grado, área y periodo; recursos digitales; repositorio de actividades compartidas; impresión. |
| **Diario de campo F-PA-05** | Un diario colaborativo por grupo y día: cada docente anota su área y el director de grupo lo envía. Genera la hoja impresa institucional. |
| **Observador del estudiante** | Anotaciones positivas, académicas y de convivencia (tipos I, II y III) con estrategias pedagógicas. Del estudiante solo se registra el nombre de pila. |
| **Revisión** | La coordinadora de cada grado aprueba, ajusta o devuelve con observaciones; historial y cumplimiento de entregas por periodo. |
| **Formación docente** | Inducción y planes por área con video, presentaciones (visor de PDF), Desafío GNS, juegos y simuladores. Certificados PDF con verificación pública por código. |
| **Asistente** | Preguntas frecuentes con búsqueda en español. Las preguntas sin respuesta se agrupan para que coordinación las atienda. No usa IA. |
| **Administración** | Usuarios y roles, grados, grupos, áreas, coordinadora por grado, asignaciones docentes y bitácora de auditoría con exportación CSV. |

## Roles

Los roles no tienen jerarquía: cada uno tiene su propia vista. Nadie se registra solo; las cuentas las crea el administrador.

| Rol | Puede |
|---|---|
| **Docente** | Planear, registrar diario y observador, hacer su formación y consultar el asistente. |
| **Coordinador** | Revisar los registros de **sus grados** y consultar los demás; asignar docentes en sus grados; crear planes de formación y seguir el avance; gestionar las preguntas frecuentes. |
| **Administrador** | Crear usuarios y asignar roles; gestionar la estructura académica; consultar todos los registros sin revisarlos. Es el único que consulta la bitácora. |

## Principios del proyecto

Son reglas no negociables:

- **Privacidad de menores.** De los estudiantes solo se guarda el nombre de pila: nunca documentos, direcciones, teléfonos, datos de salud ni fotos. Los datos demo usan nombres inventados.
- **Bitácora inmutable.** Es de solo inserción; la base de datos rechaza `UPDATE`, `DELETE` y `TRUNCATE` con triggers.
- **Lo enviado nunca se borra.** Pasa a estado `anulado` con constancia. Solo el borrador nunca enviado se puede descartar.
- **Sin IA en esta fase.**
- **Consentimiento previo.** Sin aceptar el aviso de tratamiento de datos vigente (Ley 1581 de 2012) no se puede usar la plataforma.
- **Todo pasa por la API.** El frontend nunca habla con la base de datos ni con el almacenamiento.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript 5.9 en modo estricto |
| Frontend | Next.js 16 (App Router) y React 19, CSS Modules, pdf.js |
| Backend | NestJS 11 con patrón repository, OpenAPI (Swagger) |
| Validación | Zod 4, con esquemas compartidos entre web y API |
| Base de datos | PostgreSQL 16 con Prisma 7 |
| Archivos | Almacenamiento compatible con S3: Cloudflare R2, o MinIO en local |
| Autenticación | JWT en cookie `httpOnly`, refresco rotado y contraseñas con argon2id |
| Monorepo | pnpm workspaces y Turborepo |
| Pruebas | Jest, Supertest y Testcontainers en la API; Playwright y axe-core en la web |
| CI | GitHub Actions |

## Arquitectura

```
Navegador ──HTTPS──▶ Web (Next.js, :3001) ──JSON──▶ API (NestJS, :3000) ──SQL──▶ PostgreSQL 16
    │                                                 │
    └──── PUT/GET con URL firmada ──▶ Almacenamiento S3 ◀── firma y confirma
```

- **Backend:** modular por dominio. Cada petición recorre la cadena controlador → servicio → repository, y el repository es lo único que toca la base. Antes pasa por tres controles globales: límite de peticiones, sesión y rol, y aviso de datos. Cada endpoint declara si es público o qué roles lo usan; si falta la declaración, la API no arranca. La bitácora se escribe en la misma transacción que la operación.
- **Frontend:** organizado por funcionalidad (*feature first*); una feature no importa otra y lo común vive en `shared`. El cliente HTTP se genera desde el contrato OpenAPI versionado.

El detalle completo está en `.rei/docs/project/architecture.md`.

## Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `apps/api/` | API NestJS (`@gns/api`): `src/core`, `src/modules`, `src/shared`, `prisma/` (esquema, migraciones y semillas) y `test/`. |
| `apps/web/` | Frontend Next.js (`@gns/web`): `src/app` (rutas), `src/features`, `src/shared` (incluye el sistema de diseño) y `e2e/` (Playwright). |
| `packages/shared/` | Tipos, constantes y esquemas Zod comunes (`@gns/shared`). |
| `docs/` | Prototipo visual (tablero v47), formatos de referencia, textos legales pendientes y lista de control de seguridad y privacidad. |
| `scripts/` | Utilidades de CI, como la selección de pruebas afectadas. |
| `.github/workflows/` | Integración continua. |
| `.rei/` | Arnés de trabajo REI: Work Items, progreso, roles y documentación del proyecto. |
| `docker-compose.yml` | Entorno local: PostgreSQL 16 y MinIO. |

## Requisitos

- **Node.js 26.13**, la versión de `.nvmrc`. Se recomienda nvm.
- **pnpm 12.18**: `corepack enable` toma la versión de `packageManager`.
- **Docker Desktop**, con Compose, para la base de datos, el almacenamiento y las pruebas.
- **Puertos libres:** 3000 (API), 3001 (web), 5432 (PostgreSQL) y los de MinIO.

## Puesta en marcha local

```bash
# 1. Dependencias (compila @gns/shared, genera el cliente Prisma y los tipos de la API)
pnpm install

# 2. Servicios locales: PostgreSQL 16 y MinIO
docker compose up -d

# 3. Variables de entorno (completar los valores locales)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 4. Base de datos, datos iniciales y bucket
pnpm --filter @gns/api db:deploy
pnpm --filter @gns/api db:seed
pnpm --filter @gns/api storage:init

# 5. Contraseña del primer administrador (una sola vez)
pnpm --filter @gns/api admin:init-password

# 6. Opcional: datos demo con usuarios ficticios (solo en local)
pnpm --filter @gns/api db:demo:load

# 7. Desarrollo
pnpm dev
```

Al terminar:

- La web queda en http://localhost:3001.
- La API queda en http://localhost:3000, con Swagger en http://localhost:3000/docs.
- La página de muestra del sistema de diseño está en http://localhost:3001/muestra.

> Usa siempre `localhost`, nunca `127.0.0.1`: para CORS y para las cookies son orígenes distintos.

## Variables de entorno

Las plantillas comentadas son `apps/api/.env.example` y `apps/web/.env.example`. La API valida todas las variables al arrancar: si una es inválida, se detiene y nombra cuál, sin mostrar su valor.

| Grupo | Variables principales |
|---|---|
| Servidor | `NODE_ENV`, `PORT`, `CORS_ORIGINS`, `TRUST_PROXY`, `LOG_LEVEL` |
| Base de datos | `DATABASE_URL`, `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` |
| Sesión | `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_SECRET` (32 caracteres o más y distintos), `ACCESS_TOKEN_TTL_MINUTES`, `SESSION_IDLE_TIMEOUT_HOURS`, `SESSION_REMEMBER_MAX_DAYS`, `AUTH_COOKIE_SECURE` |
| Límites | `RATE_LIMIT_*`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_SECONDS` |
| Aviso de datos | `DATA_POLICY_VERSION`, que debe coincidir con `LEGAL_DOCUMENTS_VERSION` de la web |
| Almacenamiento | `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_*_TTL_SECONDS` |
| Solo desarrollo | `ADMIN_INITIAL_PASSWORD` y `DEMO_USERS_PASSWORD`; la API no arranca con ellas en producción |
| Web | `NEXT_PUBLIC_API_URL` (obligatoria) y `NEXT_PUBLIC_SITE_URL` |

Nunca se versiona un archivo `.env`.

## Comandos

Todos se ejecutan desde la raíz del repositorio.

| Comando | Uso |
|---|---|
| `pnpm dev` | API en modo observación y web en desarrollo. |
| `pnpm build` | Compila todo el monorepo con Turborepo. |
| `pnpm lint` | ESLint y Prettier, solo comprobación. También corre en el *pre-commit*. |
| `pnpm format` | Aplica el formato de Prettier. |
| `pnpm test` | Pruebas unitarias y de integración. |
| `pnpm test:db` | Pruebas de base de datos: triggers, privilegios, semillas. Requiere la base migrada. |
| `pnpm test:e2e` | Pruebas extremo a extremo de la API. |
| `pnpm test:e2e:web` | Pruebas de navegador y accesibilidad (Playwright y axe). |
| `pnpm api:contract` | Tras cambiar la API: exporta `openapi.json` y regenera los tipos de la web. |
| `pnpm --filter @gns/api db:migrate` | Crea una migración en desarrollo. |
| `pnpm --filter @gns/api db:check` | Valida el esquema y detecta diferencias con las migraciones. |
| `pnpm --filter @gns/api db:demo:clear` | Limpia los datos demo (solo en local). |

## Pruebas y calidad

- **API:** pruebas unitarias; pruebas de integración con PostgreSQL y MinIO reales en contenedores efímeros (Testcontainers); pruebas de base de datos; y recorridos extremo a extremo.
- **Web:** pruebas unitarias de lógica y Playwright con los tres procesos institucionales (planeación, formatos y formación). Incluye revisión de accesibilidad WCAG 2.2 AA con axe en tema claro y oscuro, a 375 y 768 px.
- **Requisitos de `pnpm test:e2e:web`:** Docker, haber ejecutado `pnpm build`, los puertos 3000 y 3001 libres y Chromium. Chromium se instala una vez con `pnpm --filter @gns/web exec playwright install chromium`.
- **Calidad estática:** TypeScript estricto, ESLint con reglas de arquitectura (Prisma solo en repositories, features aisladas) y Prettier.
- **CI:** GitHub Actions ejecuta lint, pruebas, migraciones, compilación y pruebas de navegador en cada *pull request*.

Antes de subir cambios, la suite debe pasar en local.

## Flujo de trabajo y contribución

El desarrollo sigue el arnés **REI**. Su punto de entrada es [`AGENTS.md`](AGENTS.md).

- Antes de modificar el proyecto se ejecuta `rei check --quiet`.
- Cada cambio es un Work Item con especificación, implementación y revisión. El workflow está en `.rei/docs/harness/workflow.md`.
- **Ramas:** `main` es la principal. Las épicas usan `epic/<slug>` y las features `feat/<n>-<slug>`, con *pull request* hacia su épica.
- **Commits:** Conventional Commits, con el ID del backlog cuando aplica. Ejemplo: `feat(planeacion): add submit validation (BE-52)`.
- **Idioma:**
  - el código (clases, funciones, variables y archivos) va en inglés;
  - la base de datos va en español `snake_case`;
  - todo texto visible para el usuario va en español.
- Las convenciones completas están en `.rei/docs/project/conventions.md`, y la verificación en `.rei/docs/project/verification.md`.

## Seguridad y privacidad

- **Cookies de sesión:** `httpOnly`, `SameSite=Strict` y `Secure` en producción. El token de refresco rota en cada uso, y si se reutiliza se cierran todas las sesiones.
- **Acceso:** se niega por defecto, con roles exactos y alcance por grado. Quien envía o aporta a un registro no puede revisarlo.
- **Peticiones de escritura:** se rechaza con 403 la que llega de un origen ajeno. Todas las respuestas llevan `Cache-Control: no-store`.
- **Archivos:** solo se accede a ellos con URL firmadas de corta duración; el navegador nunca recibe credenciales.
- **Registros técnicos:** no incluyen cuerpos, cookies, IP ni secretos. La bitácora oculta los secretos y los textos sobre menores.
- **Controles verificados:** 65 controles en [`docs/security-privacy-checklist.md`](docs/security-privacy-checklist.md).

Si encuentras una vulnerabilidad, repórtala en privado al equipo del proyecto, no en un *issue* público.

## Despliegue

El despliegue de producción queda fuera de esta fase. Existe una demostración en servicios gestionados: Railway para la API y PostgreSQL, Vercel para la web y Cloudflare R2 para los archivos. No es un entorno de producción.

El procedimiento para el entorno institucional está en la *Guía técnica de despliegue* (GNS-PLT-GD-001). Los datos demo **nunca** se cargan fuera de un entorno local.

## Documentación

| Documento | Ubicación |
|---|---|
| Punto de entrada para agentes y reglas del repositorio | [`AGENTS.md`](AGENTS.md) |
| Contexto del proyecto | [`CONTEXTO_Plataforma_GNS.md`](CONTEXTO_Plataforma_GNS.md) |
| Backlog de desarrollo | [`Backlog_de_desarrollo_Plataforma_GNS.md`](Backlog_de_desarrollo_Plataforma_GNS.md) |
| Arquitectura, convenciones y verificación | `.rei/docs/project/` |
| Contrato de la API (OpenAPI) | `apps/web/src/shared/api/openapi.json` |
| Seguridad y privacidad | [`docs/security-privacy-checklist.md`](docs/security-privacy-checklist.md) |
| Pendientes legales | [`docs/legal/pendientes.md`](docs/legal/pendientes.md) |
| Prototipo visual | `docs/prototipo/` |
| Manual técnico del sistema (GNS-PLT-MT-001) y guía de despliegue | Documentos institucionales aparte |

## Alcance de esta fase

Quedan fuera de esta fase:

- el despliegue a pruebas y producción, y el dominio institucional;
- el PIAR y el control de notas;
- el reporte a coordinación;
- cualquier integración de inteligencia artificial.

La plataforma no es un sistema de gestión de estudiantes y no permite el autorregistro.

---

George Noble School · Montería, Colombia
