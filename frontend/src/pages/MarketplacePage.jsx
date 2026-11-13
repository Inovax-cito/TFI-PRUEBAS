import React, { useCallback, useEffect, useState } from 'react';
import './MarketplacePage.css';
import './EmprendeTheme.css';
import './PortalExtras.css';
import './PortalParticipation.css';
import './PortalAdmin.css';
import './PortalModern.css';
import { apiRequest, fileUrl } from '../utils/api.js';
import { MarkersMap, googleMapsLink } from '../components/maps/index.jsx';
import {
  EmptyState, ErrorState, InlineMessage, LoadingState, PageHeading, RatingBadge, SPACE_TYPE_LABEL, StatusBadge,
  formatDate, formatMoney, formatTime,
} from '../components/portal/ui.jsx';
import { MyBusinessPage, OrderForm } from './MyBusinessPage.jsx';
import { MySpacesPage, OrganizerHome, SpaceReviewPage } from './SpacesPage.jsx';
import { ApplicationsPage } from './ApplicationsPage.jsx';
import { OrganizerEventsPage } from './OrganizerEventsPage.jsx';
import { PlatformHome, PlatformUsersPage, ReportsPage } from './PlatformPage.jsx';
import { ReportButton } from '../components/portal/ReportButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { NotificationDropdown } from '../components/NotificationDropdown.jsx';
import {
  ArrowRight, Bell, Building2, BriefcaseBusiness, CalendarDays, CheckCircle2, ClipboardList, Flag, LayoutDashboard, ShieldCheck, Users,
  ChevronDown, ChevronRight, CircleAlert, Clock3, Compass, ExternalLink, FileText,
  HelpCircle, LogOut, Map as MapIcon, MapPin, Plus, Save, Search, Send, Share2, Sparkles, Star, Store, TicketCheck, Wallet, X,
} from 'lucide-react';

const LOCALITIES = ['Banda del Río Salí', 'Cruz Alta', 'Alderetes'];
const CATEGORIES = ['Alimentos', 'Artesanías', 'Indumentaria', 'Dulces regionales', 'Panificados', 'Plantas'];
const SHORT_LABEL = { 'Mis postulaciones': 'Postulaciones', 'Mi emprendimiento': 'Mi negocio', 'Verificar espacios': 'Verificar', 'Mis espacios': 'Espacios', Convocatorias: 'Ferias' };
const emptyBusiness = {
  name: '', kind: 'FIJO', category: '', description: '', locality: LOCALITIES[0],
  address: '', contactPhone: '', contactEmail: '', notificationsEnabled: true,
};
const canLocate = (event) => Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude)) && event.latitude !== null && event.longitude !== null && Math.abs(Number(event.latitude)) <= 90 && Math.abs(Number(event.longitude)) <= 180;
const isDemoEvent = (event) => event?.name?.startsWith('DEMO ·');
const eventDisplayStatus = (event) => {
  if (event.status === 'PUBLICADA' && new Date(event.applicationDeadline) <= new Date()) return 'CERRADA';
  if (event.status === 'PUBLICADA' && event.capacity && (event._count?.applications || 0) >= event.capacity) return 'SIN_CUPOS';
  return event.status;
};
const acceptedCategories = (event) => (event.acceptedCategories || '').split('|').map((item) => item.trim()).filter(Boolean);

function EventMap({ events, selectedId, onSelect, onOpenEvent }) {
  const items = events.map((event) => {
    const status = eventDisplayStatus(event);
    return { ...event, title: event.name, tone: status === 'PUBLICADA' ? 'open' : status === 'BORRADOR' ? 'draft' : 'closed' };
  });
  const located = items.filter(canLocate);
  return (
    <div className="market-map-wrap">
      <MarkersMap
        items={items}
        selectedId={selectedId}
        onSelect={onSelect}
        renderInfo={(event) => (
          <div className="market-map-popup">
            <StatusBadge status={eventDisplayStatus(event)} />
            <strong>{event.name}</strong>
            <span>{event.space?.name ? `${event.space.name} · ` : ''}{event.locality} · {formatDate(event.startsAt)}</span>
            {isDemoEvent(event) && <small>Ubicación de prueba · punto aproximado</small>}
            <button type="button" onClick={() => onOpenEvent(event.id)}>Ver convocatoria <ArrowRight size={13} /></button>
          </div>
        )}
      />
      {!located.length && <div className="market-map-no-pins"><MapPin size={18} /> Estas convocatorias todavía no tienen ubicación para mostrar.</div>}
      <div className="market-map-legend"><span><i className="legend-open" /> Abierta</span><span><i className="legend-closed" /> Cerrada</span><span><i className="legend-draft" /> Borrador</span></div>
    </div>
  );
}

