# Guía de pruebas del portal Emprende

Cada paso dice qué hacer y qué tiene que pasar. Si el resultado no coincide, anotá el número del paso.

## 0. Preparación

1. Cargá los datos de prueba (se puede repetir: reemplaza solo los datos de prueba):
   ```
   cd backend
   npm run seed:emprende
   ```
2. Levantá backend y frontend (`npm run dev` en cada carpeta) y abrí <http://localhost:5173>.
3. Todas las cuentas usan la contraseña **`Emprende2026`**.
4. La sesión se guarda en el navegador: para tener dos cuentas abiertas a la vez, usá una ventana normal y otra de incógnito, o dos navegadores.

| Usuario | Rol | Qué tiene cargado |
|---|---|---|
| `admin_emprende` | Administración | Un espacio pendiente para verificar |
| `org_galeria` | Organizador | Galería verificada y local pendiente. "Feria de diseño" con plano, 2 postulaciones por revisar y un pago informado con comprobante |
| `org_club` | Organizador | "Feria gastronómica" **llena** (2/2) con uno en lista de espera, mensajes sin leer y plano |
| `org_plaza` | Organizador | Plaza con permiso municipal, feria **mañana** y predio rechazado |
| `org_nuevo` | Organizador | Nada: para probar el alta desde cero |
| `emp_empanadas` | Emprendedor | Aprobada en la gastronómica con pago pendiente; calificaciones de una feria pasada |
| `emp_ceramica` | Emprendedor | Aprobada en "Diseño" (puesto 4, pago informado), un borrador y una no seleccionada |
| `emp_plantas`, `emp_dulces` | Emprendedor | Feria de mañana: recordatorio, puesto y hora de armado |
| `emp_panificados` | Emprendedor | En lista de espera de la gastronómica |
| `emp_tejidos` | Emprendedor | En revisión, con una conversación abierta |
| `emp_nuevo` | Emprendedor | Nada: para crear el emprendimiento desde cero |

## 1. Ingreso, roles y navegación

| # | Acción | Resultado esperado |
|---|---|---|
| 1.1 | Pantalla de ingreso | No menciona localidades: dice "Ferias, eventos y espacios verificados para emprender" |
| 1.2 | "Crear cuenta" sin elegir tipo y enviar | Pide elegir si sos emprendedor/a o si administrás un espacio |
| 1.3 | Entrar con Google con una cuenta nueva | Pantalla "¿Cómo vas a usar Emprende?"; se elige una sola vez |
| 1.4 | Navegar entre secciones y mirar la barra de direcciones | Cambia la URL: `/convocatorias`, `/postulaciones`, `/mi-emprendimiento`… |
| 1.5 | Botón **atrás** del navegador | Vuelve a la pantalla anterior sin salir de la app |
| 1.6 | Abrir una convocatoria → **Compartir** | Abre el menú de compartir del sistema (o copia el link). El link `/convocatorias/<n>` abre esa convocatoria directamente |
| 1.7 | Contraseña incorrecta 11 veces seguidas | "Demasiados intentos. Esperá unos minutos" |

## 2. Emprendedor

**`emp_empanadas`**

| # | Acción | Resultado esperado |
|---|---|---|
| 2.1 | Menú superior | Convocatorias · Mis postulaciones · Mi emprendimiento · Ayuda |
| 2.2 | **Convocatorias** | Tarjetas con la foto del espacio. No aparece "Feria de verano" (borrador) |
| 2.3 | Abrir "Feria gastronómica del club" | Sello de espacio verificado, calificación de la organización (★), costo del puesto y "Cómo llegar" |
| 2.4 | **Mis postulaciones → Próximas ferias** | Calendario por mes con la gastronómica: puesto 1, armado 09:30 y "Falta pagar el puesto" |
| 2.5 | **Google Calendar** / **.ics** | Abre Google Calendar con la feria cargada / descarga un archivo que se agrega al calendario del celular |
| 2.6 | **Mensajes** | Mensaje automático de bienvenida con puesto y horario, más la conversación con el club |
| 2.7 | Escribir un mensaje y enviar (Enter) | Aparece a la derecha; el organizador lo ve con contador rojo |
| 2.8 | Pestaña **Aprobadas** → **Pagar online (simulación)** | Pide confirmar; queda "Pago confirmado" con un comprobante `SIM-…` y llega un mensaje automático |
| 2.9 | Pestaña **Historial** → "Peña y feria de invierno" | Muestra la calificación que le dio la organización y la suya |
| 2.10 | Mi emprendimiento → Resumen, Productos y Pedidos | Indicadores, gráfico semanal, catálogo con fotos y pedidos |

