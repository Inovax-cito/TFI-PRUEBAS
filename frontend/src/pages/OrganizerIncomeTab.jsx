import React, { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, CircleDashed, Clock3, Hourglass, Percent, Wallet, X } from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { CHART, TOOLTIP_STYLE, shortMoney } from '../utils/chartTheme.js';
import { EmptyState, ErrorState, InlineMessage, LoadingState, PAYMENT_LABEL, formatDate, formatMoney, formatShortDate } from '../components/portal/ui.jsx';

const METHOD_LABEL = { ONLINE_SIMULADO: 'Online (simulación)', TRANSFERENCIA: 'Transferencia', EFECTIVO: 'Efectivo', OTRO: 'Otro' };

/** Ingresos de las ferias del organizador: lo cobrado por alquiler de puestos, lo pendiente y la ocupación. */
export function OrganizerIncomeTab({ onOpenApplications, onAttendance }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [today] = useState(() => { const date = new Date(); date.setHours(23, 59, 59, 999); return date.getTime(); });
  const load = useCallback(() => apiRequest('/participation/organizer/income').then(setData).catch((err) => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState label="Calculando ingresos…" />;
  const { totals } = data;
  const chart = data.daily.map((item) => ({ ...item, label: formatShortDate(`${item.day}T12:00:00`) }));
  const hasDaily = chart.some((item) => item.total > 0);

  return (
    <div className="income-tab">
      <div className="kpi-grid">
        <div className="kpi-tile highlight"><span className="kpi-icon"><Wallet size={17} /></span><div><span>Cobrado por puestos</span><strong>{formatMoney(totals.collected)}</strong><small>pagos confirmados</small></div></div>
        <div className="kpi-tile"><span className="kpi-icon"><Clock3 size={17} /></span><div><span>Por cobrar</span><strong>{formatMoney(totals.pending)}</strong><small>pendientes e informados</small></div></div>
        <div className="kpi-tile"><span className="kpi-icon"><Hourglass size={17} /></span><div><span>Pagos para confirmar</span><strong>{totals.informed}</strong></div></div>
        <div className="kpi-tile"><span className="kpi-icon"><Percent size={17} /></span><div><span>Ocupación promedio</span><strong>{totals.occupancy === null ? '—' : `${totals.occupancy}%`}</strong></div></div>
      </div>
      <div className="business-overview-grid">
        <section className="market-panel">
          <div className="portal-section-head"><h2>Cobros por día</h2><span>Últimos 30 días</span></div>
          {hasDaily ? (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={chart} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tickFormatter={shortMoney} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip formatter={(value) => [formatMoney(value), 'Cobrado']} contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f2f7f7' }} />
                  <Bar dataKey="total" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="market-muted chart-empty">Cuando confirmes pagos de puestos, vas a ver acá cuánto entra cada día.</p>}
        </section>
        <section className="market-panel">
          <div className="portal-section-head"><h2>Por medio de pago</h2></div>
          {Object.keys(data.byMethod).length === 0 ? <p className="market-muted">Sin cobros confirmados todavía.</p> : (
            <ul className="mini-order-list">{Object.entries(data.byMethod).map(([method, total]) => <li key={method}><div><strong>{METHOD_LABEL[method] || method}</strong></div><span>{formatMoney(total)}</span></li>)}</ul>
          )}
        </section>
      </div>
      <section className="market-admin-section">
        <h2>Por feria</h2>
        {data.events.length === 0 ? <EmptyState icon={Wallet} title="Sin ferias publicadas" text="Cuando publiques convocatorias con costo de puesto, vas a ver acá lo cobrado." /> : (
          <div className="income-events">
            {data.events.map((event) => (
              <article key={event.id} className="income-event">
                <div className="income-event-main">
                  <strong>{event.name}</strong>
                  <span>{formatDate(event.startsAt)} · {event.fee ? `Puesto ${formatMoney(event.fee)}` : 'Sin costo'}</span>
                </div>
                <div className="occupancy">
                  <div className="occupancy-bar"><span style={{ width: `${Math.min(100, event.occupancy ?? 0)}%` }} /></div>
                  <small>{event.approved}{event.capacity ? `/${event.capacity}` : ''} puestos{event.occupancy !== null ? ` · ${event.occupancy}%` : ''}</small>
                </div>
                <div className="income-amounts">
                  <span><b>{formatMoney(event.collected)}</b> cobrado</span>
                  {event.pendingAmount > 0 && <span className="warn">{formatMoney(event.pendingAmount)} por cobrar</span>}
                </div>
                <div className="income-actions">
                  {(event.pendingCount + event.informedCount) > 0 && <button type="button" className="market-button outline small" onClick={() => onOpenApplications(event.id)}>Ver pagos</button>}
                  {new Date(event.startsAt).getTime() <= today && event.approved > 0 && <button type="button" className="market-button outline small" onClick={() => onAttendance(event)}>Asistencia {event.attended}/{event.approved}</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Lista para marcar quién vino el día de la feria. */
export function AttendanceModal({ event, applications, onClose }) {
  const approved = applications.filter((item) => item.eventId === event.id && item.status === 'APROBADA')
    .sort((a, b) => String(a.standLabel || '~').localeCompare(String(b.standLabel || '~'), 'es', { numeric: true }));
  const [present, setPresent] = useState(() => Object.fromEntries(approved.map((item) => [item.id, Boolean(item.attendedAt)])));
  const [error, setError] = useState('');
  const toggle = async (item) => {
    const next = !present[item.id];
    setPresent((current) => ({ ...current, [item.id]: next }));
    try { await apiRequest(`/participation/${item.id}/attendance`, { method: 'PATCH', body: { present: next } }); }
    catch (err) { setPresent((current) => ({ ...current, [item.id]: !next })); setError(err.message); }
  };
  const count = Object.values(present).filter(Boolean).length;
  return (
    <div className="messages-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="messages-panel" role="dialog" aria-modal="true" aria-label="Asistencia">
        <header><div><span className="market-kicker">ASISTENCIA · {count}/{approved.length}</span><h2>{event.name}</h2></div><button type="button" className="market-close-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header>
        <ul className="attendance-list">
          {approved.map((item) => (
            <li key={item.id}>
              <button type="button" className={present[item.id] ? 'present' : ''} onClick={() => toggle(item)} aria-pressed={present[item.id]}>
                {present[item.id] ? <CheckCircle2 size={20} /> : <CircleDashed size={20} />}
                <span><strong>{item.business.name}</strong><small>Puesto {item.standLabel || 'sin asignar'} · {PAYMENT_LABEL[item.paymentStatus]}</small></span>
              </button>
            </li>
          ))}
        </ul>
        {error && <div style={{ padding: '0 20px 16px' }}><InlineMessage type="error">{error}</InlineMessage></div>}
      </section>
    </div>
  );
}
