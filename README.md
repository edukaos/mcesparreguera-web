# Web de Multiservice Car Esparreguera

Web estática de coches de ocasión. Los coches salen de una Google Sheet: se edita la hoja y la web se regenera sola cada hora.

## Cómo actualizar los coches

Una fila por coche en la Google Sheet. Columnas:

| Columna | Valores | Notas |
| --- | --- | --- |
| id | `seat-leon-2018` | Opcional. Si se deja vacío se crea con marca, modelo y año. No cambiarlo una vez publicado: es la dirección de la ficha. |
| estado | disponible / reservado / vendido | Los vendidos desaparecen de la web y su dirección lleva al stock (mejor dejar la fila como "vendido" que borrarla). |
| destacado | sí / no | Los destacados salen primero. |
| marca, modelo, version | SEAT, León, 1.2 TSI Style 110 cv | |
| año, km, cv, precio | números sin puntos ni €| `11500`, no `11.500 €` (aunque también se entiende). |
| combustible, cambio, carroceria | Gasolina, Manual, Berlina | Alimentan los filtros. Escribirlos siempre igual. |
| etiqueta | 0 / ECO / C / B / H | H = histórico. |
| fotos | enlaces separados por espacios | Enlaces de "Compartir" de Google Drive (con acceso "cualquiera con el enlace") o URLs de imágenes. La primera es la portada. Si se deja vacío se usan las fotos de `fotos/<id>/` del repositorio. |
| descripcion | texto libre | Equipamiento y estado. Sale en la ficha y en Google: no poner notas internas. |
| ficha_antigua | URL de la web antigua | Esa dirección redirige a la ficha nueva para no perder lo que Google ya tenía. |

Para publicar al momento sin esperar a la hora: en GitHub, pestaña Actions > "Publicar web" > Run workflow.

## Configuración

- Datos del negocio (teléfonos, dirección, horario, tipo de financiación): `config.mjs`.
- Enlace de la hoja: variable del repositorio `SHEET_CSV_URL` (Settings > Secrets and variables > Actions > Variables), con el enlace de Archivo > Compartir > Publicar en la web > CSV.
- Por defecto se usa la hoja indicada en `config.mjs`. Para probar sin conexión: `SHEET_CSV_URL=data/coches.csv npm run dev`.

## SEO

Lo genera `build.mjs` solo, en cada publicación:

- Título, descripción, URL canónica, Open Graph y Twitter en cada página. La URL pública llega sola desde GitHub Pages (`SITE_URL`); al pasar a mcesparreguera.com no hay que cambiar nada.
- Datos estructurados JSON-LD: el negocio (AutoDealer), cada coche (Car con oferta y precio), lista del stock, preguntas frecuentes y migas de pan.
- `sitemap.xml` con fotos, `robots.txt`, `404.html`, favicon y `site.webmanifest`.
- Fotos en WebP a varios tamaños (necesita `npm install`, que instala sharp), fuentes servidas desde la web y CSS dentro de cada página.
- Redirecciones de las fichas de la web antigua (columna `ficha_antigua` y `redirecciones` en `config.mjs`).

Cuando haya dirección y horario, rellenar `direccion`, `cp` y `horarioSchema` en `config.mjs` para que Google los muestre.

## Desarrollo

```
npm install   # una vez
npm run dev   # genera dist/ y la sirve en http://localhost:8080
```
