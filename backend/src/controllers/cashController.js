import prisma from '../config/db.js';

export const getCurrentRegister = async (req, res) => {
  try {
    const register = await prisma.cashRegister.findFirst({
      where: { status: 'ABIERTA' },
      include: {
        openingUser: { select: { id: true, name: true, lastName: true, username: true } },
        movements: {
          include: {
            user: { select: { id: true, name: true, lastName: true, username: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { openedAt: 'desc' },
    });

    if (!register) {
      return res.json({ isOpen: false, register: null });
    }

    let totalIncomes = 0;
    let totalExpenses = 0;

    register.movements.forEach((m) => {
      const amt = Number(m.amount);
      if (m.type === 'INGRESO') {
        totalIncomes += amt;
      } else {
        totalExpenses += amt;
      }
    });

    // Saldo teórico = initialAmount + (incomes except APERTURA if APERTURA was registered as movement, or initial + movements)
    // En nuestro seed y lógica, APERTURA se registra como movimiento inicial con categoría 'APERTURA',
    // o calculamos directamente la suma de ingresos - egresos.
    // Para evitar duplicar: si APERTURA está en los movimientos, la suma directa de ingresos - egresos ya la incluye.
    // Verificamos si existe movimiento 'APERTURA'
    const hasAperturaMovement = register.movements.some((m) => m.category === 'APERTURA');
    const theoreticalAmount = hasAperturaMovement
      ? totalIncomes - totalExpenses
      : Number(register.initialAmount) + totalIncomes - totalExpenses;

    res.json({
      isOpen: true,
      register,
      summary: {
        initialAmount: Number(register.initialAmount),
        totalIncomes,
        totalExpenses,
        theoreticalAmount,
        movementsCount: register.movements.length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al consultar caja actual.', error: error.message });
  }
};

export const openRegister = async (req, res) => {
  try {
    const { initialAmount = 0, notes } = req.body;

    const existingOpen = await prisma.cashRegister.findFirst({
      where: { status: 'ABIERTA' },
    });

    if (existingOpen) {
      return res.status(400).json({
        message: 'Ya existe una caja abierta en curso. Debe cerrarla antes de realizar una nueva apertura.',
      });
    }

    const initAmt = parseFloat(initialAmount) || 0;
    if (initAmt < 0) {
      return res.status(400).json({ message: 'El saldo inicial no puede ser negativo.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const register = await tx.cashRegister.create({
        data: {
          openingUserId: req.user.id,
          initialAmount: initAmt,
          status: 'ABIERTA',
          notes: notes ? notes.trim() : null,
        },
      });

      if (initAmt > 0) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: register.id,
            type: 'INGRESO',
            category: 'APERTURA',
            amount: initAmt,
            concept: 'Fondo de cambio inicial al abrir caja',
            userId: req.user.id,
          },
        });
      }

      await tx.notification.create({
        data: {
          type: 'OPERACION_IMPORTANTE',
          title: 'Apertura de Caja realizada',
          description: `El usuario ${req.user.name} abrió la caja con un saldo inicial de $${initAmt.toLocaleString('es-AR')}.`,
        },
      });

      return register;
    });

    res.status(201).json({ message: 'Caja abierta exitosamente.', register: result });
  } catch (error) {
    res.status(500).json({ message: 'Error al abrir caja.', error: error.message });
  }
};

export const closeRegister = async (req, res) => {
  try {
    const { realAmount, notes } = req.body;

    if (realAmount === undefined || realAmount === null) {
      return res.status(400).json({ message: 'Debe ingresar el dinero contado físicamente.' });
    }

    const counted = parseFloat(realAmount);
    if (counted < 0) {
      return res.status(400).json({ message: 'El importe contado no puede ser negativo.' });
    }

    const register = await prisma.cashRegister.findFirst({
      where: { status: 'ABIERTA' },
      include: { movements: true },
      orderBy: { openedAt: 'desc' },
    });

    if (!register) {
      return res.status(400).json({ message: 'No hay ninguna caja abierta actualmente.' });
    }

    let totalIncomes = 0;
    let totalExpenses = 0;
    register.movements.forEach((m) => {
      const amt = Number(m.amount);
      if (m.type === 'INGRESO') totalIncomes += amt;
      else totalExpenses += amt;
    });

    const hasApertura = register.movements.some((m) => m.category === 'APERTURA');
    const theoretical = hasApertura
      ? totalIncomes - totalExpenses
      : Number(register.initialAmount) + totalIncomes - totalExpenses;

    const difference = counted - theoretical;

    const result = await prisma.$transaction(async (tx) => {
      const closed = await tx.cashRegister.update({
        where: { id: register.id },
        data: {
          status: 'CERRADA',
          closedAt: new Date(),
          closingUserId: req.user.id,
          theoreticalAmount: theoretical,
          realAmount: counted,
          difference,
          notes: notes ? notes.trim() : register.notes,
        },
        include: {
          openingUser: { select: { id: true, name: true, lastName: true } },
          closingUser: { select: { id: true, name: true, lastName: true } },
        },
      });

      // Si hay diferencia (sobrante o faltante), registrar notificación
      if (Math.abs(difference) > 0.01) {
        const diffText = difference > 0 ? `Sobrante de $${difference.toFixed(2)}` : `Faltante de $${Math.abs(difference).toFixed(2)}`;
        await tx.notification.create({
          data: {
            type: 'DIFERENCIA_CAJA',
            title: `Diferencia en Cierre de Caja (${diffText})`,
            description: `Teórico esperado: $${theoretical.toFixed(2)} | Contado real: $${counted.toFixed(2)} | Responsable: ${req.user.name} ${req.user.lastName}`,
          },
        });
      }

      return closed;
    });

    res.json({
      message: 'Caja cerrada exitosamente.',
      register: result,
      difference,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cerrar caja.', error: error.message });
  }
};

export const createManualMovement = async (req, res) => {
  try {
    const { type, amount, concept, category = 'MANUAL', eventId } = req.body;

    if (!type || !amount || !concept) {
      return res.status(400).json({ message: 'Tipo, monto y concepto son requeridos.' });
    }

    if (!['INGRESO', 'EGRESO'].includes(type)) {
      return res.status(400).json({ message: 'Tipo de movimiento inválido (debe ser INGRESO o EGRESO).' });
    }

    const amt = parseFloat(amount);
    if (amt <= 0) {
      return res.status(400).json({ message: 'El importe debe ser mayor a 0.' });
    }

    let eventLink = {};
    const isEventExpense = eventId !== undefined && eventId !== null && eventId !== '';
    if (req.user.role === 'EMPRENDEDOR' && !isEventExpense) {
      return res.status(403).json({ message: 'Las cuentas emprendedoras solo pueden registrar gastos dentro de una participación aprobada.' });
    }
    if (isEventExpense) {
      if (type !== 'EGRESO') return res.status(400).json({ message: 'Los ingresos del evento se registran como ventas; acá podés cargar gastos.' });
      const parsedEventId = Number(eventId);
      if (!Number.isInteger(parsedEventId) || parsedEventId < 1) return res.status(400).json({ message: 'La convocatoria seleccionada no es válida.' });
      const business = await prisma.businessProfile.findUnique({ where: { ownerUserId: req.user.id } });
      const approved = business && await prisma.eventApplication.findFirst({
        where: { eventId: parsedEventId, businessId: business.id, applicantUserId: req.user.id, status: 'APROBADA' },
      });
      if (!approved) return res.status(403).json({ message: 'Solo un negocio aprobado puede registrar gastos para este evento.' });
      eventLink = { eventId: parsedEventId, businessId: business.id };
    }

    const openRegister = isEventExpense ? null : await prisma.cashRegister.findFirst({ where: { status: 'ABIERTA' } });

    if (!isEventExpense && !openRegister) {
      return res.status(400).json({
        message: 'No hay ninguna caja abierta. Debe abrir la caja para registrar movimientos.',
      });
    }

    const movement = await prisma.cashMovement.create({
      data: {
        cashRegisterId: openRegister?.id || null,
        type,
        category: isEventExpense ? 'GASTO_EVENTO' : category,
        amount: amt,
        concept: concept.trim(),
        userId: req.user.id,
        ...eventLink,
      },
      include: {
        user: { select: { id: true, name: true, lastName: true } },
      },
    });

    res.status(201).json({ message: 'Movimiento de caja registrado con éxito', movement });
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar movimiento.', error: error.message });
  }
};

export const getCashHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;

    const [total, registers] = await Promise.all([
      prisma.cashRegister.count(),
      prisma.cashRegister.findMany({
        include: {
          openingUser: { select: { id: true, name: true, lastName: true } },
          closingUser: { select: { id: true, name: true, lastName: true } },
          _count: { select: { movements: true } },
        },
        orderBy: { openedAt: 'desc' },
        skip,
        take,
      }),
    ]);

    res.json({
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take),
      registers,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener historial de cajas.', error: error.message });
  }
};
