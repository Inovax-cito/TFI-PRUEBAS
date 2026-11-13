import React from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';

export const STATUS_LABEL = {
  BORRADOR: 'Borrador', PUBLICADA: 'Inscripción abierta', CERRADA: 'Cerrada', ENVIADA: 'Enviada',
  EN_REVISION: 'En revisión', APROBADA: 'Aprobada', NO_SELECCIONADA: 'No seleccionada', CANCELADA: 'Cancelada',
  SIN_CUPOS: 'Cupos completos',
  PENDIENTE: 'Pendiente', VERIFICADO: 'Verificado', RECHAZADO: 'Rechazado', SUSPENDIDO: 'Suspendido',
  CONFIRMADO: 'Confirmado', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado', LISTA_ESPERA: 'Lista de espera',
};

export const PAYMENT_LABEL = {
  NO_APLICA: 'Sin costo', PENDIENTE: 'Pago pendiente', INFORMADO: 'Pago informado', CONFIRMADO: 'Pago confirmado', RECHAZADO: 'Pago rechazado',
};
export const PAYMENT_METHOD_LABEL = { TRANSFERENCIA: 'Transferencia', EFECTIVO: 'Efectivo', OTRO: 'Otro medio', ONLINE_SIMULADO: 'Pago online (simulación)' };

/** Estrellas de calificación: solo lectura o seleccionables. */
export function Stars({ value = 0, onChange, size = 16, label }) {
  return (
    <span className={`stars ${onChange ? 'editable' : ''}`} role={onChange ? 'radiogroup' : 'img'} aria-label={label || `${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((star) => (onChange ? (
        <button key={star} type="button" role="radio" aria-checked={value === star} aria-label={`${star} estrellas`} onClick={() => onChange(star)} className={star <= value ? 'on' : ''} style={{ fontSize: size }}>★</button>
      ) : <span key={star} className={star <= Math.round(value) ? 'on' : ''} style={{ fontSize: size }}>★</span>))}
    </span>
  );
}

export function RatingBadge({ rating }) {
  if (!rating?.count) return <span className="rating-badge empty">Sin calificaciones</span>;
  return <span className="rating-badge"><span className="on">★</span> {rating.average.toFixed(1)} <small>({rating.count})</small></span>;
}

export const SPACE_TYPE_LABEL = {
  GALERIA: 'Galería', LOCAL_COMERCIAL: 'Local comercial', CENTRO_CULTURAL: 'Centro cultural',
  SALON_EVENTOS: 'Salón de eventos', PREDIO_PRIVADO: 'Predio privado', ESPACIO_PUBLICO: 'Espacio público (plaza, parque)', OTRO: 'Otro',
};

export const TENURE_LABEL = {
  PROPIETARIO: 'Soy propietario/a', LOCATARIO: 'Lo alquilo (locatario/a)', PERMISO_MUNICIPAL: 'Tengo permiso municipal',
  CONCESION: 'Tengo una concesión', AUTORIZACION_TITULAR: 'El titular me autorizó por escrito',
};

export const DOCUMENT_KIND_LABEL = {
  TITULO_PROPIEDAD: 'Título o escritura', CONTRATO_ALQUILER: 'Contrato de alquiler', PERMISO_MUNICIPAL: 'Permiso o concesión municipal',
  HABILITACION_COMERCIAL: 'Habilitación comercial', CONSTANCIA_CUIT: 'Constancia de CUIT', AUTORIZACION_TITULAR: 'Autorización del titular', OTRO: 'Otro documento',
};

export const formatDate = (value) => (value ? new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Fecha no informada');
export const formatShortDate = (value) => (value ? new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '');
export const formatTime = (value) => (value ? new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '');
export const formatMoney = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(value || 0));

export function StatusBadge({ status }) {
  return <span className={`market-status status-${String(status).toLowerCase()}`}>{STATUS_LABEL[status] || status}</span>;
}
export function PageHeading({ kicker, title, description, action }) {
  return (
    <header className="market-page-heading portal-heading">
      <div><span className="market-kicker">{kicker}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {action}
    </header>
  );
}
export function LoadingState({ label }) { return <div className="market-loading"><span /> {label}</div>; }
export function ErrorState({ message, onRetry }) {
  return <div className="market-error" role="alert"><CircleAlert size={18} /><span>{message}</span>{onRetry && <button onClick={onRetry}>Reintentar</button>}</div>;
}
export function InlineMessage({ type, children }) {
  return <p className={`market-inline-message ${type}`} role={type === 'error' ? 'alert' : 'status'}>{type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}{children}</p>;
}
export function EmptyState({ icon: Icon, title, text, action }) {
  return <div className="market-empty"><span><Icon size={22} /></span><h2>{title}</h2><p>{text}</p>{action}</div>;
}
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="portal-tabs" role="tablist">
      {tabs.map(([id, label, badge]) => (
        <button key={id} type="button" role="tab" aria-selected={active === id} className={active === id ? 'active' : ''} onClick={() => onChange(id)}>
          {label}{badge ? <span>{badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
