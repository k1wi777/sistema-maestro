# Tablero de diseño GNS (v52)

Referencia visual y funcional aprobada de la Plataforma GNS. Es un conjunto de
pantallas HTML estáticas con datos demo (nombres y correos inventados, dominio
`demo.gns.test`). **La aplicación no importa nada de esta carpeta**: solo sirve para
comparar. Está excluida del lint (`.prettierignore`), del build y del código.

## Cómo abrirlo

Abre `pantallas/index.html` en el navegador (doble clic) y entra a cualquier pantalla.
No necesita servidor. Las pantallas `Doc-*` son de la vista docente, las `Co-*` de
coordinación, las `Ad-*` de administración y `Aviso-datos` / `Main` son transversales. Algunas cargan las fuentes
desde Google Fonts: es solo del tablero, la app las sirve desde su propio dominio.

## Contenido

| Carpeta | Qué hay |
|---------|---------|
| `pantallas/` | HTML estático de cada pantalla, listo para abrir. |
| `assets/` | `gns-premium.css` (hoja consolidada con todas las capas), las capas por separado y el escudo (`.webp`). |
| `fuentes-tablero/` | Fuentes originales del tablero (`*.dc.html`) de las que salen las pantallas, y `canvas.json`, el índice del artefacto (páginas, posición y alto de cada tablero). |

## Qué trae la v52

Suma cinco mejoras de interfaz: **«Marcar todo»** en el aviso de tratamiento de datos (nada viene marcado y la aceptación sigue siendo «Acepto y continuar»); **filas clicables** en las bandejas de consulta de coordinación y administración (el enlace de «Acción» sigue siendo el control para teclado y lectores); **secciones nuevas y «Nuevo módulo» por sección** en Planes de formación; el nuevo **bloque de la cuenta** de la barra lateral (usuario, tema, «Cerrar sesión» y enlaces legales, también en el panel de celular); y el **selector de tema** integrado sobre la barra en claro y en oscuro. En «Avance en la formación» (`Co-avance`) se suma el acceso **«Verificar un certificado»** (abre la verificación pública en una pestaña nueva), también para administración. Estas mejoras son diseño aún no programado en la app. La v51 había sumado el **visor de PDF como diapositivas** en `Doc-modulo` (material complementario con página, Anterior/Siguiente, contador «Página N de M», pantalla completa, descarga y los estados de carga y error) y en la vista previa del editor (`Co-editor-modulo`, paso 6, sin marcar revisada), y el botón de **pantalla completa** del visor de diapositivas. La v50 sumó la **vista de administración** (`Ad-*`: Formatos en consulta, Bitácora de actividad, Docentes y asignaciones con "Usuarios y roles", y Grados y áreas, que pasan de coordinación a administración) y separa las tres vistas: ya no hay "Cambiar de vista" y `Main` es el formulario de ingreso. Coordinación **revisa** los registros de sus grados y **consulta** los del resto del colegio ("Solo consulta"). Los docentes pueden **descartar borradores** nunca enviados (planeación, observador y anotación del diario), y todas las barras laterales traen el **selector de tema** con iconos (Claro, Oscuro, Sistema). La v49 había adaptado el diario al formato F-PA-05.

Roles por vista, usuarios, descarte de borradores y selector de tema son diseño de la épica #112: aún no están programados en la app.

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
