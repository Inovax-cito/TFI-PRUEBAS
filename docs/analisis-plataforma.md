# Análisis de la plataforma Emprende

Estado del código, comparación con plataformas similares y cambios de esta etapa (roles, espacios verificados, Mi emprendimiento y Google Maps). Fecha: noviembre de 2026.

## 1. Cómo está armado

| Capa | Tecnología | Observaciones |
|---|---|---|
| Frontend | React 19 + Vite, lucide-react, Recharts, Leaflet / Google Maps | Sin router: la pantalla activa es un estado (`activeTab` / `section`). No hay URLs por pantalla. |
| Backend | Express 4 + Prisma 5 sobre MySQL | API REST en `/api/*`. En producción el mismo servidor entrega el frontend compilado. |
| Autenticación | JWT (24 h) en `localStorage`, contraseña con bcrypt o Google Identity Services | Helmet con CSP, rate limit en ingreso, registro y subidas. |
| Despliegue | Render (un solo servicio) + base MySQL externa | El disco de Render no es persistente: por eso los archivos se guardan en la base. |
| Android | Capacitor que abre la web publicada | Es la misma web dentro de un WebView. |
| Esquema | `prisma db push`, sin migraciones versionadas | Cada cambio de esquema hay que aplicarlo a mano en cada base. |

### Dos sistemas en uno

El código tiene dos productos superpuestos:

1. **Sistema de autogestión de un comercio** (el origen del proyecto): panel, ventas, productos, inventario, compras, proveedores, caja, reportes, usuarios y configuración. Todas sus tablas son de **un único comercio** (`products`, `inventory_movements`, `sales`, `cash_registers`, `purchases`, `suppliers`, `business_configs` con una sola fila).
2. **Portal Emprende**: emprendedores, convocatorias a ferias y postulaciones (`business_profiles`, `market_events`, `event_applications`).

El portal reutilizaba piezas del comercio que no estaban pensadas para varios negocios. El caso más claro: un emprendedor aprobado en una feria registraba ventas **con los productos del comercio y descontando su stock**. La propia documentación (`docs/mercado-local.md`) ya lo advertía.

## 2. Pantallas y tablas antes de esta etapa

**Pantallas.** Todo el portal vivía en un solo componente (`MarketplacePage.jsx`, ~630 líneas, con JSX de una sola línea muy largo) que cambiaba de sección según el estado. Para emprendedores: Inicio, Mi negocio, Ferias y eventos, Mis solicitudes, Ayuda. Para `ADMINISTRADOR`: además, Administración (crear convocatoria y revisar postulaciones). El personal del comercio veía además el backoffice con barra lateral.

**Roles.** `ADMINISTRADOR`, `EMPLEADO`, `EMPRENDEDOR`. No existía un rol para quien **ofrece el lugar**: solo el administrador de la plataforma publicaba convocatorias.

**Problemas encontrados**

| Problema | Riesgo | Estado |
|---|---|---|
| Cualquier `ADMINISTRADOR` veía y aprobaba **todas** las postulaciones de todas las convocatorias | Un organizador podría decidir sobre ferias ajenas | **Resuelto**: cada organizador gestiona solo las suyas |
| La ubicación de una convocatoria se cargaba a mano (latitud y longitud) sin respaldo | Se podía publicar una feria en una plaza o en un lugar ajeno y cobrar el puesto | **Resuelto**: la convocatoria hereda la ubicación de un espacio verificado |
| No había forma de acreditar el derecho a usar un lugar | Estafas a emprendedores ("te alquilo un puesto" en un lugar que no es tuyo) | **Resuelto**: verificación documental de espacios |
| Catálogo y stock globales compartidos con el portal | Mezcla de ventas y stock entre el comercio y los emprendedores | **Resuelto para el portal**: catálogo y pedidos propios por emprendimiento |
| Sin motivo al rechazar una postulación | El emprendedor no sabe qué mejorar | **Resuelto**: comentario de la organización |
| Navegación sin URLs | No se puede compartir el link de una convocatoria; en Android el botón "atrás" cierra la app en vez de volver | Pendiente (ver §6) |
| Token en `localStorage` | Si hubiera un XSS, el token se podría robar | Mitigado con CSP; pendiente pasar a cookie `httpOnly` |
| Sin migraciones versionadas | Riesgo al aplicar cambios en producción | Pendiente |

## 3. Comparación con plataformas similares

Referencias: Marketspread, Eventeny y ZAPP (ferias de arte con jurado). Ver el relevamiento en la conversación del proyecto.

| Función | Marketspread / Eventeny / ZAPP | Emprende |
|---|---|---|
| Perfil del vendedor reutilizable | Sí | Sí (Mi emprendimiento, con fotos) |
| Convocatorias con fechas, cupos y requisitos | Sí | Sí |
| Estados de postulación | Recibida → en revisión → aceptada / rechazada / lista de espera | Enviada → en revisión → aprobada / no seleccionada, con comentario |
| Mapa | Mapa del predio y de puestos | Mapa de ubicación del espacio (Google Maps); todavía sin mapa de puestos |
| Documentos del vendedor (seguro, habilitaciones) | Sí | Todavía no |
| Cobro de inscripción y de puesto | Sí, con pagos integrados | Solo se informa el costo; no se procesan pagos |
| Jurado y puntaje | ZAPP | Todavía no |
| **Verificación de quien ofrece el lugar** | No es lo central: el organizador suele ser el propio mercado o festival | **Sí, es el diferencial**: documentación revisada antes de publicar |
| Ventas y pedidos del vendedor | Marketspread registra porcentaje de ventas | Pedidos, ventas e indicadores propios |

