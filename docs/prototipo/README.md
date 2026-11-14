# Tablero de diseño GNS (v47)

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
| `fuentes-tablero/` | Fuentes originales del tablero (`*.dc.html`) de las que salen las pantallas. |

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
