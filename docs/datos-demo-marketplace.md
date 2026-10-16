# Datos de demostración del portal

El seed de comercio `backend/src/seed/seed.js` elimina datos existentes de varias tablas y usuarios. **No lo uses para probar el portal de convocatorias.** El seed `backend/src/seed/marketplaceDemoSeed.js` es independiente, idempotente y solo crea/actualiza registros identificados con cuentas y nombres `demo`; no borra tablas ni manda notificaciones o mensajes.

## Carga local aislada

1. Crea una base MySQL local vacía y separada llamada `sistema_autogestion_emprende_demo`. Define `DATABASE_URL` para esa base y ejecuta `npm run prisma:push` desde `backend` para aplicar allí el esquema actual. No apuntes ese comando a una base con datos que quieras conservar.
2. En PowerShell, dentro de `backend`, configura temporalmente la URL de esa base local (sin editar el `.env` habitual si apunta a datos que quieras conservar) y la contraseña de prueba:

   ```powershell
   $env:DATABASE_URL = 'mysql://USUARIO:CLAVE@localhost:3306/sistema_autogestion_emprende_demo'
   $env:SEED_DEMO_MARKETPLACE = '1'
   $env:DEMO_SEED_PASSWORD = 'elegir-una-clave-local-de-12-caracteres'
   npm run prisma:seed:marketplace-demo
   ```

   La carga se cancela si `NODE_ENV=production`, si falta la habilitación explícita, si el host no es loopback, si el nombre de la base no contiene `demo` o si la contraseña es demasiado corta. No ejecutar `prisma:push` contra una base con datos reales.
3. Inicia el backend en modo de demostración con `npm run dev:marketplace-demo`. Este comando toma las credenciales de la URL configurada, pero redirige el servidor a `sistema_autogestion_emprende_demo` y rechaza hosts que no sean locales. Inicia el frontend en otra terminal con `npm run dev`. Entra con `emprendedor.demo@example.invalid` para revisar solicitudes; `organizador.demo@example.invalid` tiene el rol administrador para revisar cambios de estado. En esta carga, ambas cuentas usan `EmprendeDemo2026!`. El dominio `.invalid` y el teléfono `0000000000` son ficticios; no reciben mensajes.
4. La quinta convocatoria queda libre para completar una solicitud de prueba. Las otras cuatro muestran “Borrador”, “Enviada”, “En revisión” y “Aprobada”. Solo una cuenta con rol `ADMINISTRADOR` puede cambiar el estado desde la vista de revisión.

Al volver a ejecutar el seed, se restauran los cuatro estados iniciales y se limpian solo los avisos internos de esas dos cuentas demo, para que no queden mensajes de una prueba anterior. También vuelve a actualizar únicamente sus cinco convocatorias, las dos cuentas y el perfil de prueba. Para quitar los datos, utiliza una base de demostración descartable o elimina allí solo esos registros identificados como `DEMO`; nunca borres tablas de la base normal.

## Ubicaciones y fechas

Las cinco convocatorias tienen fechas futuras calculadas al cargar el seed y horarios de ejemplo de 9:00 a 18:00. Incluyen las localidades Banda del Río Salí, Cruz Alta y Alderetes y rubros/requisitos ficticios. El repositorio no contiene coordenadas verificadas ni nombres confirmados de plazas para estas convocatorias; por eso los puntos se muestran como **“Ubicación de prueba”**, son aproximados y no identifican un espacio público real ni una convocatoria oficial.

## Recorrido manual

1. Abrí “Ferias y eventos” y filtrá por Banda del Río Salí, Cruz Alta y Alderetes.
2. Cambiá entre “Lista” y “Mapa”; seleccioná un marcador de prueba y abrí sus detalles.
3. En la quinta convocatoria, iniciá una postulación con el negocio de demostración. El formulario reutiliza/permite corregir el correo `.invalid` o el teléfono `0000000000`; no se despacha ningún mensaje.
4. Enviá la solicitud y consultala en “Mis solicitudes”. El organizador de demostración puede mover una solicitud enviada a revisión o aprobarla mediante el flujo de administración existente.

La capa de mapas usa Leaflet y los mosaicos configurados actualmente en la aplicación. Los avisos son internos; el envío de correo/SMS no está configurado.
