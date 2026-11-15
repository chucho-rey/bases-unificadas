# Bases unificadas

Web para guardar tablas, relacionarlas entre sí y consultarlas desde un solo lugar. Minimalista, accesible y pensada para usarse desde el celular.

## Qué hace

- Página de inicio con tus libros, los reportes guardados y el estado del respaldo.
- Libros con tablas editables, organizados en secciones y salas.
- Relaciones entre tablas, columnas calculadas y sumas de otra tabla.
- Menú por columna para dar negritas o resaltado a la columna completa y mostrar su total al pie (suma, promedio o conteo).
- Buscar, filtrar y ordenar en dos niveles, y guardar esa combinación como una vista con nombre.
- Reportes con paletas de color, uno o dos desgloses y totales, que se guardan, se repiten con plantillas y se imprimen en carta vertical u horizontal.
- Respaldo completo en un archivo, con restauración.
- Tema claro, oscuro y alto contraste.

## Funciones que aparecen según las tablas

Dos botones se muestran solos cuando el libro abierto tiene las tablas y columnas que necesitan. Los nombres se reconocen sin importar mayúsculas ni acentos.

**Generar mes** crea las filas de un periodo a partir de una lista de conceptos. Necesita:

- Una tabla con una columna de texto `Periodo` y una relación hacia la tabla de conceptos. Si tiene `Estatus`, las filas nuevas quedan en Pendiente.
- En la tabla de conceptos, una columna `Recurrencia` (Mensual, Anual, Único…). Con `Mes de pago`, los anuales solo se generan en su mes.

**Importar nota** agrega un servicio con su mano de obra y sus refacciones a partir de un bloque de texto. Necesita:

- Una tabla `Servicios` con una columna de texto `ID` o `Folio`.
- Las tablas `Mano de obra` y `Refacciones`, cada una con una relación hacia Servicios y una columna numérica `Importe`.
- Opcionales en Servicios: `Fecha`, `Vehículo` y `Taller` (relaciones), `Tipo`, `Descripción`, `Estatus de pago`, `KM al servicio` y `Nota`. En Refacciones: `Refacción`, `Cantidad` y `Detalle original`. En Mano de obra: `Concepto`.

## Dónde están los datos

Este repositorio contiene solo el código y tres tablas de ejemplo. Los datos de cada persona se guardan en su propio navegador y nunca se suben aquí.

Dentro del navegador se guardan en IndexedDB, que tiene espacio de sobra, y en una segunda copia en `localStorage` mientras quepa. Al abrir se usa la más reciente de las dos. Borrar los datos de navegación del sitio borra ambas: por eso existe el respaldo.

Para llevar los datos de un dispositivo a otro: Opciones › Respaldo › Crear respaldo en el primero, y Restaurar respaldo en el segundo.

## Cómo está hecha

Tres archivos, sin dependencias ni paso de compilación: `index.html` (estructura), `estilos.css` (estilos y temas) y `app.js` (comportamiento). Se publica con GitHub Pages desde la rama `main`.

Para probarla, con Playwright instalado:

```bash
node pruebas/flujo.js
```

## Documentos

- [Lineamientos](docs/lineamientos.html): reglas de diseño, accesibilidad e información.
- [Plan](docs/plan.html): fases, siguiente paso e ideas.

Con GitHub Pages activo se leen en `/docs/lineamientos.html` y `/docs/plan.html` del sitio.
