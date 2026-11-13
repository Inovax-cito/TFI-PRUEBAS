import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Bot, Download, Eye, FileText, Hourglass, LayoutGrid, MessageCircle, Plus, Printer, ShieldCheck, TicketCheck, X,
} from 'lucide-react';
import { apiRequest, fileUrl, openPrivateFile } from '../utils/api.js';
import { LocationPicker } from '../components/maps/index.jsx';
import {
  EmptyState, ErrorState, InlineMessage, LoadingState, PAYMENT_LABEL, PageHeading, RatingBadge, STATUS_LABEL, Stars,
  StatusBadge, Tabs, formatDate, formatMoney, formatTime,
} from '../components/portal/ui.jsx';
import { MessagesPanel } from '../components/portal/MessagesPanel.jsx';
import { BusinessPreview } from '../components/portal/BusinessPreview.jsx';
import { StandPlanEditor, StandPlanView } from '../components/portal/StandPlan.jsx';
import { AttendanceModal, OrganizerIncomeTab } from './OrganizerIncomeTab.jsx';

const LOCALITIES = ['Banda del Río Salí', 'Cruz Alta', 'Alderetes'];
export const DEFAULT_APPROVAL = '¡Hola {nombre}! {emprendimiento} quedó aprobado para {feria} ({fecha}).\nTu puesto: {puesto}. Armado: {hora_armado}.\nDirección: {direccion}.\nCualquier duda escribime por acá.';
export const DEFAULT_REJECTION = 'Hola {nombre}, gracias por postularte a {feria}. Esta vez no pudimos sumarte, pero te esperamos en las próximas convocatorias.';
const VARIABLES = ['nombre', 'emprendimiento', 'feria', 'fecha', 'hora_inicio', 'direccion', 'puesto', 'hora_armado', 'costo'];
const emptyEvent = {
  name: '', locality: LOCALITIES[0], address: '', latitude: '', longitude: '', startsAt: '', endsAt: '', applicationDeadline: '',
  description: '', acceptedCategories: '', requirements: '', capacity: '', status: 'BORRADOR', spaceId: '', standFee: '',
  approvalMessage: DEFAULT_APPROVAL, rejectionMessage: DEFAULT_REJECTION,
};
const naturalLabel = (a, b) => String(a.standLabel || '~').localeCompare(String(b.standLabel || '~'), 'es', { numeric: true });

// ---------- Lista de puestos: Excel (CSV) e impresión ----------
const standRows = (applications) => applications.filter((item) => item.status === 'APROBADA').sort(naturalLabel).map((item) => ({
  Puesto: item.standLabel || '', Armado: item.setupTime || '', Emprendimiento: item.business.name, Rubro: item.business.category,
  Responsable: `${item.applicant.name} ${item.applicant.lastName}`, Teléfono: item.business.contactPhone || '', Correo: item.business.contactEmail || item.applicant.email,
  Ofrece: item.offeredProduct, Pago: PAYMENT_LABEL[item.paymentStatus] || '',
}));

