# Bases unificadas: reglas para trabajar en este repositorio

## Qué es
Web de tablas relacionadas, sin dependencias ni compilación. Se publica con GitHub Pages desde `main`. La interfaz y los mensajes están en español.

Archivos:
- `index.html`: la estructura de la página (inicio, libro y diálogos).
- `estilos.css`: todos los estilos y los temas.
- `app.js`: todo el comportamiento.
- `pruebas/flujo.js`: prueba automática de los flujos principales.
- `docs/`: lineamientos y plan.

Al abrir la web se muestra la página de inicio (libros, reportes guardados y respaldo); desde ahí se entra al libro. Las dos vistas viven en `index.html` y la función `mostrar` cambia entre ellas.

## Regla más importante: ningún dato real en el código
- El repositorio es público. Nunca agregues datos del usuario (pagos, servicios, nombres de personas, empresas, sucursales, proveedores, libros personales) a `index.html` ni a ningún archivo.
- Los únicos datos permitidos en el código son las tres tablas de ejemplo: Ventas, Clientes y Productos. Lo mismo vale para `docs/`: los ejemplos de los lineamientos y del plan son inventados, no la estructura real de ningún libro.
- Los datos reales viven en el navegador de cada persona y entran por Restaurar respaldo.
- No subas archivos de respaldo (`*.json` con `"app":"bases-unificadas"`).
- Las pruebas solo usan las tablas de ejemplo o datos inventados.

## Compatibilidad de datos
- El estado se guarda con la clave `bases-unificadas-v1` en dos lugares: IndexedDB (base `bases-unificadas`, almacén `datos`), que es el principal, y `localStorage`, que es una copia mientras quepa. Al abrir se usa el más reciente según `state.mod`. No quites ninguno de los dos: la copia de `localStorage` es la que trae los datos de quien usó versiones anteriores y la que protege el último cambio al cerrar.
- El estado guardado debe seguir abriendo después de cada cambio. Si cambias la forma de los datos, agrega una migración que convierta el estado anterior; no rompas respaldos existentes.
- Tipos de columna: text, number, date, select, multi, check, relation, lookup, formula, sum.
- Cada columna puede llevar `pie` (`sum`, `avg` o `count`): el total que muestra al pie. También es opcional.
- Cada columna puede llevar `oculta`. Para pintar usa `visibles(t)`; para calcular, filtrar o exportar usa `t.cols`. El orden de `t.cols` es el orden en pantalla y la primera columna es el nombre de la fila para las relaciones.
- Cada tabla puede llevar `plantillas` (cómo se arma un reporte: desgloses, suma, detalle, paleta y hoja). Un reporte guardado puede llevar o no segundo desglose (`g2Name`, `sub`) y totales del detalle (`pie`): los reportes anteriores, que no los tienen, deben seguir abriendo.
- Cada tabla puede llevar `vistas` (búsqueda, filtro y orden con nombre). Es un campo opcional: una tabla sin él sigue abriendo igual.
- Todo respaldo pasa por `revisarEstado` antes de restaurarse. Si agregas un campo que se escribe en la página, revísalo ahí y escápalo con `esc` al pintarlo.
- Si no se pudo guardar en ninguno de los dos lugares, se muestra el aviso `avisoGuardado`; no ocultes ese error.
- Al abrir, lo guardado se completa con lo mínimo si llegó incompleto (libro sin tablas, tabla sin filas): la página nunca debe quedar en blanco por un dato mal formado.
- Dos pestañas: al guardar se avisa a las demás por `BroadcastChannel`; la que recibe el aviso deja de guardar y muestra `avisoPestana` hasta recargar. No quites ese bloqueo: sin él, la pestaña vieja pisa los cambios de la nueva.

## Funciones según la forma del libro
"Generar mes" e "Importar nota" no están atadas a ningún libro: `piezasGen` y `piezasNota` buscan las tablas y columnas por nombre (lista en el README) y el botón aparece solo si están. No uses identificadores fijos de tablas o columnas en el código; si agregas una función así, búscala por nombre y documenta los nombres en el README.

## Diseño y accesibilidad
- Blanco y negro. Solo tres colores con significado: azul para positivos, rojo para negativos, amarillo para resaltado. Los reportes son la excepción y tienen paletas propias.
- Todos los colores salen de las variables CSS definidas en `:root`; cada tema (claro, oscuro, alto contraste claro y oscuro) redefine las mismas variables.
- Botones de al menos 40 px (44 px en la barra lateral), foco visible, y nunca usar el color como única señal.
- Cada control lleva nombre accesible; las tablas declaran encabezados y orden.
- La página no se desplaza a los lados; solo las tablas, dentro de su contenedor.
- Tipografía: IBM Plex Sans para texto, IBM Plex Mono para números.
- Textos en español claro, sin términos técnicos. Los botones dicen lo que hacen con un verbo.
- El tamaño de letra solo se cambia para la tabla completa (Opciones); no lo agregues como formato de celda, fila o columna.
- Los avisos (`toast`) se muestran dentro del diálogo que esté abierto; fuera de él quedarían tapados.
- El botón Atrás cierra primero el diálogo que esté encima. Cada diálogo abierto ocupa una entrada del historial y `cuadra()` las mantiene parejas; abre los diálogos siempre con `showModal()` y no llames a `history` directamente.
- Borrados: filas y formato se deshacen; columnas, tablas, libros y salas piden un segundo toque.

## Dentro y fuera de Claude
El mismo código corre como página independiente y como artefacto dentro de Claude. La constante `NATIVO` distingue los dos casos: fuera de Claude se usan la descarga y la impresión del navegador; dentro, la capacidad `downloads` y solo vista previa de impresión. El botón de pantalla completa de la presentación solo aparece donde el navegador la permite. Para publicarlo como artefacto, `estilos.css` y `app.js` se suben junto con `index.html` como archivos de apoyo.

## Antes de subir un cambio
- Comprueba la sintaxis (`node --check app.js`) y corre `node pruebas/flujo.js`; agrega ahí una comprobación del flujo que tocaste.
- Revisa que no haya entrado ningún dato real.
- Describe el cambio en español en el mensaje del commit.
