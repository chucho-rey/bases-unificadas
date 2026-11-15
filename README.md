# Bases unificadas

Web para guardar tablas, relacionarlas entre sí y consultarlas desde un solo lugar. Minimalista, accesible y pensada para usarse desde el celular.

## Qué hace

- Página de inicio con tus libros, los reportes guardados y el estado del respaldo.
- Libros con tablas editables, organizados en secciones y salas.
- Relaciones entre tablas, columnas calculadas y sumas de otra tabla.
- Buscar, filtrar y ordenar en dos niveles.
- Reportes con paletas de color, que se pueden guardar e imprimir.
- Respaldo completo en un archivo, con restauración.
- Tema claro, oscuro y alto contraste.

## Dónde están los datos

Este repositorio contiene solo el código y tres tablas de ejemplo. Los datos de cada persona se guardan en su propio navegador y nunca se suben aquí.

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
