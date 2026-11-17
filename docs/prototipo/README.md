# Tablero de diseño GNS (v48)

Referencia visual y funcional aprobada de la Plataforma GNS. Es un conjunto de
pantallas HTML estáticas con datos demo (nombres y correos inventados, dominio
`demo.gns.test`). **La aplicación no importa nada de esta carpeta**: solo sirve para
comparar. Está excluida del lint (`.prettierignore`), del build y del código.

## Cómo abrirlo

Abre `pantallas/index.html` en el navegador (doble clic) y entra a cualquier pantalla.
No necesita servidor. Las pantallas `Doc-*` son de la vista docente, las `Co-*` de
coordinación y `Aviso-datos` / `Main` son transversales. Algunas cargan las fuentes
desde Google Fonts: es solo del tablero, la app las sirve desde su propio dominio.

## Contenido

| Carpeta | Qué hay |
|---------|---------|
| `pantallas/` | HTML estático de cada pantalla, listo para abrir. |
| `assets/` | `gns-premium.css` (hoja consolidada con todas las capas), las capas por separado y el escudo (`.webp`). |
| `fuentes-tablero/` | Fuentes originales del tablero (`*.dc.html`) de las que salen las pantallas, y `canvas.json`, el índice del artefacto (páginas, posición y alto de cada tablero). |

## Qué trae la v48

Pone el tablero al día con la app (menús de docente y coordinación, «Formatos» como
centro de planeación, diario, observador y PIAR, planeación con varias dimensiones o
asignaturas, «Recursos y D.U.A», video de YouTube en los módulos) y suma seis tableros
nuevos: `Doc-formatos`, `Doc-diario-dia`, `Doc-diario-director`, `Co-diarios`,
`Co-diario-revision` y `Co-grados`. El **diario de campo colaborativo** (un diario por
grupo y día, con aportes de varios docentes) y el **catálogo de grados, grupos y áreas**
son diseño de la épica #102: aún no están programados en la app.

## Cómo se derivan las pantallas

Cada `pantallas/X.html` sale de `fuentes-tablero/X.dc.html` con esta transformación
(se hace con un script desechable, que no se versiona):

1. Empieza con `<!doctype html><html lang="es"><head><meta charset="utf-8">`, el
   `<meta name="viewport">` y `<title>X</title>`, y un salto de línea.
2. Sigue el contenido de `<helmet>` (sin las etiquetas), tal cual.
3. Añade `<link rel="stylesheet" href="../assets/gns-premium.css"></head><body>` y dos
   saltos de línea.
4. Copia lo que hay entre `</helmet>` y `</x-dc>`, tal cual, y cierra con
   `</body></html>` sin salto final. El bloque `data-dc-script` se descarta.
5. Reemplaza `/_blob/e1ea58c2f0ffcb60b71179a93c6cc1a8` por
   `../assets/e1ea58c2f0ffcb60b71179a93c6cc1a8.webp` y `href="X.dc.html"` por
   `href="X.html"`.

`pantallas/index.html` es una sola línea con un `<li><a>` por pantalla, en orden
alfabético.

## Capas de estilo

`gns-premium.css` apila capas que se sobrescriben; **gana la última**. Orden de
precedencia, de menor a mayor:

1. Base (inicio de `gns-premium.css`): colores institucionales y maquetación inicial.
2. `layer-premium.css`: tokens de color, tipografía, radios y sombras del pulido premium.
3. `layer-secciones.css`: filtros segmentados, pestañas, tarjetas de registro, observaciones.
4. `layer-pulido.css`: tokens finales, foco por contorno, sombras neutras, ajustes finales.
5. `layer-pasos.css`: barra de pasos (wizard) y barra de acciones flotante.
6. `layer-iconos.css`: regla de relleno de iconos (los de trazo abierto nunca se rellenan).

El sistema de diseño de la app (`apps/web/src/shared/ui`) traslada los valores finales
de estas capas a tokens CSS y componentes; no copia la hoja.
