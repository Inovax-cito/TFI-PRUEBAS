import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  BadgeCheck, Camera, ClipboardList, ImagePlus, Minus, Package, Pencil, Plus, Receipt, Save, ShoppingBag, Store, Trash2, Wallet, X,
} from 'lucide-react';
import { apiRequest, apiUpload, fileUrl } from '../utils/api.js';
import { CHART, TOOLTIP_STYLE, shortMoney } from '../utils/chartTheme.js';
import { CashDayTab } from './CashDayTab.jsx';
import {
  EmptyState, ErrorState, InlineMessage, LoadingState, PageHeading, StatusBadge, Tabs, formatDate, formatMoney, formatShortDate,
} from '../components/portal/ui.jsx';

const LOCALITIES = ['Banda del Río Salí', 'Cruz Alta', 'Alderetes'];
const CHANNEL_LABEL = { PRESENCIAL: 'Presencial', WHATSAPP: 'WhatsApp', REDES: 'Redes sociales', FERIA: 'Feria o evento', OTRO: 'Otro' };
const NEXT_STATUS = { PENDIENTE: ['CONFIRMADO', 'ENTREGADO', 'CANCELADO'], CONFIRMADO: ['ENTREGADO', 'CANCELADO'], ENTREGADO: ['CANCELADO'], CANCELADO: [] };
const STATUS_ACTION = { CONFIRMADO: 'Confirmar', ENTREGADO: 'Marcar entregado', CANCELADO: 'Cancelar' };
const emptyProfile = {
  name: '', kind: 'FIJO', category: '', description: '', locality: LOCALITIES[0],
  address: '', contactPhone: '', contactEmail: '', notificationsEnabled: true,
};

// ---------- Resumen ----------

function Kpi({ icon: Icon, label, value, hint }) {
  return (
    <div className="kpi-tile">
      <span className="kpi-icon"><Icon size={17} /></span>
      <div><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>
    </div>
  );
}

