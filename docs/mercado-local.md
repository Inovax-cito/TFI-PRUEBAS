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

El mapa usa Leaflet y teselas de OpenStreetMap. La ubicación se carga manualmente mediante localidad, dirección y coordenadas opcionales; no se incorporó geocodificación. Si faltan coordenadas, la convocatoria sigue disponible en el listado. El mapa requiere conexión para descargar sus teselas.

## Alcance y límites actuales

- El catálogo y el stock del sistema anterior son globales y de un único comercio. Las ventas del evento reutilizan esos productos y descuentan el inventario compartido. No usar como operación multi-negocio real hasta separar productos, stock y movimientos por negocio.
- Los movimientos de eventos quedan vinculados al evento y al negocio, y se excluyen de los reportes operativos generales del comercio.
- Las cuentas nuevas tienen rol `EMPRENDEDOR`. No se crea por registro una cuenta administradora.
- Las notificaciones son internas. No hay pagos, suscripciones, correo, integración municipal ni datos oficiales cargados.
- La lista de localidades inicial responde al alcance de la demostración: Banda del Río Salí, Cruz Alta y Alderetes.
