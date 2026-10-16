import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MarketplacePage.css';
import './EmprendeTheme.css';
import { apiRequest } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { NotificationDropdown } from '../components/NotificationDropdown.jsx';
import {
  ArrowRight, Bell, BriefcaseBusiness, CalendarDays, CheckCircle2,
  ChevronDown, ChevronRight, CircleAlert, Clock3, Compass, ExternalLink, FileText,
  HelpCircle, LogOut, Map as MapIcon, MapPin, Plus, Save, Search, Send, Store, TicketCheck, UserRound, Wallet, X,
} from 'lucide-react';

const LOCALITIES = ['Banda del Río Salí', 'Cruz Alta', 'Alderetes'];
const STATUS_LABEL = {
  BORRADOR: 'Borrador', PUBLICADA: 'Inscripción abierta', CERRADA: 'Cerrada', ENVIADA: 'Enviada',
  EN_REVISION: 'En revisión', APROBADA: 'Aprobada', NO_SELECCIONADA: 'No seleccionada', CANCELADA: 'Cancelada',
  SIN_CUPOS: 'Cupos completos',
};
const emptyBusiness = {
  name: '', kind: 'FIJO', category: '', description: '', locality: LOCALITIES[0],
  address: '', contactPhone: '', contactEmail: '', notificationsEnabled: true,
};
const emptyEvent = {
  name: '', locality: LOCALITIES[0], address: '', latitude: '', longitude: '',
  startsAt: '', endsAt: '', applicationDeadline: '', description: '', acceptedCategories: '',
  requirements: '', capacity: '', status: 'BORRADOR',
};
const formatDate = (value) => value ? new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Fecha no informada';
const formatTime = (value) => value ? new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
const formatMoney = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(value || 0));
const canLocate = (event) => Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude)) && event.latitude !== null && event.longitude !== null && Math.abs(Number(event.latitude)) <= 90 && Math.abs(Number(event.longitude)) <= 180;
const isDemoEvent = (event) => event?.name?.startsWith('DEMO ·');
const eventDisplayStatus = (event) => {
  if (event.status === 'PUBLICADA' && new Date(event.applicationDeadline) <= new Date()) return 'CERRADA';
  if (event.status === 'PUBLICADA' && event.capacity && (event._count?.applications || 0) >= event.capacity) return 'SIN_CUPOS';
  return event.status;
};
const acceptedCategories = (event) => (event.acceptedCategories || '').split('|').map((item) => item.trim()).filter(Boolean);

function eventMarker(status, selected = false) {
  const tone = status === 'PUBLICADA' ? 'open' : status === 'CERRADA' ? 'closed' : 'draft';
  return L.divIcon({
    className: `market-leaflet-marker-shell${selected ? ' selected' : ''}`,
    html: `<span class="market-leaflet-marker ${tone}${selected ? ' selected' : ''}"><i></i></span>`,
    iconSize: [27, 36], iconAnchor: [13, 33], popupAnchor: [0, -30],
  });
}

function MapSelection({ events, selectedId }) {
  const map = useMap();
  useEffect(() => {
    const located = events.filter(canLocate);
    if (selectedId) {
      const selected = located.find((event) => event.id === selectedId);
      if (selected) map.flyTo([Number(selected.latitude), Number(selected.longitude)], Math.max(map.getZoom(), 14), { duration: .35 });
    } else if (located.length > 1) {
      map.fitBounds(located.map((event) => [Number(event.latitude), Number(event.longitude)]), { padding: [38, 38], maxZoom: 13 });
    } else if (located.length === 1) {
      map.setView([Number(located[0].latitude), Number(located[0].longitude)], 13);
    }
  }, [events, map, selectedId]);
  return null;
}