function OverviewTab({ overview, onNavigate, onTab }) {
  const { kpis, weeklySales, recentOrders } = overview;
  const chartData = weeklySales.map((week) => ({ ...week, label: formatShortDate(`${week.week}T12:00:00`) }));
  const hasSales = chartData.some((week) => week.total > 0);
  return (
    <>
      <div className="kpi-grid">
        <Kpi icon={Wallet} label="Ventas del mes" value={formatMoney(kpis.monthSales)} hint={`${kpis.monthOrders} ${kpis.monthOrders === 1 ? 'venta' : 'ventas'}`} />
        <Kpi icon={ClipboardList} label="Pedidos por entregar" value={kpis.pendingOrders} />
        <Kpi icon={Receipt} label="Ticket promedio" value={formatMoney(kpis.averageTicket)} hint="Este mes" />
        <Kpi icon={BadgeCheck} label="Postulaciones aprobadas" value={kpis.approvedApplications} hint={kpis.activeApplications ? `${kpis.activeApplications} en revisión` : undefined} />
      </div>
      <div className="business-overview-grid">
        <section className="market-panel">
          <div className="portal-section-head"><h2>Ventas por semana</h2><span>Últimas 8 semanas · pedidos entregados</span></div>
          {hasSales ? (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={shortMoney} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip formatter={(value) => [formatMoney(value), 'Ventas']} labelFormatter={(label) => `Semana del ${label}`} contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f2f7f7' }} />
                  <Bar dataKey="total" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="market-muted chart-empty">Cuando marques pedidos como entregados, vas a ver acá cómo evolucionan tus ventas.</p>}
        </section>
        <section className="market-panel">
          <div className="portal-section-head"><h2>Últimos pedidos</h2><button className="market-text-button" onClick={() => onTab('orders')}>Ver todos</button></div>
          {recentOrders.length === 0 ? <p className="market-muted">Todavía no registraste pedidos.</p> : (
            <ul className="mini-order-list">
              {recentOrders.map((order) => (
                <li key={order.id}><div><strong>{order.customerName}</strong><small>{formatDate(order.createdAt)} · {CHANNEL_LABEL[order.channel] || order.channel}</small></div><span>{formatMoney(order.total)}</span><StatusBadge status={order.status} /></li>
              ))}
            </ul>
          )}
          <button className="market-button outline w-full" onClick={() => onNavigate('events')}>Buscar convocatorias</button>
        </section>
      </div>
    </>
  );
}

// ---------- Perfil y fotos ----------

function ProfileTab({ profile, photos, onSaved, onPhotosChange }) {
  const [form, setForm] = useState({ ...emptyProfile, ...profile });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value });

  const save = async (event) => {
    event.preventDefault(); setMessage(''); setError('');
    try {
      const result = await apiRequest('/marketplace/business', { method: 'PUT', body: form });
      setMessage('Datos guardados.');
      onSaved(result.profile);
    } catch (err) { setError(err.message); }
  };

  const addPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setPhotoError('La foto supera los 3 MB.'); return; }
    setUploading(true); setPhotoError('');
    try { const result = await apiUpload('/business/photos', file); onPhotosChange([...photos, result.photo]); }
    catch (err) { setPhotoError(err.message); }
    finally { setUploading(false); }
  };

  const removePhoto = async (photo) => {
    if (!window.confirm('¿Eliminar esta foto?')) return;
    try { await apiRequest(`/business/photos/${photo.id}`, { method: 'DELETE' }); onPhotosChange(photos.filter((item) => item.id !== photo.id)); }
    catch (err) { setPhotoError(err.message); }
  };

  return (
    <div className="business-profile-grid">
      <form className="market-panel market-business-form" onSubmit={save}>
        <h2>Datos del emprendimiento</h2>
        <div className="market-form-grid">
          <label>Nombre <b>*</b><input required maxLength={120} value={form.name} onChange={set('name')} placeholder="Ej.: Taller de cerámica" /></label>
          <label>Tipo de actividad <b>*</b><select value={form.kind} onChange={set('kind')}><option value="FIJO">Local fijo</option><option value="ITINERANTE">Itinerante / feriante</option></select></label>
          <label>Rubro <b>*</b><input required maxLength={80} value={form.category} onChange={set('category')} placeholder="Ej.: alimentos, indumentaria" /></label>
          <label>Localidad <b>*</b><select value={form.locality} onChange={set('locality')}>{LOCALITIES.map((locality) => <option key={locality}>{locality}</option>)}</select></label>
          <label className="wide">Descripción<textarea rows="3" maxLength={1000} value={form.description || ''} onChange={set('description')} placeholder="Qué ofrecés y qué te distingue." /></label>
          <label>Dirección o zona<input maxLength={180} value={form.address || ''} onChange={set('address')} placeholder="Opcional" /></label>
          <label>Teléfono<input type="tel" maxLength={40} value={form.contactPhone || ''} onChange={set('contactPhone')} placeholder="Opcional" /></label>
          <label>Correo<input type="email" maxLength={120} value={form.contactEmail || ''} onChange={set('contactEmail')} placeholder="Opcional" /></label>
          <label className="market-switch inline"><input type="checkbox" checked={form.notificationsEnabled !== false} onChange={set('notificationsEnabled')} /><span>Avisarme de convocatorias en mi localidad</span></label>
        </div>
        <div className="market-form-footer"><span>Los campos con <b>*</b> son obligatorios.</span><button className="market-button primary"><Save size={15} /> Guardar</button></div>
        {message && <InlineMessage type="success">{message}</InlineMessage>}
        {error && <InlineMessage type="error">{error}</InlineMessage>}
      </form>
      <section className="market-panel">
        <div className="portal-section-head"><h2>Fotos</h2><span>{photos.length}/8 · se muestran a quienes organizan</span></div>
        {!profile?.id ? <p className="market-muted">Guardá primero los datos del emprendimiento.</p> : (
          <div className="photo-grid">
            {photos.map((photo) => (
              <figure key={photo.id}>
                <img src={fileUrl(photo.url)} alt="Foto del emprendimiento" loading="lazy" />
                <button type="button" onClick={() => removePhoto(photo)} aria-label="Eliminar foto"><Trash2 size={14} /></button>
              </figure>
            ))}
            {photos.length < 8 && (
              <label className={`photo-add ${uploading ? 'disabled' : ''}`}>
                <ImagePlus size={22} /><span>{uploading ? 'Subiendo…' : 'Agregar foto'}</span><small>JPG, PNG o WEBP · máx. 3 MB</small>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={addPhoto} disabled={uploading} hidden />
              </label>
            )}
          </div>
        )}
        {photoError && <InlineMessage type="error">{photoError}</InlineMessage>}
      </section>
    </div>
  );
}

