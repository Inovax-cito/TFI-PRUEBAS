// Navegación desde avisos y otros atajos.
// Los destinos del portal son rutas ("/postulaciones?postulacion=12&mensajes=1");
// los del panel comercial son "#tab:<pestaña>" porque ese panel no usa URLs.

export const navigateTo = (link) => {
  if (!link) return;
  if (link.startsWith('#tab:')) {
    window.dispatchEvent(new CustomEvent('app:tab', { detail: link.slice(5) }));
    return;
  }
  if (`${window.location.pathname}${window.location.search}` !== link) window.history.pushState(null, '', link);
  window.dispatchEvent(new CustomEvent('app:path', { detail: link }));
  window.dispatchEvent(new PopStateEvent('popstate'));
};

/** Destino de un aviso. Los avisos viejos no lo tienen guardado: se deduce por su tipo. */
export const notificationLink = (notification, role) => {
  if (notification.link) return notification.link;
  const manages = role === 'ORGANIZADOR' || role === 'ADMINISTRADOR';
  switch (notification.type) {
    case 'STOCK_BAJO': return '#tab:inventory';
    case 'DIFERENCIA_CAJA': return '#tab:cash';
    case 'COMPRA_PENDIENTE': return '#tab:purchases';
    case 'ESPACIO': return role === 'ADMINISTRADOR' && /verificar/i.test(notification.title) ? '/verificar' : '/espacios';
    case 'MENSAJE': case 'PAGO': return manages ? '/gestion' : '/postulaciones';
    case 'RECORDATORIO': return '/postulaciones';
    case 'DENUNCIA': return role === 'ADMINISTRADOR' ? '/denuncias' : null;
    case 'CONVOCATORIA':
      if (/nueva convocatoria/i.test(notification.title)) return '/convocatorias';
      return manages && !/tu postulación/i.test(notification.title) ? '/gestion' : '/postulaciones';
    default: return null;
  }
};
