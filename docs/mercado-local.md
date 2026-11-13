# Mercado local

## Ejecutar en desarrollo

1. Iniciar MySQL y verificar la configuración local del backend en `backend/.env`.
2. Desde la raíz, iniciar la API: `npm --prefix backend run dev`.
3. En otra terminal, iniciar la interfaz: `npm --prefix frontend run dev`.
4. Abrir <http://localhost:5173>. La interfaz usa la API en `http://localhost:5000` a través del proxy de Vite.

Las tablas nuevas se incorporan al esquema existente con `npm --prefix backend run prisma:push`. Este repositorio no tiene migraciones versionadas de Prisma; antes de aplicar cambios de esquema en otro entorno, revisar el diff que presenta Prisma.

## Recorrido

- Una persona emprendedora crea una cuenta desde la pantalla de acceso y completa el perfil del negocio.
- Puede consultar convocatorias publicadas por localidad, revisar fechas, categorías y requisitos, guardar un borrador y enviar una postulación.
- La revisión de convocatorias y postulaciones está disponible a usuarios con el rol existente `ADMINISTRADOR`. Para esta versión académica ese rol sirve para operar la demostración; no representa una cuenta municipal ni una aprobación oficial.
- El sistema muestra notificaciones dentro de la aplicación. No se configuró un proveedor de correo.
- Un negocio con postulación aprobada puede registrar ventas y egresos asociados a ese evento. El resumen resta egresos cargados a ventas registradas; no calcula ganancia neta.

No se insertaron eventos ni perfiles de ejemplo en la base configurada. Se pueden cargar convocatorias manuales desde la sección de administración para la demostración, identificándolas como datos de prueba.

## Mapa y datos

El mapa usa Google Maps cuando el backend tiene `GOOGLE_MAPS_API_KEY`; si no, usa Leaflet con OpenStreetMap. Los organizadores marcan la ubicación de su espacio en el mapa (con búsqueda de dirección cuando Google está configurado) y cada convocatoria toma la ubicación de su espacio verificado. El enlace "Cómo llegar" abre Google Maps sin necesitar clave.

## Alcance y límites actuales

- Roles y circuito de verificación de espacios: ver `docs/analisis-plataforma.md`.
- El catálogo y el stock del comercio siguen siendo globales. El portal ya no los usa: cada emprendimiento tiene sus propios productos, pedidos y ventas.
- Los movimientos de eventos quedan vinculados al evento y al negocio, y se excluyen de los reportes operativos generales del comercio.
- Al registrarse se elige `EMPRENDEDOR` u `ORGANIZADOR`. `ADMINISTRADOR` y `EMPLEADO` solo los asigna la administración.
- Las notificaciones son internas. No hay pagos, correo ni integración municipal; el costo del puesto es informativo.
- La lista de localidades inicial responde al alcance de la demostración: Banda del Río Salí, Cruz Alta y Alderetes.