// ---------- Productos ----------

function ProductForm({ product, onCancel, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', ...product, stock: product?.stock ?? '' });
  const [error, setError] = useState('');
  const save = async (event) => {
    event.preventDefault(); setError('');
    try {
      const body = { ...form, price: Number(form.price), stock: form.stock === '' ? null : Number(form.stock) };
      const result = product?.id ? await apiRequest(`/business/products/${product.id}`, { method: 'PUT', body }) : await apiRequest('/business/products', { method: 'POST', body });
      onSaved(result.product);
    } catch (err) { setError(err.message); }
  };
  return (
    <form className="market-panel portal-form compact" onSubmit={save}>
      <div className="portal-form-head"><h2>{product?.id ? 'Editar producto' : 'Nuevo producto'}</h2><button type="button" className="market-close-button" onClick={onCancel} aria-label="Cerrar"><X size={18} /></button></div>
      <div className="market-form-grid">
        <label>Nombre <b>*</b><input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Precio <b>*</b><input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="$ 0,00" /></label>
        <label>Stock<input type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="Vacío = sin control" /></label>
        <label className="wide">Descripción<input maxLength={1000} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opcional" /></label>
      </div>
      {error && <InlineMessage type="error">{error}</InlineMessage>}
      <div className="market-form-footer"><span /><button className="market-button primary"><Save size={15} /> Guardar</button></div>
    </form>
  );
}

function ProductsTab({ products, setProducts }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const upsert = (product) => setProducts((list) => (list.some((item) => item.id === product.id) ? list.map((item) => (item.id === product.id ? product : item)) : [product, ...list]));

  const toggle = async (product) => {
    try { upsert((await apiRequest(`/business/products/${product.id}`, { method: 'PUT', body: { active: !product.active } })).product); }
    catch (err) { setError(err.message); }
  };
  const uploadPhoto = async (product, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try { upsert((await apiUpload(`/business/products/${product.id}/photo`, file)).product); }
    catch (err) { setError(err.message); }
  };

  return (
    <>
      <div className="portal-toolbar"><span>{products.filter((item) => item.active).length} productos activos</span>{!editing && <button className="market-button primary" onClick={() => setEditing({})}><Plus size={15} /> Agregar producto</button>}</div>
      {editing && <ProductForm product={editing.id ? editing : null} onCancel={() => setEditing(null)} onSaved={(product) => { upsert(product); setEditing(null); }} />}
      {error && <InlineMessage type="error">{error}</InlineMessage>}
      {products.length === 0 && !editing ? <EmptyState icon={Package} title="Cargá tus productos" text="Con tu catálogo vas a poder registrar pedidos y ventas en segundos, también dentro de una feria." action={<button className="market-button primary" onClick={() => setEditing({})}><Plus size={15} /> Agregar producto</button>} /> : (
        <div className="product-grid">
          {products.map((product) => (
            <article key={product.id} className={`product-card ${product.active ? '' : 'paused'}`}>
              <label className="product-photo" title="Cambiar foto">
                {product.photoUrl ? <img src={fileUrl(product.photoUrl)} alt={product.name} loading="lazy" /> : <span><Camera size={20} /><small>Agregar foto</small></span>}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadPhoto(product, e)} hidden />
              </label>
              <div className="product-body">
                <strong>{product.name}</strong>
                <span className="product-price">{formatMoney(product.price)}</span>
                <small>{product.stock === null ? 'Sin control de stock' : `Stock: ${product.stock}`}{product.active ? '' : ' · Pausado'}</small>
                <div className="product-actions">
                  <button type="button" className="market-text-button" onClick={() => setEditing(product)}><Pencil size={13} /> Editar</button>
                  <button type="button" className="market-text-button" onClick={() => toggle(product)}>{product.active ? 'Pausar' : 'Activar'}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- Pedidos y ventas ----------

export function OrderForm({ products, eventId, defaultStatus = 'PENDIENTE', defaultChannel = 'PRESENCIAL', onCancel, onSaved, compact = false }) {
  const PAYMENT_OPTIONS = [['EFECTIVO', 'Efectivo'], ['TRANSFERENCIA', 'Transferencia'], ['TARJETA', 'Tarjeta'], ['MERCADO_PAGO', 'Mercado Pago'], ['OTRO', 'Otro']];
  const active = products.filter((product) => product.active);
  const [lines, setLines] = useState({});
  const [form, setForm] = useState({ customerName: '', customerContact: '', channel: defaultChannel, status: defaultStatus, notes: '', paymentMethod: 'EFECTIVO' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const total = active.reduce((sum, product) => sum + (lines[product.id] || 0) * product.price, 0);
  const change = (id, delta) => setLines((current) => ({ ...current, [id]: Math.max(0, (current[id] || 0) + delta) }));

  const save = async (event) => {
    event.preventDefault(); setError('');
    const items = Object.entries(lines).filter(([, qty]) => qty > 0).map(([productId, quantity]) => ({ productId: Number(productId), quantity }));
    if (!items.length) { setError('Sumá al menos un producto.'); return; }
    setBusy(true);
    try {
      const result = await apiRequest('/business/orders', { method: 'POST', body: { ...form, items, eventId } });
      setLines({}); setForm({ ...form, customerName: '', customerContact: '', notes: '' });
      onSaved(result);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (!active.length) return <p className="market-muted">Primero cargá productos en la pestaña Productos de Mi emprendimiento.</p>;
  return (
    <form className={`market-panel portal-form ${compact ? 'compact' : ''}`} onSubmit={save}>
      {onCancel && <div className="portal-form-head"><h2>Nuevo pedido o venta</h2><button type="button" className="market-close-button" onClick={onCancel} aria-label="Cerrar"><X size={18} /></button></div>}
      <ul className="order-lines">
        {active.map((product) => (
          <li key={product.id}>
            <div><strong>{product.name}</strong><small>{formatMoney(product.price)}{product.stock !== null ? ` · stock ${product.stock}` : ''}</small></div>
            <div className="qty-stepper">
              <button type="button" onClick={() => change(product.id, -1)} aria-label={`Quitar ${product.name}`} disabled={!lines[product.id]}><Minus size={14} /></button>
              <span>{lines[product.id] || 0}</span>
              <button type="button" onClick={() => change(product.id, 1)} aria-label={`Sumar ${product.name}`}><Plus size={14} /></button>
            </div>
          </li>
        ))}
      </ul>
      <div className="market-form-grid">
        <label>Cliente<input maxLength={120} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Consumidor final" /></label>
        {!compact && <label>Contacto<input maxLength={120} value={form.customerContact} onChange={(e) => setForm({ ...form, customerContact: e.target.value })} placeholder="Teléfono o usuario (opcional)" /></label>}
        {!eventId && <label>Canal<select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>{Object.entries(CHANNEL_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
        <label>Estado<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="PENDIENTE">Pedido pendiente</option><option value="CONFIRMADO">Pedido confirmado</option><option value="ENTREGADO">Venta entregada</option></select></label>
        {form.status === 'ENTREGADO' && <label>Cobrado con<select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>{PAYMENT_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
      </div>
      {error && <InlineMessage type="error">{error}</InlineMessage>}
      <div className="market-form-footer"><span className="order-total">Total: <strong>{formatMoney(total)}</strong></span><button className="market-button primary" disabled={busy}><Save size={15} /> {busy ? 'Guardando…' : 'Registrar'}</button></div>
    </form>
  );
}

function OrdersTab({ products, onChanged }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setOrders(await apiRequest(`/business/orders${filter ? `?status=${filter}` : ''}`)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (order, status) => {
    if (status === 'CANCELADO' && !window.confirm('¿Cancelar este pedido?')) return;
    try {
      const result = await apiRequest(`/business/orders/${order.id}/status`, { method: 'PATCH', body: { status } });
      setOrders((list) => list.map((item) => (item.id === order.id ? result.order : item)));
      onChanged();
    } catch (err) { setError(err.message); }
  };

  return (
    <>
      <div className="portal-toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar pedidos">
          <option value="">Todos los pedidos</option><option value="PENDIENTE">Pendientes</option><option value="CONFIRMADO">Confirmados</option><option value="ENTREGADO">Entregados (ventas)</option><option value="CANCELADO">Cancelados</option>
        </select>
        {!creating && <button className="market-button primary" onClick={() => { setCreating(true); setMessage(''); }}><Plus size={15} /> Nuevo pedido</button>}
      </div>
      {creating && <OrderForm products={products} onCancel={() => setCreating(false)} onSaved={(result) => { setMessage(result.message); setCreating(false); load(); onChanged(); }} />}
      {message && <InlineMessage type="success">{message}</InlineMessage>}
      {error && <InlineMessage type="error">{error}</InlineMessage>}
      {loading ? <LoadingState label="Cargando pedidos…" /> : orders.length === 0 ? <EmptyState icon={ShoppingBag} title="No hay pedidos" text="Registrá pedidos de WhatsApp, redes o de tu puesto para tener todo en un mismo lugar." /> : (
        <div className="order-table" role="table">
          {orders.map((order) => (
            <article key={order.id} className="order-row" role="row">
              <div className="order-main">
                <strong>{order.customerName}</strong>
                <small>{formatDate(order.createdAt)} · {CHANNEL_LABEL[order.channel] || order.channel}{order.event ? ` · ${order.event.name}` : ''}</small>
                <span className="order-items">{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}</span>
              </div>
              <span className="order-amount">{formatMoney(order.total)}</span>
              <StatusBadge status={order.status} />
              <div className="order-actions">
                {NEXT_STATUS[order.status].map((status) => (
                  <button key={status} type="button" className={`market-button ${status === 'CANCELADO' ? 'ghost' : 'outline'} small`} onClick={() => setStatus(order, status)}>{STATUS_ACTION[status]}</button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- Página ----------

export function MyBusinessPage({ onNavigate }) {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await apiRequest('/business/overview');
      setOverview(data);
      if (data.business) setProducts(await apiRequest('/business/products'));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const hasBusiness = Boolean(overview?.business);
  const tabs = useMemo(() => (hasBusiness
    ? [['overview', 'Resumen'], ['cash', 'Caja del día'], ['orders', 'Pedidos y ventas', overview?.kpis?.pendingOrders || null], ['products', 'Productos'], ['profile', 'Perfil y fotos']]
    : [['profile', 'Perfil y fotos']]), [hasBusiness, overview?.kpis?.pendingOrders]);
  const activeTab = hasBusiness ? tab : 'profile';

  if (loading) return <div className="marketplace-page"><LoadingState label="Cargando tu emprendimiento…" /></div>;
  if (error && !overview) return <div className="marketplace-page"><ErrorState message={error} onRetry={load} /></div>;

  return (
    <div className="marketplace-page">
      <PageHeading
        kicker="MI EMPRENDIMIENTO"
        title={overview?.business?.name || 'Creá el perfil de tu emprendimiento'}
        description={hasBusiness ? `${overview.business.category} · ${overview.business.locality}` : 'Con estos datos te postulás a convocatorias sin volver a escribirlos.'}
        action={hasBusiness && <span className="business-heading-mark"><Store size={18} /></span>}
      />
      <Tabs tabs={tabs} active={activeTab} onChange={setTab} />
      {activeTab === 'overview' && <OverviewTab overview={overview} onNavigate={onNavigate} onTab={setTab} />}
      {activeTab === 'profile' && (
        <ProfileTab
          profile={overview?.business}
          photos={overview?.photos || []}
          onSaved={(profile) => { setOverview((current) => ({ ...current, business: profile })); if (!hasBusiness) load(); }}
          onPhotosChange={(photos) => setOverview((current) => ({ ...current, photos }))}
        />
      )}
      {activeTab === 'cash' && <CashDayTab products={products} onChanged={load} />}
      {activeTab === 'products' && <ProductsTab products={products} setProducts={setProducts} />}
      {activeTab === 'orders' && <OrdersTab products={products} onChanged={load} />}
    </div>
  );
}

export default MyBusinessPage;
