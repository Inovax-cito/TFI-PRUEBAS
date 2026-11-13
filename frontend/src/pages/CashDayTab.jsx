import React, { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, Lock, Minus, Plus, Receipt, Store, Unlock, Wallet } from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { CHART, TOOLTIP_STYLE, shortMoney } from '../utils/chartTheme.js';
import { EmptyState, ErrorState, InlineMessage, LoadingState, formatMoney, formatShortDate } from '../components/portal/ui.jsx';
import { OrderForm } from './MyBusinessPage.jsx';

export const METHOD_LABEL = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta', MERCADO_PAGO: 'Mercado Pago', OTRO: 'Otro' };
const KIND = { VENTA: ['Venta', 'in'], GASTO: ['Gasto', 'out'], ALQUILER: ['Alquiler de puesto', 'out'] };
const hour = (value) => new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

function OpenForm({ events, onOpened }) {
  const [form, setForm] = useState({ openingCash: '', eventId: '' });
  const [error, setError] = useState('');
  const open = async (event) => {
    event.preventDefault(); setError('');
    try { onOpened(await apiRequest('/business/cash/open', { method: 'POST', body: { openingCash: Number(form.openingCash || 0), eventId: form.eventId || null } })); }
    catch (err) { setError(err.message); }
  };
  return (
    <form className="market-panel cash-open" onSubmit={open}>
      <span className="cash-open-icon"><Unlock size={22} /></span>
      <div>
        <h2>Abrí la caja para empezar el día</h2>
        <p>Desde que la abrís, cada venta que marques como entregada, cada gasto y el pago del puesto se suman acá. Al cerrar contás el efectivo y ves lo que te quedó.</p>
        <div className="market-form-grid">
          <label>Efectivo con el que arrancás<input type="number" min="0" step="0.01" value={form.openingCash} onChange={(e) => setForm({ ...form, openingCash: e.target.value })} placeholder="$ 0" /></label>
          <label>¿Dónde vendés hoy?<select value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })}><option value="">En mi local / pedidos</option>{events.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatShortDate(item.startsAt)}</option>)}</select></label>
        </div>
        {error && <InlineMessage type="error">{error}</InlineMessage>}
        <button className="market-button primary"><Unlock size={15} /> Abrir caja</button>
      </div>
    </form>
  );
}

function ExpenseForm({ onSaved, methods }) {
  const [form, setForm] = useState({ concept: '', amount: '', method: 'EFECTIVO' });
  const [error, setError] = useState('');
  const save = async (event) => {
    event.preventDefault(); setError('');
    try { onSaved((await apiRequest('/business/expenses', { method: 'POST', body: { ...form, amount: Number(form.amount) } })).message); setForm({ concept: '', amount: '', method: 'EFECTIVO' }); }
    catch (err) { setError(err.message); }
  };
  return (
    <form className="market-panel portal-form compact-panel" onSubmit={save}>
      <h3><Minus size={15} /> Registrar gasto</h3>
      <div className="market-form-grid">
        <label className="wide">Concepto<input required maxLength={160} value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} placeholder="Ej.: hielo, flete, bolsas" /></label>
        <label>Importe<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="$ 0" /></label>
        <label>Pagado con<select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{methods.map((method) => <option key={method} value={method}>{METHOD_LABEL[method]}</option>)}</select></label>
      </div>
      {error && <InlineMessage type="error">{error}</InlineMessage>}
      <button className="market-button outline small"><Minus size={14} /> Registrar gasto</button>
    </form>
  );
}

function CloseForm({ day, onClosed }) {
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const expected = day.summary.expectedCash;
  const diff = counted === '' ? null : Math.round((Number(counted) - expected) * 100) / 100;
  const close = async (event) => {
    event.preventDefault(); setError('');
    if (!window.confirm('¿Cerrar la caja del día?')) return;
    try { onClosed(await apiRequest('/business/cash/close', { method: 'POST', body: { countedCash: counted === '' ? '' : Number(counted), notes } })); }
    catch (err) { setError(err.message); }
  };
  return (
    <form className="market-panel portal-form compact-panel" onSubmit={close}>
      <h3><Lock size={15} /> Cerrar caja (arqueo)</h3>
      <p className="portal-hint">Deberías tener <b>{formatMoney(expected)}</b> en efectivo: {formatMoney(day.openingCash)} inicial + ventas en efectivo − gastos y alquiler pagados en efectivo.</p>
      <div className="market-form-grid">
        <label>Efectivo que contaste<input required type="number" min="0" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="$ 0" /></label>
        <label>Nota (opcional)<input maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: di cambio de más" /></label>
      </div>
      {diff !== null && <p className={`cash-diff ${diff === 0 ? 'ok' : diff > 0 ? 'plus' : 'minus'}`}>{diff === 0 ? 'Coincide exacto.' : diff > 0 ? `Sobran ${formatMoney(diff)}.` : `Faltan ${formatMoney(-diff)}.`}</p>}
      {error && <InlineMessage type="error">{error}</InlineMessage>}
      <button className="market-button primary small"><Lock size={14} /> Cerrar caja</button>
    </form>
  );
}

