import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, AlertTriangle, AlertCircle, ShoppingBag, DollarSign, MessageCircle, CreditCard, CalendarClock, Building2, TicketCheck, ChevronRight } from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { navigateTo, notificationLink } from '../utils/navigation.js';
import { formatDateTime } from '../utils/formatters.js';

export const NotificationDropdown = ({ isOpen, onClose, onRefreshCount }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/notifications');
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error('Error al cargar notificaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkAsRead = async (id) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      if (onRefreshCount) onRefreshCount();
    } catch (err) {
      console.error(err);
    }
  };

  // Al tocar un aviso: se marca como leído y se abre el lugar al que se refiere.
  const openNotification = (item) => {
    if (!item.read) handleMarkAsRead(item.id);
    const link = notificationLink(item, user?.role);
    if (link) {
      if (onClose) onClose();
      navigateTo(link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      if (onRefreshCount) onRefreshCount();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'STOCK_BAJO':
        return <AlertTriangle size={18} className="text-warning" />;
      case 'DIFERENCIA_CAJA':
        return <DollarSign size={18} className="text-danger" />;
      case 'COMPRA_PENDIENTE':
        return <ShoppingBag size={18} className="text-primary" />;
      case 'MENSAJE':
        return <MessageCircle size={18} style={{ color: '#008c91' }} />;
      case 'PAGO':
        return <CreditCard size={18} style={{ color: '#25734a' }} />;
      case 'RECORDATORIO':
        return <CalendarClock size={18} style={{ color: '#c7811e' }} />;
      case 'ESPACIO':
        return <Building2 size={18} style={{ color: '#486490' }} />;
      case 'CONVOCATORIA':
        return <TicketCheck size={18} style={{ color: '#008c91' }} />;
      case 'DENUNCIA':
        return <AlertTriangle size={18} style={{ color: '#a34d45' }} />;
      default:
        return <AlertCircle size={18} className="text-muted" />;
    }
  };

  return (
    <div className="notifications-dropdown">
      <div className="notifications-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
          <Bell size={16} /> Notificaciones
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.72rem', padding: '3px 8px' }}
          onClick={handleMarkAllRead}
          title="Marcar todas como leídas"
        >
          <CheckCheck size={14} /> Leídas
        </button>
      </div>

      <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
            Cargando notificaciones...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
            No hay notificaciones registradas.
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              className={`notification-item ${!item.read ? 'unread' : ''}`}
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => openNotification(item)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNotification(item); } }}
            >
              <div style={{ marginTop: '2px' }}>{getIcon(item.type)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: item.read ? 500 : 700, fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
                    {item.title}
                  </span>
                  {!item.read && (
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} />
                  )}
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#475569', lineHeight: 1.3 }}>
                  {item.description}
                </p>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {formatDateTime(item.createdAt)}
                  {notificationLink(item, user?.role) && <span style={{ display: 'inline-flex', alignItems: 'center', color: '#06777c', fontWeight: 700 }}>Ver <ChevronRight size={13} /></span>}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