function EventMap({ events, selectedId, onSelect, onOpenEvent }) {
  const [tileError, setTileError] = useState(false);
  const located = events.filter(canLocate);
  return (
    <div className="market-map-wrap">
      <MapContainer className="market-map" center={[-26.82, -65.22]} zoom={10} scrollWheelZoom>
        <TileLayer
          url={import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
          eventHandlers={{ tileerror: () => setTileError(true), tileload: () => setTileError(false) }}
        />
        {located.map((event) => (
          <Marker
            key={event.id}
            position={[Number(event.latitude), Number(event.longitude)]}
            icon={eventMarker(eventDisplayStatus(event) === 'SIN_CUPOS' ? 'CERRADA' : eventDisplayStatus(event), selectedId === event.id)}
            eventHandlers={{ click: () => onSelect(event.id) }}
          >
            <Popup>
              <div className="market-map-popup">
                <StatusBadge status={eventDisplayStatus(event)} />
                <strong>{event.name}</strong>
                <span>{event.locality} · {formatDate(event.startsAt)}</span>
                {isDemoEvent(event) && <small>Ubicación de prueba · punto aproximado</small>}
                <button type="button" onClick={() => onOpenEvent(event.id)}>Ver convocatoria <ArrowRight size={13} /></button>
              </div>
            </Popup>
          </Marker>
        ))}
        <MapSelection events={events} selectedId={selectedId} />
      </MapContainer>
      {tileError && <div className="market-map-message" role="status"><CircleAlert size={16} /> El mapa base no está disponible ahora. Podés seguir explorando la lista.</div>}
      {!located.length && <div className="market-map-no-pins"><MapPin size={18} /> Estas convocatorias todavía no tienen coordenadas para mostrar.</div>}
      <div className="market-map-legend"><span><i className="legend-open" /> Abierta</span><span><i className="legend-closed" /> Cerrada</span><span><i className="legend-draft" /> Borrador</span></div>
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`market-status status-${String(status).toLowerCase()}`}>{STATUS_LABEL[status] || status}</span>;
}

function PortalHeader({ section, onNavigate, onOpenBackoffice }) {
  const { user, isAdmin, logout, unreadNotifications, fetchUnreadCount } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const initials = `${user?.name?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U';
  const navigation = [
    ['business', 'Mi negocio', BriefcaseBusiness],
    ['events', 'Ferias y eventos', CalendarDays],
    ['applications', 'Mis solicitudes', FileText],
    ['help', 'Ayuda', HelpCircle],
  ];
  if (isAdmin) navigation.push(['admin', 'Administración', UserRound]);

  return (
    <header className="emprende-header">
      <div className="emprende-header-inner">
        <button className="emprende-brand" type="button" onClick={() => onNavigate('home')} aria-label="Emprende, inicio">
          <span className="emprende-brand-mark"><span /><span /></span>
          <span className="emprende-brand-copy"><strong>Emprende</strong><small>Banda del Río Salí · Cruz Alta · Alderetes</small></span>
        </button>
        <nav className="emprende-nav" aria-label="Navegación principal">
          {navigation.map(([id, label, Icon]) => (
            <button key={id} type="button" className={section === id || (id === 'events' && section === 'home') ? 'active' : ''} aria-current={section === id || (id === 'events' && section === 'home') ? 'page' : undefined} onClick={() => onNavigate(id)}>
              <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="emprende-header-actions">
          <div className="emprende-popover-anchor">
            <button className={`emprende-icon-button ${notificationsOpen ? 'active' : ''}`} type="button" aria-label={`Notificaciones${unreadNotifications ? `, ${unreadNotifications} sin leer` : ''}`} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(!notificationsOpen); setAccountOpen(false); }}>
              <Bell size={19} />{unreadNotifications > 0 && <span className="emprende-notification-count">{unreadNotifications}</span>}
            </button>
            <NotificationDropdown isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} onRefreshCount={fetchUnreadCount} />
          </div>
          <div className="emprende-profile-anchor">
            <button className="emprende-profile-button" type="button" aria-expanded={accountOpen} onClick={() => { setAccountOpen(!accountOpen); setNotificationsOpen(false); }}>
              <span className="emprende-avatar">{initials}</span><span className="emprende-profile-name">{user?.name} {user?.lastName}</span><ChevronDown size={15} />
            </button>
            {accountOpen && <div className="emprende-account-menu"><span>{user?.email}</span><small>{isAdmin ? 'Cuenta administradora' : user?.role === 'EMPLEADO' ? 'Cuenta del equipo' : 'Cuenta de emprendedor'}</small>{onOpenBackoffice && user?.role !== 'EMPRENDEDOR' && <button type="button" onClick={onOpenBackoffice}><Store size={15} /> Panel comercial</button>}<button type="button" onClick={logout}><LogOut size={15} /> Cerrar sesión</button></div>}
          </div>
        </div>
      </div>
    </header>
  );
}

export function EntrepreneurPortal({ initialSection = 'home', onOpenBackoffice }) {
  const [section, setSection] = useState(initialSection);
  return (
    <div className="emprende-portal-shell">
      <PortalHeader section={section} onNavigate={setSection} onOpenBackoffice={onOpenBackoffice} />
      <main className="emprende-portal-main">
        <MarketplacePage initialTab={section} onNavigate={setSection} />
      </main>
    </div>
  );
}

function EventCard({ event, selected, onSelect, onDetails }) {
  const categories = acceptedCategories(event);
  const status = eventDisplayStatus(event);
  return (
    <article className={`market-event-card ${selected ? 'selected' : ''}`}>
      <div className="market-event-card-row">
        <button className="market-event-visual" type="button" onClick={() => onSelect(event.id)} aria-label={`Seleccionar ${event.name}`} aria-pressed={selected}>
          <span className="market-event-visual-mark"><CalendarDays size={29} strokeWidth={1.5} /></span><span>FERIA Y EVENTO</span>
        </button>
        <button className="market-event-card-main" type="button" onClick={() => onSelect(event.id)} aria-pressed={selected}>
          <div className="market-event-card-top"><span className="market-event-locality"><MapPin size={14} /> {event.locality}</span><StatusBadge status={status} /></div>
          {isDemoEvent(event) && <span className="market-demo-label">Datos de demostración</span>}
          <h3>{event.name}</h3>
          <p>{event.description}</p>
          {categories.length > 0 && <div className="market-tags">{categories.slice(0, 3).map((category) => <span key={category}>{category}</span>)}</div>}
        </button>
      </div>
      <div className="market-event-card-bottom">
        <div className="market-event-card-facts"><span><MapPin size={15} /><span><strong>{event.locality}</strong><small>{event.address || 'Dirección no informada'}</small></span></span><span><CalendarDays size={15} /><span><strong>{formatDate(event.startsAt)}</strong><small>{event.endsAt ? `${formatTime(event.startsAt)} a ${formatTime(event.endsAt)} hs` : 'Horario no informado'}</small></span></span></div>
        <button className="market-button outline" type="button" onClick={() => onDetails(event.id)}>Ver convocatoria <ArrowRight size={15} /></button>
      </div>
    </article>
  );
}

function EventActivity({ event }) {
  const [activity, setActivity] = useState(null);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [expense, setExpense] = useState({ amount: '', concept: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const data = await apiRequest(`/marketplace/events/${event.id}/activity`);
    setActivity(data);
  }, [event.id]);

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest(`/marketplace/events/${event.id}/activity`), apiRequest('/products?active=true')])
      .then(([data, catalog]) => {
        if (!active) return;
        setActivity(data);
        setProducts(Array.isArray(catalog) ? catalog.filter((product) => product.active !== false) : (catalog.products || []).filter((product) => product.active !== false));
      })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [event.id]);

  const registerSale = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const product = products.find((item) => String(item.id) === String(productId));
      if (!product || Number(quantity) < 1 || !Number.isInteger(Number(quantity))) throw new Error('Elegí un producto e ingresá una cantidad entera mayor que cero.');
      await apiRequest('/sales', { method: 'POST', body: { eventId: event.id, paymentMethod, items: [{ productId: product.id, quantity: Number(quantity), unitPrice: Number(product.salePrice) }] } });
      setMessage('Venta registrada y asociada a esta convocatoria.');
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const registerExpense = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (Number(expense.amount) <= 0 || !expense.concept.trim()) throw new Error('Ingresá el importe y un concepto para el gasto.');
      await apiRequest('/cash/movements', { method: 'POST', body: { eventId: event.id, type: 'EGRESO', amount: Number(expense.amount), concept: expense.concept.trim() } });
      setExpense({ amount: '', concept: '' });
      setMessage('Gasto registrado y asociado a esta convocatoria.');
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <section className="market-activity">
      <div className="market-subsection-heading"><div><span className="market-kicker">PARTICIPACIÓN APROBADA</span><h3>Actividad del puesto</h3><p>Los movimientos de este evento se guardan vinculados y no se mezclan con tus reportes habituales.</p></div><TicketCheck size={20} /></div>
      {activity ? <div className="market-activity-totals"><div><span>Ventas registradas</span><strong>{formatMoney(activity.summary.salesTotal)}</strong></div><div><span>Gastos registrados</span><strong>{formatMoney(activity.summary.expensesTotal)}</strong></div><div><span>Diferencia simple</span><strong>{formatMoney(activity.summary.difference)}</strong><small>Ventas menos gastos cargados. No es una ganancia neta.</small></div></div> : <div className="market-loading small"><span /> Cargando actividad...</div>}
      <div className="market-activity-forms">
        <form className="market-inline-form" onSubmit={registerSale}><h4><Store size={16} /> Registrar venta</h4><p>Usa el catálogo y el control de stock existentes.</p>
          <label>Producto<select required value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Elegí un producto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatMoney(product.salePrice)}</option>)}</select></label>
          <div className="market-inline-grid"><label>Unidades<input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label><label>Medio de pago<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></label></div>
          <button className="market-button primary" disabled={busy || !products.length}><Plus size={15} /> Registrar venta</button>
          {!products.length && <small>No hay productos activos en el catálogo compartido para registrar ventas.</small>}
        </form>
        <form className="market-inline-form" onSubmit={registerExpense}><h4><Wallet size={16} /> Registrar gasto</h4><p>Este egreso queda separado de la caja habitual.</p>
          <label>Concepto<input required maxLength={160} value={expense.concept} onChange={(e) => setExpense({ ...expense, concept: e.target.value })} placeholder="Ej.: traslado del puesto" /></label>
          <label>Importe<input required min="0.01" step="0.01" type="number" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} placeholder="$ 0,00" /></label>
          <button className="market-button outline" disabled={busy}><Plus size={15} /> Registrar gasto</button>
        </form>
      </div>
      {message && <p className="market-success" role="status"><CheckCircle2 size={16} /> {message}</p>}
      {error && <p className="market-error" role="alert"><CircleAlert size={16} /> {error}</p>}
    </section>
  );
}

export function MarketplacePage({ initialTab = 'home', onNavigate }) {
  const { user, isAdmin } = useAuth();
  const section = initialTab;
  const [business, setBusiness] = useState(emptyBusiness);
  const [businessExists, setBusinessExists] = useState(false);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [businessError, setBusinessError] = useState('');
  const [businessMessage, setBusinessMessage] = useState('');
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');
  const [applications, setApplications] = useState([]);
  const [adminApplications, setAdminApplications] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [myApplication, setMyApplication] = useState(null);
  const [filters, setFilters] = useState({ locality: '', date: '', dateTo: '', category: '' });
  const [displayMode, setDisplayMode] = useState('list');
  const [applicationForm, setApplicationForm] = useState({ offeredProduct: '', additionalInfo: '' });
  const [pageMessage, setPageMessage] = useState('');
  const [pageError, setPageError] = useState('');
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [eventBusy, setEventBusy] = useState(false);
  const [adminSubtab, setAdminSubtab] = useState('events');

  const navigate = (next) => { setPageError(''); setPageMessage(''); setSelectedId(null); setDetailId(null); setSelectedEvent(null); if (onNavigate) onNavigate(next); };

  const loadBusiness = useCallback(async () => {
    setBusinessLoading(true);
    try {
      const result = await apiRequest('/marketplace/business');
      setBusiness(result.profile ? { ...emptyBusiness, ...result.profile } : emptyBusiness);
      setBusinessExists(Boolean(result.profile));
    } catch (error) { setBusinessError(error.message); }
    finally { setBusinessLoading(false); }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true); setEventsError('');
    try {
      const query = new URLSearchParams();
      if (filters.locality) query.set('locality', filters.locality);
      if (filters.category) query.set('category', filters.category);
      if (filters.date) query.set('from', filters.date);
      if (filters.dateTo) query.set('to', filters.dateTo);
      const result = await apiRequest(`/marketplace/events${query.size ? `?${query}` : ''}`);
      setEvents(result);
      if (!result.some((item) => item.id === selectedId)) setSelectedId(null);
    } catch (error) { setEventsError(error.message); }
    finally { setEventsLoading(false); }
  }, [filters, selectedId]);

  const loadApplications = useCallback(async () => {
    try { setApplications(await apiRequest('/marketplace/applications')); }
    catch (error) { setPageError(error.message); }
  }, []);

  const loadAdminApplications = useCallback(async () => {
    try { setAdminApplications(await apiRequest('/marketplace/admin/applications')); }
    catch (error) { setPageError(error.message); }
  }, []);

  useEffect(() => { loadBusiness(); }, [loadBusiness]);
  useEffect(() => {
    if (section !== 'events') return;
    const pendingEventId = window.sessionStorage.getItem('marketplace-selected-event');
    if (pendingEventId) {
      setSelectedId(Number(pendingEventId));
      window.sessionStorage.removeItem('marketplace-selected-event');
    }
  }, [section]);
  useEffect(() => { if (section === 'events' || section === 'home' || section === 'admin') loadEvents(); }, [section, loadEvents]);
  useEffect(() => { if (section === 'applications' || section === 'home') loadApplications(); }, [section, loadApplications]);
  useEffect(() => { if (section === 'admin' && isAdmin) loadAdminApplications(); }, [section, isAdmin, loadAdminApplications]);
  useEffect(() => {
    if (!detailId) { setSelectedEvent(null); setMyApplication(null); return; }
    let active = true;
    apiRequest(`/marketplace/events/${detailId}`).then((data) => {
      if (!active) return;
      setSelectedEvent(data.event); setMyApplication(data.application);
      setApplicationForm({ offeredProduct: data.application?.offeredProduct || '', additionalInfo: data.application?.additionalInfo || '' });
    }).catch((error) => { if (active) setPageError(error.message); });
    return () => { active = false; };
  }, [detailId]);

  const saveBusiness = async (event) => {
    event.preventDefault(); setBusinessError(''); setBusinessMessage('');
    try {
      const result = await apiRequest('/marketplace/business', { method: 'PUT', body: business });
      setBusiness({ ...emptyBusiness, ...result.profile }); setBusinessExists(true);
      setBusinessMessage('Perfil del negocio guardado.');
    } catch (error) { setBusinessError(error.message); }
  };

  const submitApplication = async (send) => {
    setPageError(''); setPageMessage('');
    if (send && !(applicationForm.contactEmail ?? business.contactEmail)?.trim() && !(applicationForm.contactPhone ?? business.contactPhone)?.trim()) {
      setPageError('Completá un correo o un teléfono de contacto. Podés hacerlo acá o desde Mi negocio.');
      return;
    }
    try {
      const response = await apiRequest(`/marketplace/events/${selectedId}/applications`, { method: 'POST', body: { ...applicationForm, contactEmail: applicationForm.contactEmail ?? business.contactEmail, contactPhone: applicationForm.contactPhone ?? business.contactPhone, send } });
      setMyApplication(response.application); setPageMessage(response.message); await loadApplications();
    } catch (error) { setPageError(error.message); }
  };

  const createEvent = async (event) => {
    event.preventDefault(); setEventBusy(true); setPageError(''); setPageMessage('');
    try {
      const result = await apiRequest('/marketplace/events', { method: 'POST', body: eventForm });
      setPageMessage('Convocatoria creada. Si queda como borrador, solo la verán quienes gestionan el sistema.');
      setEventForm(emptyEvent); await loadEvents();
      if (result.event?.status === 'PUBLICADA') await loadEvents();
    } catch (error) { setPageError(error.message); }
    finally { setEventBusy(false); }
  };

  const updateEventStatus = async (event, status) => {
    setPageError(''); setPageMessage('');
    try {
      await apiRequest(`/marketplace/events/${event.id}`, { method: 'PUT', body: { ...event, status } });
      setPageMessage(`Convocatoria ${STATUS_LABEL[status].toLowerCase()}.`); await loadEvents();
    } catch (error) { setPageError(error.message); }
  };

  const setApplicationStatus = async (application, status) => {
    setPageError(''); setPageMessage('');
    try {
      await apiRequest(`/marketplace/admin/applications/${application.id}/status`, { method: 'PATCH', body: { status } });
      setPageMessage('Estado de postulación actualizado.'); await loadAdminApplications();
    } catch (error) { setPageError(error.message); }
  };

  const filteredApplications = useMemo(() => applications, [applications]);
  const openEventsCount = events.filter((event) => eventDisplayStatus(event) === 'PUBLICADA').length;
  const activeApplicationsCount = applications.filter((item) => ['ENVIADA', 'EN_REVISION', 'APROBADA'].includes(item.status)).length;

  const clearFilters = () => setFilters({ locality: '', date: '', dateTo: '', category: '' });
  const saveNotificationPreference = async () => {
    if (!businessExists) { navigate('business'); return; }
    try {
      setBusinessError(''); setBusinessMessage('');
      const updated = { ...business, notificationsEnabled: business.notificationsEnabled === false };
      const result = await apiRequest('/marketplace/business', { method: 'PUT', body: updated });
      setBusiness({ ...emptyBusiness, ...result.profile });
      setBusinessMessage('Preferencia de avisos guardada.');
    } catch (error) { setBusinessError(error.message); }
  };

  if (section === 'business') return (
    <div className="marketplace-page">
      <PageHeading kicker="MI ACTIVIDAD" title="Mi negocio" description="Completá estos datos una vez para agilizar tus postulaciones." />
      {!businessExists && <div className="market-callout"><BriefcaseBusiness size={18} /><span>Tu perfil se asocia a tu cuenta. La información se usa para completar las postulaciones.</span></div>}
      {businessLoading ? <LoadingState label="Cargando el perfil del negocio..." /> : <form className="market-panel market-business-form" onSubmit={saveBusiness}>
        <div className="market-form-grid">
          <label>Nombre del emprendimiento <b>*</b><input required maxLength={120} value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} placeholder="Ej.: Taller de cerámica" /></label>
          <label>Tipo de actividad <b>*</b><select value={business.kind} onChange={(e) => setBusiness({ ...business, kind: e.target.value })}><option value="FIJO">Local fijo</option><option value="ITINERANTE">Itinerante / feriante</option></select></label>
          <label>Rubro <b>*</b><input required maxLength={80} value={business.category} onChange={(e) => setBusiness({ ...business, category: e.target.value })} placeholder="Ej.: alimentos, indumentaria, artesanías" /></label>
          <label>Localidad <b>*</b><select value={business.locality} onChange={(e) => setBusiness({ ...business, locality: e.target.value })}>{LOCALITIES.map((locality) => <option key={locality}>{locality}</option>)}</select></label>
          <label className="wide">Descripción breve<textarea rows="3" maxLength={1000} value={business.description || ''} onChange={(e) => setBusiness({ ...business, description: e.target.value })} placeholder="Contanos qué ofrecés y qué te distingue." /></label>
          <label>Dirección o zona habitual<input maxLength={180} value={business.address || ''} onChange={(e) => setBusiness({ ...business, address: e.target.value })} placeholder="Opcional" /></label>
          <label>Teléfono de contacto<input type="tel" maxLength={40} value={business.contactPhone || ''} onChange={(e) => setBusiness({ ...business, contactPhone: e.target.value })} placeholder="Opcional" /></label>
          <label>Correo de contacto<input type="email" maxLength={120} value={business.contactEmail || ''} onChange={(e) => setBusiness({ ...business, contactEmail: e.target.value })} placeholder="Opcional" /></label>
        </div>
        <div className="market-preferences"><div><strong><Bell size={16} /> Avisos dentro de la aplicación</strong><span>Te avisamos si se publica una convocatoria en tu localidad. El correo no está configurado.</span></div><label className="market-switch"><input type="checkbox" checked={business.notificationsEnabled !== false} onChange={(e) => setBusiness({ ...business, notificationsEnabled: e.target.checked })} /><span>{business.notificationsEnabled !== false ? 'Activados' : 'Desactivados'}</span></label></div>
        <div className="market-form-footer"><span>Los campos con <b>*</b> son obligatorios.</span><button className="market-button primary"><Save size={16} /> Guardar perfil</button></div>
      </form>}
      {businessError && <InlineMessage type="error">{businessError}</InlineMessage>}{businessMessage && <InlineMessage type="success">{businessMessage}</InlineMessage>}
      <MarketplaceLinks section={section} onNavigate={navigate} />
    </div>
  );

  if (section === 'events') return (
    <div className="marketplace-page">
      <PageHeading kicker="OPORTUNIDADES LOCALES" title="Ferias y eventos" description="Explorá convocatorias abiertas cerca tuyo y revisá los requisitos antes de postularte." />
      <OpportunityFilters filters={filters} setFilters={setFilters} displayMode={displayMode} setDisplayMode={setDisplayMode} onClear={clearFilters} />
      {!businessExists && <div className="market-callout"><BriefcaseBusiness size={18} /><span>Completá el <button onClick={() => navigate('business')}>perfil de tu negocio</button> antes de postularte.</span></div>}
      {eventsLoading ? <LoadingState label="Buscando convocatorias..." /> : eventsError ? <ErrorState message={eventsError} onRetry={loadEvents} /> : events.length === 0 ? <EmptyState icon={Compass} title="No hay convocatorias para estos filtros" text="Probá otra localidad o volvé más adelante. Las publicaciones se cargan cuando una persona administradora las crea." /> : (
        <div className={`market-explore-layout ${displayMode === 'map' ? 'map-focus' : ''}`}>
          <div className={`market-event-list ${displayMode === 'map' ? 'mobile-hidden' : ''}`}>
            <div className="market-list-count"><strong>{events.length}</strong> {events.length === 1 ? 'convocatoria encontrada' : 'convocatorias encontradas'}</div>
            {events.map((event) => <EventCard key={event.id} event={event} selected={selectedId === event.id} onSelect={setSelectedId} onDetails={setDetailId} />)}
          </div>
          <div className={`market-map-column ${displayMode === 'list' ? 'mobile-hidden' : ''}`}><EventMap events={events} selectedId={selectedId} onSelect={setSelectedId} onOpenEvent={setDetailId} /></div>
        </div>
      )}
      {selectedEvent && <EventDetails event={selectedEvent} business={businessExists ? business : null} application={myApplication} applicationForm={applicationForm} setApplicationForm={setApplicationForm} onClose={() => { setSelectedId(null); setDetailId(null); setPageError(''); setPageMessage(''); }} onSaveDraft={() => submitApplication(false)} onSubmit={() => submitApplication(true)} onEditDraft={() => { setApplicationForm({ offeredProduct: myApplication?.offeredProduct || '', additionalInfo: myApplication?.additionalInfo || '' }); }} onNavigate={navigate} pageError={pageError} pageMessage={pageMessage} />}
      <MarketplaceLinks section={section} onNavigate={navigate} />
    </div>
  );

  if (section === 'applications') return (
    <div className="marketplace-page">
      <PageHeading kicker="SEGUIMIENTO" title="Mis solicitudes" description="Consultá las postulaciones de tu negocio y el estado de cada una." />
      {pageError && <InlineMessage type="error">{pageError}</InlineMessage>}
      {!filteredApplications.length ? <EmptyState icon={TicketCheck} title="Todavía no enviaste postulaciones" text="Cuando encuentres una oportunidad que te interese, vas a poder postularte desde su detalle." action={<button className="market-button primary" onClick={() => navigate('events')}>Explorar convocatorias <ArrowRight size={15} /></button>} /> : <div className="market-application-list">{filteredApplications.map((application) => <article className="market-application-card" key={application.id}><div className="market-application-icon"><FileText size={19} /></div><div className="market-application-main"><div className="market-event-card-top"><span>{application.event.locality} · {formatDate(application.event.startsAt)}</span><StatusBadge status={application.status} /></div><h3>{application.event.name}</h3><p>{application.business.name} · Ofrece: {application.offeredProduct}</p>{application.status === 'BORRADOR' && <button onClick={() => { window.sessionStorage.setItem('marketplace-selected-event', String(application.event.id)); navigate('events'); }}>Continuar borrador <ArrowRight size={14} /></button>}</div></article>)}</div>}
      <MarketplaceLinks section={section} onNavigate={navigate} />
    </div>
  );

  if (section === 'help') return (
    <div className="marketplace-page">
      <PageHeading kicker="CENTRO DE AYUDA" title="Cómo usar Emprende" description="Una guía breve para encontrar convocatorias y presentar una postulación." />
      <div className="market-help-grid">
        <article><span>01</span><h2>Completá tu negocio</h2><p>Guardá el nombre, el rubro y la localidad una vez. Esa información se reutiliza en cada postulación.</p><button className="market-button outline" onClick={() => navigate('business')}>Abrir Mi negocio <ArrowRight size={15} /></button></article>
        <article><span>02</span><h2>Explorá oportunidades</h2><p>Filtrá por localidad y fecha. El mapa ubica solo convocatorias con coordenadas cargadas.</p><button className="market-button outline" onClick={() => navigate('events')}>Ver ferias y eventos <ArrowRight size={15} /></button></article>
        <article><span>03</span><h2>Seguí tu solicitud</h2><p>Contá qué producto o servicio vas a ofrecer y consultá los cambios de estado en Mis solicitudes.</p><button className="market-button outline" onClick={() => navigate('applications')}>Ver mis solicitudes <ArrowRight size={15} /></button></article>
        <p className="market-help-note"><CircleAlert size={16} /> Las convocatorias se cargan en Emprende y no representan por sí solas una aprobación municipal. Los avisos por correo no están configurados.</p>
      </div>
    </div>
  );

  if (section === 'home') return <MarketplaceHome
    business={business} businessExists={businessExists} businessLoading={businessLoading}
    businessError={businessError} businessMessage={businessMessage}
    events={events} eventsLoading={eventsLoading} eventsError={eventsError} loadEvents={loadEvents}
    filters={filters} setFilters={setFilters} clearFilters={clearFilters}
    displayMode={displayMode} setDisplayMode={setDisplayMode}
    openEventsCount={openEventsCount} selectedId={selectedId} setSelectedId={setSelectedId}
    navigate={navigate} saveNotificationPreference={saveNotificationPreference} setDetailId={setDetailId}
    selectedEvent={selectedEvent} myApplication={myApplication} applicationForm={applicationForm}
    setApplicationForm={setApplicationForm} submitApplication={submitApplication}
    pageError={pageError} pageMessage={pageMessage}
  />;

  if (section === 'admin') return isAdmin ? (
    <div className="marketplace-page">
      <PageHeading kicker="GESTIÓN DEL PROTOTIPO" title="Administrar oportunidades" description="El rol administrador existente puede publicar convocatorias y revisar postulaciones. No representa una integración municipal." />
      <div className="market-admin-tabs"><button className={adminSubtab === 'events' ? 'active' : ''} onClick={() => setAdminSubtab('events')}>Convocatorias</button><button className={adminSubtab === 'applications' ? 'active' : ''} onClick={() => setAdminSubtab('applications')}>Postulaciones <span>{adminApplications.filter((item) => ['ENVIADA', 'EN_REVISION'].includes(item.status)).length}</span></button></div>
      {pageMessage && <InlineMessage type="success">{pageMessage}</InlineMessage>}{pageError && <InlineMessage type="error">{pageError}</InlineMessage>}
      {adminSubtab === 'events' ? <>
        <form className="market-panel market-admin-form" onSubmit={createEvent}><h2><Plus size={18} /> Crear convocatoria</h2><p>Publicá solo información verificada por el equipo organizador. La ubicación se ingresa manualmente.</p>
          <div className="market-form-grid"><label>Nombre del evento <b>*</b><input required maxLength={160} value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} /></label><label>Localidad <b>*</b><select value={eventForm.locality} onChange={(e) => setEventForm({ ...eventForm, locality: e.target.value })}>{LOCALITIES.map((locality) => <option key={locality}>{locality}</option>)}</select></label><label className="wide">Dirección o referencia<input maxLength={180} value={eventForm.address} onChange={(e) => setEventForm({ ...eventForm, address: e.target.value })} placeholder="Sin coordenadas la convocatoria se verá solo en la lista." /></label><label>Latitud<input type="number" step="any" value={eventForm.latitude} onChange={(e) => setEventForm({ ...eventForm, latitude: e.target.value })} placeholder="Ej.: -26.8" /></label><label>Longitud<input type="number" step="any" value={eventForm.longitude} onChange={(e) => setEventForm({ ...eventForm, longitude: e.target.value })} placeholder="Ej.: -65.2" /></label><label>Inicio <b>*</b><input required type="datetime-local" value={eventForm.startsAt} onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })} /></label><label>Fin <b>*</b><input required type="datetime-local" value={eventForm.endsAt} onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })} /></label><label>Fecha límite para postularse <b>*</b><input required type="datetime-local" value={eventForm.applicationDeadline} onChange={(e) => setEventForm({ ...eventForm, applicationDeadline: e.target.value })} /></label><label>Puestos disponibles<input type="number" min="1" step="1" value={eventForm.capacity} onChange={(e) => setEventForm({ ...eventForm, capacity: e.target.value })} placeholder="Opcional" /></label><label>Rubros admitidos<input value={eventForm.acceptedCategories} onChange={(e) => setEventForm({ ...eventForm, acceptedCategories: e.target.value })} placeholder="Separados por coma; vacío = todos" /></label><label>Estado al crear<select value={eventForm.status} onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}><option value="BORRADOR">Borrador</option><option value="PUBLICADA">Publicada</option></select></label><label className="wide">Descripción <b>*</b><textarea required rows="3" maxLength={2000} value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></label><label className="wide">Requisitos<textarea rows="3" maxLength={2000} value={eventForm.requirements} onChange={(e) => setEventForm({ ...eventForm, requirements: e.target.value })} placeholder="Condiciones que deben conocer antes de postularse." /></label></div>
          <div className="market-form-footer"><span>Los datos se guardan en la base existente.</span><button className="market-button primary" disabled={eventBusy}><Plus size={15} /> {eventBusy ? 'Guardando...' : 'Crear convocatoria'}</button></div>
        </form>
        <section className="market-admin-section"><h2>Convocatorias del sistema</h2>{events.length === 0 ? <p className="market-muted">Todavía no hay convocatorias. Las nuevas se guardarán en la base de datos existente.</p> : <div className="market-admin-event-list">{events.map((event) => <article key={event.id}><div><strong>{event.name}</strong><span>{event.locality} · {formatDate(event.startsAt)}</span></div><StatusBadge status={event.status} /><select aria-label={`Cambiar estado de ${event.name}`} value={event.status} onChange={(e) => updateEventStatus(event, e.target.value)}><option value="BORRADOR">Borrador</option><option value="PUBLICADA">Publicada</option><option value="CERRADA">Cerrada</option></select></article>)}</div>}</section>
      </> : <section className="market-admin-section"><h2>Postulaciones recibidas</h2>{adminApplications.length === 0 ? <EmptyState icon={TicketCheck} title="No hay solicitudes para revisar" text="Las postulaciones enviadas aparecerán acá." /> : <div className="market-admin-applications">{adminApplications.map((application) => <article key={application.id}><div className="market-admin-app-heading"><div><strong>{application.business.name}</strong><span>{application.event.name} · {application.business.locality}</span></div><StatusBadge status={application.status} /></div><p><b>Rubro:</b> {application.business.category} · <b>Ofrece:</b> {application.offeredProduct}</p>{(application.business.contactEmail || application.business.contactPhone) && <p><b>Contacto:</b> {[application.business.contactEmail, application.business.contactPhone].filter(Boolean).join(" · ")}</p>}{application.additionalInfo && <p>{application.additionalInfo}</p>}<small>Postuló {application.applicant.name} {application.applicant.lastName} · {formatDate(application.createdAt)}</small><div className="market-admin-app-actions">{application.status === 'ENVIADA' && <button className="market-button outline" onClick={() => setApplicationStatus(application, 'EN_REVISION')}>Marcar en revisión</button>}{application.status !== 'APROBADA' && <button className="market-button primary" onClick={() => setApplicationStatus(application, 'APROBADA')}>Aprobar</button>}{application.status !== 'NO_SELECCIONADA' && <button className="market-button danger" onClick={() => setApplicationStatus(application, 'NO_SELECCIONADA')}>No seleccionada</button>}</div></article>)}</div>}</section>}
      <MarketplaceLinks section={section} onNavigate={navigate} />
    </div>
  ) : <div className="marketplace-page"><EmptyState icon={CircleAlert} title="Acceso restringido" text="La gestión de convocatorias está disponible para el rol administrador." /></div>;

  return (
    <div className="marketplace-page">
      <PageHeading kicker="PORTAL PARA EMPRENDEDORES · TUCUMÁN" title={`Hola, ${user?.name || 'emprendedor/a'}.`} description="Organizá tu negocio y encontrá oportunidades para participar en ferias y eventos." />
      {pageError && <InlineMessage type="error">{pageError}</InlineMessage>}
      <div className="market-home-layout">
        <section className="market-home-main">
          {!businessExists ? <article className="market-home-profile incomplete"><div className="market-home-icon"><BriefcaseBusiness size={20} /></div><div><span className="market-kicker">PRIMER PASO</span><h2>Completá el perfil de tu negocio</h2><p>Así vas a poder postularte sin volver a escribir los mismos datos.</p><button className="market-button primary" onClick={() => navigate('business')}>Completar perfil <ArrowRight size={15} /></button></div></article> : <article className="market-home-profile"><div className="market-home-icon"><Store size={20} /></div><div><span className="market-kicker">MI NEGOCIO</span><h2>{business.name}</h2><p>{business.category} · {business.locality} · {business.kind === 'FIJO' ? 'Local fijo' : 'Itinerante'}</p><button className="market-text-button" onClick={() => navigate('business')}>Ver o editar perfil <ArrowRight size={14} /></button></div></article>}
          <div className="market-home-opportunities"><div className="market-home-section-head"><div><span className="market-kicker">OPORTUNIDADES</span><h2>Convocatorias abiertas</h2></div><button className="market-text-button" onClick={() => navigate('events')}>Explorar todas <ArrowRight size={14} /></button></div>
            {eventsLoading ? <LoadingState label="Buscando oportunidades..." /> : eventsError ? <ErrorState message={eventsError} onRetry={loadEvents} /> : events.length === 0 ? <EmptyState icon={Compass} title="No hay convocatorias publicadas todavía" text="Cuando se carguen oportunidades para la zona, las vas a encontrar acá." /> : <div className="market-home-event-grid">{events.slice(0, 2).map((event) => <EventCard key={event.id} event={event} selected={false} onSelect={(id) => { window.sessionStorage.setItem('marketplace-selected-event', String(id)); navigate('events'); }} onDetails={(id) => { window.sessionStorage.setItem('marketplace-selected-event', String(id)); navigate('events'); }} />)}</div>}
          </div>
        </section>
        <aside className="market-home-side"><div className="market-home-stat"><span className="market-home-stat-icon"><Compass size={17} /></span><div><strong>{openEventsCount}</strong><span>convocatorias abiertas ahora</span></div></div><div className="market-home-stat"><span className="market-home-stat-icon blue"><TicketCheck size={17} /></span><div><strong>{activeApplicationsCount}</strong><span>postulaciones activas</span></div></div><button className="market-side-link" onClick={() => navigate('applications')}>Ver mis solicitudes <ChevronRight size={15} /></button>{isAdmin && <button className="market-side-link" onClick={() => navigate('admin')}>Administrar convocatorias <ChevronRight size={15} /></button>}<div className="market-side-info"><CircleAlert size={16} /><p>Las publicaciones de esta plataforma no implican aprobación municipal. Revisá siempre quién organiza cada actividad.</p></div></aside>
      </div>
      <MarketplaceLinks section={section} onNavigate={navigate} />
    </div>
  );
}

function MarketplaceHome({
  business, businessExists, businessLoading, businessError, businessMessage,
  events, eventsLoading, eventsError, loadEvents, filters, setFilters, clearFilters,
  displayMode, setDisplayMode, openEventsCount, selectedId, setSelectedId,
  navigate, saveNotificationPreference, setDetailId, selectedEvent, myApplication, applicationForm,
  setApplicationForm, submitApplication, pageError, pageMessage,
}) {
  const homeEvents = events.slice(0, 2);
  return (
    <div className="marketplace-page market-home-page">
      <div className="emprende-home-heading">
        <PageHeading kicker="FERIAS Y EVENTOS" title="Oportunidades para tu negocio" description="Convocatorias disponibles en Banda del Río Salí, Cruz Alta y Alderetes." />
        <div className="emprende-home-cta"><button className="market-button primary" onClick={() => navigate('business')}>{businessExists ? 'Editar perfil del negocio' : 'Completar perfil del negocio'} <ArrowRight size={17} /></button><small>Postulate a ferias y eventos de la zona.</small></div>
      </div>
      <OpportunityFilters filters={filters} setFilters={setFilters} displayMode={displayMode} setDisplayMode={setDisplayMode} onClear={clearFilters} />
      {(businessError || pageError) && <InlineMessage type="error">{businessError || pageError}</InlineMessage>}
      <div className="market-home-layout">
        <section className="market-home-main">
          <div className="market-home-opportunities">
            <div className="market-home-section-head"><div><span className="market-kicker">CONVOCATORIAS DE LA ZONA</span><h2>{eventsLoading ? 'Buscando oportunidades…' : `${openEventsCount} ${openEventsCount === 1 ? 'inscripción abierta' : 'inscripciones abiertas'}`}</h2></div><button className="market-text-button" onClick={() => navigate('events')}>Ver todas <ArrowRight size={15} /></button></div>
            {eventsLoading ? <LoadingState label="Cargando convocatorias de la plataforma…" /> : eventsError ? <ErrorState message={eventsError} onRetry={loadEvents} /> : events.length === 0 ? <EmptyState icon={Compass} title="Todavía no hay convocatorias disponibles" text="Cuando se publique una convocatoria para tu zona, aparecerá acá. No mostramos eventos de demostración como si fueran oficiales." action={(filters.locality || filters.date || filters.dateTo || filters.category) ? <button className="market-button outline" onClick={clearFilters}>Quitar filtros</button> : undefined} /> : (
              <div className={`market-explore-layout market-home-explore ${displayMode === 'map' ? 'map-focus' : ''}`}>
                <div className={`market-event-list ${displayMode === 'map' ? 'mobile-hidden' : ''}`}>
                  {homeEvents.map((event) => <EventCard key={event.id} event={event} selected={selectedId === event.id} onSelect={setSelectedId} onDetails={setDetailId} />)}
                  {events.length > homeEvents.length && <button className="market-more-events" onClick={() => navigate('events')}>Ver las {events.length} convocatorias <ArrowRight size={15} /></button>}
                </div>
                <div className={`market-map-column ${displayMode === 'list' ? 'mobile-hidden' : ''}`}><EventMap events={homeEvents} selectedId={selectedId} onSelect={setSelectedId} onOpenEvent={setDetailId} /></div>
              </div>
            )}
          </div>
        </section>
        <aside className="market-home-side">
          <article className="market-business-summary">
            <div className="market-side-heading"><h2>Tu negocio</h2><button type="button" aria-label="Abrir gestión del negocio" onClick={() => navigate('business')}><ChevronRight size={19} /></button></div>
            {businessLoading ? <LoadingState label="Cargando perfil…" /> : businessExists ? <div className="market-business-summary-content"><span className="market-business-placeholder"><Store size={30} strokeWidth={1.5} /></span><div><strong>{business.name}</strong><span>{business.locality}</span><small>{business.category}{business.kind === 'ITINERANTE' ? ' · Itinerante' : ''}</small></div></div> : <div className="market-business-empty"><span className="market-business-placeholder"><BriefcaseBusiness size={27} strokeWidth={1.5} /></span><p>Completá el perfil para reutilizar tus datos en las solicitudes.</p></div>}
            <button className="market-side-link" onClick={() => navigate('business')}>{businessExists ? 'Abrir gestión' : 'Completar perfil'} <ArrowRight size={16} /></button>
          </article>
          <article className="market-notice-panel">
            <div className="market-side-heading"><span className="market-notice-icon"><Bell size={20} /></span><h2>Avisos</h2></div>
            <p>Recibí una notificación cuando se publique una convocatoria en tu localidad.</p>
            {businessExists ? <button className={`market-notice-action ${business.notificationsEnabled !== false ? 'enabled' : ''}`} onClick={saveNotificationPreference} type="button"><Bell size={17} />{business.notificationsEnabled !== false ? 'Avisos activados' : 'Activar avisos'}</button> : <button className="market-notice-action" onClick={() => navigate('business')} type="button"><Bell size={17} />Completar perfil para activar</button>}
            <small>Los avisos se muestran en la aplicación. El correo electrónico no está configurado.</small>
          </article>
          <div className="market-side-info"><CircleAlert size={16} /><p>Revisá quién organiza cada convocatoria. Publicarla en Emprende no implica aprobación municipal.</p></div>
          {businessMessage && <InlineMessage type="success">{businessMessage}</InlineMessage>}
        </aside>
      </div>
      {selectedEvent && <EventDetails event={selectedEvent} business={businessExists ? business : null} application={myApplication} applicationForm={applicationForm} setApplicationForm={setApplicationForm} onClose={() => { setSelectedId(null); setDetailId(null); setPageError(''); setPageMessage(''); }} onSaveDraft={() => submitApplication(false)} onSubmit={() => submitApplication(true)} onEditDraft={() => setApplicationForm({ offeredProduct: myApplication?.offeredProduct || '', additionalInfo: myApplication?.additionalInfo || '' })} onNavigate={navigate} pageError={pageError} pageMessage={pageMessage} />}
    </div>
  );
}

function PageHeading({ kicker, title, description }) {
  return <header className="market-page-heading"><span className="market-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></header>;
}
function LoadingState({ label }) { return <div className="market-loading"><span /> {label}</div>; }
function ErrorState({ message, onRetry }) { return <div className="market-error" role="alert"><CircleAlert size={18} /><span>{message}</span><button onClick={onRetry}>Reintentar</button></div>; }
function InlineMessage({ type, children }) { return <p className={`market-inline-message ${type}`} role={type === 'error' ? 'alert' : 'status'}>{type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}{children}</p>; }
function EmptyState({ icon: Icon, title, text, action }) { return <div className="market-empty"><span><Icon size={22} /></span><h2>{title}</h2><p>{text}</p>{action}</div>; }

function OpportunityFilters({ filters, setFilters, displayMode, setDisplayMode, onClear }) {
  return (
    <div className="market-filters" aria-label="Filtros de convocatorias">
      <label className="market-filter-field"><MapPin size={17} /><span className="market-filter-label"><small>Localidad</small><select aria-label="Filtrar por localidad" value={filters.locality} onChange={(e) => setFilters({ ...filters, locality: e.target.value })}><option value="">Todas las localidades</option>{LOCALITIES.map((locality) => <option key={locality}>{locality}</option>)}</select></span><ChevronDown size={15} /></label>
      <label className="market-filter-field"><CalendarDays size={17} /><span className="market-filter-label"><small>Desde</small><input aria-label="Filtrar desde fecha" type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} /></span></label>
      <label className="market-filter-field"><CalendarDays size={17} /><span className="market-filter-label"><small>Hasta</small><input aria-label="Filtrar hasta fecha" type="date" min={filters.date || undefined} value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} /></span></label>
      <label className="market-filter-field category"><Search size={17} /><span className="market-filter-label"><small>Rubro</small><input aria-label="Filtrar por rubro" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} placeholder="Todos los rubros" /></span></label>
      {(filters.locality || filters.date || filters.dateTo || filters.category) && <button className="market-clear-filters" type="button" onClick={onClear}><X size={14} /> Limpiar</button>}
      <div className="market-view-toggle" role="group" aria-label="Vista de convocatorias"><button type="button" className={displayMode === 'list' ? 'active' : ''} aria-pressed={displayMode === 'list'} onClick={() => setDisplayMode('list')}><FileText size={16} /> Lista</button><button type="button" className={displayMode === 'map' ? 'active' : ''} aria-pressed={displayMode === 'map'} onClick={() => setDisplayMode('map')}><MapIcon size={16} /> Mapa</button></div>
    </div>
  );
}

function MarketplaceLinks({ section, onNavigate }) {
  return <nav className="market-footer-nav" aria-label="Secciones del portal">{[['business', 'Mi negocio', BriefcaseBusiness], ['events', 'Ferias y eventos', Compass], ['applications', 'Mis solicitudes', TicketCheck]].filter(([id]) => id !== section).map(([id, label, Icon]) => <button key={id} onClick={() => onNavigate(id)}><Icon size={15} /> {label} <ArrowRight size={14} /></button>)}</nav>;
}

function EventDetails({ event, business, application, applicationForm, setApplicationForm, onClose, onSaveDraft, onSubmit, onNavigate, pageError, pageMessage }) {
  const [showForm, setShowForm] = useState(application?.status === 'BORRADOR');
  const [showActivity, setShowActivity] = useState(false);
  const isOpen = eventDisplayStatus(event) === 'PUBLICADA';
  const categories = acceptedCategories(event);
  return (
    <div className="market-detail-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="market-detail-panel" role="dialog" aria-modal="true" aria-labelledby="market-detail-title">
        <div className="market-detail-heading"><div><span className="market-kicker">DETALLE DE LA CONVOCATORIA</span><button className="market-close-button" onClick={onClose} aria-label="Cerrar detalle"><X size={19} /></button></div>{isDemoEvent(event) && <span className="market-demo-label">Datos de demostración · no oficial</span>}<StatusBadge status={eventDisplayStatus(event)} /><h2 id="market-detail-title">{event.name}</h2><span className="market-detail-locality"><MapPin size={15} /> {event.locality}{event.address ? ` · ${event.address}` : ''}</span></div>
        <div className="market-detail-content">
          <div className="market-detail-keyfacts"><div><CalendarDays size={17} /><span><strong>{formatDate(event.startsAt)}</strong><small>{formatTime(event.startsAt)}{event.endsAt ? ` a ${formatTime(event.endsAt)}` : ''}</small></span></div><div><Clock3 size={17} /><span><strong>Postulación hasta</strong><small>{formatDate(event.applicationDeadline)}</small></span></div>{event.capacity && <div><TicketCheck size={17} /><span><strong>Puestos disponibles</strong><small>{event.capacity}</small></span></div>}</div>
          {canLocate(event) ? <div className="market-detail-map"><MapPin size={17} /><div><strong>{isDemoEvent(event) ? 'Ubicación de prueba aproximada' : 'Ubicación en el mapa'}</strong><span>{event.address || `${event.latitude}, ${event.longitude}`}</span></div><a href={`https://www.openstreetmap.org/?mlat=${event.latitude}&mlon=${event.longitude}#map=16/${event.latitude}/${event.longitude}`} target="_blank" rel="noreferrer">Abrir mapa <ExternalLink size={13} /></a></div> : <div className="market-detail-map unavailable"><MapPin size={17} /><div><strong>Ubicación sin coordenadas</strong><span>{event.address || 'La organización no informó una dirección precisa.'}</span></div></div>}
          <section className="market-detail-block"><h3>Sobre el evento</h3><p>{event.description}</p></section>
          {categories.length > 0 && <section className="market-detail-block"><h3>Rubros admitidos</h3><div className="market-tags">{categories.map((category) => <span key={category}>{category}</span>)}</div></section>}
          {event.requirements && <section className="market-detail-block"><h3>Requisitos</h3><p className="market-preserve-lines">{event.requirements}</p></section>}
          {application && <div className="market-application-current"><span>Tu postulación</span><StatusBadge status={application.status} />{application.status !== 'BORRADOR' && <small>Enviada el {formatDate(application.updatedAt)}. Ya no se puede editar desde esta pantalla.</small>}</div>}
          {isOpen && (!application || application.status === 'BORRADOR') && <div className="market-apply-block">{!business ? <><div className="market-callout"><BriefcaseBusiness size={17} /><span>Para postularte, primero completá el perfil de tu negocio.</span></div><button className="market-button primary" onClick={() => { onClose(); onNavigate('business'); }}>Ir a Mi negocio <ArrowRight size={15} /></button></> : !showForm ? <button className="market-button primary" onClick={() => setShowForm(true)}><Send size={15} /> Iniciar postulación</button> : <form className="market-application-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}><h3>Postular a este evento</h3><div className="market-profile-summary"><strong>{business.name}</strong><span>{business.category} · {business.locality}</span><small>Usamos los datos guardados de Mi negocio.</small></div><label>¿Qué producto o servicio vas a ofrecer? <b>*</b><input required maxLength={300} value={applicationForm.offeredProduct} onChange={(e) => setApplicationForm({ ...applicationForm, offeredProduct: e.target.value })} placeholder="Ej.: panificados artesanales" /></label><label>Correo de contacto<input type="email" maxLength={120} value={applicationForm.contactEmail ?? business.contactEmail ?? ""} onChange={(e) => setApplicationForm({ ...applicationForm, contactEmail: e.target.value })} placeholder="emprendedor.demo@example.invalid" /></label><label>Teléfono de contacto<input type="tel" maxLength={40} pattern="[+()0-9 .-]{7,40}" value={applicationForm.contactPhone ?? business.contactPhone ?? ""} onChange={(e) => setApplicationForm({ ...applicationForm, contactPhone: e.target.value })} placeholder="0000000000" /></label><small className="market-form-hint">Completá al menos uno. La organización lo usará como contacto; no se envían emails ni SMS.</small><label>Información adicional solicitada por la organización<textarea rows="3" maxLength={2000} value={applicationForm.additionalInfo} onChange={(e) => setApplicationForm({ ...applicationForm, additionalInfo: e.target.value })} placeholder="Opcional" /></label><p className="market-form-hint">Al enviar, la organización podrá revisar los datos del negocio y esta propuesta.</p><div className="market-application-actions"><button type="button" className="market-button outline" onClick={onSaveDraft}><Save size={15} /> Guardar borrador</button><button className="market-button primary"><Send size={15} /> Enviar postulación</button></div>{pageMessage && <InlineMessage type="success">{pageMessage}</InlineMessage>}{pageError && <InlineMessage type="error">{pageError}</InlineMessage>}</form>}</div>}
          {!isOpen && !application && <div className="market-closed-notice"><CircleAlert size={16} /> Esta convocatoria no está abierta para nuevas postulaciones.</div>}
          {application?.status === 'APROBADA' && business && <><button className="market-button outline market-activity-toggle" onClick={() => setShowActivity(!showActivity)}><Store size={16} /> {showActivity ? 'Ocultar actividad del puesto' : 'Gestionar actividad del evento'} <ChevronDown size={14} /></button>{showActivity && <EventActivity event={event} />}</>}
        </div>
        <div className="market-detail-footer"><span>Información publicada por la persona organizadora.</span><button className="market-close-text" onClick={onClose}>Cerrar</button></div>
      </section>
    </div>
  );
}
