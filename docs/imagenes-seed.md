# Imágenes para los datos de prueba (para generar con Codex)

El seed (`npm --prefix backend run seed:emprende`) busca cada imagen en **`backend/src/seed/images/`** por su nombre. Si la encuentra, la usa; si no, pone una imagen de muestra con degradé de color. Podés cargarlas de a poco: cada vez que corras el seed toma las que haya.

**Reglas para todos los archivos**
- Formato **JPG, PNG o WEBP**, de **máximo 3 MB**. El nombre tiene que ser **exactamente** el de la tabla; la extensión puede ser cualquiera de las tres.
- Estilo común, para que todo el sitio se vea parejo: fotografía realista, luz natural cálida, colores vivos pero naturales, estilo documental de feria del norte argentino.
- **Sin texto, sin logos, sin marcas de agua y sin caras reconocibles** (manos, personas de espaldas o desenfocadas).

**Texto base para cada pedido a Codex** (reemplazá `[DESCRIPCIÓN]`):

> Fotografía realista de [DESCRIPCIÓN], en Tucumán, Argentina. Luz natural cálida, estilo documental, colores naturales, profundidad de campo suave. Sin texto, sin logos, sin marcas de agua, sin caras reconocibles. Formato [PROPORCIÓN].

## 1. Espacios: 5 imágenes · horizontal 16:9 (1280 × 720)

Aparecen como portada del espacio y en las tarjetas de convocatorias.

| Archivo | Descripción |
|---|---|
| `space-galeria` | Galería comercial techada con piso claro, locales vidriados a los costados y espacio libre en el centro para puestos de feria; luz de tarde. |
| `space-local` | Local comercial de esquina en una calle de barrio, persiana abierta, vereda ancha, fachada pintada de color pastel. |
| `space-club` | Salón de un club social de barrio: piso de baldosas, mesas largas, banderines de colores colgados, escenario chico al fondo. |
| `space-plaza` | Plaza de pueblo con árboles (lapachos o tipas), bancos y caminos de ladrillo, preparada para una feria al aire libre por la mañana. |
| `space-predio` | Predio abierto de tierra y pasto al costado de una ruta, con un tinglado de chapa y montañas verdes del pedemonte de fondo. |

## 2. Emprendimientos: 18 imágenes · 4:3 (1200 × 900)

Galería de fotos del emprendimiento, en Mi emprendimiento y en la ficha que ve el organizador. Van 3 por emprendimiento: `-1` es el puesto, `-2` es el producto destacado y `-3` es el taller o la elaboración.

| Archivo | Descripción |
|---|---|
| `business-emp_empanadas-1` | Puesto de feria de empanadas tucumanas con mantel a cuadros, canastas de mimbre y un horno de barro chico detrás. |
| `business-emp_empanadas-2` | Bandeja de empanadas tucumanas de carne recién horneadas, doradas, repulgue bien marcado. |
| `business-emp_empanadas-3` | Manos haciendo el repulgue de empanadas sobre una mesa enharinada. |
| `business-emp_ceramica-1` | Puesto de cerámica artesanal con tazas y bowls esmaltados en verdes y terracota sobre una mesa de madera. |
| `business-emp_ceramica-2` | Taza de cerámica esmaltada hecha a mano, en primer plano, con textura visible. |
| `business-emp_ceramica-3` | Manos modelando barro en un torno de alfarero, taller con estantes de piezas sin esmaltar. |
| `business-emp_tejidos-1` | Puesto con ponchos, bufandas y gorros de lana colgados en un perchero de madera, colores tierra y azules. |
| `business-emp_tejidos-2` | Poncho tejido en telar, doblado, con guarda geométrica norteña. |
| `business-emp_tejidos-3` | Telar de madera con un tejido a medio hacer y ovillos de lana alrededor. |
| `business-emp_dulces-1` | Puesto de dulces regionales con frascos de vidrio de dulce de cayote, membrillo y miel, etiquetas en blanco. |
| `business-emp_dulces-2` | Frasco abierto de dulce de cayote con una cuchara de madera, sobre un mantel bordado. |
| `business-emp_dulces-3` | Olla de cobre con dulce cocinándose en una cocina de campo. |
| `business-emp_panificados-1` | Puesto de panadería con panes caseros, tortillas al rescoldo y facturas en canastos. |
| `business-emp_panificados-2` | Tortillas al rescoldo apiladas sobre papel, con marcas de brasa. |
| `business-emp_panificados-3` | Masa madre y panes leudando sobre una mesada de madera enharinada. |
| `business-emp_plantas-1` | Puesto de vivero con suculentas, aromáticas y plantines en macetas recicladas de lata pintada. |
| `business-emp_plantas-2` | Suculentas variadas en macetas pequeñas, vista desde arriba. |
| `business-emp_plantas-3` | Vivero chico con media sombra, bandejas de plantines y regadera. |

## 3. Productos: 25 imágenes · 4:3 (800 × 600)

Foto de cada producto del catálogo. Un solo producto, centrado, fondo simple (madera, lino o pared lisa).

| Archivo | Producto |
|---|---|
| `product-emp_empanadas-1` | Empanada de carne |
| `product-emp_empanadas-2` | Docena de empanadas en caja de cartón |
| `product-emp_empanadas-3` | Humita en chala |
| `product-emp_empanadas-4` | Tamal |
| `product-emp_empanadas-5` | Empanada de pollo |
| `product-emp_ceramica-1` | Taza esmaltada |
| `product-emp_ceramica-2` | Bowl mediano |
| `product-emp_ceramica-3` | Maceta colgante de cerámica |
| `product-emp_ceramica-4` | Set de 4 platos |
| `product-emp_tejidos-1` | Gorro de lana |
| `product-emp_tejidos-2` | Bufanda tejida |
| `product-emp_tejidos-3` | Poncho de telar |
| `product-emp_tejidos-4` | Medias de lana |
| `product-emp_dulces-1` | Dulce de cayote 500 g |
| `product-emp_dulces-2` | Dulce de leche 500 g |
| `product-emp_dulces-3` | Miel 1 kg |
| `product-emp_dulces-4` | Caja de 6 alfajores de maicena |
| `product-emp_panificados-1` | Pan casero 1 kg |
| `product-emp_panificados-2` | Tortilla al rescoldo |
| `product-emp_panificados-3` | Docena de facturas |
| `product-emp_panificados-4` | Pan de masa madre |
| `product-emp_plantas-1` | Suculenta en maceta |
| `product-emp_plantas-2` | Aromática (romero o menta) en maceta |
| `product-emp_plantas-3` | Lapacho joven en bolsa de vivero |
| `product-emp_plantas-4` | Kit de huerta (plantines y semillas) |

## 4. Cargarlas

1. Guardá los archivos en `backend/src/seed/images/` con los nombres de las tablas.
2. Corré `npm --prefix backend run seed:emprende`.
3. Al terminar, el seed indica cuántas imágenes reales usó, por ejemplo: `Imágenes reales usadas desde src/seed/images: 48`.

Si alguna no aparece, revisá que el nombre sea exacto y que pese menos de 3 MB. El seed avisa cuando ignora un archivo.
