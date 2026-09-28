import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando carga de datos iniciales (Seed)...');

  // Limpiar datos existentes en orden de dependencias
  await prisma.notification.deleteMany();
  await prisma.cashMovement.deleteMany();
  await prisma.cashRegister.deleteMany();
  await prisma.saleDetail.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseDetail.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.businessConfig.deleteMany();
  await prisma.user.deleteMany();

  // 1. Usuarios
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const employeePasswordHash = await bcrypt.hash('empleado123', 10);

  const adminUser = await prisma.user.create({
    data: {
      name: 'Joaquín',
      lastName: 'Pérez',
      username: 'admin',
      email: 'admin@comercio.com',
      password: adminPasswordHash,
      role: 'ADMINISTRADOR',
      status: true,
    },
  });

  const employeeUser = await prisma.user.create({
    data: {
      name: 'Aaron',
      lastName: 'Risso',
      username: 'empleado',
      email: 'empleado@comercio.com',
      password: employeePasswordHash,
      role: 'EMPLEADO',
      status: true,
    },
  });

  console.log('✅ Usuarios creados: admin (admin123) y empleado (empleado123)');

  // 2. Configuración del negocio
  await prisma.businessConfig.create({
    data: {
      businessName: 'Almacén & Autoservicio El Trébol',
      cuit: '20-35489123-4',
      address: 'Av. Corrientes 3420, Buenos Aires',
      phone: '+54 11 4862-7711',
      email: 'contacto@eltrebol.com.ar',
      currencyCode: 'ARS',
      currencySymbol: '$',
      receiptFooter: '¡Gracias por su compra! Comprobante de autogestión comercial no fiscal.',
      allowNegativeStock: false,
    },
  });

  // 3. Métodos de pago
  const paymentMethods = [
    { name: 'Efectivo', isDefault: true, active: true },
    { name: 'Transferencia', isDefault: false, active: true },
    { name: 'Tarjeta de Débito', isDefault: false, active: true },
    { name: 'Tarjeta de Crédito', isDefault: false, active: true },
    { name: 'Mercado Pago / QR', isDefault: false, active: true },
  ];

  for (const pm of paymentMethods) {
    await prisma.paymentMethod.create({ data: pm });
  }

  // 4. Categorías
  const catAlmacen = await prisma.category.create({
    data: { name: 'Almacén', description: 'Comestibles, fideos, aceites, harinas y conservas' },
  });
  const catBebidas = await prisma.category.create({
    data: { name: 'Bebidas', description: 'Gaseosas, aguas, jugos y aperitivos' },
  });
  const catLacteos = await prisma.category.create({
    data: { name: 'Lácteos y Frescos', description: 'Leches, yogures, quesos y mantecas' },
  });
  const catKiosco = await prisma.category.create({
    data: { name: 'Golosinas y Kiosco', description: 'Alfajores, chocolates, galletitas y snacks' },
  });
  const catLimpieza = await prisma.category.create({
    data: { name: 'Limpieza', description: 'Artículos de higiene del hogar y perfumería' },
  });

  // 5. Proveedores
  const provArcor = await prisma.supplier.create({
    data: {
      name: 'Distribuidora Arcor S.A.',
      cuit: '30-50279317-5',
      phone: '011-4567-1111',
      email: 'pedidos@arcor.com.ar',
      address: 'Av. Maipú 2100, Vicente López',
      notes: 'Entregas los martes y jueves por la mañana.',
    },
  });

  const provCoca = await prisma.supplier.create({
    data: {
      name: 'Femsa Coca-Cola Distribución',
      cuit: '30-50123456-1',
      phone: '011-4222-3333',
      email: 'ventas@femsa.com.ar',
      address: 'Panamericana Km 28, Don Torcuato',
      notes: 'Plazo de pago 15 días.',
    },
  });

  const provSerenisima = await prisma.supplier.create({
    data: {
      name: 'Mastellone Hnos. (La Serenísima)',
      cuit: '30-50000001-2',
      phone: '011-4444-5555',
      email: 'pedidos@mastellone.com.ar',
      address: 'Gral. Rodríguez, Buenos Aires',
      notes: 'Reparto diario de productos frescos.',
    },
  });

  // 6. Productos
  const productsData = [
    {
      name: 'Yerba Mate Playadito 500g',
      sku: '7790070411211',
      categoryId: catAlmacen.id,
      purchasePrice: 1650.0,
      salePrice: 2450.0,
      currentStock: 35,
      minStock: 10,
      unit: 'paquete',
      description: 'Yerba mate suave elaborada con palo 500g',
    },
    {
      name: 'Fideos Matarazzo Spaghetti 500g',
      sku: '7790070101112',
      categoryId: catAlmacen.id,
      purchasePrice: 980.0,
      salePrice: 1550.0,
      currentStock: 40,
      minStock: 12,
      unit: 'paquete',
      description: 'Fideos secos de sémola de trigo candeal',
    },
    {
      name: 'Aceite de Girasol Natura 900ml',
      sku: '7790070202223',
      categoryId: catAlmacen.id,
      purchasePrice: 1400.0,
      salePrice: 2150.0,
      currentStock: 25,
      minStock: 8,
      unit: 'botella',
      description: 'Aceite vegetal 100% puro de girasol',
    },
    {
      name: 'Coca-Cola Sabor Original 1.5L',
      sku: '7790895000456',
      categoryId: catBebidas.id,
      purchasePrice: 1750.0,
      salePrice: 2600.0,
      currentStock: 28,
      minStock: 12,
      unit: 'botella',
      description: 'Gaseosa sabor cola en botella descartable 1.5L',
    },
    {
      name: 'Agua Mineral Villavicencio sin gas 1.5L',
      sku: '7790895000789',
      categoryId: catBebidas.id,
      purchasePrice: 700.0,
      salePrice: 1200.0,
      currentStock: 30,
      minStock: 10,
      unit: 'botella',
      description: 'Agua de manantial natural protegida',
    },
    {
      name: 'Cerveza Quilmes Clásica 1L',
      sku: '7790895001122',
      categoryId: catBebidas.id,
      purchasePrice: 1600.0,
      salePrice: 2400.0,
      currentStock: 4, // Stock bajo a propósito para probar alertas!
      minStock: 10,
      unit: 'botella',
      description: 'Cerveza rubia tipo lager en envase retornable',
    },
    {
      name: 'Leche Entera La Serenísima 1L',
      sku: '7793940420011',
      categoryId: catLacteos.id,
      purchasePrice: 1100.0,
      salePrice: 1650.0,
      currentStock: 18,
      minStock: 8,
      unit: 'sachet',
      description: 'Leche fluida pasteurizada homogenizada 3% tenor graso',
    },
    {
      name: 'Queso Cremoso La Paulina x 500g',
      sku: '7793940420555',
      categoryId: catLacteos.id,
      purchasePrice: 3200.0,
      salePrice: 4700.0,
      currentStock: 12,
      minStock: 5,
      unit: 'pieza',
      description: 'Queso de pasta blanda tradicional',
    },
    {
      name: 'Galletitas Oreo Original 118g',
      sku: '7622300741234',
      categoryId: catKiosco.id,
      purchasePrice: 950.0,
      salePrice: 1450.0,
      currentStock: 45,
      minStock: 15,
      unit: 'paquete',
      description: 'Galletitas rellenas de crema sabor vainilla',
    },
    {
      name: 'Alfajor Havanna Mixto Chocolate',
      sku: '7791234567890',
      categoryId: catKiosco.id,
      purchasePrice: 1200.0,
      salePrice: 1900.0,
      currentStock: 3, // Stock bajo a propósito!
      minStock: 8,
      unit: 'unidad',
      description: 'Alfajor relleno con dulce de leche bañado en chocolate',
    },
    {
      name: 'Papas Fritas Lays Clásicas 85g',
      sku: '7790123456781',
      categoryId: catKiosco.id,
      purchasePrice: 1350.0,
      salePrice: 2050.0,
      currentStock: 20,
      minStock: 6,
      unit: 'paquete',
      description: 'Papas fritas con sal marina crujientes',
    },
    {
      name: 'Detergente Magistral Limón 500ml',
      sku: '7790045612345',
      categoryId: catLimpieza.id,
      purchasePrice: 1850.0,
      salePrice: 2800.0,
      currentStock: 14,
      minStock: 6,
      unit: 'botella',
      description: 'Detergente lavavajilla concentrado desengrasante',
    },
    {
      name: 'Lavandina Ayudín Triple Poder 1L',
      sku: '7790045698765',
      categoryId: catLimpieza.id,
      purchasePrice: 850.0,
      salePrice: 1350.0,
      currentStock: 22,
      minStock: 8,
      unit: 'botella',
      description: 'Desinfectante líquido concentrado con cloro',
    },
  ];

  const createdProducts = [];
  for (const p of productsData) {
    const prod = await prisma.product.create({ data: p });
    createdProducts.push(prod);

    // Registro de movimiento inicial de inventario
    await prisma.inventoryMovement.create({
      data: {
        productId: prod.id,
        type: 'AJUSTE_POSITIVO',
        quantity: prod.currentStock,
        previousStock: 0,
        resultStock: prod.currentStock,
        reason: 'Carga de stock inicial de apertura del sistema',
        userId: adminUser.id,
      },
    });

    // Historial de precio inicial
    await prisma.priceHistory.create({
      data: {
        productId: prod.id,
        oldPrice: prod.salePrice,
        newPrice: prod.salePrice,
        userId: adminUser.id,
      },
    });
  }
  console.log(`✅ ${createdProducts.length} Productos y movimientos iniciales creados`);

  // 7. Apertura de caja actual
  const cashRegister = await prisma.cashRegister.create({
    data: {
      openingUserId: adminUser.id,
      initialAmount: 25000.0,
      status: 'ABIERTA',
      notes: 'Apertura de turno mañana con fondo de cambio inicial.',
    },
  });

  await prisma.cashMovement.create({
    data: {
      cashRegisterId: cashRegister.id,
      type: 'INGRESO',
      category: 'APERTURA',
      amount: 25000.0,
      concept: 'Fondo inicial para cambio en caja',
      userId: adminUser.id,
    },
  });
  console.log('✅ Caja abierta con saldo inicial de $25.000,00');

  // 8. Crear un par de compras de prueba
  // Compra 1: Recibida a Arcor
  const purchase1 = await prisma.purchase.create({
    data: {
      purchaseNumber: 'COM-000001',
      supplierId: provArcor.id,
      total: 35000.0,
      status: 'RECIBIDA',
      notes: 'Factura A-0004-00123984 entregada en fecha',
      userId: adminUser.id,
      receivedAt: new Date(),
      details: {
        create: [
          {
            productId: createdProducts[8].id, // Oreo
            quantity: 20,
            unitCost: 950.0,
            subtotal: 19000.0,
          },
          {
            productId: createdProducts[0].id, // Playadito
            quantity: 10,
            unitCost: 1600.0,
            subtotal: 16000.0,
          },
        ],
      },
    },
  });

  // Movimiento de caja por compra en efectivo de insumos menores
  await prisma.cashMovement.create({
    data: {
      cashRegisterId: cashRegister.id,
      type: 'EGRESO',
      category: 'GASTO_OPERATIVO',
      amount: 4500.0,
      concept: 'Pago a fletero por flete de mercadería local',
      userId: adminUser.id,
    },
  });

  // Compra 2: Pendiente a Quilmes
  await prisma.purchase.create({
    data: {
      purchaseNumber: 'COM-000002',
      supplierId: provCoca.id,
      total: 52000.0,
      status: 'PENDIENTE',
      notes: 'Pedido programado para entregar el próximo jueves',
      userId: adminUser.id,
      details: {
        create: [
          {
            productId: createdProducts[3].id, // Coca Cola
            quantity: 20,
            unitCost: 1750.0,
            subtotal: 35000.0,
          },
          {
            productId: createdProducts[4].id, // Villavicencio
            quantity: 24,
            unitCost: 700.0,
            subtotal: 16800.0,
          },
        ],
      },
    },
  });

  // 9. Crear ventas de demostración para métricas y gráficos
  // Venta 1
  const sale1 = await prisma.sale.create({
    data: {
      saleNumber: 'VTA-000001',
      total: 7500.0,
      discount: 0.0,
      paymentMethod: 'Efectivo',
      status: 'COMPLETADA',
      userId: adminUser.id,
      createdAt: new Date(Date.now() - 3600000 * 2), // hace 2 horas
      details: {
        create: [
          {
            productId: createdProducts[0].id, // Playadito
            quantity: 2,
            unitPrice: 2450.0,
            unitCost: 1650.0,
            subtotal: 4900.0,
          },
          {
            productId: createdProducts[3].id, // Coca Cola
            quantity: 1,
            unitPrice: 2600.0,
            unitCost: 1750.0,
            subtotal: 2600.0,
          },
        ],
      },
    },
  });

  await prisma.cashMovement.create({
    data: {
      cashRegisterId: cashRegister.id,
      type: 'INGRESO',
      category: 'VENTA',
      amount: 7500.0,
      concept: 'Cobro de Venta N° VTA-000001 en Efectivo',
      userId: adminUser.id,
      createdAt: new Date(Date.now() - 3600000 * 2),
    },
  });

  // Venta 2
  const sale2 = await prisma.sale.create({
    data: {
      saleNumber: 'VTA-000002',
      total: 4850.0,
      discount: 200.0,
      paymentMethod: 'Mercado Pago / QR',
      status: 'COMPLETADA',
      userId: employeeUser.id,
      createdAt: new Date(Date.now() - 3600000 * 1), // hace 1 hora
      details: {
        create: [
          {
            productId: createdProducts[6].id, // Leche
            quantity: 2,
            unitPrice: 1650.0,
            unitCost: 1100.0,
            subtotal: 3300.0,
          },
          {
            productId: createdProducts[1].id, // Matarazzo
            quantity: 1,
            unitPrice: 1550.0,
            unitCost: 980.0,
            subtotal: 1550.0,
          },
        ],
      },
    },
  });

  // Venta 3 (Ayer para alimentar gráfico de 7 días)
  await prisma.sale.create({
    data: {
      saleNumber: 'VTA-000003',
      total: 11800.0,
      discount: 0.0,
      paymentMethod: 'Tarjeta de Débito',
      status: 'COMPLETADA',
      userId: employeeUser.id,
      createdAt: new Date(Date.now() - 86400000 * 1), // ayer
      details: {
        create: [
          {
            productId: createdProducts[7].id, // Queso
            quantity: 2,
            unitPrice: 4700.0,
            unitCost: 3200.0,
            subtotal: 9400.0,
          },
          {
            productId: createdProducts[5].id, // Quilmes
            quantity: 1,
            unitPrice: 2400.0,
            unitCost: 1600.0,
            subtotal: 2400.0,
          },
        ],
      },
    },
  });

  // 10. Notificaciones
  await prisma.notification.createMany({
    data: [
      {
        type: 'STOCK_BAJO',
        title: 'Alerta de Stock Bajo: Cerveza Quilmes Clásica 1L',
        description: 'Quedan 4 unidades disponibles (mínimo configurado: 10). Se recomienda reposición.',
        read: false,
      },
      {
        type: 'STOCK_BAJO',
        title: 'Alerta de Stock Bajo: Alfajor Havanna Mixto',
        description: 'Quedan 3 unidades disponibles (mínimo configurado: 8). Se recomienda contactar a Arcor.',
        read: false,
      },
      {
        type: 'COMPRA_PENDIENTE',
        title: 'Compra pendiente por recibir: COM-000002',
        description: 'Orden de compra a Femsa Coca-Cola por un total de $52.000,00 pendiente de recepción.',
        read: false,
      },
    ],
  });

  console.log('✅ Notificaciones, ventas de prueba y flujo de caja inicial creados.');
  console.log('🎉 Seed finalizado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
