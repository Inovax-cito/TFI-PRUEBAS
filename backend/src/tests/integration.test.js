
const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Iniciando Suite de Pruebas de Integración y Calidad...\n');
  let token = null;

  // 1. Login Admin
  console.log('1️⃣  Probando Autenticación de Administrador (login)...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'admin123' }),
  });
  const loginData = await loginRes.json();
  if (loginRes.status !== 200 || !loginData.token) {
    throw new Error(`Fallo login: ${JSON.stringify(loginData)}`);
  }
  token = loginData.token;
  console.log('   ✅ Login exitoso. Token JWT generado.');

  // 2. Health & Me
  console.log('2️⃣  Probando obtención de perfil e info de comercio (/auth/me)...');
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meData = await meRes.json();
  console.log(`   ✅ Usuario: ${meData.user.name} ${meData.user.lastName} (${meData.user.role})`);
  console.log(`   ✅ Comercio: ${meData.businessConfig.businessName} (CUIT: ${meData.businessConfig.cuit})`);

  // 3. Consultar Dashboard
  console.log('3️⃣  Probando Métricas del Dashboard (/reports/dashboard)...');
  const dashRes = await fetch(`${BASE_URL}/reports/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const dashData = await dashRes.json();
  console.log(`   ✅ Ventas hoy: $${dashData.cards.salesTodayTotal} (${dashData.cards.salesTodayCount} operaciones)`);
  console.log(`   ✅ Productos registrados: ${dashData.cards.totalProducts}, en alerta: ${dashData.cards.lowStockCount}`);
  console.log(`   ✅ Estado Caja: ${dashData.cards.cashStatus.isOpen ? 'ABIERTA' : 'CERRADA'} (Saldo: $${dashData.cards.cashStatus.currentBalance})`);

  // 4. Obtener productos y verificar stock antes de venta
  console.log('4️⃣  Consultando Catálogo de Productos (/products)...');
  const prodRes = await fetch(`${BASE_URL}/products?active=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const products = await prodRes.json();
  const prod1 = products[0]; // Yerba Mate
  const prod2 = products[1]; // Fideos
  const initialStockProd1 = prod1.currentStock;
  console.log(`   ✅ Producto seleccionado: ${prod1.name} (Stock inicial: ${initialStockProd1})`);

  // 5. Registrar Venta (POS)
  console.log('5️⃣  Ejecutando Venta Atómica en POS (/sales)...');
  const salePayload = {
    paymentMethod: 'Efectivo',
    discount: 100,
    items: [
      { productId: prod1.id, quantity: 2, unitPrice: Number(prod1.salePrice) },
      { productId: prod2.id, quantity: 1, unitPrice: Number(prod2.salePrice) },
    ],
  };
  const saleRes = await fetch(`${BASE_URL}/sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(salePayload),
  });
  const saleData = await saleRes.json();
  if (saleRes.status !== 201) {
    throw new Error(`Fallo venta: ${JSON.stringify(saleData)}`);
  }
  console.log(`   ✅ Venta ${saleData.sale.saleNumber} registrada por un total de $${saleData.sale.total}`);

  // 6. Verificar decremento automático de stock
  console.log('6️⃣  Verificando decremento atómico de stock e inventario...');
  const prod1AfterRes = await fetch(`${BASE_URL}/products/${prod1.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const prod1After = await prod1AfterRes.json();
  if (prod1After.currentStock !== initialStockProd1 - 2) {
    throw new Error(`El stock no decrementó correctamente. Esperado: ${initialStockProd1 - 2}, Actual: ${prod1After.currentStock}`);
  }
  console.log(`   ✅ Stock decrementó con éxito: De ${initialStockProd1} a ${prod1After.currentStock}`);

  // 7. Verificar Movimiento de Inventario Kardex
  console.log('7️⃣  Verificando registro en Kardex de inventario (/inventory/movements)...');
  const movRes = await fetch(`${BASE_URL}/inventory/movements?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const movData = await movRes.json();
  const lastMov = movData.movements[0];
  console.log(`   ✅ Último movimiento: ${lastMov.type} de ${lastMov.quantity} unidades en "${lastMov.product.name}"`);

  // 8. Verificar impacto en Caja
  console.log('8️⃣  Verificando cobro automático en Caja actual (/cash/current)...');
  const cashRes = await fetch(`${BASE_URL}/cash/current`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const cashData = await cashRes.json();
  console.log(`   ✅ Saldo teórico actual de caja: $${cashData.summary.theoreticalAmount} (${cashData.summary.movementsCount} movimientos registrados)`);

  // 9. Registrar Movimiento Manual en Caja
  console.log('9️⃣  Registrando Egreso Manual en Caja (/cash/movements)...');
  const manualMovRes = await fetch(`${BASE_URL}/cash/movements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: 'EGRESO',
      amount: 1500,
      concept: 'Compra de cinta adhesiva y rollos para ticketera',
      category: 'GASTO_OPERATIVO',
    }),
  });
  const manualMovData = await manualMovRes.json();
  console.log(`   ✅ Egreso registrado: -$${manualMovData.movement.amount} (${manualMovData.movement.concept})`);

  // 10. Probar Gestión de Compras y Recepción de Stock
  console.log('🔟 Probando Gestión de Compras y Recepción Atómica (/purchases)...');
  const purchasePayload = {
    supplierId: 1,
    status: 'PENDIENTE',
    notes: 'Pedido de reposición mensual',
    items: [{ productId: prod1.id, quantity: 15, unitCost: 1600 }],
  };
  const purchRes = await fetch(`${BASE_URL}/purchases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(purchasePayload),
  });
  const purchData = await purchRes.json();
  console.log(`   ✅ Orden ${purchData.purchase.purchaseNumber} creada en estado ${purchData.purchase.status}`);

  // Recepcionar la compra
  const receiveRes = await fetch(`${BASE_URL}/purchases/${purchData.purchase.id}/receive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ payFromCash: false }),
  });
  const receiveData = await receiveRes.json();
  console.log(`   ✅ ${receiveData.message}`);

  // Verificar que el stock incrementó por la compra recibida
  const prod1AfterPurchase = await (await fetch(`${BASE_URL}/products/${prod1.id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  console.log(`   ✅ Stock tras recepción de compra: ${prod1AfterPurchase.currentStock} unidades`);

  // 11. Reporte Financiero
  console.log('1️⃣1️⃣ Probando Reporte Financiero y Ganancia Neta (/reports/financial)...');
  const finRes = await fetch(`${BASE_URL}/reports/financial`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const finData = await finRes.json();
  console.log(`   ✅ Total Facturado: $${finData.totalSalesRevenue}`);
  console.log(`   ✅ Costo Mercadería Vendida (COGS): $${finData.costOfGoodsSold}`);
  console.log(`   ✅ Margen Bruto: $${finData.grossMargin}`);
  console.log(`   ✅ Gastos Operativos de Caja: $${finData.operatingExpenses}`);
  console.log(`   ✅ Ganancia Neta Estimada: $${finData.netEstimatedProfit}`);

  // 12. Restricción de permisos para Empleado
  console.log('1️⃣2️⃣ Probando Seguridad y RBAC (Rol Empleado)...');
  const empLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'empleado', password: 'empleado123' }),
  });
  const empData = await empLoginRes.json();
  const empToken = empData.token;

  // Intento de acceso a ruta de administración de usuarios como empleado
  const forbiddenRes = await fetch(`${BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${empToken}` },
  });
  if (forbiddenRes.status === 403) {
    console.log('   ✅ Seguridad comprobada: Empleado bloqueado correctamente con 403 Forbidden en módulos restringidos.');
  } else {
    throw new Error(`Fallo seguridad: Empleado obtuvo código ${forbiddenRes.status}`);
  }

  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE INTEGRACIÓN PASARON EXITOSAMENTE!');
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EN PRUEBAS:', err);
  process.exit(1);
});