**`emp_ceramica`**

| # | Acción | Resultado esperado |
|---|---|---|
| 2.11 | "Feria de diseño" → **Ver mi lugar en el plano** | Plano de la galería con el puesto 4 resaltado en naranja |
| 2.12 | Pago de esa feria | "Pago informado": espera que la organización lo confirme |
| 2.13 | **Darme de baja** en "Feria de diseño" | Pide confirmar; queda Cancelada y el organizador recibe el aviso |

**`emp_panificados`**

| # | Acción | Resultado esperado |
|---|---|---|
| 2.14 | Mis postulaciones → En curso | "Estás 1° en la lista de espera" de la gastronómica |

**`emp_plantas`**

| # | Acción | Resultado esperado |
|---|---|---|
| 2.15 | Campana de avisos (unos segundos después de levantar el backend) | "Mañana tenés feria", con el horario de armado y el puesto |

## 3. Organizador

**`org_club`**

| # | Acción | Resultado esperado |
|---|---|---|
| 3.1 | Menú superior | Inicio · Mis espacios · Convocatorias (con contador rojo de mensajes) · Ayuda |
| 3.2 | Convocatorias → tarjeta "Feria gastronómica" | 2/2 aprobados, 1 en espera; botones Postulaciones, Plano, Mensajes automáticos, Imprimir y Excel |
| 3.3 | **Excel** | Descarga un CSV que Excel abre en columnas: puesto, armado, emprendimiento, contacto y pago |
| 3.4 | **Imprimir** | Abre la lista de puestos lista para imprimir, con columna "Presente" |
| 3.5 | **Plano → Asignar puestos**: elegir "Dulces de la Abuela Mirta" y tocar el puesto 1 | Error: el puesto ya está ocupado (esta feria tiene los 2 puestos asignados) |
| 3.6 | **Mensajes automáticos** → editar y guardar | Los próximos aprobados reciben el texto nuevo, con sus datos completados |
| 3.7 | Postulaciones → Empanadas → **Ver emprendimiento** | Ficha con fotos, descripción, productos con precio y calificación |
| 3.8 | Otra ventana como `emp_empanadas`: **Darme de baja** de la gastronómica | En `org_club`: Panadería El Molino pasa sola de lista de espera a **Aprobada** y recibe su mensaje de aprobación |
| 3.9 | Postulaciones → filtro "Todas" → "Peña y feria de invierno" | Cada tarjeta muestra el promedio de estrellas del emprendedor y "Lo calificaste ★…" |

**`org_galeria`**

| # | Acción | Resultado esperado |
|---|---|---|
| 3.10 | Postulaciones → "Hilos del Salí" (en revisión): cargar puesto y hora de armado → **Aprobar** | Queda aprobada y el mensaje automático sale con ese puesto y horario |
| 3.11 | "Verde Monte Vivero" → **Lista de espera** | Queda en espera, con posición |
| 3.12 | Cerámica → pago informado → **Ver comprobante** → **Confirmar pago** | Se abre el PDF; el pago queda confirmado y la emprendedora recibe el aviso |
| 3.13 | Feria de diseño → **Plano → Asignar puestos**: elegir un aprobado y tocar un puesto libre | Queda asignado y el emprendedor recibe un mensaje con su puesto |
| 3.13b | **Dibujar plano**: agregar un puesto, una entrada y guardar | Se guarda; si se superan los puestos de la convocatoria, avisa |
| 3.14 | Mis espacios → tocar la foto del espacio | Permite cambiar la portada (JPG, PNG o WEBP) |
| 3.15 | Editar la galería y cambiar la **dirección** | Vuelve a Pendiente y sus ferias dejan de verse hasta que se verifique de nuevo |