En el contexto local (Banda del Río Salí, Cruz Alta, Alderetes) cualquiera puede ofrecer un lugar. Por eso, a diferencia de las plataformas de afuera, Emprende pone el foco en **validar al organizador**.

## 4. Nuevo modelo: roles y circuito

| Rol | Cómo se obtiene | Qué puede hacer |
|---|---|---|
| `EMPRENDEDOR` | Lo elige al registrarse | Mi emprendimiento (perfil, fotos, productos, pedidos, ventas, indicadores), ver convocatorias y postularse |
| `ORGANIZADOR` (administra espacios) | Lo elige al registrarse | Proponer espacios con documentación. **Solo con un espacio verificado** puede publicar convocatorias y revisar postulaciones a ellas |
| `ADMINISTRADOR` (plataforma) | Lo asigna otra administración; no se puede elegir | Verificar, rechazar o suspender espacios; ver todo |
| `EMPLEADO` | Lo asigna la administración | Backoffice del comercio (sin cambios) |

Con Google, la cuenta nueva entra con el rol de menor privilegio (`EMPRENDEDOR`) y elige su rol **una sola vez** en la pantalla de bienvenida.

**Circuito del organizador**

1. Registra el espacio: tipo, dirección, punto en el mapa, titular, CUIT/CUIL (se valida el dígito verificador), teléfono y con qué derecho lo usa (propietario, locatario, permiso municipal, concesión o autorización del titular). Acepta una declaración jurada; se guardan la fecha y la IP.
2. Sube el documento que exige su tipo de derecho: escritura, contrato de alquiler, permiso municipal o autorización. Se aceptan solo PDF, JPG, PNG y WEBP, validados por su contenido real.
3. La administración revisa. No puede verificar un espacio propio ni verificarlo si falta el documento obligatorio. Rechazar o suspender exige un motivo, y el organizador recibe un aviso.
4. Con el espacio verificado publica convocatorias. La ubicación sale siempre del espacio y los cupos no pueden superar su capacidad.

**Reglas legales que aplica el servidor**

- Un **espacio público** (plaza, parque, vereda) solo se acepta con permiso municipal o concesión, nunca como "propio".
- Si se cambian nombre, tipo, ubicación, titular, CUIT o el tipo de derecho de un espacio verificado, el espacio **vuelve a revisión** y sus convocatorias dejan de mostrarse hasta que se verifique otra vez.
- Si se suspende un espacio, sus convocatorias publicadas se cierran.
- Emprende **no procesa pagos**: el costo del puesto es informativo, y la ayuda recomienda pedir siempre comprobante.

## 5. Tablas nuevas

| Tabla | Para qué |
|---|---|
| `spaces` | Espacios propuestos: datos del lugar, ubicación, titular, CUIT, tipo de derecho, declaración jurada y estado de verificación |
| `space_documents` | Documentación de cada espacio, por tipo |
| `uploads` | Archivos subidos (binario en la base, tipo detectado, tamaño, SHA-256). Fotos públicas con clave aleatoria; documentos privados (solo dueño y administración) |
| `business_photos` | Galería del emprendimiento (hasta 8) |
| `business_products` | Catálogo propio del emprendimiento, con stock opcional |
| `business_orders` / `business_order_items` | Pedidos y ventas: canal, estado (pendiente → confirmado → entregado / cancelado) y vínculo opcional con una feria aprobada |

Columnas nuevas: `users.onboardingCompleted`, `market_events.spaceId` y `standFee`, `event_applications.reviewNotes`. Rol nuevo: `ORGANIZADOR`.

## 6. Pantallas por rol (web)

- **Emprendedor**: Convocatorias (lista y mapa) · Mis postulaciones · Mi emprendimiento (Resumen con 4 indicadores y un gráfico semanal · Perfil y fotos · Productos · Pedidos y ventas) · Ayuda.
- **Organizador**: Inicio (indicadores y pasos para empezar) · Mis espacios (alta con mapa, documentos y estado) · Convocatorias (crear y postulaciones recibidas) · Ayuda propia.
- **Administración**: lo anterior más Verificar espacios.

### Próximos pasos sugeridos

**Web**
1. Agregar URLs con un router (`/convocatorias/12`, `/mi-emprendimiento/pedidos`) para compartir links y que funcione el botón "atrás". Es la base para la app Android.
2. Lista de espera y cupos por rubro en cada convocatoria.
3. Documentos del emprendedor (monotributo, carnet de manipulación de alimentos) reutilizables en las postulaciones.
4. Avisos por correo además de los avisos dentro de la app.
5. Migraciones versionadas de Prisma.

**Android** (después de la web)
1. Botón "atrás" del sistema conectado al router.
2. Ingreso con Google nativo: Google bloquea el ingreso dentro de WebViews.
3. Cámara para fotos de productos y documentos.
4. Notificaciones push para cambios de estado de las postulaciones.

## 7. Configuración necesaria

| Variable | Dónde | Para qué |
|---|---|---|
| `GOOGLE_CLIENT_ID` | backend | Ingreso con Google |
| `GOOGLE_MAPS_API_KEY` | backend | Mapas de Google. Sin la clave se usa OpenStreetMap |
| `GOOGLE_MAPS_MAP_ID` | backend (opcional) | Estilo del mapa y marcadores avanzados. Sin él se usa `DEMO_MAP_ID` |

La clave de Maps se entrega al navegador, así que **debe restringirse por dominio** en Google Cloud (HTTP referrers) y habilitar solo *Maps JavaScript API* y *Geocoding API*.

Prueba del circuito completo: con el backend corriendo, `npm --prefix backend run test:marketplace`.