function PortalHeader({ section, onNavigate, onOpenBackoffice, onSearch }) {
  const { user, isAdmin, isOrganizer, logout, unreadNotifications, fetchUnreadCount } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => apiRequest('/participation/unread').then((data) => { if (active) setUnreadMessages(data.total || 0); }).catch(() => {});
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('messages:read', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('messages:read', refresh); };
  }, []);
  const messagesTab = isOrganizer || isAdmin ? 'admin' : 'applications';
  const initials = `${user?.name?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U';
  // Cada rol ve solo lo que usa: menos opciones, menos confusión.
  const navigation = isAdmin ? [
    ['home', 'Panel', LayoutDashboard],
    ['verify', 'Verificar espacios', ShieldCheck],
    ['reports', 'Denuncias', Flag],
    ['users', 'Usuarios', Users],
    ['admin', 'Convocatorias', ClipboardList],
    ['events', 'Explorar', CalendarDays],
  ] : isOrganizer ? [
    ['home', 'Inicio', LayoutDashboard],
    ['spaces', 'Mis espacios', Building2],
    ['admin', 'Convocatorias', ClipboardList],
    ['help', 'Ayuda', HelpCircle],
  ] : [
    ['events', 'Convocatorias', CalendarDays],
    ['applications', 'Mis postulaciones', FileText],
    ['business', 'Mi emprendimiento', BriefcaseBusiness],
    ['help', 'Ayuda', HelpCircle],
  ];
  const isActive = (id) => section === id || (id === 'events' && section === 'home' && !isOrganizer && !isAdmin);
  const submitSearch = (event) => { event.preventDefault(); onSearch(query.trim()); setSearchOpen(false); };
  const searchForm = (className) => (
    <form className={className} role="search" onSubmit={submitSearch}>
      <Search size={17} />
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscá ferias, rubros o lugares" aria-label="Buscar convocatorias" maxLength={80} />
      <button type="submit">Buscar</button>
    </form>
  );

  return (
    <>
    <header className="emprende-header">
      <div className="emprende-header-inner">
        <button className="emprende-brand" type="button" onClick={() => onNavigate('home')} aria-label="Emprende, inicio">
          <span className="emprende-brand-mark"><span /><span /></span>
          <span className="emprende-brand-copy"><strong>Emprende</strong><small>Ferias y espacios para emprender</small></span>
        </button>
        {searchForm('emprende-search')}
        <nav className={`emprende-nav ${navigation.length > 4 ? 'many' : ''}`} aria-label="Navegación principal">
          {navigation.map(([id, label, Icon]) => (
            <button key={id} type="button" title={label} className={isActive(id) ? 'active' : ''} aria-current={isActive(id) ? 'page' : undefined} onClick={() => onNavigate(id)}>
              <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
              {id === messagesTab && unreadMessages > 0 && <span className="nav-unread" aria-label={`${unreadMessages} mensajes sin leer`}>{unreadMessages}</span>}
            </button>
          ))}
        </nav>
        <div className="emprende-header-actions">
          <button className="emprende-icon-button mobile-only" type="button" aria-label="Buscar" aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><Search size={19} /></button>
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
            {accountOpen && <div className="emprende-account-menu"><span>{user?.email}</span><small>{isAdmin ? 'Administración de la plataforma' : isOrganizer ? 'Administración de espacios' : user?.role === 'EMPLEADO' ? 'Cuenta del equipo' : 'Cuenta de emprendedor'}</small>{onOpenBackoffice && user?.role === 'EMPLEADO' && <button type="button" onClick={onOpenBackoffice}><Store size={15} /> Panel comercial</button>}<button type="button" onClick={logout}><LogOut size={15} /> Cerrar sesión</button></div>}
          </div>
        </div>
      </div>
      {searchOpen && searchForm('emprende-search mobile-search')}
    </header>
    {/* En el celular la navegación va abajo, al alcance del pulgar, como en una app. */}
    <nav className="emprende-bottom-nav" aria-label="Navegación">
      {navigation.slice(0, 5).map(([id, label, Icon]) => (
        <button key={id} type="button" className={isActive(id) ? 'active' : ''} aria-current={isActive(id) ? 'page' : undefined} onClick={() => onNavigate(id)}>
          <span className="bottom-nav-icon"><Icon size={21} strokeWidth={isActive(id) ? 2.2 : 1.8} />{id === messagesTab && unreadMessages > 0 && <span className="nav-unread">{unreadMessages}</span>}</span>
          <span>{SHORT_LABEL[label] || label}</span>
        </button>
      ))}
    </nav>
    </>
  );
}

const SECTION_PATHS = {
  home: '/inicio', events: '/convocatorias', applications: '/postulaciones', business: '/mi-emprendimiento',
  spaces: '/espacios', admin: '/gestion', verify: '/verificar', help: '/ayuda', reports: '/denuncias', users: '/usuarios',
};
const PATH_SECTIONS = Object.fromEntries(Object.entries(SECTION_PATHS).map(([section, path]) => [path, section]));

/** Lee la pantalla y la convocatoria abierta desde la URL (ej.: /convocatorias/12). */
const readLocation = (fallback) => {
  const [, first, second] = window.location.pathname.split('/');
  const section = PATH_SECTIONS[`/${first || ''}`] || fallback;
  const eventId = section === 'events' && /^\d+$/.test(second || '') ? Number(second) : null;
  // Destino puntual (desde un aviso): una postulación y, si corresponde, su conversación.
  const params = new URLSearchParams(window.location.search);
  const applicationId = Number(params.get('postulacion')) || null;
  const focus = applicationId ? { applicationId, chat: params.get('mensajes') === '1', key: Date.now() } : null;
  const query = section === 'events' ? (params.get('q') || '') : '';
  return { section, eventId, focus, query };
};

export function EntrepreneurPortal({ initialSection = 'home', onOpenBackoffice }) {
  const [route, setRoute] = useState(() => readLocation(initialSection));
  useEffect(() => {
    // Normaliza la URL al entrar (ej.: "/" → "/inicio") sin agregar un paso al historial.
    const path = route.eventId ? `/convocatorias/${route.eventId}` : SECTION_PATHS[route.section];
    if (path && window.location.pathname !== path) window.history.replaceState(null, '', `${path}${window.location.search}`);
    const onPop = () => setRoute(readLocation(initialSection));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!route.eventId) window.scrollTo({ top: 0 }); }, [route.section, route.eventId]);

  const go = (section, eventId = null) => {
    const path = eventId ? `/convocatorias/${eventId}` : SECTION_PATHS[section] || '/inicio';
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setRoute({ section: eventId ? 'events' : section, eventId, focus: null, query: '' });
  };
  const search = (query) => {
    const path = query ? `/convocatorias?q=${encodeURIComponent(query)}` : '/convocatorias';
    window.history.pushState(null, '', path);
    setRoute({ section: 'events', eventId: null, focus: null, query });
  };
  // Una vez abierta la postulación, se limpia la URL para que recargar no la vuelva a abrir.
  const focusHandled = () => {
    window.history.replaceState(null, '', window.location.pathname);
    setRoute((current) => ({ ...current, focus: null }));
  };

  return (
    <div className="emprende-portal-shell">
      <PortalHeader section={route.section} onNavigate={(section) => go(section)} onOpenBackoffice={onOpenBackoffice} onSearch={search} />
      <main className="emprende-portal-main">
        <MarketplacePage
          initialTab={route.section}
          onNavigate={(section) => go(section)}
          routeEventId={route.eventId}
          onOpenEvent={(id) => go('events', id)}
          onCloseEvent={() => go('events')}
          focus={route.focus}
          onFocusHandled={focusHandled}
          routeQuery={route.query}
          onSearch={search}
        />
      </main>
    </div>
  );
}

function EventCard({ event, selected, onSelect, onDetails }) {
  const categories = acceptedCategories(event);
  const status = eventDisplayStatus(event);
  const start = new Date(event.startsAt);
  const left = event.capacity ? Math.max(0, event.capacity - (event._count?.applications || 0)) : null;
  const open = status === 'PUBLICADA';
  return (
    <article className={`mk-card ${selected ? 'selected' : ''} ${open ? '' : 'is-closed'}`} onMouseEnter={() => onSelect?.(event.id)}>
      <button type="button" className="mk-card-media" onClick={() => onDetails(event.id)} aria-label={`Ver ${event.name}`}>
        {event.space?.coverUrl
          ? <img src={fileUrl(event.space.coverUrl)} alt="" loading="lazy" />
          : <span className="mk-card-placeholder"><CalendarDays size={34} strokeWidth={1.4} /></span>}
        <span className="mk-card-date"><strong>{start.getDate()}</strong>{start.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</span>
        <span className="mk-card-status"><StatusBadge status={status} /></span>
        {open && left !== null && left <= 3 && left > 0 && <span className="mk-card-urgent">¡Quedan {left}!</span>}
      </button>
      <button type="button" className="mk-card-body" onClick={() => onDetails(event.id)}>
        <span className="mk-card-place"><MapPin size={13} /> {event.space?.name ? `${event.space.name} · ` : ''}{event.locality}</span>
        <h3>{event.name}</h3>
        <span className="mk-card-time">{start.toLocaleDateString('es-AR', { weekday: 'long' })} · {formatTime(event.startsAt)} a {formatTime(event.endsAt)} hs</span>
        <span className="mk-card-tags">{categories.length ? categories.slice(0, 2).map((category) => <i key={category}>{category}</i>) : <i>Todos los rubros</i>}{categories.length > 2 && <i>+{categories.length - 2}</i>}</span>
        <span className="mk-card-footer">
          <span className="mk-price"><small>Puesto</small><strong>{event.standFee ? formatMoney(event.standFee) : 'Sin costo'}</strong></span>
          <span className="mk-card-side">
            {event.organizerRating?.count ? <span className="mk-rating"><Star size={13} fill="currentColor" /> {event.organizerRating.average.toFixed(1)}</span> : null}
            {open && left !== null && <span className="mk-seats">{left} {left === 1 ? 'lugar libre' : 'lugares libres'}</span>}
          </span>
        </span>
        {event.space?.status === 'VERIFICADO' && <span className="mk-verified"><ShieldCheck size={12} /> Espacio verificado</span>}
      </button>
    </article>
  );
}

function EventActivity({ event }) {
  const [activity, setActivity] = useState(null);
  const [products, setProducts] = useState([]);
  const [expense, setExpense] = useState({ amount: '', concept: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setActivity(await apiRequest(`/marketplace/events/${event.id}/activity`));
  }, [event.id]);

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest(`/marketplace/events/${event.id}/activity`), apiRequest('/business/products')])
      .then(([data, catalog]) => { if (active) { setActivity(data); setProducts(catalog); } })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [event.id]);

  const registerExpense = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (Number(expense.amount) <= 0 || !expense.concept.trim()) throw new Error('Ingresá el importe y un concepto para el gasto.');
      await apiRequest('/business/expenses', { method: 'POST', body: { eventId: event.id, amount: Number(expense.amount), concept: expense.concept.trim() } });
      setExpense({ amount: '', concept: '' });
      setMessage('Gasto registrado y asociado a esta convocatoria.');
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <section className="market-activity">
      <div className="market-subsection-heading"><div><span className="market-kicker">PARTICIPACIÓN APROBADA</span><h3>Actividad del puesto</h3><p>Las ventas usan tu catálogo de Mi emprendimiento y quedan vinculadas a este evento.</p></div><TicketCheck size={20} /></div>
      {activity ? <div className="market-activity-totals"><div><span>Ventas registradas</span><strong>{formatMoney(activity.summary.salesTotal)}</strong></div><div><span>Gastos registrados</span><strong>{formatMoney(activity.summary.expensesTotal)}</strong></div><div><span>Diferencia simple</span><strong>{formatMoney(activity.summary.difference)}</strong><small>Ventas menos gastos cargados. No es una ganancia neta.</small></div></div> : <div className="market-loading small"><span /> Cargando actividad...</div>}
      <div className="market-activity-forms">
        <div className="market-inline-form"><h4><Store size={16} /> Registrar venta</h4>
          <OrderForm products={products} eventId={event.id} defaultStatus="ENTREGADO" defaultChannel="FERIA" compact onSaved={async (result) => { setMessage(result.message); await refresh(); }} />
        </div>
        <form className="market-inline-form" onSubmit={registerExpense}><h4><Wallet size={16} /> Registrar gasto</h4><p>Se suma a tu Caja del día si la tenés abierta.</p>
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

export function MarketplacePage({ initialTab = 'home', onNavigate, routeEventId = null, onOpenEvent, onCloseEvent, focus = null, onFocusHandled, routeQuery = '', onSearch }) {
  const { user, isAdmin, isOrganizer } = useAuth();
  const canManage = isAdmin || isOrganizer;
  // Solo el emprendedor tiene negocio y se postula; la administración y los organizadores solo exploran.
  const usesBusiness = user?.role === 'EMPRENDEDOR';
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
  const [selectedId, setSelectedId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [myApplication, setMyApplication] = useState(null);
  const [filters, setFilters] = useState({ locality: '', date: '', dateTo: '', category: '', q: routeQuery });
  useEffect(() => { setFilters((current) => (current.q === routeQuery ? current : { ...current, q: routeQuery })); }, [routeQuery]);
  const search = (text) => (onSearch ? onSearch(text) : setFilters((current) => ({ ...current, q: text })));
  const [displayMode, setDisplayMode] = useState('list');
  const [applicationForm, setApplicationForm] = useState({ offeredProduct: '', additionalInfo: '' });
  const [pageMessage, setPageMessage] = useState('');
  const [pageError, setPageError] = useState('');
  // Con URLs, la convocatoria abierta la define la ruta (/convocatorias/:id); sin ellas, el estado local.
  const routed = typeof onOpenEvent === 'function';
  const openId = routed ? routeEventId : detailId;
  const openDetail = (id) => { setSelectedId(id); if (routed) onOpenEvent(id); else setDetailId(id); };
  const closeDetail = () => { setSelectedId(null); setPageError(''); setPageMessage(''); if (routed) onCloseEvent(); else setDetailId(null); };

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
      if (filters.q) query.set('q', filters.q);
      const result = await apiRequest(`/marketplace/events${query.size ? `?${query}` : ''}`);
      // Como en un marketplace: primero lo que se puede contratar (abiertas por fecha), al final lo cerrado.
      const rank = (event) => ({ PUBLICADA: 0, SIN_CUPOS: 1, BORRADOR: 2, CERRADA: 3 }[eventDisplayStatus(event)] ?? 2);
      result.sort((a, b) => rank(a) - rank(b) || (rank(a) === 3 ? new Date(b.startsAt) - new Date(a.startsAt) : new Date(a.startsAt) - new Date(b.startsAt)));
      setEvents(result);
      setSelectedId((current) => (result.some((item) => item.id === current) ? current : null));
    } catch (error) { setEventsError(error.message); }
    finally { setEventsLoading(false); }
  }, [filters]);

  const loadApplications = useCallback(async () => {
    try { setApplications(await apiRequest('/marketplace/applications')); }
    catch (error) { setPageError(error.message); }
  }, []);


  useEffect(() => { if (usesBusiness) loadBusiness(); else setBusinessLoading(false); }, [loadBusiness, usesBusiness]);
  useEffect(() => {
    if (section !== 'events') return;
    const pendingEventId = window.sessionStorage.getItem('marketplace-selected-event');
    if (pendingEventId) {
      setSelectedId(Number(pendingEventId));
      window.sessionStorage.removeItem('marketplace-selected-event');
    }
  }, [section]);
  useEffect(() => { if (section === 'events' || section === 'home') loadEvents(); }, [section, loadEvents]);
  useEffect(() => { if (usesBusiness && section === 'home') loadApplications(); }, [section, loadApplications, usesBusiness]);
  useEffect(() => {
    if (!openId) { setSelectedEvent(null); setMyApplication(null); return; }
    let active = true;
    setSelectedId(openId);
    apiRequest(`/marketplace/events/${openId}`).then((data) => {
      if (!active) return;
      setSelectedEvent(data.event); setMyApplication(data.application);
      setApplicationForm({ offeredProduct: data.application?.offeredProduct || '', additionalInfo: data.application?.additionalInfo || '' });
    }).catch((error) => { if (active) setPageError(error.message); });
    return () => { active = false; };
  }, [openId]);

  const submitApplication = async (send) => {
    setPageError(''); setPageMessage('');
    if (send && !(applicationForm.contactEmail ?? business.contactEmail)?.trim() && !(applicationForm.contactPhone ?? business.contactPhone)?.trim()) {
      setPageError('Completá un correo o un teléfono de contacto. Podés hacerlo acá o desde Mi negocio.');
      return;
    }
    try {
      const response = await apiRequest(`/marketplace/events/${openId}/applications`, { method: 'POST', body: { ...applicationForm, contactEmail: applicationForm.contactEmail ?? business.contactEmail, contactPhone: applicationForm.contactPhone ?? business.contactPhone, send } });
      setMyApplication(response.application); setPageMessage(response.message); await loadApplications();
    } catch (error) { setPageError(error.message); }
  };


  const openEventsCount = events.filter((event) => eventDisplayStatus(event) === 'PUBLICADA').length;
  const activeApplicationsCount = applications.filter((item) => ['ENVIADA', 'EN_REVISION', 'APROBADA'].includes(item.status)).length;

  const clearFilters = () => { setFilters({ locality: '', date: '', dateTo: '', category: '', q: '' }); if (filters.q && onSearch) onSearch(''); };
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

  if (section === 'business') return <MyBusinessPage onNavigate={navigate} />;
  if (section === 'spaces') return <MySpacesPage onNavigate={navigate} />;
  if (section === 'verify') return isAdmin ? <SpaceReviewPage /> : null;
  if (section === 'reports') return isAdmin ? <ReportsPage /> : null;
  if (section === 'users') return isAdmin ? <PlatformUsersPage currentUserId={user?.id} /> : null;
  if (section === 'home' && isAdmin) return <PlatformHome onNavigate={navigate} />;
  if (section === 'home' && isOrganizer) return <OrganizerHome user={user} onNavigate={navigate} />;

  if (section === 'events') return (
    <div className="marketplace-page">
      <PageHeading kicker="EXPLORAR" title={filters.q ? `Resultados para “${filters.q}”` : 'Ferias y eventos'} description="Elegí dónde vender: fechas, costo del puesto, cupos y espacios verificados." />
      <CategoryChips value={filters.category} onChange={(category) => setFilters({ ...filters, category })} />
      <OpportunityFilters filters={filters} setFilters={setFilters} displayMode={displayMode} setDisplayMode={setDisplayMode} onClear={clearFilters} />
      {usesBusiness && !businessExists && <div className="market-callout"><BriefcaseBusiness size={18} /><span>Completá el <button onClick={() => navigate('business')}>perfil de tu emprendimiento</button> antes de postularte.</span></div>}
      {eventsLoading && !events.length ? <LoadingState label="Buscando convocatorias..." /> : eventsError ? <ErrorState message={eventsError} onRetry={loadEvents} /> : events.length === 0 ? <EmptyState icon={Compass} title="No hay convocatorias para estos filtros" text="Probá con otra búsqueda, otro rubro u otra fecha." action={<button className="market-button outline" onClick={clearFilters}>Quitar filtros</button>} /> : (
        <div className={`market-explore-layout ${displayMode === 'map' ? 'map-focus' : ''}`}>
          <div className={`market-event-list ${displayMode === 'map' ? 'mobile-hidden' : ''}`}>
            <div className="market-list-count"><strong>{events.length}</strong> {events.length === 1 ? 'convocatoria encontrada' : 'convocatorias encontradas'}</div>
            {events.map((event) => <EventCard key={event.id} event={event} selected={selectedId === event.id} onSelect={setSelectedId} onDetails={openDetail} />)}
          </div>
          {displayMode === 'map' && <div className="market-map-column"><EventMap events={events} selectedId={selectedId} onSelect={setSelectedId} onOpenEvent={openDetail} /></div>}
        </div>
      )}
      {selectedEvent && <EventDetails event={selectedEvent} business={businessExists ? business : null} application={myApplication} applicationForm={applicationForm} setApplicationForm={setApplicationForm} onClose={closeDetail} onSaveDraft={() => submitApplication(false)} onSubmit={() => submitApplication(true)} onNavigate={navigate} pageError={pageError} pageMessage={pageMessage} canApply={usesBusiness} />}
      <MarketplaceLinks section={section} onNavigate={navigate} />
    </div>
  );

  if (section === 'applications') return <ApplicationsPage onNavigate={navigate} onOpenEvent={openDetail} focus={focus} onFocusHandled={onFocusHandled} />;


  if (section === 'help' && isOrganizer) return (
    <div className="marketplace-page">
      <PageHeading kicker="CENTRO DE AYUDA" title="Cómo publicar en Emprende" description="Tres pasos para recibir emprendedores en tu espacio de forma segura." />
      <div className="market-help-grid">
        <article><span>01</span><h2>Registrá tu espacio</h2><p>Marcalo en el mapa e indicá el titular, su CUIT y con qué derecho lo usás: propiedad, alquiler, permiso municipal, concesión o autorización.</p><button className="market-button outline" onClick={() => navigate('spaces')}>Mis espacios <ArrowRight size={15} /></button></article>
        <article><span>02</span><h2>Acreditalo con documentos</h2><p>Subí la escritura, el contrato, el permiso o la autorización firmada. Una plaza o un parque solo se aceptan con permiso municipal o concesión.</p><button className="market-button outline" onClick={() => navigate('spaces')}>Subir documentación <ArrowRight size={15} /></button></article>
        <article><span>03</span><h2>Publicá y elegí</h2><p>Con el espacio verificado, creá convocatorias con fechas, cupos y costo del puesto, y revisá las postulaciones.</p><button className="market-button outline" onClick={() => navigate('admin')}>Mis convocatorias <ArrowRight size={15} /></button></article>
        <p className="market-help-note"><CircleAlert size={16} /> Emprende no procesa pagos. Si cobrás el puesto, acordalo directamente con cada emprendedor y emití el comprobante que corresponda.</p>
      </div>
    </div>
  );

  if (section === 'help') return (
    <div className="marketplace-page">
      <PageHeading kicker="CENTRO DE AYUDA" title="Cómo usar Emprende" description="Una guía breve para encontrar convocatorias y presentar una postulación." />
      <div className="market-help-grid">
        <article><span>01</span><h2>Completá tu emprendimiento</h2><p>Guardá el nombre, el rubro, la localidad y tus fotos una vez. Esa información se reutiliza en cada postulación.</p><button className="market-button outline" onClick={() => navigate('business')}>Abrir Mi emprendimiento <ArrowRight size={15} /></button></article>
        <article><span>02</span><h2>Explorá oportunidades</h2><p>Filtrá por localidad y fecha, y mirá en el mapa dónde queda cada espacio. Solo se publican espacios con documentación verificada.</p><button className="market-button outline" onClick={() => navigate('events')}>Ver ferias y eventos <ArrowRight size={15} /></button></article>
        <article><span>03</span><h2>Seguí tu solicitud</h2><p>Contá qué producto o servicio vas a ofrecer y consultá los cambios de estado en Mis solicitudes.</p><button className="market-button outline" onClick={() => navigate('applications')}>Ver mis solicitudes <ArrowRight size={15} /></button></article>
        <p className="market-help-note"><CircleAlert size={16} /> Emprende verifica que quien organiza tenga derecho a usar el espacio, pero no procesa pagos. Si te cobran el puesto, pedí siempre un comprobante.</p>
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
    navigate={navigate} saveNotificationPreference={saveNotificationPreference} setDetailId={openDetail} closeDetail={closeDetail} onSearch={search} applications={applications}
    selectedEvent={selectedEvent} myApplication={myApplication} applicationForm={applicationForm}
    setApplicationForm={setApplicationForm} submitApplication={submitApplication}
    pageError={pageError} pageMessage={pageMessage}
  />;

  if (section === 'admin') return canManage
    ? <OrganizerEventsPage isAdmin={isAdmin} isOrganizer={isOrganizer} navigate={navigate} focus={focus} onFocusHandled={onFocusHandled} />
    : <div className="marketplace-page"><EmptyState icon={CircleAlert} title="Acceso restringido" text="La gestión de convocatorias está disponible para quienes administran espacios verificados." /></div>;

  return (
    <div className="marketplace-page">
      <PageHeading kicker="PORTAL PARA EMPRENDEDORES" title={`Hola, ${user?.name || 'emprendedor/a'}.`} description="Organizá tu negocio y encontrá oportunidades para participar en ferias y eventos." />
      {pageError && <InlineMessage type="error">{pageError}</InlineMessage>}
      <div className="market-home-layout">
        <section className="market-home-main">
          {!businessExists ? <article className="market-home-profile incomplete"><div className="market-home-icon"><BriefcaseBusiness size={20} /></div><div><span className="market-kicker">PRIMER PASO</span><h2>Completá el perfil de tu negocio</h2><p>Así vas a poder postularte sin volver a escribir los mismos datos.</p><button className="market-button primary" onClick={() => navigate('business')}>Completar perfil <ArrowRight size={15} /></button></div></article> : <article className="market-home-profile"><div className="market-home-icon"><Store size={20} /></div><div><span className="market-kicker">MI NEGOCIO</span><h2>{business.name}</h2><p>{business.category} · {business.locality} · {business.kind === 'FIJO' ? 'Local fijo' : 'Itinerante'}</p><button className="market-text-button" onClick={() => navigate('business')}>Ver o editar perfil <ArrowRight size={14} /></button></div></article>}
          <div className="market-home-opportunities"><div className="market-home-section-head"><div><span className="market-kicker">OPORTUNIDADES</span><h2>Convocatorias abiertas</h2></div><button className="market-text-button" onClick={() => navigate('events')}>Explorar todas <ArrowRight size={14} /></button></div>
            {eventsLoading ? <LoadingState label="Buscando oportunidades..." /> : eventsError ? <ErrorState message={eventsError} onRetry={loadEvents} /> : events.length === 0 ? <EmptyState icon={Compass} title="No hay convocatorias publicadas todavía" text="Cuando se carguen oportunidades para la zona, las vas a encontrar acá." /> : <div className="market-home-event-grid">{events.slice(0, 2).map((event) => <EventCard key={event.id} event={event} selected={false} onSelect={openDetail} onDetails={openDetail} />)}</div>}
          </div>
        </section>
        <aside className="market-home-side"><div className="market-home-stat"><span className="market-home-stat-icon"><Compass size={17} /></span><div><strong>{openEventsCount}</strong><span>convocatorias abiertas ahora</span></div></div><div className="market-home-stat"><span className="market-home-stat-icon blue"><TicketCheck size={17} /></span><div><strong>{activeApplicationsCount}</strong><span>postulaciones activas</span></div></div><button className="market-side-link" onClick={() => navigate('applications')}>Ver mis solicitudes <ChevronRight size={15} /></button>{isAdmin && <button className="market-side-link" onClick={() => navigate('admin')}>Administrar convocatorias <ChevronRight size={15} /></button>}<div className="market-side-info"><CircleAlert size={16} /><p>Las publicaciones de esta plataforma no implican aprobación municipal. Revisá siempre quién organiza cada actividad.</p></div></aside>
      </div>
      <MarketplaceLinks section={section} onNavigate={navigate} />
    </div>
  );
}

function MarketplaceHome({
  business, businessExists, businessError, events, eventsLoading, eventsError, loadEvents, filters, setFilters, clearFilters,
  openEventsCount, navigate, setDetailId, closeDetail, selectedEvent, myApplication, applicationForm,
  setApplicationForm, submitApplication, pageError, pageMessage, onSearch, applications,
}) {
  const [query, setQuery] = useState('');
  const open = events.filter((event) => eventDisplayStatus(event) === 'PUBLICADA');
  const soon = [...open].sort((a, b) => new Date(a.applicationDeadline) - new Date(b.applicationDeadline)).slice(0, 4);
  const upcoming = (applications || []).filter((item) => item.status === 'APROBADA' && new Date(item.event.endsAt) > new Date()).length;
  return (
    <div className="marketplace-page market-home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="home-hero-kicker"><Sparkles size={14} /> Ferias · eventos · espacios verificados</span>
          <h1>Encontrá dónde vender lo que hacés</h1>
          <p>Postulate a ferias de la zona, coordiná tu puesto con quien organiza y llevá tus ventas en un solo lugar.</p>
          <form className="home-hero-search" role="search" onSubmit={(e) => { e.preventDefault(); onSearch(query.trim()); }}>
            <Search size={19} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej.: feria gastronómica, artesanías, plaza" aria-label="Buscar convocatorias" maxLength={80} />
            <button type="submit" className="market-button primary">Buscar</button>
          </form>
        </div>
        <div className="home-hero-stats">
          <button type="button" onClick={() => navigate('events')}><strong>{openEventsCount}</strong><span>inscripciones abiertas</span></button>
          <button type="button" onClick={() => navigate('applications')}><strong>{upcoming}</strong><span>ferias confirmadas</span></button>
          <button type="button" onClick={() => navigate('business')}><strong>{businessExists ? '✓' : '!'}</strong><span>{businessExists ? business.name : 'Completá tu perfil'}</span></button>
        </div>
      </section>

      <CategoryChips value={filters.category} onChange={(category) => setFilters({ ...filters, category })} />
      {(businessError || pageError) && <InlineMessage type="error">{businessError || pageError}</InlineMessage>}
      {!businessExists && (
        <div className="home-banner">
          <BriefcaseBusiness size={22} />
          <div><strong>Completá tu emprendimiento</strong><span>Con tus fotos y productos te postulás en un toque y las organizaciones te conocen mejor.</span></div>
          <button className="market-button primary small" onClick={() => navigate('business')}>Completar <ArrowRight size={14} /></button>
        </div>
      )}

      {soon.length > 0 && (
        <section className="home-section">
          <div className="home-section-head"><h2>Cierran pronto</h2><button className="market-text-button" onClick={() => navigate('events')}>Ver todas <ArrowRight size={14} /></button></div>
          <div className="mk-rail">{soon.map((event) => <EventCard key={event.id} event={event} onDetails={setDetailId} />)}</div>
        </section>
      )}

      <section className="home-section">
        <div className="home-section-head"><h2>{filters.category ? `Ferias para ${filters.category}` : 'Todas las convocatorias'}</h2><button className="market-text-button" onClick={() => navigate('events')}>Ver en el mapa <MapIcon size={14} /></button></div>
        {eventsLoading && !events.length ? <LoadingState label="Cargando convocatorias…" /> : eventsError ? <ErrorState message={eventsError} onRetry={loadEvents} /> : events.length === 0 ? (
          <EmptyState icon={Compass} title="No hay convocatorias con este filtro" text="Probá con otro rubro o volvé más adelante." action={filters.category ? <button className="market-button outline" onClick={clearFilters}>Ver todas</button> : undefined} />
        ) : <div className="mk-grid">{events.slice(0, 8).map((event) => <EventCard key={event.id} event={event} onDetails={setDetailId} />)}</div>}
        {events.length > 8 && <button className="market-more-events" onClick={() => navigate('events')}>Ver las {events.length} convocatorias <ArrowRight size={15} /></button>}
      </section>

      <section className="home-trust">
        <div><ShieldCheck size={22} /><strong>Espacios verificados</strong><span>Cada lugar se publica solo si quien organiza demostró que puede usarlo.</span></div>
        <div><Star size={22} /><strong>Calificaciones reales</strong><span>Después de cada feria, emprendedores y organizadores se califican.</span></div>
        <div><Wallet size={22} /><strong>Tus ventas al día</strong><span>Caja diaria, pedidos y lo que te queda después del puesto.</span></div>
      </section>
      {selectedEvent && <EventDetails event={selectedEvent} business={businessExists ? business : null} application={myApplication} applicationForm={applicationForm} setApplicationForm={setApplicationForm} onClose={closeDetail} onSaveDraft={() => submitApplication(false)} onSubmit={() => submitApplication(true)} onNavigate={navigate} pageError={pageError} pageMessage={pageMessage} canApply />}
    </div>
  );
}

/** Rubros como chips, para filtrar con un toque (como las categorías de un marketplace). */
function CategoryChips({ value, onChange }) {
  return (
    <div className="category-chips" role="group" aria-label="Filtrar por rubro">
      <button type="button" className={!value ? 'active' : ''} aria-pressed={!value} onClick={() => onChange('')}>Todos</button>
      {CATEGORIES.map((category) => (
        <button key={category} type="button" className={value === category ? 'active' : ''} aria-pressed={value === category} onClick={() => onChange(value === category ? '' : category)}>{category}</button>
      ))}
    </div>
  );
}


function OpportunityFilters({ filters, setFilters, displayMode, setDisplayMode, onClear }) {
  const [open, setOpen] = useState(false);
  const active = [filters.locality, filters.date, filters.dateTo, filters.category].filter(Boolean).length;
  return (
    <div className={`market-filters ${open ? 'open' : ''}`} aria-label="Filtros de convocatorias">
      <button type="button" className="filters-toggle" aria-expanded={open} onClick={() => setOpen(!open)}><Search size={16} /> Filtros{active ? ` (${active})` : ''} <ChevronDown size={15} /></button>
      <label className="market-filter-field"><MapPin size={17} /><span className="market-filter-label"><small>Localidad</small><select aria-label="Filtrar por localidad" value={filters.locality} onChange={(e) => setFilters({ ...filters, locality: e.target.value })}><option value="">Todas las localidades</option>{LOCALITIES.map((locality) => <option key={locality}>{locality}</option>)}</select></span><ChevronDown size={15} /></label>
      <label className="market-filter-field"><CalendarDays size={17} /><span className="market-filter-label"><small>Desde</small><input aria-label="Filtrar desde fecha" type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} /></span></label>
      <label className="market-filter-field"><CalendarDays size={17} /><span className="market-filter-label"><small>Hasta</small><input aria-label="Filtrar hasta fecha" type="date" min={filters.date || undefined} value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} /></span></label>
      <label className="market-filter-field category"><Search size={17} /><span className="market-filter-label"><small>Rubro</small><input aria-label="Filtrar por rubro" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} placeholder="Todos los rubros" /></span></label>
      {(filters.locality || filters.date || filters.dateTo || filters.category || filters.q) && <button className="market-clear-filters" type="button" onClick={onClear}><X size={14} /> Limpiar filtros</button>}
      <div className="market-view-toggle" role="group" aria-label="Vista de convocatorias"><button type="button" className={displayMode === 'list' ? 'active' : ''} aria-pressed={displayMode === 'list'} onClick={() => setDisplayMode('list')}><FileText size={16} /> Lista</button><button type="button" className={displayMode === 'map' ? 'active' : ''} aria-pressed={displayMode === 'map'} onClick={() => setDisplayMode('map')}><MapIcon size={16} /> Mapa</button></div>
    </div>
  );
}

function MarketplaceLinks({ section, onNavigate }) {
  return <nav className="market-footer-nav" aria-label="Secciones del portal">{[['events', 'Convocatorias', Compass], ['applications', 'Mis postulaciones', TicketCheck], ['business', 'Mi emprendimiento', BriefcaseBusiness]].filter(([id]) => id !== section).map(([id, label, Icon]) => <button key={id} onClick={() => onNavigate(id)}><Icon size={15} /> {label} <ArrowRight size={14} /></button>)}</nav>;
}

function EventDetails({ event, business, application, applicationForm, setApplicationForm, onClose, onSaveDraft, onSubmit, onNavigate, pageError, pageMessage, canApply = true }) {
  const [showForm, setShowForm] = useState(application?.status === 'BORRADOR');
  const [showActivity, setShowActivity] = useState(false);
  const [shared, setShared] = useState('');
  const share = async () => {
    const url = `${window.location.origin}/convocatorias/${event.id}`;
    try {
      if (navigator.share) await navigator.share({ title: event.name, text: `${event.name} · ${formatDate(event.startsAt)}`, url });
      else { await navigator.clipboard.writeText(url); setShared('Link copiado.'); }
    } catch { /* la persona canceló */ }
  };
  const isOpen = eventDisplayStatus(event) === 'PUBLICADA';
  const categories = acceptedCategories(event);
  return (
    <div className="market-detail-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="market-detail-panel" role="dialog" aria-modal="true" aria-labelledby="market-detail-title">
        <div className="market-detail-heading"><div><span className="market-kicker">DETALLE DE LA CONVOCATORIA</span><button className="market-close-button" onClick={onClose} aria-label="Cerrar detalle"><X size={19} /></button></div>{isDemoEvent(event) && <span className="market-demo-label">Datos de demostración · no oficial</span>}<StatusBadge status={eventDisplayStatus(event)} /><h2 id="market-detail-title">{event.name}</h2><span className="market-detail-locality"><MapPin size={15} /> {event.space ? `${event.space.name} · ` : ''}{event.locality}{event.address ? ` · ${event.address}` : ''}</span><div className="detail-chips">{event.space?.status === 'VERIFICADO' && <span className="verified-chip"><ShieldCheck size={13} /> Espacio verificado · {SPACE_TYPE_LABEL[event.space.type]}</span>}<span className="verified-chip neutral">Organización <RatingBadge rating={event.organizerRating} /></span><button type="button" className="share-button" onClick={share}><Share2 size={13} /> Compartir</button>{canApply && <ReportButton targetType="CONVOCATORIA" targetId={event.id} compact />}{shared && <small>{shared}</small>}</div></div>
        <div className="market-detail-content">
          <div className="market-detail-keyfacts"><div><CalendarDays size={17} /><span><strong>{formatDate(event.startsAt)}</strong><small>{formatTime(event.startsAt)}{event.endsAt ? ` a ${formatTime(event.endsAt)}` : ''}</small></span></div><div><Clock3 size={17} /><span><strong>Postulación hasta</strong><small>{formatDate(event.applicationDeadline)}</small></span></div>{event.capacity && <div><TicketCheck size={17} /><span><strong>Puestos disponibles</strong><small>{event.capacity}</small></span></div>}<div><Wallet size={17} /><span><strong>Costo del puesto</strong><small>{event.standFee ? `${formatMoney(event.standFee)} · se paga al ser aprobado` : 'Sin costo'}</small></span></div></div>
          {canLocate(event) ? <div className="market-detail-map"><MapPin size={17} /><div><strong>{isDemoEvent(event) ? 'Ubicación de prueba aproximada' : 'Ubicación en el mapa'}</strong><span>{event.address || `${event.latitude}, ${event.longitude}`}</span></div><a href={googleMapsLink(event.latitude, event.longitude)} target="_blank" rel="noreferrer">Cómo llegar <ExternalLink size={13} /></a></div> : <div className="market-detail-map unavailable"><MapPin size={17} /><div><strong>Ubicación sin coordenadas</strong><span>{event.address || 'La organización no informó una dirección precisa.'}</span></div></div>}
          <section className="market-detail-block"><h3>Sobre el evento</h3><p>{event.description}</p></section>
          {categories.length > 0 && <section className="market-detail-block"><h3>Rubros admitidos</h3><div className="market-tags">{categories.map((category) => <span key={category}>{category}</span>)}</div></section>}
          {event.requirements && <section className="market-detail-block"><h3>Requisitos</h3><p className="market-preserve-lines">{event.requirements}</p></section>}
          {application && <div className="market-application-current"><span>Tu postulación</span><StatusBadge status={application.status} />{application.status === 'APROBADA' && <small>Puesto {application.standLabel || 'a confirmar'} · Armado {application.setupTime ? `${application.setupTime} hs` : 'a confirmar'}</small>}{application.status !== 'BORRADOR' && <button type="button" className="market-text-button" onClick={() => { onClose(); onNavigate('applications'); }}>Ver en Mis postulaciones y mensajes <ArrowRight size={13} /></button>}</div>}
          {canApply && isOpen && (!application || application.status === 'BORRADOR') && <div className="market-apply-block">{!business ? <><div className="market-callout"><BriefcaseBusiness size={17} /><span>Para postularte, primero completá el perfil de tu emprendimiento.</span></div><button className="market-button primary" onClick={() => { onClose(); onNavigate('business'); }}>Ir a Mi emprendimiento <ArrowRight size={15} /></button></> : !showForm ? <button className="market-button primary" onClick={() => setShowForm(true)}><Send size={15} /> Iniciar postulación</button> : <form className="market-application-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}><h3>Postular a este evento</h3><div className="market-profile-summary"><strong>{business.name}</strong><span>{business.category} · {business.locality}</span><small>Usamos los datos guardados de Mi emprendimiento.</small></div><label>¿Qué producto o servicio vas a ofrecer? <b>*</b><input required maxLength={300} value={applicationForm.offeredProduct} onChange={(e) => setApplicationForm({ ...applicationForm, offeredProduct: e.target.value })} placeholder="Ej.: panificados artesanales" /></label><label>Correo de contacto<input type="email" maxLength={120} value={applicationForm.contactEmail ?? business.contactEmail ?? ""} onChange={(e) => setApplicationForm({ ...applicationForm, contactEmail: e.target.value })} placeholder="emprendedor.demo@example.invalid" /></label><label>Teléfono de contacto<input type="tel" maxLength={40} pattern="[+()0-9 .-]{7,40}" value={applicationForm.contactPhone ?? business.contactPhone ?? ""} onChange={(e) => setApplicationForm({ ...applicationForm, contactPhone: e.target.value })} placeholder="0000000000" /></label><small className="market-form-hint">Completá al menos uno. La organización lo usará como contacto; no se envían emails ni SMS.</small><label>Información adicional solicitada por la organización<textarea rows="3" maxLength={2000} value={applicationForm.additionalInfo} onChange={(e) => setApplicationForm({ ...applicationForm, additionalInfo: e.target.value })} placeholder="Opcional" /></label><p className="market-form-hint">Al enviar, la organización podrá revisar los datos del negocio y esta propuesta.</p><div className="market-application-actions"><button type="button" className="market-button outline" onClick={onSaveDraft}><Save size={15} /> Guardar borrador</button><button className="market-button primary"><Send size={15} /> Enviar postulación</button></div>{pageMessage && <InlineMessage type="success">{pageMessage}</InlineMessage>}{pageError && <InlineMessage type="error">{pageError}</InlineMessage>}</form>}</div>}
          {canApply && !isOpen && !application && <div className="market-closed-notice"><CircleAlert size={16} /> Esta convocatoria no está abierta para nuevas postulaciones.</div>}
          {application?.status === 'APROBADA' && business && <><button className="market-button outline market-activity-toggle" onClick={() => setShowActivity(!showActivity)}><Store size={16} /> {showActivity ? 'Ocultar actividad del puesto' : 'Gestionar actividad del evento'} <ChevronDown size={14} /></button>{showActivity && <EventActivity event={event} />}</>}
        </div>
        <div className="market-detail-footer"><span>Información publicada por la persona organizadora.</span><button className="market-close-text" onClick={onClose}>Cerrar</button></div>
      </section>
    </div>
  );
}

