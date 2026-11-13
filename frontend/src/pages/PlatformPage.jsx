import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight, Building2, CalendarDays, Flag, MessageCircle, Search, ShieldCheck, Store, TicketCheck, UserCheck, UserX, Users,
} from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import {
  EmptyState, ErrorState, InlineMessage, LoadingState, PageHeading, Tabs, formatDate,
} from '../components/portal/ui.jsx';
import { MessagesPanel } from '../components/portal/MessagesPanel.jsx';

const ROLE_LABEL = { ADMINISTRADOR: 'Administración', EMPLEADO: 'Personal del comercio', EMPRENDEDOR: 'Emprendedor', ORGANIZADOR: 'Organizador' };

function Kpi({ icon: Icon, label, value, hint, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`kpi-tile ${onClick ? 'link' : ''}`} onClick={onClick}>
      <span className="kpi-icon"><Icon size={17} /></span>
      <div><span>{label}</span><strong>{value ?? '—'}</strong>{hint && <small>{hint}</small>}</div>
    </Tag>
  );
}

/** Inicio de la administración: el estado de la plataforma y lo que hay que atender. */
export function PlatformHome({ onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => apiRequest('/platform/overview').then(setData).catch((err) => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);
  if (error) return <div className="marketplace-page"><ErrorState message={error} onRetry={load} /></div>;
  if (!data) return <div className="marketplace-page"><LoadingState label="Cargando el panel de la plataforma…" /></div>;
  const { users, spaces, events, applications, seats } = data;
  return (
    <div className="marketplace-page">
      <PageHeading kicker="PANEL DE LA PLATAFORMA" title="Que Emprende sea confiable" description="Verificás los espacios, atendés denuncias y cuidás que nadie ofrezca lugares que no le corresponden." />
      <div className="kpi-grid">
        <Kpi icon={ShieldCheck} label="Espacios por verificar" value={spaces.pendientes} hint={`${spaces.verificados} verificados`} onClick={() => onNavigate('verify')} />
        <Kpi icon={Flag} label="Denuncias abiertas" value={data.openReports} onClick={() => onNavigate('reports')} />
        <Kpi icon={Users} label="Emprendedores" value={users.emprendedores} hint={`${users.nuevosUltimoMes} cuentas nuevas en 30 días`} onClick={() => onNavigate('users')} />
        <Kpi icon={Building2} label="Organizadores" value={users.organizadores} onClick={() => onNavigate('users')} />
      </div>
      <div className="kpi-grid">
        <Kpi icon={CalendarDays} label="Convocatorias publicadas" value={events.publicadas} hint={`${events.cerradas} cerradas`} onClick={() => onNavigate('admin')} />
        <Kpi icon={TicketCheck} label="Postulaciones" value={applications.enviadas} hint={applications.tasaAprobacion !== null ? `${applications.tasaAprobacion}% aprobadas` : undefined} />
        <Kpi icon={Store} label="Puestos ocupados" value={seats.total ? `${seats.ocupados}/${seats.total}` : seats.ocupados} hint={seats.ocupacion !== null ? `${seats.ocupacion}% de ocupación en ferias próximas` : undefined} />
        <Kpi icon={UserCheck} label="En lista de espera" value={applications.enEspera} />
      </div>
      <div className="business-overview-grid">
        <section className="market-panel">
          <div className="portal-section-head"><h2>Espacios esperando verificación</h2><button className="market-text-button" onClick={() => onNavigate('verify')}>Ir a verificar <ArrowRight size={14} /></button></div>
          {data.pendingSpaces.length === 0 ? <p className="market-muted">No hay espacios pendientes. ¡Al día!</p> : (
            <ul className="mini-order-list">
              {data.pendingSpaces.map((space) => <li key={space.id}><div><strong>{space.name}</strong><small>{space.owner.name} {space.owner.lastName} · {space.locality} · {space._count.documents} documento(s)</small></div><span className="queue-age">desde {formatDate(space.updatedAt)}</span></li>)}
            </ul>
          )}
        </section>
        <section className="market-panel">
          <div className="portal-section-head"><h2>Últimas verificaciones</h2></div>
          {data.recentReviews.length === 0 ? <p className="market-muted">Todavía no hay revisiones.</p> : (
            <ul className="mini-order-list">
              {data.recentReviews.map((space) => <li key={space.id}><div><strong>{space.name}</strong><small>{space.reviewedBy ? `${space.reviewedBy.name} ${space.reviewedBy.lastName}` : 'Sin dato'} · {formatDate(space.reviewedAt)}</small></div><span className={`market-status status-${space.status.toLowerCase()}`}>{space.status}</span></li>)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const ACTIONS = [
  ['NINGUNA', 'Sin medida (solo registrar)'],
  ['SUSPENDER_USUARIO', 'Suspender la cuenta denunciada'],
  ['SUSPENDER_ESPACIO', 'Suspender el espacio (cierra sus convocatorias)'],
  ['CERRAR_CONVOCATORIA', 'Cerrar la convocatoria'],
];

function ReportCard({ report, onResolved, onOpenChat }) {
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState('NINGUNA');
  const [error, setError] = useState('');
  const { target } = report;
  const resolve = async (status) => {
    setError('');
    try { onResolved((await apiRequest(`/platform/reports/${report.id}`, { method: 'PATCH', body: { status, action: status === 'RESUELTA' ? action : 'NINGUNA', notes } })).message); }
    catch (err) { setError(err.message); }
  };
  return (
    <article className="report-card">
      <div className="report-head">
        <span className="report-icon"><Flag size={16} /></span>
        <div><strong>{report.reasonLabel}</strong><span>{target ? `${target.subtitle} · ${target.title}` : 'El contenido ya no existe'}</span></div>
        <small>{formatDate(report.createdAt)}</small>
      </div>
      {report.details && <p className="report-details">“{report.details}”</p>}
      <dl className="space-card-facts">
        <div><dt>Denunció</dt><dd>{report.reporter.name} {report.reporter.lastName} · {report.reporter.email}</dd></div>
        {target?.user && <div><dt>Persona denunciada</dt><dd>{target.user.name} {target.user.lastName}{target.user.status === false ? ' (suspendida)' : ''}</dd></div>}
        {target?.space && <div><dt>Espacio</dt><dd>{target.space.name} · {target.space.status}</dd></div>}
      </dl>
      {target?.applicationId && <button type="button" className="market-button outline small" onClick={() => onOpenChat(target.applicationId)}><MessageCircle size={14} /> Leer la conversación</button>}
      {report.status === 'ABIERTA' ? (
        <div className="space-review-actions">
          <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Medida">
            {ACTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <textarea rows="2" maxLength={1500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Qué revisaste y qué decidiste (se le informa a quien denunció)" />
          <div>
            <button type="button" className="market-button primary small" onClick={() => resolve('RESUELTA')}>Resolver</button>
            <button type="button" className="market-button outline small" onClick={() => resolve('DESCARTADA')}>Descartar</button>
          </div>
          {error && <InlineMessage type="error">{error}</InlineMessage>}
        </div>
      ) : (
        <p className="application-review-note"><b>{report.status === 'RESUELTA' ? 'Resuelta' : 'Descartada'}</b> por {report.resolvedBy ? `${report.resolvedBy.name} ${report.resolvedBy.lastName}` : '—'} · {formatDate(report.resolvedAt)}: {report.resolutionNotes}</p>
      )}
    </article>
  );
}

export function ReportsPage() {
  const [status, setStatus] = useState('ABIERTA');
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState(null);
  const load = useCallback(async () => {
    setError('');
    try { setReports((await apiRequest(`/platform/reports?status=${status}`)).reports); }
    catch (err) { setError(err.message); }
  }, [status]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="marketplace-page">
      <PageHeading kicker="PANEL DE LA PLATAFORMA" title="Denuncias" description="Lo que reportan emprendedores y organizadores: espacios ajenos, cobros indebidos, datos falsos o malos tratos." />
      <Tabs active={status} onChange={(next) => { setStatus(next); setMessage(''); setReports(null); }} tabs={[['ABIERTA', 'Abiertas'], ['RESUELTA', 'Resueltas'], ['DESCARTADA', 'Descartadas']]} />
      {message && <InlineMessage type="success">{message}</InlineMessage>}
      {error ? <ErrorState message={error} onRetry={load} /> : !reports ? <LoadingState label="Cargando denuncias…" /> : reports.length === 0 ? (
        <EmptyState icon={Flag} title="No hay denuncias acá" text="Cuando alguien denuncie una convocatoria, una conversación o un espacio, aparece en Abiertas." />
      ) : <div className="spaces-review-list">{reports.map((report) => <ReportCard key={report.id} report={report} onResolved={(text) => { setMessage(text); load(); }} onOpenChat={setChat} />)}</div>}
      {chat && <MessagesPanel applicationId={chat} onClose={() => setChat(null)} />}
    </div>
  );
}

export function PlatformUsersPage({ currentUserId }) {
  const [filters, setFilters] = useState({ search: '', role: '' });
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setError('');
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    try { setUsers(await apiRequest(`/platform/users${query.size ? `?${query}` : ''}`)); }
    catch (err) { setError(err.message); }
  }, [filters]);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);

  const update = async (user, body, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError('');
    try { setMessage((await apiRequest(`/platform/users/${user.id}`, { method: 'PATCH', body })).message); load(); }
    catch (err) { setError(err.message); }
  };

  return (
    <div className="marketplace-page">
      <PageHeading kicker="PANEL DE LA PLATAFORMA" title="Usuarios" description="Buscá cuentas, cambiá su rol o suspendé a quien no cumpla las reglas." />
      <div className="portal-toolbar">
        <label className="search-field"><Search size={15} /><input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Nombre, usuario o correo" /></label>
        <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })} aria-label="Filtrar por rol">
          <option value="">Todos los roles</option>{Object.entries(ROLE_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      {message && <InlineMessage type="success">{message}</InlineMessage>}
      {error && <InlineMessage type="error">{error}</InlineMessage>}
      {!users ? <LoadingState label="Cargando usuarios…" /> : users.length === 0 ? <EmptyState icon={Users} title="Sin resultados" text="Probá con otra búsqueda." /> : (
        <div className="users-table">
          {users.map((user) => (
            <article key={user.id} className={`user-row ${user.status ? '' : 'suspended'}`}>
              <span className="received-avatar">{user.name[0]}</span>
              <div className="user-main">
                <strong>{user.name} {user.lastName}{!user.status && <span className="market-status status-suspendido">Suspendida</span>}{user.openReports > 0 && <span className="market-status status-rechazado">{user.openReports} denuncia(s)</span>}</strong>
                <small>{user.email} · @{user.username}{user.withGoogle ? ' · Google' : ''} · alta {formatDate(user.createdAt)}</small>
                <small>{user.businessProfile ? `${user.businessProfile.name} (${user.businessProfile.category}) · ` : ''}{user._count.eventApplications} postulaciones · {user._count.spaces} espacios · {user._count.organizedEvents} convocatorias</small>
              </div>
              <select value={user.role} disabled={user.id === currentUserId} onChange={(e) => update(user, { role: e.target.value }, `¿Cambiar el rol de ${user.name} a ${ROLE_LABEL[e.target.value]}?`)} aria-label={`Rol de ${user.name}`}>
                {Object.entries(ROLE_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              {user.id !== currentUserId && (user.status
                ? <button type="button" className="market-button ghost small" onClick={() => update(user, { status: false }, `¿Suspender la cuenta de ${user.name}? No va a poder ingresar.`)}><UserX size={14} /> Suspender</button>
                : <button type="button" className="market-button outline small" onClick={() => update(user, { status: true })}><UserCheck size={14} /> Reactivar</button>)}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
