import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Building2, CircleAlert, ExternalLink, FileText, FileUp, ImagePlus, MapPin, Pencil, Plus, Save, ShieldCheck, Trash2, X,
} from 'lucide-react';
import { apiRequest, apiUpload, fileUrl, openPrivateFile } from '../utils/api.js';
import { LocationPicker, MarkersMap, googleMapsLink } from '../components/maps/index.jsx';
import {
  DOCUMENT_KIND_LABEL, EmptyState, ErrorState, InlineMessage, LoadingState, PageHeading, SPACE_TYPE_LABEL,
  StatusBadge, TENURE_LABEL, Tabs, formatDate,
} from '../components/portal/ui.jsx';

const LOCALITIES = ['Banda del Río Salí', 'Cruz Alta', 'Alderetes'];
const PUBLIC_TENURES = ['PERMISO_MUNICIPAL', 'CONCESION'];
const REQUIRED_DOC = {
  PROPIETARIO: 'TITULO_PROPIEDAD', LOCATARIO: 'CONTRATO_ALQUILER', PERMISO_MUNICIPAL: 'PERMISO_MUNICIPAL',
  CONCESION: 'PERMISO_MUNICIPAL', AUTORIZACION_TITULAR: 'AUTORIZACION_TITULAR',
};
const emptySpace = {
  name: '', type: 'GALERIA', description: '', locality: LOCALITIES[0], address: '', latitude: '', longitude: '',
  capacity: '', holderName: '', holderTaxId: '', tenure: 'PROPIETARIO', contactPhone: '', declarationAccepted: false,
};
const formatSize = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);

function SpaceForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(() => ({ ...emptySpace, ...initial, declarationAccepted: false }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = Boolean(initial?.id);
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value });
  const tenureOptions = form.type === 'ESPACIO_PUBLICO' ? PUBLIC_TENURES : Object.keys(TENURE_LABEL);
  const needsDeclaration = !editing || initial.status !== 'PENDIENTE';

  const changeType = (event) => {
    const type = event.target.value;
    const tenure = type === 'ESPACIO_PUBLICO' && !PUBLIC_TENURES.includes(form.tenure) ? 'PERMISO_MUNICIPAL' : form.tenure;
    setForm({ ...form, type, tenure });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.latitude === '' || form.longitude === '') { setError('Marcá en el mapa dónde está el espacio.'); return; }
    if (!editing && !form.declarationAccepted) { setError('Tenés que aceptar la declaración jurada.'); return; }
    setBusy(true);
    try {
      const body = { ...form, capacity: form.capacity === '' ? null : Number(form.capacity) };
      const result = editing
        ? await apiRequest(`/spaces/${initial.id}`, { method: 'PUT', body })
        : await apiRequest('/spaces', { method: 'POST', body });
      onSaved(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="market-panel portal-form" onSubmit={submit}>
      <div className="portal-form-head">
        <h2>{editing ? 'Editar espacio' : 'Proponer un espacio'}</h2>
        <button type="button" className="market-close-button" onClick={onCancel} aria-label="Cerrar"><X size={18} /></button>
      </div>

      <fieldset>
        <legend>1. El lugar</legend>
        <div className="market-form-grid">
          <label>Nombre del espacio <b>*</b><input required maxLength={160} value={form.name} onChange={set('name')} placeholder="Ej.: Galería del Centro" /></label>
          <label>Tipo de espacio <b>*</b><select value={form.type} onChange={changeType}>{Object.entries(SPACE_TYPE_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>Localidad <b>*</b><select value={form.locality} onChange={set('locality')}>{LOCALITIES.map((locality) => <option key={locality}>{locality}</option>)}</select></label>
          <label>Puestos que entran<input type="number" min="1" max="5000" step="1" value={form.capacity ?? ''} onChange={set('capacity')} placeholder="Opcional" /></label>
          <label className="wide">Dirección <b>*</b><input required maxLength={200} value={form.address} onChange={set('address')} placeholder="Calle, número y referencia" /></label>
          <label className="wide">Descripción<textarea rows="2" maxLength={2000} value={form.description || ''} onChange={set('description')} placeholder="Cómo es el lugar, horarios, servicios (luz, baños, techo)…" /></label>
        </div>
        <LocationPicker value={{ latitude: form.latitude, longitude: form.longitude }} locality={form.locality} onChange={(point) => setForm((current) => ({ ...current, ...point }))} />
      </fieldset>

      <fieldset>
        <legend>2. Quién tiene el derecho a usarlo</legend>
        {form.type === 'ESPACIO_PUBLICO' && (
          <p className="market-callout"><CircleAlert size={16} /><span>Una plaza, parque o vereda es de uso público: solo podés proponerla si tenés un permiso municipal o una concesión vigente a tu nombre.</span></p>
        )}
        <div className="market-form-grid">
          <label>Tu relación con el espacio <b>*</b><select value={form.tenure} onChange={set('tenure')}>{tenureOptions.map((id) => <option key={id} value={id}>{TENURE_LABEL[id]}</option>)}</select></label>
          <label>Titular o razón social <b>*</b><input required maxLength={160} value={form.holderName} onChange={set('holderName')} placeholder="Como figura en el documento" /></label>
          <label>CUIT / CUIL del titular <b>*</b><input required inputMode="numeric" maxLength={13} value={form.holderTaxId} onChange={set('holderTaxId')} placeholder="20-12345678-3" /></label>
          <label>Teléfono de contacto <b>*</b><input required type="tel" maxLength={40} value={form.contactPhone} onChange={set('contactPhone')} placeholder="381 000 0000" /></label>
        </div>
        <p className="portal-hint">Después de guardar vas a subir: <b>{DOCUMENT_KIND_LABEL[REQUIRED_DOC[form.tenure]]}</b> (obligatorio) y, si tenés, la habilitación comercial.</p>
      </fieldset>

      {needsDeclaration && (
        <label className="portal-declaration">
          <input type="checkbox" checked={form.declarationAccepted} onChange={set('declarationAccepted')} />
          <span>Declaro bajo juramento que los datos son verdaderos, que tengo derecho a disponer de este espacio para recibir emprendedores y que no voy a cobrar por puestos en lugares que no me corresponden. Entiendo que la información falsa puede implicar la baja de la cuenta y acciones legales.</span>
        </label>
      )}
      {editing && initial.status === 'VERIFICADO' && <p className="portal-hint">Si cambiás nombre, tipo, ubicación, titular, CUIT o tu relación con el espacio, vuelve a revisión y no vas a poder publicar hasta que se verifique otra vez.</p>}
      {error && <InlineMessage type="error">{error}</InlineMessage>}
      <div className="market-form-footer">
        <span>Los campos con <b>*</b> son obligatorios.</span>
        <button className="market-button primary" disabled={busy}><Save size={15} /> {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar espacio'}</button>
      </div>
    </form>
  );
}

function DocumentList({ space, onChanged, canDelete }) {
  const [kind, setKind] = useState(REQUIRED_DOC[space.tenure] || 'OTRO');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('El archivo supera los 5 MB.'); return; }
    setBusy(true); setError('');
    try { onChanged(await apiUpload(`/spaces/${space.id}/documents`, file, { kind })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const remove = async (doc) => {
    if (!window.confirm(`¿Eliminar "${doc.upload.originalName}"?`)) return;
    try { onChanged(await apiRequest(`/spaces/${space.id}/documents/${doc.id}`, { method: 'DELETE' })); }
    catch (err) { setError(err.message); }
  };

  return (
    <div className="space-documents">
      <h4><FileText size={15} /> Documentación</h4>
      {space.documents.length === 0 ? <p className="market-muted">Todavía no subiste documentos.</p> : (
        <ul>
          {space.documents.map((doc) => (
            <li key={doc.id}>
              <button type="button" className="space-doc-link" onClick={() => openPrivateFile(doc.upload.id).catch((err) => setError(err.message))}>
                <FileText size={14} /> <span><strong>{DOCUMENT_KIND_LABEL[doc.kind]}</strong><small>{doc.upload.originalName} · {formatSize(doc.upload.size)}</small></span>
              </button>
              {canDelete && <button type="button" className="icon-button" onClick={() => remove(doc)} aria-label="Eliminar documento"><Trash2 size={14} /></button>}
            </li>
          ))}
        </ul>
      )}
      {space.status !== 'SUSPENDIDO' && onChanged && (
        <div className="space-doc-upload">
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo de documento">
            {Object.entries(DOCUMENT_KIND_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <label className={`market-button outline ${busy ? 'disabled' : ''}`}>
            <FileUp size={15} /> {busy ? 'Subiendo…' : 'Subir PDF o foto'}
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={upload} disabled={busy} hidden />
          </label>
        </div>
      )}
      {error && <InlineMessage type="error">{error}</InlineMessage>}
    </div>
  );
}

function SpaceCover({ space, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    try { onChanged(await apiUpload(`/spaces/${space.id}/cover`, file)); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return (
    <label className={`space-cover ${space.coverUrl ? '' : 'empty'} ${busy ? 'busy' : ''}`} title="Cambiar foto del espacio">
      {space.coverUrl ? <img src={fileUrl(space.coverUrl)} alt={space.name} /> : <span><ImagePlus size={20} /> Agregar foto del espacio</span>}
      <span className="space-cover-action">{busy ? 'Subiendo…' : 'Cambiar foto'}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} hidden disabled={busy} />
      {error && <small role="alert">{error}</small>}
    </label>
  );
}

function SpaceCard({ space, onEdit, onChanged }) {
  const missing = space.missingDocuments || [];
  return (
    <article className="space-card">
      {space.status !== 'SUSPENDIDO' && <SpaceCover space={space} onChanged={onChanged} />}
      <div className="space-card-head">
        <span className="space-card-icon"><Building2 size={19} /></span>
        <div>
          <h3>{space.name}</h3>
          <span>{SPACE_TYPE_LABEL[space.type]} · {space.locality}</span>
        </div>
        <StatusBadge status={space.status} />
      </div>
      <p className="space-card-address"><MapPin size={14} /> {space.address} <a href={googleMapsLink(space.latitude, space.longitude)} target="_blank" rel="noreferrer">Ver en Google Maps <ExternalLink size={12} /></a></p>
      <dl className="space-card-facts">
        <div><dt>Titular</dt><dd>{space.holderName} · {space.holderTaxId}</dd></div>
        <div><dt>Derecho</dt><dd>{TENURE_LABEL[space.tenure]}</dd></div>
        {space.capacity && <div><dt>Puestos</dt><dd>{space.capacity}</dd></div>}
      </dl>
      {space.status === 'PENDIENTE' && (missing.length
        ? <p className="space-card-alert"><CircleAlert size={15} /> Falta subir: {missing.map((kind) => DOCUMENT_KIND_LABEL[kind]).join(', ')}.</p>
        : <p className="space-card-info"><ShieldCheck size={15} /> Documentación completa. La administración la está revisando.</p>)}
      {space.status === 'VERIFICADO' && <p className="space-card-ok"><ShieldCheck size={15} /> Verificado. Ya podés publicar convocatorias en este espacio.</p>}
      {['RECHAZADO', 'SUSPENDIDO'].includes(space.status) && space.reviewNotes && <p className="space-card-alert"><CircleAlert size={15} /> {space.reviewNotes}</p>}
      <DocumentList space={space} onChanged={onChanged} canDelete={space.status !== 'VERIFICADO'} />
      {space.status !== 'SUSPENDIDO' && <button type="button" className="market-text-button" onClick={() => onEdit(space)}><Pencil size={14} /> Editar datos</button>}
    </article>
  );
}

/** Organizador: sus espacios y su estado de verificación. */
export function MySpacesPage({ onNavigate }) {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setSpaces(await apiRequest('/spaces/mine')); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const applyResult = (result) => {
    setMessage(result.message || '');
    setSpaces((current) => {
      const exists = current.some((space) => space.id === result.space.id);
      return exists ? current.map((space) => (space.id === result.space.id ? result.space : space)) : [result.space, ...current];
    });
  };
  const verifiedCount = spaces.filter((space) => space.status === 'VERIFICADO').length;
  const mapItems = useMemo(() => spaces.map((space) => ({ ...space, tone: space.status === 'VERIFICADO' ? 'space' : 'draft', title: space.name })), [spaces]);

  return (
    <div className="marketplace-page">
      <PageHeading
        kicker="ADMINISTRACIÓN DE ESPACIOS"
        title="Mis espacios"
        description="Registrá los lugares que administrás. Cada uno se verifica con documentación antes de poder publicar convocatorias."
        action={!editing && <button className="market-button primary" onClick={() => { setEditing({}); setMessage(''); }}><Plus size={16} /> Proponer espacio</button>}
      />
      {message && <InlineMessage type="success">{message}</InlineMessage>}
      {editing && <SpaceForm initial={editing.id ? editing : null} onCancel={() => setEditing(null)} onSaved={(result) => { applyResult(result); setEditing(null); }} />}
      {loading ? <LoadingState label="Cargando tus espacios…" /> : error ? <ErrorState message={error} onRetry={load} /> : spaces.length === 0 ? (
        !editing && <EmptyState icon={Building2} title="Todavía no registraste espacios" text="Empezá proponiendo el lugar que administrás: una galería, un local, un salón o un espacio con permiso municipal." action={<button className="market-button primary" onClick={() => setEditing({})}><Plus size={15} /> Proponer espacio</button>} />
      ) : (
        <div className="spaces-layout">
          <div className="spaces-list">{spaces.map((space) => <SpaceCard key={space.id} space={space} onEdit={(item) => { setEditing(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }} onChanged={applyResult} />)}</div>
          <aside className="spaces-side">
            <div className="market-map-wrap"><MarkersMap items={mapItems} selectedId={selectedId} onSelect={setSelectedId} renderInfo={(space) => <div className="market-map-popup"><StatusBadge status={space.status} /><strong>{space.name}</strong><span>{space.address}</span></div>} className="market-map small" /></div>
            {verifiedCount > 0 && <button className="market-button primary w-full" onClick={() => onNavigate('admin')}>Publicar una convocatoria <ArrowRight size={15} /></button>}
          </aside>
        </div>
      )}
    </div>
  );
}

/** Inicio del organizador: estado de sus espacios, convocatorias y postulaciones por revisar. */
export function OrganizerHome({ user, onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([apiRequest('/spaces/mine'), apiRequest('/marketplace/events?mine=1'), apiRequest('/marketplace/admin/applications')])
      .then(([spaces, events, applications]) => { if (active) setData({ spaces, events, applications }); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  if (error) return <div className="marketplace-page"><ErrorState message={error} /></div>;
  if (!data) return <div className="marketplace-page"><LoadingState label="Cargando tu panel…" /></div>;
  const verified = data.spaces.filter((space) => space.status === 'VERIFICADO');
  const pendingSpaces = data.spaces.filter((space) => space.status === 'PENDIENTE');
  const toReview = data.applications.filter((item) => ['ENVIADA', 'EN_REVISION'].includes(item.status));
  const published = data.events.filter((event) => event.status === 'PUBLICADA');

  const steps = [
    { done: data.spaces.length > 0, title: 'Registrá tu espacio', text: 'Ubicalo en el mapa y contá quién es el titular.', action: () => onNavigate('spaces') },
    { done: data.spaces.some((space) => !space.missingDocuments?.length), title: 'Subí la documentación', text: 'Escritura, contrato, permiso municipal o autorización.', action: () => onNavigate('spaces') },
    { done: verified.length > 0, title: 'Esperá la verificación', text: 'La administración controla que el espacio sea tuyo o tengas permiso.', action: () => onNavigate('spaces') },
    { done: data.events.length > 0, title: 'Publicá una convocatoria', text: 'Fechas, cupos, rubros y costo del puesto.', action: () => onNavigate('admin') },
  ];
  const nextStep = steps.find((step) => !step.done);

  return (
    <div className="marketplace-page">
      <PageHeading kicker="PANEL DEL ORGANIZADOR" title={`Hola, ${user?.name || ''}.`} description="Administrá tus espacios, publicá convocatorias y elegí a los emprendedores que participan." />
      <div className="kpi-grid">
        <button type="button" className="kpi-tile link" onClick={() => onNavigate('spaces')}><span className="kpi-icon"><Building2 size={17} /></span><div><span>Espacios verificados</span><strong>{verified.length}</strong>{pendingSpaces.length > 0 && <small>{pendingSpaces.length} en revisión</small>}</div></button>
        <button type="button" className="kpi-tile link" onClick={() => onNavigate('admin')}><span className="kpi-icon"><FileText size={17} /></span><div><span>Convocatorias abiertas</span><strong>{published.length}</strong><small>{data.events.length} en total</small></div></button>
        <button type="button" className="kpi-tile link" onClick={() => onNavigate('admin')}><span className="kpi-icon"><ShieldCheck size={17} /></span><div><span>Postulaciones por revisar</span><strong>{toReview.length}</strong></div></button>
      </div>
      {nextStep && (
        <section className="market-panel onboarding-steps">
          <h2>Para empezar a recibir emprendedores</h2>
          <ol>
            {steps.map((step) => (
              <li key={step.title} className={step.done ? 'done' : step === nextStep ? 'current' : ''}>
                <span>{step.done ? '✓' : steps.indexOf(step) + 1}</span>
                <div><strong>{step.title}</strong><small>{step.text}</small></div>
                {step === nextStep && <button className="market-button primary small" onClick={step.action}>Continuar <ArrowRight size={14} /></button>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {toReview.length > 0 && (
        <section className="market-panel">
          <div className="portal-section-head"><h2>Últimas postulaciones</h2><button className="market-text-button" onClick={() => onNavigate('admin')}>Revisar todas <ArrowRight size={14} /></button></div>
          <ul className="mini-order-list">
            {toReview.slice(0, 5).map((item) => <li key={item.id}><div><strong>{item.business.name}</strong><small>{item.event.name} · {item.business.category}</small></div><StatusBadge status={item.status} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReviewActions({ space, onDone }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const review = async (status) => {
    if (status !== 'VERIFICADO' && !notes.trim()) { setError('Escribí el motivo para que el organizador pueda corregirlo.'); return; }
    if (status === 'SUSPENDIDO' && !window.confirm('Suspender cierra las convocatorias publicadas de este espacio. ¿Continuar?')) return;
    setBusy(true); setError('');
    try { onDone(await apiRequest(`/spaces/admin/${space.id}/review`, { method: 'PATCH', body: { status, notes } })); setNotes(''); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-review-actions">
      <textarea rows="2" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Motivo o comentario (obligatorio para rechazar o suspender)" />
      <div>
        {space.status !== 'VERIFICADO' && <button className="market-button primary" disabled={busy || space.missingDocuments?.length > 0} onClick={() => review('VERIFICADO')}><ShieldCheck size={15} /> Verificar</button>}
        {space.status === 'PENDIENTE' && <button className="market-button outline" disabled={busy} onClick={() => review('RECHAZADO')}>Rechazar</button>}
        {space.status === 'VERIFICADO' && <button className="market-button danger" disabled={busy} onClick={() => review('SUSPENDIDO')}>Suspender</button>}
      </div>
      {space.missingDocuments?.length > 0 && <small>No se puede verificar: falta {space.missingDocuments.map((kind) => DOCUMENT_KIND_LABEL[kind]).join(', ')}.</small>}
      {error && <InlineMessage type="error">{error}</InlineMessage>}
    </div>
  );
}

/** Administración de la plataforma: revisión de la documentación de los espacios. */
export function SpaceReviewPage() {
  const [status, setStatus] = useState('PENDIENTE');
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setSpaces(await apiRequest(`/spaces/admin/all?status=${status}`)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="marketplace-page">
      <PageHeading kicker="ADMINISTRACIÓN DE LA PLATAFORMA" title="Verificación de espacios" description="Revisá que la documentación acredite el derecho a usar cada lugar antes de habilitarlo para convocatorias." />
      <Tabs tabs={[['PENDIENTE', 'Pendientes'], ['VERIFICADO', 'Verificados'], ['RECHAZADO', 'Rechazados'], ['SUSPENDIDO', 'Suspendidos']]} active={status} onChange={(next) => { setStatus(next); setMessage(''); }} />
      {message && <InlineMessage type="success">{message}</InlineMessage>}
      {loading ? <LoadingState label="Cargando espacios…" /> : error ? <ErrorState message={error} onRetry={load} /> : spaces.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No hay espacios en este estado" text="Cuando un organizador proponga un espacio, aparecerá en Pendientes." />
      ) : (
        <div className="spaces-review-list">
          {spaces.map((space) => (
            <article key={space.id} className="space-card review">
              <div className="space-card-head">
                <span className="space-card-icon"><Building2 size={19} /></span>
                <div><h3>{space.name}</h3><span>{SPACE_TYPE_LABEL[space.type]} · {space.locality}</span></div>
                <StatusBadge status={space.status} />
              </div>
              <p className="space-card-address"><MapPin size={14} /> {space.address} <a href={googleMapsLink(space.latitude, space.longitude)} target="_blank" rel="noreferrer">Ver en Google Maps <ExternalLink size={12} /></a></p>
              <dl className="space-card-facts">
                <div><dt>Organizador</dt><dd>{space.owner.name} {space.owner.lastName} · {space.owner.email}</dd></div>
                <div><dt>Titular</dt><dd>{space.holderName} · {space.holderTaxId}</dd></div>
                <div><dt>Derecho declarado</dt><dd>{TENURE_LABEL[space.tenure]}</dd></div>
                <div><dt>Teléfono</dt><dd>{space.contactPhone}</dd></div>
                <div><dt>Declaración jurada</dt><dd>{formatDate(space.declarationAcceptedAt)}</dd></div>
                {space.reviewedAt && <div><dt>Última revisión</dt><dd>{space.reviewedBy ? `${space.reviewedBy.name} ${space.reviewedBy.lastName}` : '—'} · {formatDate(space.reviewedAt)}</dd></div>}
                {space.capacity && <div><dt>Puestos</dt><dd>{space.capacity}</dd></div>}
              </dl>
              {space.description && <p className="market-muted">{space.description}</p>}
              <DocumentList space={space} canDelete={false} />
              <p className="portal-hint">Controlá que el titular y el CUIT coincidan con el documento, y que la dirección del documento sea la marcada en el mapa.</p>
              <ReviewActions space={space} onDone={(result) => { setMessage(result.message); load(); }} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
