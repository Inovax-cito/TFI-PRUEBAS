// Prueba de punta a punta: organizador → verificación → convocatoria → postulación → ventas.
// Uso: con el backend corriendo, `npm run test:marketplace` (o TEST_API_URL=http://localhost:5000/api).
// Crea usuarios "prueba_claude_*" y los borra al terminar. Requiere el usuario admin del seed.
import 'dotenv/config';
import prisma from '../config/db.js';

const BASE = process.env.TEST_API_URL || 'http://localhost:5000/api';
const stamp = Date.now().toString(36);
let failures = 0;

const call = async (method, path, { token, body, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
};
const expect = (label, condition, detail = '') => {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}${condition ? '' : `  -> ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300)}`}`);
  if (!condition) failures += 1;
};
const fileForm = (bytes, name, type, fields = {}) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  form.append('file', new Blob([bytes], { type }), name);
  return form;
};
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b30000000049454e44ae426082', 'hex');
const FAKE = Buffer.from('MZ\x90\x00 esto es un ejecutable disfrazado de pdf');

const register = async (role, suffix) => call('POST', '/auth/register', { body: {
  name: 'Prueba', lastName: suffix, username: `prueba_claude_${suffix}_${stamp}`.slice(0, 30), email: `prueba.claude.${suffix}.${stamp}@example.invalid`, password: 'ClavePrueba123', role,
} });

const run = async () => {
  // --- registro con rol ---
  const badRole = await register('ADMINISTRADOR', 'adm');
  expect('No se puede auto-asignar ADMINISTRADOR', badRole.status === 400, badRole.data);
  const org = await register('ORGANIZADOR', 'org');
  expect('Registro como organizador', org.status === 201 && org.data.user.role === 'ORGANIZADOR', org.data);
  const emp = await register('EMPRENDEDOR', 'emp');
  expect('Registro como emprendedor', emp.status === 201 && emp.data.user.role === 'EMPRENDEDOR' && emp.data.user.onboardingCompleted === true, emp.data);
  const O = org.data.token; const E = emp.data.token;
  const onboardingAgain = await call('POST', '/auth/onboarding', { token: E, body: { role: 'ORGANIZADOR' } });
  expect('No se puede cambiar el rol por onboarding si ya se eligió', onboardingAgain.status === 409, onboardingAgain.data);

  // --- espacios: reglas legales ---
  const baseSpace = { name: 'Galería Prueba', type: 'GALERIA', locality: 'Cruz Alta', address: 'Calle Falsa 123', latitude: -26.83, longitude: -65.18, holderName: 'Titular Prueba', holderTaxId: '20-12345678-6', tenure: 'PROPIETARIO', contactPhone: '381 555 1234', declarationAccepted: true, capacity: 20 };
  const empSpace = await call('POST', '/spaces', { token: E, body: baseSpace });
  expect('Un emprendedor no puede proponer espacios', empSpace.status === 403, empSpace.data);
  const badCuit = await call('POST', '/spaces', { token: O, body: { ...baseSpace, holderTaxId: '20-12345678-0' } });
  expect('CUIT con dígito verificador inválido se rechaza', badCuit.status === 400 && /CUIT/.test(badCuit.data.message), badCuit.data);
  const plaza = await call('POST', '/spaces', { token: O, body: { ...baseSpace, type: 'ESPACIO_PUBLICO', tenure: 'PROPIETARIO' } });
  expect('Una plaza no puede declararse como propia', plaza.status === 400 && /permiso municipal/.test(plaza.data.message), plaza.data);
  const noDecl = await call('POST', '/spaces', { token: O, body: { ...baseSpace, declarationAccepted: false } });
  expect('Sin declaración jurada no se registra', noDecl.status === 400, noDecl.data);
  const space = await call('POST', '/spaces', { token: O, body: baseSpace });
  expect('Espacio registrado como PENDIENTE', space.status === 201 && space.data.space.status === 'PENDIENTE' && space.data.space.missingDocuments.includes('TITULO_PROPIEDAD'), space.data);
  const spaceId = space.data.space.id;

  const eventBody = { name: `Feria prueba ${stamp}`, locality: 'Alderetes', address: 'Otro lugar', latitude: -20, longitude: -60, startsAt: new Date(Date.now() + 20 * 864e5).toISOString(), endsAt: new Date(Date.now() + 20 * 864e5 + 6 * 36e5).toISOString(), applicationDeadline: new Date(Date.now() + 10 * 864e5).toISOString(), description: 'Feria de prueba', capacity: 10, standFee: 5000, status: 'PUBLICADA', spaceId };
  const earlyEvent = await call('POST', '/marketplace/events', { token: O, body: eventBody });
  expect('No se publica en un espacio sin verificar', earlyEvent.status === 400 && /verificado/.test(earlyEvent.data.message), earlyEvent.data);

  // --- documentos ---
  const fake = await call('POST', `/spaces/${spaceId}/documents`, { token: O, form: fileForm(FAKE, 'escritura.pdf', 'application/pdf', { kind: 'TITULO_PROPIEDAD' }) });
  expect('Archivo disfrazado de PDF se rechaza por su contenido', fake.status === 400, fake.data);
  const doc = await call('POST', `/spaces/${spaceId}/documents`, { token: O, form: fileForm(PDF, 'escritura.pdf', 'application/pdf', { kind: 'TITULO_PROPIEDAD' }) });
  expect('PDF real se acepta', doc.status === 201 && doc.data.space.missingDocuments.length === 0, doc.data);
  const docUploadId = doc.data.space.documents[0].upload.id;
  const privByEmp = await call('GET', `/files/private/${docUploadId}`, { token: E });
  expect('Otro usuario no puede descargar el documento legal', privByEmp.status === 404, privByEmp.status);
  const privByOrg = await call('GET', `/files/private/${docUploadId}`, { token: O });
  expect('El dueño descarga su documento', privByOrg.status === 200 && privByOrg.headers.get('content-type') === 'application/pdf', privByOrg.status);

  // --- verificación por la administración ---
  const admin = await call('POST', '/auth/login', { body: { identifier: 'admin', password: 'admin123' } });
  expect('Login de administración', admin.status === 200, admin.data);
  const A = admin.data.token;
  const orgReview = await call('PATCH', `/spaces/admin/${spaceId}/review`, { token: O, body: { status: 'VERIFICADO' } });
  expect('El organizador no puede autoverificarse', orgReview.status === 403, orgReview.data);
  const rejectNoNotes = await call('PATCH', `/spaces/admin/${spaceId}/review`, { token: A, body: { status: 'RECHAZADO' } });
  expect('Rechazar exige motivo', rejectNoNotes.status === 400, rejectNoNotes.data);
  const verify = await call('PATCH', `/spaces/admin/${spaceId}/review`, { token: A, body: { status: 'VERIFICADO' } });
  expect('Administración verifica el espacio', verify.status === 200 && verify.data.space.status === 'VERIFICADO', verify.data);

  // --- convocatoria: ubicación forzada desde el espacio ---
  const tooMany = await call('POST', '/marketplace/events', { token: O, body: { ...eventBody, capacity: 50 } });
  expect('No se ofrecen más puestos de los que entran en el espacio', tooMany.status === 400, tooMany.data);
  const event = await call('POST', '/marketplace/events', { token: O, body: eventBody });
  expect('Convocatoria publicada en espacio verificado', event.status === 201, event.data);
  const ev = event.data.event;
  expect('La ubicación se toma del espacio (no la que se mandó)', ev.locality === 'Cruz Alta' && ev.latitude === -26.83 && ev.standFee === 5000, { locality: ev.locality, lat: ev.latitude, fee: ev.standFee });

  // --- legal: cambiar la dirección de un espacio verificado lo devuelve a revisión ---
  const move = await call('PUT', `/spaces/${spaceId}`, { token: O, body: { address: 'Plaza Principal', declarationAccepted: true } });
  expect('Mover un espacio verificado lo devuelve a PENDIENTE', move.status === 200 && move.data.space.status === 'PENDIENTE', move.data);
  const listWhilePending = await call('GET', '/marketplace/events', { token: E });
  expect('Sus convocatorias dejan de verse públicamente', !listWhilePending.data.some((item) => item.id === ev.id), listWhilePending.data.length);
  await call('PATCH', `/spaces/admin/${spaceId}/review`, { token: A, body: { status: 'VERIFICADO' } });
  const listAfter = await call('GET', '/marketplace/events', { token: E });
  expect('Vuelven a verse al re-verificar', listAfter.data.some((item) => item.id === ev.id), listAfter.data.length);

  // --- postulación ---
  const biz = await call('PUT', '/marketplace/business', { token: E, body: { name: 'Emprendimiento prueba', kind: 'ITINERANTE', category: 'Alimentos', locality: 'Cruz Alta', contactPhone: '381 555 0000' } });
  expect('Perfil del emprendimiento', biz.status === 200, biz.data);
  const orgApply = await call('POST', `/marketplace/events/${ev.id}/applications`, { token: O, body: { offeredProduct: 'x', send: true } });
  expect('Un organizador no puede postularse', orgApply.status === 403, orgApply.data);
  const apply = await call('POST', `/marketplace/events/${ev.id}/applications`, { token: E, body: { offeredProduct: 'Empanadas', send: true } });
  expect('Postulación enviada', apply.status === 201 && apply.data.application.status === 'ENVIADA', apply.data);
  const orgApps = await call('GET', '/marketplace/admin/applications', { token: O });
  expect('El organizador ve solo postulaciones a sus convocatorias', orgApps.status === 200 && orgApps.data.length >= 1 && orgApps.data.every((item) => item.event.organizerUserId === org.data.user.id), orgApps.data.length);
  const approve = await call('PATCH', `/marketplace/admin/applications/${apply.data.application.id}/status`, { token: O, body: { status: 'APROBADA', reviewNotes: 'Puesto 4, armado 8 hs' } });
  expect('Organizador aprueba con comentario', approve.status === 200 && approve.data.application.reviewNotes === 'Puesto 4, armado 8 hs', approve.data);

  // --- Mi emprendimiento ---
  const product = await call('POST', '/business/products', { token: E, body: { name: 'Empanada', price: 1200, stock: 30 } });
  expect('Producto propio', product.status === 201, product.data);
  const photo = await call('POST', `/business/products/${product.data.product.id}/photo`, { token: E, form: fileForm(PNG, 'empanada.png', 'image/png') });
  expect('Foto del producto (PNG real)', photo.status === 200 && photo.data.product.photoUrl?.startsWith('/api/files/public/'), photo.data);
  const pub = await fetch(`${BASE.replace(/\/api$/, '')}${photo.data.product.photoUrl}`);
  expect('La foto pública se sirve con nosniff', pub.status === 200 && pub.headers.get('x-content-type-options') === 'nosniff', pub.status);
  const overStock = await call('POST', '/business/orders', { token: E, body: { items: [{ productId: product.data.product.id, quantity: 99 }], status: 'ENTREGADO' } });
  expect('No se vende más que el stock', overStock.status === 400, overStock.data);
  const sale = await call('POST', '/business/orders', { token: E, body: { items: [{ productId: product.data.product.id, quantity: 5 }], status: 'ENTREGADO', channel: 'FERIA', eventId: ev.id } });
  expect('Venta en la feria aprobada', sale.status === 201 && sale.data.order.total === 6000, sale.data);
  const order = await call('POST', '/business/orders', { token: E, body: { customerName: 'Ana', items: [{ productId: product.data.product.id, quantity: 2 }] } });
  expect('Pedido pendiente', order.status === 201 && order.data.order.status === 'PENDIENTE', order.data);
  const overview = await call('GET', '/business/overview', { token: E });
  const k = overview.data.kpis;
  expect('KPI: ventas del mes, pendientes y postulaciones', k.monthSales === 6000 && k.pendingOrders === 1 && k.approvedApplications === 1, k);
  const products = await call('GET', '/business/products', { token: E });
  expect('Stock descontado al entregar', products.data[0].stock === 25, products.data[0]);
  const cancel = await call('PATCH', `/business/orders/${sale.data.order.id}/status`, { token: E, body: { status: 'CANCELADO' } });
  const productsAfter = await call('GET', '/business/products', { token: E });
  expect('Cancelar una venta devuelve el stock', cancel.status === 200 && productsAfter.data[0].stock === 30, productsAfter.data[0]);
  const activity = await call('GET', `/marketplace/events/${ev.id}/activity`, { token: O });
  expect('El organizador ve la actividad de su evento', activity.status === 200, activity.data);
  const otherOrder = await call('PATCH', `/business/orders/${order.data.order.id}/status`, { token: O, body: { status: 'CANCELADO' } });
  expect('Otro usuario no puede tocar los pedidos', otherOrder.status === 403 || otherOrder.status === 404, otherOrder.status);

  // --- Participación: mensajes, puesto, pago simulado, lista de espera, plano y calificaciones ---
  const appId = apply.data.application.id;
  const thread = await call('GET', `/participation/${appId}/messages`, { token: E });
  expect('Al aprobar llega un mensaje automático', thread.status === 200 && thread.data.messages.some((m) => m.kind === 'AUTOMATICO'), thread.data);
  const outsider = await call('GET', `/participation/${appId}/messages`, { token: (await register('EMPRENDEDOR', 'otro')).data.token });
  expect('Un tercero no puede leer la conversación', outsider.status === 404, outsider.status);
  const sent = await call('POST', `/participation/${appId}/messages`, { token: E, body: { body: '¿Dónde descargo la mercadería?' } });
  expect('El emprendedor escribe a la organización', sent.status === 201, sent.data);
  const unread = await call('GET', '/participation/unread', { token: O });
  expect('El organizador ve el mensaje sin leer', unread.data.byApplication?.[appId] === 1, unread.data);
  await call('GET', `/participation/${appId}/messages`, { token: O });
  const unreadAfter = await call('GET', '/participation/unread', { token: O });
  expect('Al abrir la conversación se marca como leída', !unreadAfter.data.byApplication?.[appId], unreadAfter.data);

  const stand = await call('PATCH', `/participation/${appId}/stand`, { token: O, body: { standLabel: '7', setupTime: '08:30' } });
  expect('El organizador asigna puesto y hora de armado', stand.status === 200 && stand.data.application.standLabel === '7', stand.data);
  const badTime = await call('PATCH', `/participation/${appId}/stand`, { token: O, body: { setupTime: '25:99' } });
  expect('Hora de armado inválida se rechaza', badTime.status === 400, badTime.data);

  const mine = await call('GET', '/marketplace/applications', { token: E });
  const myApp = mine.data.find((item) => item.id === appId);
  expect('Con costo de puesto, el pago queda pendiente', myApp.paymentStatus === 'PENDIENTE' && myApp.standLabel === '7', myApp);
  const orgPays = await call('POST', `/participation/${appId}/payment/simulate`, { token: O });
  expect('El organizador no puede pagar por el emprendedor', orgPays.status === 403, orgPays.status);
  const pay = await call('POST', `/participation/${appId}/payment/simulate`, { token: E });
  expect('Pago simulado acreditado', pay.status === 200 && pay.data.reference?.startsWith('SIM-'), pay.data);
  const payAgain = await call('POST', `/participation/${appId}/payment/simulate`, { token: E });
  expect('No se paga dos veces', payAgain.status === 400, payAgain.data);

  const earlyReview = await call('POST', `/participation/${appId}/review`, { token: E, body: { rating: 5 } });
  expect('No se califica antes de que termine la feria', earlyReview.status === 400, earlyReview.data);

  const planOk = await call('PUT', `/participation/events/${ev.id}/plan`, { token: O, body: { standPlan: { cols: 6, rows: 3, stands: [{ label: '7', x: 0, y: 0 }, { label: '8', x: 1, y: 0 }], marks: [{ type: 'ENTRADA', x: 2, y: 2 }] } } });
  expect('Se guarda el plano de puestos', planOk.status === 200 && planOk.data.standPlan.stands.length === 2, planOk.data);
  const planBig = await call('PUT', `/participation/events/${ev.id}/plan`, { token: O, body: { standPlan: { cols: 30, rows: 3, stands: [] } } });
  expect('Plano fuera de medida se rechaza', planBig.status === 400, planBig.data);
  const planDup = await call('PUT', `/participation/events/${ev.id}/plan`, { token: O, body: { standPlan: { cols: 4, rows: 3, stands: [{ label: '1', x: 0, y: 0 }, { label: '1', x: 1, y: 0 }] } } });
  expect('Números de puesto repetidos se rechazan', planDup.status === 400, planDup.data);

  // Lista de espera: convocatoria de 1 puesto, el segundo espera y entra solo cuando el primero se baja.
  const small = await call('POST', '/marketplace/events', { token: O, body: { ...eventBody, name: `Feria prueba ${stamp} chica`, capacity: 1, standFee: '', status: 'PUBLICADA' } });
  expect('Convocatoria de un solo puesto', small.status === 201, small.data);
  const emp2 = await register('EMPRENDEDOR', 'emp2');
  const E2 = emp2.data.token;
  await call('PUT', '/marketplace/business', { token: E2, body: { name: 'Segundo emprendimiento', kind: 'FIJO', category: 'Alimentos', locality: 'Cruz Alta', contactPhone: '381 555 1111' } });
  const a1 = await call('POST', `/marketplace/events/${small.data.event.id}/applications`, { token: E, body: { offeredProduct: 'Empanadas', send: true } });
  const a2 = await call('POST', `/marketplace/events/${small.data.event.id}/applications`, { token: E2, body: { offeredProduct: 'Pan', send: true } });
  await call('PATCH', `/marketplace/admin/applications/${a1.data.application.id}/status`, { token: O, body: { status: 'APROBADA' } });
  const full = await call('PATCH', `/marketplace/admin/applications/${a2.data.application.id}/status`, { token: O, body: { status: 'APROBADA' } });
  expect('Con el cupo lleno no se aprueba más', full.status === 409 && /lista de espera/.test(full.data.message), full.data);
  const wait = await call('PATCH', `/marketplace/admin/applications/${a2.data.application.id}/status`, { token: O, body: { status: 'LISTA_ESPERA' } });
  expect('Pasa a lista de espera', wait.status === 200 && wait.data.application.status === 'LISTA_ESPERA', wait.data);
  const mine2 = await call('GET', '/marketplace/applications', { token: E2 });
  expect('El emprendedor ve su posición en la lista', mine2.data.find((item) => item.id === a2.data.application.id)?.waitlistPosition === 1, mine2.data[0]);
  const withdraw = await call('POST', `/participation/${a1.data.application.id}/withdraw`, { token: E, body: { reason: 'No llego' } });
  expect('El aprobado se da de baja', withdraw.status === 200, withdraw.data);
  const promoted = await call('GET', '/marketplace/applications', { token: E2 });
  const promotedApp = promoted.data.find((item) => item.id === a2.data.application.id);
  expect('El primero de la lista entra automáticamente', promotedApp?.status === 'APROBADA', promotedApp?.status);
  const promotedThread = await call('GET', `/participation/${a2.data.application.id}/messages`, { token: E2 });
  expect('Y recibe el mensaje de aprobación', promotedThread.data.messages.some((m) => m.kind === 'AUTOMATICO' && /aprobado/i.test(m.body)), promotedThread.data.messages.map((m) => m.body));

  // Pago informado con comprobante: el organizador lo ve y lo confirma.
  const feeEvent = await call('POST', '/marketplace/events', { token: O, body: { ...eventBody, name: `Feria prueba ${stamp} paga`, capacity: 5, standFee: 3000, status: 'PUBLICADA' } });
  const a3 = await call('POST', `/marketplace/events/${feeEvent.data.event.id}/applications`, { token: E2, body: { offeredProduct: 'Pan', send: true } });
  await call('PATCH', `/marketplace/admin/applications/${a3.data.application.id}/status`, { token: O, body: { status: 'APROBADA' } });
  const inform = await call('POST', `/participation/${a3.data.application.id}/payment/inform`, { token: E2, form: fileForm(PDF, 'comprobante.pdf', 'application/pdf', { method: 'TRANSFERENCIA', reference: '123' }) });
  expect('Pago informado con comprobante', inform.status === 200, inform.data);
  const received = await call('GET', '/marketplace/admin/applications', { token: O });
  const informed = received.data.find((item) => item.id === a3.data.application.id);
  expect('El organizador ve el pago informado', informed?.paymentStatus === 'INFORMADO' && informed.paymentReceiptUploadId, informed);
  const receipt = await call('GET', `/files/private/${informed.paymentReceiptUploadId}`, { token: O });
  expect('El organizador puede abrir el comprobante', receipt.status === 200, receipt.status);
  const receiptOther = await call('GET', `/files/private/${informed.paymentReceiptUploadId}`, { token: E });
  expect('Otro emprendedor no puede abrir el comprobante', receiptOther.status === 404, receiptOther.status);
  const rejectNoReason = await call('PATCH', `/participation/${a3.data.application.id}/payment`, { token: O, body: { status: 'RECHAZADO' } });
  expect('Rechazar un pago exige motivo', rejectNoReason.status === 400, rejectNoReason.data);
  const confirm = await call('PATCH', `/participation/${a3.data.application.id}/payment`, { token: O, body: { status: 'CONFIRMADO' } });
  expect('El organizador confirma el pago', confirm.status === 200, confirm.data);
  expect('La ficha del emprendimiento llega con fotos y productos', Array.isArray(informed.business.photos) && Array.isArray(informed.business.products), informed.business);

  // --- Caja del día del emprendedor ---
  const noDay = await call('POST', '/business/cash/close', { token: E, body: { countedCash: 0 } });
  expect('No se cierra una caja que no está abierta', noDay.status === 400, noDay.data);
  const openDay = await call('POST', '/business/cash/open', { token: E, body: { openingCash: 1000 } });
  expect('Se abre la caja del día', openDay.status === 201 && openDay.data.day.openingCash === 1000, openDay.data);
  const openTwice = await call('POST', '/business/cash/open', { token: E, body: { openingCash: 0 } });
  expect('No se abren dos cajas a la vez', openTwice.status === 409, openTwice.status);
  await call('POST', '/business/orders', { token: E, body: { items: [{ productId: product.data.product.id, quantity: 2 }], status: 'ENTREGADO', paymentMethod: 'EFECTIVO' } });
  await call('POST', '/business/orders', { token: E, body: { items: [{ productId: product.data.product.id, quantity: 1 }], status: 'ENTREGADO', paymentMethod: 'TRANSFERENCIA' } });
  const expense = await call('POST', '/business/expenses', { token: E, body: { concept: 'Hielo', amount: 500, method: 'EFECTIVO' } });
  expect('Gasto registrado en la caja', expense.status === 201 && expense.data.expense.cashDayId, expense.data);
  const current = await call('GET', '/business/cash/current', { token: E });
  const sum = current.data.day.summary;
  expect('La caja suma ventas por medio de pago y descuenta gastos', sum.sales === 3600 && sum.byMethod.EFECTIVO === 2400 && sum.byMethod.TRANSFERENCIA === 1200 && sum.expenses === 500, sum);
  expect('Efectivo esperado = inicial + ventas en efectivo − gastos en efectivo', sum.expectedCash === 1000 + 2400 - 500, sum.expectedCash);
  const close = await call('POST', '/business/cash/close', { token: E, body: { countedCash: 2800 } });
  expect('Al cerrar se calcula la diferencia del arqueo', close.status === 200 && close.data.day.summary.difference === -100, close.data);
  const history = await call('GET', '/business/cash/history', { token: E });
  expect('El día cerrado queda en el historial', history.data.length >= 1 && history.data[0].summary.net === sum.sales - sum.expenses - sum.rent, history.data[0]);

  // --- Ingresos y asistencia del organizador ---
  const income = await call('GET', '/participation/organizer/income', { token: O });
  expect('El organizador ve lo cobrado por puestos', income.status === 200 && income.data.totals.collected >= 3000 && income.data.daily.length === 30, income.data.totals);
  const incomeEmp = await call('GET', '/participation/organizer/income', { token: E });
  expect('Un emprendedor no ve los ingresos del organizador', incomeEmp.status === 403, incomeEmp.status);
  const earlyAttendance = await call('PATCH', `/participation/${a3.data.application.id}/attendance`, { token: O, body: { present: true } });
  expect('La asistencia no se marca antes del día de la feria', earlyAttendance.status === 400, earlyAttendance.data);

  // --- Denuncias y panel de la plataforma ---
  const overviewOrg = await call('GET', '/platform/overview', { token: O });
  expect('Solo la administración ve el panel de la plataforma', overviewOrg.status === 403, overviewOrg.status);
  const platform = await call('GET', '/platform/overview', { token: A });
  expect('Panel de la plataforma con indicadores', platform.status === 200 && typeof platform.data.users.emprendedores === 'number', platform.data);
  const badReport = await call('POST', '/platform/reports', { token: E2, body: { targetType: 'CONVERSACION', targetId: appId, reason: 'TRATO' } });
  expect('Solo quien participa puede denunciar una conversación', badReport.status === 404, badReport.status);
  const report = await call('POST', '/platform/reports', { token: E, body: { targetType: 'CONVERSACION', targetId: appId, reason: 'COBRO_INDEBIDO', details: 'Prueba automática' } });
  expect('El emprendedor denuncia la conversación', report.status === 201, report.data);
  const reportTwice = await call('POST', '/platform/reports', { token: E, body: { targetType: 'CONVERSACION', targetId: appId, reason: 'COBRO_INDEBIDO' } });
  expect('No se duplica una denuncia abierta', reportTwice.status === 409, reportTwice.status);
  const reports = await call('GET', '/platform/reports', { token: A });
  const mineReport = reports.data.reports.find((item) => item.id === report.data.report.id);
  expect('La administración ve la denuncia y a quién afecta (el organizador)', mineReport?.target?.user?.id === org.data.user.id, mineReport?.target);
  const noNotes = await call('PATCH', `/platform/reports/${report.data.report.id}`, { token: A, body: { status: 'RESUELTA' } });
  expect('Resolver exige una nota', noNotes.status === 400, noNotes.data);
  const resolve = await call('PATCH', `/platform/reports/${report.data.report.id}`, { token: A, body: { status: 'RESUELTA', action: 'SUSPENDER_USUARIO', notes: 'Prueba: se suspende la cuenta.' } });
  expect('La administración resuelve y suspende la cuenta denunciada', resolve.status === 200, resolve.data);
  const blocked = await call('GET', '/auth/me', { token: O });
  expect('La cuenta suspendida ya no puede usar la app', blocked.status === 403, blocked.status);
  const reactivate = await call('PATCH', `/platform/users/${org.data.user.id}`, { token: A, body: { status: true } });
  expect('La administración reactiva la cuenta', reactivate.status === 200, reactivate.data);
  const selfChange = await call('PATCH', `/platform/users/${admin.data.user.id}`, { token: A, body: { role: 'EMPRENDEDOR' } });
  expect('La administración no puede quitarse su propio rol', selfChange.status === 400, selfChange.data);

  console.log(`\n${failures === 0 ? 'TODO OK' : `${failures} FALLAS`}`);
};

const cleanup = async () => {
  const users = await prisma.user.findMany({ where: { username: { startsWith: 'prueba_claude_' } }, select: { id: true } });
  const ids = users.map((user) => user.id);
  if (ids.length) {
    await prisma.marketEvent.deleteMany({ where: { organizerUserId: { in: ids } } });
    await prisma.space.deleteMany({ where: { ownerUserId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.notification.deleteMany({ where: { description: { contains: `Feria prueba ${stamp}` } } });
  await prisma.notification.deleteMany({ where: { description: { contains: 'Emprendimiento prueba' } } });
  await prisma.$disconnect();
};

run()
  .catch((error) => { console.error(error); failures += 1; })
  .finally(async () => { await cleanup(); process.exit(failures ? 1 : 0); });