const downloadCsv = (event, applications) => {
  const rows = standRows(applications);
  const headers = Object.keys(rows[0] || { Puesto: '', Emprendimiento: '' });
  const cell = (value) => `"${String(value).replace(/"/g, '""')}"`;
  // Punto y coma + BOM: Excel en español lo abre en columnas y con acentos.
  const csv = `﻿${[headers.map(cell).join(';'), ...rows.map((row) => headers.map((header) => cell(row[header])).join(';'))].join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `puestos-${event.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const printList = (event, applications) => {
  const rows = standRows(applications);
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  const headers = ['Puesto', 'Armado', 'Emprendimiento', 'Rubro', 'Responsable', 'Teléfono', 'Pago'];
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Puestos · ${escapeHtml(event.name)}</title>
    <style>body{font-family:Inter,Arial,sans-serif;color:#132344;margin:28px}h1{font-size:20px;margin:0}p{color:#64748b;margin:4px 0 18px}
    table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dfe5eb;padding:7px 8px;text-align:left}th{background:#f2f7f7}
    td:first-child{font-weight:700;width:60px}.firma{width:120px}@media print{body{margin:10mm}}</style></head><body>
    <h1>${escapeHtml(event.name)}</h1><p>${escapeHtml(formatDate(event.startsAt))} · ${escapeHtml(formatTime(event.startsAt))} a ${escapeHtml(formatTime(event.endsAt))} hs · ${rows.length} puestos</p>
    <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}<th class="firma">Presente</th></tr></thead><tbody>
    ${rows.map((row) => `<tr>${headers.map((h) => `<td>${escapeHtml(row[h])}</td>`).join('')}<td></td></tr>`).join('') || '<tr><td colspan="8">Todavía no hay postulaciones aprobadas.</td></tr>'}
    </tbody></table></body></html>`);
  win.document.close();
  win.focus();
  win.print();
};

// ---------- Mensajes automáticos ----------
function TemplateFields({ value, onChange }) {
  return (
    <div className="template-fields">
      <p className="portal-hint"><Bot size={14} /> Se envían solos al aprobar o rechazar. Podés usar: {VARIABLES.map((variable) => <code key={variable}>{`{${variable}}`}</code>)}</p>
      <label>Mensaje para aprobados<textarea rows="4" maxLength={2000} value={value.approvalMessage ?? ''} onChange={(e) => onChange({ ...value, approvalMessage: e.target.value })} /></label>
      <label>Mensaje para no seleccionados<textarea rows="3" maxLength={2000} value={value.rejectionMessage ?? ''} onChange={(e) => onChange({ ...value, rejectionMessage: e.target.value })} /></label>
    </div>
  );
}

function TemplateEditor({ event, onSaved, onCancel }) {
  const [value, setValue] = useState({ approvalMessage: event.approvalMessage || DEFAULT_APPROVAL, rejectionMessage: event.rejectionMessage || DEFAULT_REJECTION });
  const [error, setError] = useState('');
  const save = async () => {
    try { await apiRequest(`/marketplace/events/${event.id}`, { method: 'PUT', body: value }); onSaved('Mensajes automáticos guardados.'); }
    catch (err) { setError(err.message); }
  };
  return (
    <div className="event-inline-panel">
      <TemplateFields value={value} onChange={setValue} />
      {error && <InlineMessage type="error">{error}</InlineMessage>}
      <div className="plan-actions"><button type="button" className="market-button outline" onClick={onCancel}>Cancelar</button><button type="button" className="market-button primary" onClick={save}>Guardar mensajes</button></div>
    </div>
  );
}

// ---------- Plano: edición y asignación ----------
function PlanModal({ event, applications, onClose, onChanged }) {
  const approved = applications.filter((item) => item.eventId === event.id && item.status === 'APROBADA');
  const [mode, setMode] = useState(event.standPlan ? 'assign' : 'edit');
  const [plan, setPlan] = useState(event.standPlan);
  const [selectedApp, setSelectedApp] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [assignments, setAssignments] = useState(() => Object.fromEntries(approved.filter((item) => item.standLabel).map((item) => [item.standLabel, item.business.name])));

  const savePlan = async (next) => {
    setBusy(true); setError('');
    try {
      const result = await apiRequest(`/participation/events/${event.id}/plan`, { method: 'PUT', body: { standPlan: next } });
      setPlan(result.standPlan); setMode('assign'); onChanged('Plano guardado.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const assign = async (x, y, item) => {
    if (item?.kind !== 'stand') return;
    if (!selectedApp) { setError('Elegí primero un emprendimiento de la lista.'); return; }
    if (assignments[item.label] && assignments[item.label] !== selectedApp.business.name) { setError(`El puesto ${item.label} ya está ocupado.`); return; }
    setError('');
    try {
      await apiRequest(`/participation/${selectedApp.id}/stand`, { method: 'PATCH', body: { standLabel: item.label } });
      setAssignments((current) => {
        const next = Object.fromEntries(Object.entries(current).filter(([, name]) => name !== selectedApp.business.name));
        next[item.label] = selectedApp.business.name;
        return next;
      });
      setSelectedApp(null);
      onChanged(`Puesto ${item.label} asignado. Le avisamos al emprendedor por mensaje.`, false);
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="messages-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="plan-modal" role="dialog" aria-modal="true" aria-label="Plano de puestos">
        <header><div><span className="market-kicker">PLANO DE PUESTOS</span><h2>{event.name}</h2></div><button type="button" className="market-close-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header>
        <Tabs active={mode} onChange={setMode} tabs={[['edit', 'Dibujar plano'], ...(plan ? [['assign', 'Asignar puestos']] : [])]} />
        {mode === 'edit' ? <StandPlanEditor initialPlan={plan} capacity={event.capacity} onSave={savePlan} busy={busy} /> : (
          <div className="plan-assign">
            <aside>
              <p className="portal-hint">1. Elegí un emprendimiento · 2. Tocá su puesto en el plano.</p>
              {approved.length === 0 ? <p className="market-muted">Todavía no hay postulaciones aprobadas.</p> : approved.sort(naturalLabel).map((item) => (
                <button key={item.id} type="button" className={`plan-assign-item ${selectedApp?.id === item.id ? 'active' : ''}`} onClick={() => setSelectedApp(item)}>
                  <strong>{item.business.name}</strong><small>{Object.entries(assignments).find(([, name]) => name === item.business.name)?.[0] ? `Puesto ${Object.entries(assignments).find(([, name]) => name === item.business.name)[0]}` : 'Sin puesto'}</small>
                </button>
              ))}
            </aside>
            <StandPlanView plan={plan} assignments={assignments} onCellClick={assign} />
          </div>
        )}
        {error && <InlineMessage type="error">{error}</InlineMessage>}
      </section>
    </div>
  );
}

// ---------- Tarjeta de postulación recibida ----------
function ReceivedApplication({ application, plan, onChanged, onMessages, onPreview, highlighted }) {
  const [notes, setNotes] = useState('');
  const [stand, setStand] = useState({ standLabel: application.standLabel || '', setupTime: application.setupTime || '' });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const isApproved = application.status === 'APROBADA';
  const reviewable = ['ENVIADA', 'EN_REVISION', 'LISTA_ESPERA'].includes(application.status);
  const eventEnded = new Date(application.event.endsAt) < new Date();
  const labels = plan?.stands?.map((item) => item.label) || [];

  const act = async (fn) => { setError(''); try { onChanged(await fn()); } catch (err) { setError(err.message); } };
  const setStatus = (status) => act(async () => {
    const body = { status, reviewNotes: notes, ...(status === 'APROBADA' ? stand : {}) };
    const result = await apiRequest(`/marketplace/admin/applications/${application.id}/status`, { method: 'PATCH', body });
    setNotes('');
    return result.message;
  });
  const saveStand = () => act(async () => (await apiRequest(`/participation/${application.id}/stand`, { method: 'PATCH', body: stand })).message);
  const reviewPayment = (status) => act(async () => {
    const paymentNotes = status === 'RECHAZADO' ? window.prompt('¿Por qué rechazás el pago?') : '';
    if (status === 'RECHAZADO' && !paymentNotes) throw new Error('Escribí el motivo del rechazo.');
    return (await apiRequest(`/participation/${application.id}/payment`, { method: 'PATCH', body: { status, notes: paymentNotes } })).message;
  });
  const sendReview = () => act(async () => {
    if (!rating) throw new Error('Elegí de 1 a 5 estrellas.');
    return (await apiRequest(`/participation/${application.id}/review`, { method: 'POST', body: { rating, comment } })).message;
  });

  return (
    <article id={`postulacion-${application.id}`} className={`received-card status-${application.status.toLowerCase()} ${highlighted ? 'highlighted' : ''}`}>
      <div className="received-head">
        {application.business.photos?.[0] ? <img src={fileUrl(application.business.photos[0])} alt="" /> : <span className="received-avatar">{application.business.name[0]}</span>}
        <div>
          <strong>{application.business.name}</strong>
          <span>{application.business.category} · {application.business.locality} · <RatingBadge rating={application.business.rating} /></span>
        </div>
        <StatusBadge status={application.status} />
      </div>
      <p className="received-offer"><b>Ofrece:</b> {application.offeredProduct}</p>
      {application.additionalInfo && <p className="received-extra">{application.additionalInfo}</p>}
      {application.status === 'LISTA_ESPERA' && <p className="waitlist-chip"><Hourglass size={14} /> {application.waitlistPosition}° en la lista de espera. Entra solo si se libera un puesto.</p>}
      <small className="received-meta">Postuló {application.applicant.name} {application.applicant.lastName} · {formatDate(application.createdAt)}</small>

      <div className="received-tools">
        <button type="button" className="market-button outline small" onClick={() => onPreview(application.business)}><Eye size={14} /> Ver emprendimiento</button>
        <button type="button" className="market-button outline small" onClick={() => onMessages(application)}><MessageCircle size={14} /> Mensajes{application.unreadMessages > 0 && <span className="unread-pill">{application.unreadMessages}</span>}</button>
      </div>

      {(reviewable || isApproved) && (
        <div className="stand-inputs">
          <label>Puesto
            {labels.length ? (
              <select value={stand.standLabel} onChange={(e) => setStand({ ...stand, standLabel: e.target.value })}><option value="">Sin asignar</option>{labels.map((label) => <option key={label} value={label}>{label}</option>)}</select>
            ) : <input maxLength={20} value={stand.standLabel} onChange={(e) => setStand({ ...stand, standLabel: e.target.value })} placeholder="Ej.: 4 o Sector B" />}
          </label>
          <label>Hora de armado<input type="time" value={stand.setupTime} onChange={(e) => setStand({ ...stand, setupTime: e.target.value })} /></label>
          {isApproved && <button type="button" className="market-button outline small" onClick={saveStand}>Guardar puesto</button>}
        </div>
      )}

      {isApproved && application.paymentStatus !== 'NO_APLICA' && (
        <div className={`payment-box compact status-${application.paymentStatus.toLowerCase()}`}>
          <div className="payment-head"><TicketCheck size={15} /><div><strong>{PAYMENT_LABEL[application.paymentStatus]}</strong><small>{formatMoney(application.event.standFee)}{application.paymentReference ? ` · ${application.paymentReference}` : ''}</small></div></div>
          <div className="payment-actions">
            {application.paymentReceiptUploadId && <button type="button" className="market-text-button" onClick={() => openPrivateFile(application.paymentReceiptUploadId).catch((err) => setError(err.message))}><FileText size={13} /> Ver comprobante</button>}
            {['INFORMADO', 'PENDIENTE'].includes(application.paymentStatus) && <button type="button" className="market-button primary small" onClick={() => reviewPayment('CONFIRMADO')}>{application.paymentStatus === 'PENDIENTE' ? 'Registrar pago recibido' : 'Confirmar pago'}</button>}
            {application.paymentStatus === 'INFORMADO' && <button type="button" className="market-button ghost small" onClick={() => reviewPayment('RECHAZADO')}>Rechazar</button>}
          </div>
        </div>
      )}

      {reviewable && (
        <>
          <textarea className="review-notes" rows="2" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Comentario para el emprendedor (opcional, se envía como mensaje)" />
          <div className="market-admin-app-actions">
            {application.status === 'ENVIADA' && <button className="market-button outline small" onClick={() => setStatus('EN_REVISION')}>En revisión</button>}
            <button className="market-button primary small" onClick={() => setStatus('APROBADA')}>Aprobar</button>
            {application.status !== 'LISTA_ESPERA' && <button className="market-button outline small" onClick={() => setStatus('LISTA_ESPERA')}><Hourglass size={13} /> Lista de espera</button>}
            <button className="market-button danger small" onClick={() => setStatus('NO_SELECCIONADA')}>No seleccionada</button>
          </div>
        </>
      )}
      {isApproved && !eventEnded && <button type="button" className="market-text-button danger-text" onClick={() => { if (window.confirm('¿Quitar a este emprendimiento de la feria? Su lugar pasa al primero de la lista de espera.')) setStatus('NO_SELECCIONADA'); }}>Quitar de la feria</button>}
      {isApproved && eventEnded && (application.myReview ? <p className="review-done">Lo calificaste: <Stars value={application.myReview.rating} size={14} /></p> : (
        <div className="review-box">
          <strong>¿Cómo fue su participación?</strong>
          <Stars value={rating} onChange={setRating} size={20} label="Calificación" />
          <textarea rows="2" maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Puntualidad, presentación del puesto, trato… (opcional)" />
          <button type="button" className="market-button primary small" onClick={sendReview}>Calificar</button>
        </div>
      ))}
      {error && <InlineMessage type="error">{error}</InlineMessage>}
    </article>
  );
}

// ---------- Página ----------
export function OrganizerEventsPage({ isAdmin, isOrganizer, navigate, focus, onFocusHandled }) {
  const [tab, setTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyEvent);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [templatesFor, setTemplatesFor] = useState(null);
  const [planFor, setPlanFor] = useState(null);
  const [chat, setChat] = useState(null);
  const [preview, setPreview] = useState(null);
  const [attendanceFor, setAttendanceFor] = useState(null);
  const [filters, setFilters] = useState({ eventId: '', status: 'PENDIENTES' });
  const [highlight, setHighlight] = useState(null);
  const [loadCount, setLoadCount] = useState(0);
  const [pendingFocus, setPendingFocus] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [eventList, spaceList, received] = await Promise.all([
        apiRequest(isOrganizer ? '/marketplace/events?mine=1' : '/marketplace/events'),
        apiRequest('/spaces/mine').catch(() => []),
        apiRequest('/marketplace/admin/applications'),
      ]);
      setEvents(eventList); setSpaces(spaceList); setApplications(received); setLoadCount((count) => count + 1);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [isOrganizer]);
  useEffect(() => { load(); }, [load]);

  // Llegada desde un aviso: se recargan los datos (puede ser algo recién creado) y después se abre.
  useEffect(() => {
    if (!focus) return;
    setPendingFocus({ ...focus, afterLoad: loadCount });
    onFocusHandled?.();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);
  useEffect(() => {
    if (!pendingFocus || loadCount <= pendingFocus.afterLoad) return;
    const focusTarget = pendingFocus;
    setPendingFocus(null);
    const target = applications.find((item) => item.id === focusTarget.applicationId);
    if (target) {
      setTab('applications');
      setFilters({ eventId: String(target.eventId), status: '' });
      setHighlight(target.id);
      if (focusTarget.chat) setChat(target);
      setTimeout(() => document.getElementById(`postulacion-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
      setTimeout(() => setHighlight(null), 4000);
    }
  }, [pendingFocus, loadCount, applications]);

  const changed = (text, reload = true) => { if (text) setMessage(text); if (reload) load(); };
  const verifiedSpaces = spaces.filter((space) => space.status === 'VERIFICADO');
  const selectedSpace = verifiedSpaces.find((space) => String(space.id) === String(form.spaceId));
  const canCreate = isAdmin || verifiedSpaces.length > 0;
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const pendingCount = applications.filter((item) => ['ENVIADA', 'EN_REVISION'].includes(item.status)).length;
  const unreadCount = applications.reduce((sum, item) => sum + (item.unreadMessages || 0), 0);

  const visibleApplications = useMemo(() => applications.filter((item) => {
    if (filters.eventId && String(item.eventId) !== String(filters.eventId)) return false;
    if (filters.status === 'PENDIENTES') return ['ENVIADA', 'EN_REVISION', 'LISTA_ESPERA'].includes(item.status) || item.unreadMessages > 0;
    if (filters.status) return item.status === filters.status;
    return true;
  }), [applications, filters]);

  const createEvent = async (event) => {
    event.preventDefault(); setBusy(true); setFormError('');
    try {
      const result = await apiRequest('/marketplace/events', { method: 'POST', body: form });
      setMessage(result.event?.status === 'PUBLICADA' ? 'Convocatoria publicada. Avisamos a los emprendedores de la zona.' : 'Convocatoria guardada como borrador.');
      setForm(emptyEvent); setFormOpen(false); load();
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  };
  const updateStatus = async (event, status) => {
    try { await apiRequest(`/marketplace/events/${event.id}`, { method: 'PUT', body: { status } }); changed(`Convocatoria ${STATUS_LABEL[status].toLowerCase()}.`); }
    catch (err) { setError(err.message); }
  };

  if (loading) return <div className="marketplace-page"><LoadingState label="Cargando tus convocatorias…" /></div>;

  return (
    <div className="marketplace-page">
      <PageHeading
        kicker={isAdmin ? 'ADMINISTRACIÓN DE LA PLATAFORMA' : 'MIS CONVOCATORIAS'}
        title="Convocatorias y postulaciones"
        description="Publicá en tus espacios verificados, elegí a los emprendedores y coordiná con cada uno."
        action={tab === 'events' && canCreate && !formOpen && <button className="market-button primary" onClick={() => setFormOpen(true)}><Plus size={16} /> Nueva convocatoria</button>}
      />
      <Tabs active={tab} onChange={(next) => { setTab(next); setMessage(''); }} tabs={[['events', 'Convocatorias'], ['applications', 'Postulaciones', (pendingCount + unreadCount) || null], ['income', 'Ingresos']]} />
      {message && <InlineMessage type="success">{message}</InlineMessage>}
      {error && <ErrorState message={error} onRetry={load} />}

      {tab === 'events' ? <>
        {!canCreate && <EmptyState icon={ShieldCheck} title="Necesitás un espacio verificado" text={spaces.length ? 'Tu espacio está en revisión. Cuando se verifique vas a poder publicar.' : 'Registrá el espacio que administrás y subí la documentación que acredita que podés usarlo.'} action={<button className="market-button primary" onClick={() => navigate('spaces')}>Ir a Mis espacios <ArrowRight size={15} /></button>} />}
        {formOpen && (
          <form className="market-panel market-admin-form portal-form" onSubmit={createEvent}>
            <div className="portal-form-head"><h2>Nueva convocatoria</h2><button type="button" className="market-close-button" onClick={() => setFormOpen(false)} aria-label="Cerrar"><X size={18} /></button></div>
            <fieldset><legend>1. Dónde y cuándo</legend>
              <div className="market-form-grid">
                <label className="wide">Espacio {!isAdmin && <b>*</b>}
                  <select required={!isAdmin} value={form.spaceId} onChange={set('spaceId')}>
                    <option value="">{isAdmin ? 'Sin espacio (ubicación manual)' : 'Elegí un espacio verificado'}</option>
                    {verifiedSpaces.map((space) => <option key={space.id} value={space.id}>{space.name} · {space.locality}</option>)}
                  </select>
                </label>
                {selectedSpace ? <p className="wide portal-hint"><ShieldCheck size={14} /> Ubicación del espacio verificado: {selectedSpace.address}.{selectedSpace.capacity ? ` Admite hasta ${selectedSpace.capacity} puestos.` : ''}</p> : isAdmin && <>
                  <label>Localidad <b>*</b><select value={form.locality} onChange={set('locality')}>{LOCALITIES.map((locality) => <option key={locality}>{locality}</option>)}</select></label>
                  <label>Dirección<input maxLength={180} value={form.address} onChange={set('address')} /></label>
                  <div className="wide"><LocationPicker value={{ latitude: form.latitude, longitude: form.longitude }} locality={form.locality} onChange={(point) => setForm((current) => ({ ...current, ...point }))} /></div>
                </>}
                <label>Inicio <b>*</b><input required type="datetime-local" value={form.startsAt} onChange={set('startsAt')} /></label>
                <label>Fin <b>*</b><input required type="datetime-local" value={form.endsAt} onChange={set('endsAt')} /></label>
                <label>Cierre de postulaciones <b>*</b><input required type="datetime-local" value={form.applicationDeadline} onChange={set('applicationDeadline')} /></label>
                <label>Puestos<input type="number" min="1" step="1" max={selectedSpace?.capacity || undefined} value={form.capacity} onChange={set('capacity')} placeholder="Opcional" /></label>
              </div>
            </fieldset>
            <fieldset><legend>2. La convocatoria</legend>
              <div className="market-form-grid">
                <label>Nombre <b>*</b><input required maxLength={160} value={form.name} onChange={set('name')} placeholder="Ej.: Feria de diseño de primavera" /></label>
                <label>Rubros admitidos<input value={form.acceptedCategories} onChange={set('acceptedCategories')} placeholder="Separados por coma; vacío = todos" /></label>
                <label>Costo del puesto<input type="number" min="0" step="0.01" value={form.standFee} onChange={set('standFee')} placeholder="Vacío = sin costo" /></label>
                <label>Estado<select value={form.status} onChange={set('status')}><option value="BORRADOR">Borrador</option><option value="PUBLICADA">Publicada</option></select></label>
                <label className="wide">Descripción <b>*</b><textarea required rows="3" maxLength={2000} value={form.description} onChange={set('description')} /></label>
                <label className="wide">Requisitos<textarea rows="3" maxLength={2000} value={form.requirements} onChange={set('requirements')} placeholder="Ej.: gazebo propio, monotributo al día, carnet de manipulación de alimentos." /></label>
              </div>
            </fieldset>
            <fieldset><legend>3. Mensajes automáticos</legend><TemplateFields value={form} onChange={setForm} /></fieldset>
            {formError && <InlineMessage type="error">{formError}</InlineMessage>}
            <div className="market-form-footer"><span>El pago del puesto se simula: no se cobra dinero real.</span><button className="market-button primary" disabled={busy}><Plus size={15} /> {busy ? 'Guardando…' : 'Crear convocatoria'}</button></div>
          </form>
        )}
        <section className="market-admin-section">
          <h2>{isAdmin ? 'Convocatorias del sistema' : 'Tus convocatorias'}</h2>
          {events.length === 0 ? <p className="market-muted">Todavía no hay convocatorias.</p> : (
            <div className="organizer-event-list">
              {events.map((event) => {
                const eventApps = applications.filter((item) => item.eventId === event.id);
                const approved = eventApps.filter((item) => item.status === 'APROBADA').length;
                const pending = eventApps.filter((item) => ['ENVIADA', 'EN_REVISION'].includes(item.status)).length;
                return (
                  <article key={event.id} className="organizer-event">
                    <div className="organizer-event-main">
                      <div><strong>{event.name}</strong><span>{event.space?.name ? `${event.space.name} · ` : ''}{formatDate(event.startsAt)} · {formatTime(event.startsAt)} hs</span></div>
                      <StatusBadge status={event.status} />
                      <select aria-label={`Estado de ${event.name}`} value={event.status} onChange={(e) => updateStatus(event, e.target.value)}><option value="BORRADOR">Borrador</option><option value="PUBLICADA">Publicada</option><option value="CERRADA">Cerrada</option></select>
                    </div>
                    <div className="organizer-event-stats">
                      <span><b>{approved}</b>{event.capacity ? `/${event.capacity}` : ''} aprobados</span>
                      <span><b>{pending}</b> por revisar</span>
                      <span><b>{eventApps.filter((item) => item.status === 'LISTA_ESPERA').length}</b> en espera</span>
                      {event.standFee ? <span>Puesto {formatMoney(event.standFee)}</span> : <span>Sin costo</span>}
                    </div>
                    <div className="organizer-event-actions">
                      <button type="button" className="market-button outline small" onClick={() => { setFilters({ eventId: String(event.id), status: '' }); setTab('applications'); }}><TicketCheck size={14} /> Postulaciones</button>
                      <button type="button" className="market-button outline small" onClick={() => setPlanFor(event)}><LayoutGrid size={14} /> {event.standPlan ? 'Plano' : 'Armar plano'}</button>
                      <button type="button" className="market-button outline small" onClick={() => setTemplatesFor(templatesFor === event.id ? null : event.id)}><Bot size={14} /> Mensajes automáticos</button>
                      <button type="button" className="market-button outline small" onClick={() => printList(event, eventApps)}><Printer size={14} /> Imprimir</button>
                      <button type="button" className="market-button outline small" onClick={() => downloadCsv(event, eventApps)}><Download size={14} /> Excel</button>
                    </div>
                    {templatesFor === event.id && <TemplateEditor event={event} onCancel={() => setTemplatesFor(null)} onSaved={(text) => { setTemplatesFor(null); changed(text); }} />}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </> : tab === 'applications' ? (
        <section className="market-admin-section">
          <div className="portal-toolbar">
            <select value={filters.eventId} onChange={(e) => setFilters({ ...filters, eventId: e.target.value })} aria-label="Filtrar por convocatoria">
              <option value="">Todas las convocatorias</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} aria-label="Filtrar por estado">
              <option value="PENDIENTES">Para atender</option><option value="">Todas</option><option value="APROBADA">Aprobadas</option>
              <option value="LISTA_ESPERA">Lista de espera</option><option value="NO_SELECCIONADA">No seleccionadas</option><option value="CANCELADA">Se dieron de baja</option>
            </select>
          </div>
          {visibleApplications.length === 0 ? <EmptyState icon={TicketCheck} title="No hay postulaciones con estos filtros" text="Cuando un emprendimiento se postule o te escriba, aparece en Para atender." /> : (
            <div className="received-grid">
              {visibleApplications.map((application) => (
                <ReceivedApplication
                  key={`${application.id}-${application.status}-${application.standLabel}`}
                  application={application}
                  plan={events.find((event) => event.id === application.eventId)?.standPlan}
                  onChanged={changed}
                  onMessages={setChat}
                  onPreview={setPreview}
                  highlighted={highlight === application.id}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <OrganizerIncomeTab
          onOpenApplications={(eventId) => { setFilters({ eventId: String(eventId), status: 'APROBADA' }); setTab('applications'); }}
          onAttendance={setAttendanceFor}
        />
      )}
      {attendanceFor && <AttendanceModal event={attendanceFor} applications={applications} onClose={() => { setAttendanceFor(null); load(); }} />}
      {planFor && <PlanModal event={planFor} applications={applications} onClose={() => { setPlanFor(null); load(); }} onChanged={changed} />}
      {chat && <MessagesPanel applicationId={chat.id} onClose={() => { setChat(null); load(); }} />}
      {preview && <BusinessPreview business={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

export default OrganizerEventsPage;
