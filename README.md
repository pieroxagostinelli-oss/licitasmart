# LicitaSmart Chile - Prototipo visual

Primera versión del diseño visual para un buscador inteligente de licitaciones públicas.

## Incluye

- Dashboard principal
- Buscador por palabras
- Filtro por región
- Filtro por rubro
- Filtro por presupuesto
- Filtro por compatibilidad
- Filtro por fecha de cierre
- Ordenamiento de resultados
- Tarjetas de licitación
- Puntaje visual de compatibilidad
- Detalle de licitación
- Favoritos guardados en el navegador
- Diseño responsive para escritorio, tablet y móvil

## Publicar en GitHub Pages

1. Crear un repositorio nuevo, por ejemplo: `licitasmart`.
2. Subir `index.html`, `styles.css` y `app.js` a la raíz del repositorio.
3. Ir a **Settings > Pages**.
4. En **Build and deployment**, seleccionar:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
5. Guardar.
6. GitHub mostrará la URL pública del sitio.

Ejemplo:
`https://TU-USUARIO.github.io/licitasmart/`

## Importante

Esta versión usa datos de demostración. En la siguiente fase se reemplazará el arreglo `tenders` de `app.js` por datos reales obtenidos desde un backend/API.

GitHub Pages sirve perfectamente para el frontend estático, pero las credenciales privadas y el ticket de la API de Mercado Público no deben quedar visibles en JavaScript público. Para la integración real se recomienda un backend o función serverless.