function DaySummary({ summary }) {
  const methods = Object.entries(summary.byMethod).filter(([, total]) => total > 0);
  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-tile"><span className="kpi-icon"><Store size={17} /></span><div><span>Vendido</span><strong>{formatMoney(summary.sales)}</strong><small>{summary.salesCount} {summary.salesCount === 1 ? 'venta' : 'ventas'}</small></div></div>
        <div className="kpi-tile"><span className="kpi-icon"><Minus size={17} /></span><div><span>Gastos</span><strong>{formatMoney(summary.expenses)}</strong></div></div>
        <div className="kpi-tile"><span className="kpi-icon"><Receipt size={17} /></span><div><span>Alquiler de puesto</span><strong>{formatMoney(summary.rent)}</strong></div></div>
        <div className={`kpi-tile highlight ${summary.net < 0 ? 'negative' : ''}`}><span className="kpi-icon"><Wallet size={17} /></span><div><span>Te quedó</span><strong>{formatMoney(summary.net)}</strong><small>ventas − gastos − alquiler</small></div></div>
      </div>
      {methods.length > 0 && (
        <div className="cash-methods">
          {methods.map(([method, total]) => <span key={method}><Banknote size={13} /> {METHOD_LABEL[method]}: <b>{formatMoney(total)}</b></span>)}
        </div>
      )}
    </>
  );
}

export function CashDayTab({ products, onChanged }) {
  const [state, setState] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selling, setSelling] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [current, days] = await Promise.all([apiRequest('/business/cash/current'), apiRequest('/business/cash/history')]);
      setState(current); setHistory(days);
    } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const done = (text) => { setMessage(text); load(); onChanged?.(); };
  if (error && !state) return <ErrorState message={error} onRetry={load} />;
  if (!state) return <LoadingState label="Cargando la caja…" />;
  const { day } = state;
  const chart = [...history].reverse().slice(-14).map((item) => ({ label: formatShortDate(item.openedAt), net: item.summary.net, sales: item.summary.sales }));

  return (
    <div className="cash-day">
      {message && <InlineMessage type="success">{message}</InlineMessage>}
      {!day ? <OpenForm events={state.events} onOpened={(result) => done(result.message)} /> : (
        <>
          <div className="cash-day-head">
            <div><span className="cash-badge"><Unlock size={13} /> Caja abierta</span><h2>{day.event ? day.event.name : 'Venta del día'}</h2><small>Desde las {hour(day.openedAt)} · efectivo inicial {formatMoney(day.openingCash)}</small></div>
            <button type="button" className="market-button primary" onClick={() => setSelling(!selling)}><Plus size={15} /> Registrar venta</button>
          </div>
          {selling && <OrderForm products={products} eventId={day.event?.id} defaultStatus="ENTREGADO" defaultChannel={day.event ? 'FERIA' : 'PRESENCIAL'} compact onSaved={(result) => { setSelling(false); done(result.message); }} onCancel={() => setSelling(false)} />}
          <DaySummary summary={day.summary} />
          <div className="business-overview-grid">
            <section className="market-panel">
              <div className="portal-section-head"><h2>Movimientos de hoy</h2><span>{day.summary.movements.length}</span></div>
              {day.summary.movements.length === 0 ? <p className="market-muted">Todavía no hay movimientos. Registrá tu primera venta.</p> : (
                <ul className="cash-movements">
                  {day.summary.movements.map((item) => (
                    <li key={item.id} className={KIND[item.kind][1]}>
                      <span className="cash-time">{hour(item.at)}</span>
                      <div><strong>{KIND[item.kind][0]}</strong><small>{item.label} · {METHOD_LABEL[item.method] || item.method}</small></div>
                      <b>{item.amount > 0 ? '+' : '−'}{formatMoney(Math.abs(item.amount))}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <div className="cash-side">
              <ExpenseForm methods={state.paymentMethods} onSaved={done} />
              <CloseForm day={day} onClosed={(result) => done(result.message)} />
            </div>
          </div>
        </>
      )}

      <section className="market-panel cash-history">
        <div className="portal-section-head"><h2>Días anteriores</h2><span>Lo que te quedó cada día</span></div>
        {history.length === 0 ? <EmptyState icon={Wallet} title="Sin cierres todavía" text="Cuando cierres tu primera caja, vas a ver acá el resumen de cada día." /> : (
          <>
            {chart.length > 1 && (
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={chart} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={shortMoney} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip formatter={(value, key) => [formatMoney(value), key === 'net' ? 'Te quedó' : 'Vendido']} contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f2f7f7' }} />
                    <Bar dataKey="net" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="cash-history-table" role="table">
              <div className="cash-history-row head" role="row"><span>Día</span><span>Dónde</span><span>Vendido</span><span>Gastos + alquiler</span><span>Te quedó</span><span>Arqueo</span></div>
              {history.map((item) => (
                <div key={item.id} className="cash-history-row" role="row">
                  <span>{new Date(item.openedAt).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span>{item.event?.name || 'Local / pedidos'}</span>
                  <span>{formatMoney(item.summary.sales)}</span>
                  <span>{formatMoney(item.summary.expenses + item.summary.rent)}</span>
                  <span className={item.summary.net < 0 ? 'neg' : ''}><b>{formatMoney(item.summary.net)}</b></span>
                  <span className={item.summary.difference ? 'warn' : 'ok'}>{item.summary.difference === null ? '—' : item.summary.difference === 0 ? 'Coincide' : `${item.summary.difference > 0 ? '+' : ''}${formatMoney(item.summary.difference)}`}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default CashDayTab;