**`org_nuevo`**

| # | Acción | Resultado esperado |
|---|---|---|
| 3.16 | Inicio y Convocatorias | Pasos para empezar y "Necesitás un espacio verificado" |
| 3.17 | Proponer un **espacio público** | Solo deja elegir permiso municipal o concesión |
| 3.18 | CUIT `20-12345678-0` / `20-12345678-6` | El primero da error; el segundo se acepta |
| 3.19 | Subir un archivo que no sea PDF ni imagen (renombrado a `.pdf`) | Se rechaza por su contenido |

## 4. Panel de la plataforma (`admin_emprende`)

| # | Acción | Resultado esperado |
|---|---|---|
| 4.1 | Entrar | Menú propio: Panel · Verificar espacios · Denuncias · Usuarios · Convocatorias · Explorar. Ya no aparece "Panel comercial" |
| 4.2 | **Panel** | Indicadores (espacios por verificar, denuncias abiertas, emprendedores, organizadores, ocupación) y la cola de espacios pendientes |
| 4.3 | Campana → "Espacio para verificar" | Lleva a Verificar espacios |
| 4.4 | **Verificar espacios** → Rechazar sin motivo / Verificar | Pide motivo / pasa a Verificado y muestra "Última revisión: quién y cuándo" |
| 4.5 | **Denuncias** → "Predio sobre Ruta 9" | Motivo, detalle, quién denunció y a quién afecta |
| 4.6 | Elegir "Suspender el espacio" + nota → **Resolver** | El espacio queda suspendido, sus ferias se cierran y quien denunció recibe el aviso |
| 4.7 | Denuncia de la conversación de Cerámica → **Leer la conversación** | Se abre en modo lectura (la administración no puede escribir) |
| 4.8 | **Usuarios**: buscar "dulces", cambiar el rol o **Suspender** | Pide confirmación; la cuenta suspendida no puede ingresar. **Reactivar** la habilita de nuevo |
| 4.9 | Como emprendedor: convocatoria → **Denunciar**, o Mensajes → **Denunciar conversación** | Formulario con motivos; la denuncia llega a Denuncias y avisa a la administración |

## 4b. Caja del día y ingresos

| # | Acción | Resultado esperado |
|---|---|---|
| 4b.1 | `emp_empanadas` → Mi emprendimiento → **Caja del día** | Historial de días anteriores con lo vendido, gastos, lo que quedó y el arqueo, más un gráfico |
| 4b.2 | **Abrir caja** con $5.000 iniciales | Queda "Caja abierta" con indicadores en $0 |
| 4b.3 | **Registrar venta** (cobrado con Efectivo) y otra con Transferencia | Se suman a "Vendido" y aparecen separadas por medio de pago |
| 4b.4 | **Registrar gasto** de $500 en efectivo | Baja "Te quedó" y el efectivo esperado |
| 4b.5 | **Cerrar caja** escribiendo el efectivo contado | Muestra si coincide, sobra o falta, y el día pasa al historial |
| 4b.6 | `org_club` → Convocatorias → **Ingresos** | Cobrado por puestos, por cobrar, pagos para confirmar, ocupación, cobros por día y por feria |
| 4b.7 | "Peña y feria de invierno" → **Asistencia** | Lista de aprobados con presente/ausente; tocar cambia el estado |

## 5. Seguridad y prueba automática

| # | Acción | Resultado esperado |
|---|---|---|
| 5.1 | Con el backend corriendo: `npm --prefix backend run test:marketplace` | 91 comprobaciones y "TODO OK". Prueba, entre otras cosas, que un tercero no lee mensajes ajenos, que nadie paga por otro y que la lista de espera asciende sola |
| 5.2 | Correrla dos veces seguidas contra el mismo servidor | La segunda falla al registrar cuentas: es el límite de 5 registros por hora. Reiniciá el backend para repetir |

## 6. Celular

En Chrome, F12 → ícono de celular (390 px de ancho). Repetir 2.4, 2.6, 2.11 y 3.5:
- no tiene que haber scroll horizontal de la página (el plano puede deslizarse dentro de su recuadro);
- los mensajes se abren a pantalla completa;
- los botones se pueden tocar con el dedo.
