import prisma from '../config/db.js';

export const getDashboardMetrics = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Ventas del día
    const todaySales = await prisma.sale.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        status: 'COMPLETADA',
        eventId: null,
      },
      include: {
        details: true,
      },
    });

    const salesTodayCount = todaySales.length;
    let salesTodayTotal = 0;
    let salesTodayCost = 0;

    todaySales.forEach((s) => {
      salesTodayTotal += Number(s.total);
      s.details.forEach((d) => {
        salesTodayCost += Number(d.unitCost) * d.quantity;
      });
    });

    // 2. Movimientos de caja del día
    const todayMovements = await prisma.cashMovement.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        eventId: null,
      },
    });

    let todayIncomes = 0;
    let todayExpenses = 0;

    todayMovements.forEach((m) => {
      const amt = Number(m.amount);
      if (m.type === 'INGRESO') {
        todayIncomes += amt;
      } else {
        todayExpenses += amt;
      }
    });

    // Ganancia estimada del día = (Total ventas del día - Costo mercadería del día) - Egresos operativos no relacionados a costo de stock
    const estimatedProfitToday = salesTodayTotal - salesTodayCost;

    // 3. Resumen de productos
    const allProducts = await prisma.product.findMany({
      where: { active: true },
      select: { currentStock: true, minStock: true },
    });

    const totalProducts = allProducts.length;
    const lowStockCount = allProducts.filter((p) => p.currentStock <= p.minStock).length;

    // 4. Compras pendientes
    const pendingPurchasesCount = await prisma.purchase.count({
      where: { status: 'PENDIENTE' },
    });

    // 5. Estado de la caja
    const openRegister = await prisma.cashRegister.findFirst({
      where: { status: 'ABIERTA' },
      include: { movements: true },
      orderBy: { openedAt: 'desc' },
    });

    let cashStatus = {
      isOpen: Boolean(openRegister),
      currentBalance: 0,
    };

    if (openRegister) {
      let regIn = 0;
      let regOut = 0;
      openRegister.movements.forEach((m) => {
        if (m.type === 'INGRESO') regIn += Number(m.amount);
        else regOut += Number(m.amount);
      });
      const hasApertura = openRegister.movements.some((m) => m.category === 'APERTURA');
      cashStatus.currentBalance = hasApertura
        ? regIn - regOut
        : Number(openRegister.initialAmount) + regIn - regOut;
    }

    // 6. Gráfico: Ventas de los últimos 7 días
    // Las 7 consultas se lanzan en paralelo (cada ida y vuelta a la base remota suma latencia)
    const last7Days = await Promise.all([6, 5, 4, 3, 2, 1, 0].map(async (i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const daySales = await prisma.sale.findMany({
        where: {
          createdAt: { gte: dayStart, lte: dayEnd },
          status: 'COMPLETADA',
          eventId: null,
        },
        select: { total: true },
      });

      const dayTotal = daySales.reduce((acc, s) => acc + Number(s.total), 0);
      const dayName = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' });

      return {
        date: d.toISOString().split('T')[0],
        label: dayName,
        total: dayTotal,
        count: daySales.length,
      };
    }));

    // 7. Gráfico: Top 5 productos más vendidos (todo el historial o últimos 30 días)
    const saleDetails = await prisma.saleDetail.findMany({
      where: { sale: { status: 'COMPLETADA', eventId: null } },
      include: {
        product: { select: { id: true, name: true } },
      },
    });

    const productSalesMap = {};
    saleDetails.forEach((d) => {
      const pId = d.productId;
      if (!productSalesMap[pId]) {
        productSalesMap[pId] = {
          id: pId,
          name: d.product.name,
          quantity: 0,
          total: 0,
        };
      }
      productSalesMap[pId].quantity += d.quantity;
      productSalesMap[pId].total += Number(d.subtotal);
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // 8. Actividad reciente (Últimas ventas y compras)
    const recentSales = await prisma.sale.findMany({
      take: 4,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, lastName: true } } },
    });

    const recentPurchases = await prisma.purchase.findMany({
      take: 4,
      orderBy: { createdAt: 'desc' },
      include: { supplier: { select: { name: true } }, user: { select: { name: true, lastName: true } } },
    });

    const activities = [
      ...recentSales.map((s) => ({
        id: `sale-${s.id}`,
        type: 'VENTA',
        title: `Venta ${s.saleNumber}`,
        description: `Monto: $${Number(s.total).toLocaleString('es-AR')} (${s.paymentMethod})`,
        status: s.status,
        userName: `${s.user.name} ${s.user.lastName}`,
        createdAt: s.createdAt,
      })),
      ...recentPurchases.map((p) => ({
        id: `purchase-${p.id}`,
        type: 'COMPRA',
        title: `Compra ${p.purchaseNumber}`,
        description: `Proveedor: ${p.supplier.name} - Total: $${Number(p.total).toLocaleString('es-AR')}`,
        status: p.status,
        userName: `${p.user.name} ${p.user.lastName}`,
        createdAt: p.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

    res.json({
      cards: {
        salesTodayCount,
        salesTodayTotal,
        todayIncomes,
        todayExpenses,
        estimatedProfitToday,
        totalProducts,
        lowStockCount,
        pendingPurchasesCount,
        cashStatus,
      },
      charts: {
        last7Days,
        topProducts,
      },
      recentActivity: activities,
    });
  } catch (error) {
    console.error('Error en dashboard metrics:', error);
    res.status(500).json({ message: 'Error al generar métricas del panel principal.', error: error.message });
  }
};

export const getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, paymentMethod } = req.query;

    const where = { status: 'COMPLETADA', eventId: null };

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        user: { select: { name: true, lastName: true } },
        details: {
          include: { product: { select: { name: true, sku: true, category: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalCost = 0;
    const paymentBreakdown = {};

    sales.forEach((s) => {
      const tot = Number(s.total);
      totalRevenue += tot;
      totalDiscount += Number(s.discount);

      paymentBreakdown[s.paymentMethod] = (paymentBreakdown[s.paymentMethod] || 0) + tot;

      s.details.forEach((d) => {
        totalCost += Number(d.unitCost) * d.quantity;
      });
    });

    const averageTicket = sales.length > 0 ? totalRevenue / sales.length : 0;
    const grossProfit = totalRevenue - totalCost;

    res.json({
      summary: {
        salesCount: sales.length,
        totalRevenue,
        totalCost,
        grossProfit,
        profitMarginPct: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
        totalDiscount,
        averageTicket,
      },
      paymentBreakdown: Object.entries(paymentBreakdown).map(([method, amount]) => ({
        method,
        amount,
      })),
      sales,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al generar reporte de ventas.', error: error.message });
  }
};

export const getFinancialReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    }

    // 1. Ventas e ingresos
    const sales = await prisma.sale.findMany({
      where: {
        status: 'COMPLETADA',
        eventId: null,
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      include: { details: true },
    });

    let totalSalesRevenue = 0;
    let costOfGoodsSold = 0;

    sales.forEach((s) => {
      totalSalesRevenue += Number(s.total);
      s.details.forEach((d) => {
        costOfGoodsSold += Number(d.unitCost) * d.quantity;
      });
    });

    // 2. Gastos y egresos de caja (distintos a egresos por compra de mercadería ya inventariada)
    const cashMovements = await prisma.cashMovement.findMany({
      where: {
        eventId: null,
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
    });

    let operatingExpenses = 0;
    let otherIncomes = 0;

    cashMovements.forEach((m) => {
      const amt = Number(m.amount);
      if (m.type === 'EGRESO' && m.category !== 'COMPRA') {
        operatingExpenses += amt;
      } else if (m.type === 'INGRESO' && m.category !== 'VENTA' && m.category !== 'APERTURA') {
        otherIncomes += amt;
      }
    });

    const grossMargin = totalSalesRevenue - costOfGoodsSold;
    const netEstimatedProfit = grossMargin + otherIncomes - operatingExpenses;

    res.json({
      totalSalesRevenue,
      costOfGoodsSold,
      grossMargin,
      operatingExpenses,
      otherIncomes,
      netEstimatedProfit,
      marginPercentage: totalSalesRevenue > 0 ? (netEstimatedProfit / totalSalesRevenue) * 100 : 0,
      salesCount: sales.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al generar reporte financiero.', error: error.message });
  }
};

export const getInventoryReport = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: { currentStock: 'asc' },
    });

    let totalCostValuation = 0;
    let totalSaleValuation = 0;
    let lowStockCount = 0;
    let zeroStockCount = 0;

    const items = products.map((p) => {
      const cost = Number(p.purchasePrice);
      const sale = Number(p.salePrice);
      const stock = p.currentStock;
      const costVal = stock * cost;
      const saleVal = stock * sale;

      totalCostValuation += costVal;
      totalSaleValuation += saleVal;

      if (stock === 0) zeroStockCount++;
      else if (stock <= p.minStock) lowStockCount++;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category.name,
        stock,
        minStock: p.minStock,
        purchasePrice: cost,
        salePrice: sale,
        totalCostValuation: costVal,
        totalSaleValuation: saleVal,
        marginUnit: sale - cost,
        isLow: stock <= p.minStock,
      };
    });

    res.json({
      summary: {
        totalProducts: products.length,
        lowStockCount,
        zeroStockCount,
        totalCostValuation,
        totalSaleValuation,
        projectedGrossProfit: totalSaleValuation - totalCostValuation,
      },
      items,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al generar reporte de inventario.', error: error.message });
  }
};
