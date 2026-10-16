import prisma from '../config/db.js';

export const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { OR: [{ userId: req.user.id }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const unreadCount = await prisma.notification.count({
      where: { read: false, OR: [{ userId: req.user.id }, { userId: null }] },
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener notificaciones.', error: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notifId = parseInt(id, 10);

    const updated = await prisma.notification.updateMany({
      where: { id: notifId, OR: [{ userId: req.user.id }, { userId: null }] },
      data: { read: true },
    });
    if (!updated.count) return res.status(404).json({ message: 'Notificación no encontrada.' });

    res.json({ message: 'Notificación marcada como leída.', notification: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar notificación.', error: error.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { read: false, OR: [{ userId: req.user.id }, { userId: null }] },
      data: { read: true },
    });

    res.json({ message: 'Todas las notificaciones marcadas como leídas.' });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar notificaciones.', error: error.message });
  }
};
