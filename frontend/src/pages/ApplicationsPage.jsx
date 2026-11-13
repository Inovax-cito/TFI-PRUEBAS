import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, CalendarPlus, Clock3, CreditCard, Download, ExternalLink, FileUp, Hourglass, LayoutGrid, MapPin,
  MessageCircle, TicketCheck, UserMinus,
} from 'lucide-react';
import { apiRequest, apiUpload, fileUrl } from '../utils/api.js';
import { googleMapsLink } from '../components/maps/index.jsx';
import {
  EmptyState, ErrorState, InlineMessage, LoadingState, PAYMENT_LABEL, PAYMENT_METHOD_LABEL, PageHeading, RatingBadge,
  Stars, StatusBadge, Tabs, formatDate, formatMoney, formatTime,
} from '../components/portal/ui.jsx';
import { MessagesPanel } from '../components/portal/MessagesPanel.jsx';
import { PlanLegend, StandPlanView } from '../components/portal/StandPlan.jsx';

const ended = (event) => new Date(event.endsAt) < new Date();
const started = (event) => new Date(event.startsAt) <= new Date();

// ---------- Calendario: Google Calendar y archivo .ics ----------
const calendarDate = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const eventDetails = (application) => [
  application.standLabel && `Puesto: ${application.standLabel}`,
  application.setupTime && `Armado: ${application.setupTime} hs`,
  `Emprendimiento: ${application.business.name}`,
  'Organizado a través de Emprende',
].filter(Boolean).join('\n');
const googleCalendarLink = (application) => {
  const { event } = application;
  const params = new URLSearchParams({
    action: 'TEMPLATE', text: event.name, dates: `${calendarDate(event.startsAt)}/${calendarDate(event.endsAt)}`,
    location: [event.space?.name, event.address, event.locality].filter(Boolean).join(', '), details: eventDetails(application),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
};
const icsEscape = (text) => String(text).replace(/\\/g, '\\\\').replace(/[,;]/g, (char) => `\\${char}`).replace(/\n/g, '\\n');
const downloadIcs = (application) => {
  const { event } = application;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Emprende//Ferias//ES', 'BEGIN:VEVENT',
    `UID:emprende-postulacion-${application.id}@emprende`, `DTSTAMP:${calendarDate(new Date())}`,
    `DTSTART:${calendarDate(event.startsAt)}`, `DTEND:${calendarDate(event.endsAt)}`,
    `SUMMARY:${icsEscape(event.name)}`, `LOCATION:${icsEscape([event.space?.name, event.address, event.locality].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${icsEscape(eventDetails(application))}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Mañana tenés feria', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `${event.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

// ---------- Pago simulado ----------
function PaymentBox({ application, onDone }) {
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState({ method: 'TRANSFERENCIA', reference: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { paymentStatus } = application;
  const canPay = ['PENDIENTE', 'RECHAZADO'].includes(paymentStatus);

  const simulate = async () => {
    if (!window.confirm(`Simulación de pago de ${formatMoney(application.event.standFee)}. No se cobra dinero real. ¿Continuar?`)) return;
    setBusy(true); setError('');
    try { onDone((await apiRequest(`/participation/${application.id}/payment/simulate`, { method: 'POST' })).message); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const inform = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { onDone((await apiUpload(`/participation/${application.id}/payment/inform`, file, form)).message); setMode(null); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className={`payment-box status-${paymentStatus.toLowerCase()}`}>
      <div className="payment-head">
        <CreditCard size={16} />
        <div><strong>Puesto: {formatMoney(application.event.standFee)}</strong><small>{PAYMENT_LABEL[paymentStatus]}{application.paymentMethod ? ` · ${PAYMENT_METHOD_LABEL[application.paymentMethod] || application.paymentMethod}` : ''}{application.paymentReference ? ` · ${application.paymentReference}` : ''}</small></div>
      </div>
      {paymentStatus === 'RECHAZADO' && application.paymentNotes && <p className="payment-note">La organización indicó: {application.paymentNotes}</p>}
      {paymentStatus === 'INFORMADO' && <p className="payment-note">La organización tiene que confirmar el pago.</p>}
      {canPay && !mode && (
        <div className="payment-actions">
          <button type="button" className="market-button primary small" disabled={busy} onClick={simulate}><CreditCard size={14} /> Pagar online (simulación)</button>
          <button type="button" className="market-button outline small" onClick={() => setMode('inform')}>Informar transferencia o efectivo</button>
        </div>
      )}
      {mode === 'inform' && (
        <form className="payment-form" onSubmit={inform}>
          <label>Medio<select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option><option value="OTRO">Otro</option></select></label>
          <label>Referencia<input maxLength={80} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="N° de operación (opcional)" /></label>
          <label className="payment-file"><FileUp size={14} /> {file ? file.name : 'Adjuntar comprobante (opcional)'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
          <div className="payment-actions"><button type="button" className="market-button outline small" onClick={() => setMode(null)}>Cancelar</button><button className="market-button primary small" disabled={busy}>Informar pago</button></div>
        </form>
      )}
      <small className="payment-disclaimer">Simulación: Emprende todavía no procesa dinero real.</small>
      {error && <p className="messages-error" role="alert">{error}</p>}
    </div>
  );
}

// ---------- Calificación ----------
function ReviewBox({ application, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  if (application.myReview) {
    return <p className="review-done">Calificaste a la organización: <Stars value={application.myReview.rating} size={14} /></p>;
  }
  const send = async () => {
    if (!rating) { setError('Elegí de 1 a 5 estrellas.'); return; }
    try { onDone((await apiRequest(`/participation/${application.id}/review`, { method: 'POST', body: { rating, comment } })).message); }
    catch (err) { setError(err.message); }
  };
  return (
    <div className="review-box">
      <strong>¿Cómo te fue con la organización?</strong>
      <Stars value={rating} onChange={setRating} size={22} label="Calificación" />
      <textarea rows="2" maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentario opcional: trato, organización, cantidad de público…" />
      <button type="button" className="market-button primary small" onClick={send}>Enviar calificación</button>
      {error && <p className="messages-error" role="alert">{error}</p>}
    </div>
  );
}

// ---------- Tarjeta de postulación ----------
function ApplicationCard({ application, onMessages, onOpenEvent, onChanged, highlighted }) {
  const { event } = application;
  const [showPlan, setShowPlan] = useState(false);
  const [error, setError] = useState('');
  const isApproved = application.status === 'APROBADA';
  const canWithdraw = ['ENVIADA', 'EN_REVISION', 'LISTA_ESPERA', 'APROBADA'].includes(application.status) && !started(event);

  const withdraw = async () => {
    const reason = window.prompt('¿Querés darte de baja? Si estabas aprobado, tu lugar pasa a la lista de espera. Motivo (opcional):');
    if (reason === null) return;
    try { onChanged((await apiRequest(`/participation/${application.id}/withdraw`, { method: 'POST', body: { reason } })).message); }
    catch (err) { setError(err.message); }
  };

  return (
    <article id={`postulacion-${application.id}`} className={`application-card status-${application.status.toLowerCase()} ${highlighted ? 'highlighted' : ''}`}>
      {event.space?.coverUrl && <img className="application-cover" src={fileUrl(event.space.coverUrl)} alt="" loading="lazy" />}
      <div className="application-body">
        <div className="application-top">
          <span>{event.space?.name ? `${event.space.name} · ` : ''}{event.locality}</span>
          <StatusBadge status={application.status} />
        </div>
        <h3>{event.name}</h3>
        <p className="application-when"><Clock3 size={14} /> {formatDate(event.startsAt)} · {formatTime(event.startsAt)} a {formatTime(event.endsAt)} hs</p>
        <p className="application-offer">{application.business.name} · Ofrece: {application.offeredProduct}</p>

        {application.status === 'LISTA_ESPERA' && <p className="waitlist-chip"><Hourglass size={14} /> Estás {application.waitlistPosition ? `${application.waitlistPosition}°` : ''} en la lista de espera. Si se libera un lugar, entrás automáticamente.</p>}
        {isApproved && (
          <div className="stand-chips">
            <span><b>Puesto</b> {application.standLabel || 'a confirmar'}</span>
            <span><b>Armado</b> {application.setupTime ? `${application.setupTime} hs` : 'a confirmar'}</span>
            {event.organizerRating && <span><b>Organización</b> <RatingBadge rating={event.organizerRating} /></span>}
          </div>
        )}
        {isApproved && event.standPlan && (
          <>
            <button type="button" className="market-text-button" onClick={() => setShowPlan(!showPlan)}><LayoutGrid size={14} /> {showPlan ? 'Ocultar plano' : 'Ver mi lugar en el plano'}</button>
            {showPlan && <div className="application-plan"><StandPlanView plan={event.standPlan} highlight={application.standLabel} compact /><PlanLegend showTaken={false} /></div>}
          </>
        )}
        {isApproved && application.paymentStatus !== 'NO_APLICA' && <PaymentBox application={application} onDone={onChanged} />}
        {isApproved && ended(event) && <ReviewBox application={application} onDone={onChanged} />}
        {application.receivedReview && <p className="review-done">La organización te calificó: <Stars value={application.receivedReview.rating} size={14} />{application.receivedReview.comment ? ` “${application.receivedReview.comment}”` : ''}</p>}

        <div className="application-actions">
          {application.status !== 'BORRADOR' && (
            <button type="button" className="market-button outline small" onClick={() => onMessages(application)}>
              <MessageCircle size={14} /> Mensajes{application.unreadMessages > 0 && <span className="unread-pill">{application.unreadMessages}</span>}
            </button>
          )}
          {application.status === 'BORRADOR'
            ? <button type="button" className="market-button primary small" onClick={() => onOpenEvent(event.id)}>Continuar borrador <ArrowRight size={14} /></button>
            : <button type="button" className="market-text-button" onClick={() => onOpenEvent(event.id)}>Ver convocatoria <ArrowRight size={14} /></button>}
          {canWithdraw && <button type="button" className="market-button ghost small" onClick={withdraw}><UserMinus size={14} /> Darme de baja</button>}
        </div>
        {error && <p className="messages-error" role="alert">{error}</p>}
      </div>
    </article>
  );
}

// ---------- Calendario de próximas ferias ----------
function UpcomingCalendar({ items, onMessages }) {
  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = new Date(item.event.startsAt).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return [...map.entries()];
  }, [items]);
  if (!items.length) return <EmptyState icon={CalendarPlus} title="No tenés ferias confirmadas" text="Cuando una organización apruebe tu postulación, la feria aparece acá con su fecha, puesto y horario." />;
  return (
    <div className="upcoming-calendar">
      {groups.map(([month, list]) => (
        <section key={month}>
          <h2>{month}</h2>
          {list.map((item) => {
            const start = new Date(item.event.startsAt);
            return (
              <article key={item.id} className="upcoming-item">
                <div className="upcoming-date"><strong>{start.getDate()}</strong><span>{start.toLocaleDateString('es-AR', { weekday: 'short' })}</span></div>
                <div className="upcoming-main">
                  <h3>{item.event.name}</h3>
                  <p>{formatTime(item.event.startsAt)} a {formatTime(item.event.endsAt)} hs · {item.event.space?.name || item.event.locality}</p>
                  <p className="upcoming-stand">Puesto {item.standLabel || 'a confirmar'} · Armado {item.setupTime ? `${item.setupTime} hs` : 'a confirmar'}{item.paymentStatus === 'PENDIENTE' ? ' · Falta pagar el puesto' : ''}</p>
                  <div className="application-actions">
                    <a className="market-button outline small" href={googleMapsLink(item.event.latitude, item.event.longitude)} target="_blank" rel="noreferrer"><MapPin size={14} /> Cómo llegar</a>
                    <a className="market-button outline small" href={googleCalendarLink(item)} target="_blank" rel="noreferrer"><CalendarPlus size={14} /> Google Calendar</a>
                    <button type="button" className="market-button outline small" onClick={() => downloadIcs(item)}><Download size={14} /> .ics</button>
                    <button type="button" className="market-button outline small" onClick={() => onMessages(item)}><MessageCircle size={14} /> Mensajes{item.unreadMessages > 0 && <span className="unread-pill">{item.unreadMessages}</span>}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ))}
      <p className="portal-hint"><ExternalLink size={13} /> El día anterior te llega un aviso de recordatorio en Emprende.</p>
    </div>
  );
}

export function ApplicationsPage({ onNavigate, onOpenEvent, focus, onFocusHandled }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState(null);
  const [chat, setChat] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [loadCount, setLoadCount] = useState(0);
  const [pendingFocus, setPendingFocus] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try { setApplications(await apiRequest('/marketplace/applications')); setLoadCount((count) => count + 1); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
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
      setTab('all');
      setHighlight(target.id);
      if (focusTarget.chat) setChat(target);
      setTimeout(() => document.getElementById(`postulacion-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
      setTimeout(() => setHighlight(null), 4000);
    }
  }, [pendingFocus, loadCount, applications]);

  const groups = useMemo(() => ({
    upcoming: applications.filter((item) => item.status === 'APROBADA' && !ended(item.event)).sort((a, b) => new Date(a.event.startsAt) - new Date(b.event.startsAt)),
    active: applications.filter((item) => ['BORRADOR', 'ENVIADA', 'EN_REVISION', 'LISTA_ESPERA'].includes(item.status)),
    approved: applications.filter((item) => item.status === 'APROBADA'),
    history: applications.filter((item) => ended(item.event) || ['NO_SELECCIONADA', 'CANCELADA'].includes(item.status)),
    all: applications,
  }), [applications]);
  const activeTab = tab || (groups.upcoming.length ? 'upcoming' : 'all');
  const unread = applications.reduce((sum, item) => sum + (item.unreadMessages || 0), 0);
  const changed = (text) => { setMessage(text); load(); };

  return (
    <div className="marketplace-page">
      <PageHeading kicker="SEGUIMIENTO" title="Mis postulaciones" description="El estado de cada postulación, tus próximas ferias y la conversación con cada organización." />
      {loading ? <LoadingState label="Cargando tus postulaciones…" /> : error ? <ErrorState message={error} onRetry={load} /> : applications.length === 0 ? (
        <EmptyState icon={TicketCheck} title="Todavía no te postulaste" text="Cuando encuentres una feria que te interese, postulate desde su detalle." action={<button className="market-button primary" onClick={() => onNavigate('events')}>Explorar convocatorias <ArrowRight size={15} /></button>} />
      ) : (
        <>
          <Tabs
            active={activeTab}
            onChange={(next) => { setTab(next); setMessage(''); }}
            tabs={[
              ['upcoming', 'Próximas ferias', groups.upcoming.length || null],
              ['active', 'En curso', groups.active.length || null],
              ['approved', 'Aprobadas'],
              ['history', 'Historial'],
              ['all', unread ? `Todas · ${unread} sin leer` : 'Todas'],
            ]}
          />
          {message && <InlineMessage type="success">{message}</InlineMessage>}
          {activeTab === 'upcoming' ? <UpcomingCalendar items={groups.upcoming} onMessages={setChat} /> : groups[activeTab].length === 0 ? (
            <EmptyState icon={TicketCheck} title="No hay postulaciones acá" text="Probá con otra pestaña." />
          ) : (
            <div className="application-grid">
              {groups[activeTab].map((application) => <ApplicationCard key={application.id} application={application} onMessages={setChat} onOpenEvent={onOpenEvent} onChanged={changed} highlighted={highlight === application.id} />)}
            </div>
          )}
        </>
      )}
      {chat && <MessagesPanel applicationId={chat.id} onClose={() => { setChat(null); load(); }} />}
    </div>
  );
}

export default ApplicationsPage;
