import React, { useMemo, useState } from 'react';
import { DoorOpen, Eraser, Mic2, PencilLine, Sparkles, Square, Toilet, Utensils } from 'lucide-react';

export const MARKS = {
  ENTRADA: { label: 'Entrada', short: 'IN', icon: DoorOpen },
  ESCENARIO: { label: 'Escenario', short: '♪', icon: Mic2 },
  BANO: { label: 'Baños', short: 'WC', icon: Toilet },
  COCINA: { label: 'Cocina', short: 'CO', icon: Utensils },
  PASILLO: { label: 'Pasillo', short: '', icon: Square },
};

const cellKey = (x, y) => `${x},${y}`;

/**
 * Dibuja el plano. `assignments` = { etiqueta: texto } para mostrar quién ocupa cada puesto;
 * `highlight` = etiqueta propia (se marca en el plano del emprendedor); `selectedLabel` resalta un puesto.
 */
export function StandPlanView({ plan, assignments = {}, highlight, selectedLabel, onCellClick, compact = false }) {
  const byCell = useMemo(() => Object.fromEntries([
    ...(plan?.marks || []).map((mark) => [cellKey(mark.x, mark.y), { kind: 'mark', ...mark }]),
    ...(plan?.stands || []).map((stand) => [cellKey(stand.x, stand.y), { kind: 'stand', ...stand }]),
  ]), [plan]);
  if (!plan) return null;
  const describe = (item) => {
    if (item?.kind === 'stand') {
      const owner = assignments[item.label];
      const classes = ['plan-cell', 'stand', owner && 'taken', highlight && item.label === highlight && 'mine', selectedLabel && item.label === selectedLabel && 'selected'];
      return {
        className: classes.filter(Boolean).join(' '),
        content: <><b>{item.label}</b>{owner && !compact && <small>{owner}</small>}</>,
        title: owner ? `Puesto ${item.label}: ${owner}` : `Puesto ${item.label} libre`,
      };
    }
    if (item?.kind === 'mark') return { className: `plan-cell mark mark-${item.type.toLowerCase()}`, content: MARKS[item.type]?.short, title: MARKS[item.type]?.label };
    return { className: 'plan-cell', content: null, title: undefined };
  };
  const positions = Array.from({ length: plan.rows * plan.cols }, (_, index) => ({ x: index % plan.cols, y: Math.floor(index / plan.cols) }));
  const cells = positions.map(({ x, y }) => {
    const item = byCell[cellKey(x, y)];
    const { className, content, title } = describe(item);
    return onCellClick
      ? <button key={cellKey(x, y)} type="button" className={className} title={title} aria-label={title || `Celda ${x + 1}, ${y + 1}`} onClick={() => onCellClick(x, y, item)}>{content}</button>
      : <div key={cellKey(x, y)} className={className} title={title}>{content}</div>;
  });
  return (
    <div className="plan-scroll">
      <div className={`plan-grid ${compact ? 'compact' : ''}`} style={{ gridTemplateColumns: `repeat(${plan.cols}, minmax(${compact ? 22 : 34}px, 1fr))` }}>{cells}</div>
    </div>
  );
}

export function PlanLegend({ showTaken = true }) {
  return (
    <div className="plan-legend">
      <span><i className="plan-cell stand" /> Puesto libre</span>
      {showTaken && <span><i className="plan-cell stand taken" /> Ocupado</span>}
      <span><i className="plan-cell stand mine" /> Tu puesto</span>
      <span><i className="plan-cell mark mark-entrada" /> Entrada</span>
    </div>
  );
}

const TOOLS = [
  ['PUESTO', 'Puesto', Square], ['ENTRADA', 'Entrada', DoorOpen], ['ESCENARIO', 'Escenario', Mic2],
  ['BANO', 'Baños', Toilet], ['COCINA', 'Cocina', Utensils], ['RENOMBRAR', 'Renombrar', PencilLine], ['BORRAR', 'Borrar', Eraser],
];

const nextLabel = (stands) => String(stands.reduce((max, stand) => Math.max(max, Number(stand.label) || 0), 0) + 1);

/** Arma un plano automático: filas de puestos con un pasillo en el medio y la entrada abajo. */
const autoPlan = (count) => {
  const total = Math.max(4, Math.min(count || 12, 120));
  const cols = Math.min(12, Math.max(6, Math.ceil(Math.sqrt(total * 2))));
  const perRow = cols;
  const standRows = Math.ceil(total / perRow);
  const rows = Math.min(16, standRows + Math.ceil(standRows / 2) + 1);
  const stands = [];
  let y = 0;
  let label = 1;
  while (label <= total && y < rows - 1) {
    for (let x = 0; x < cols && label <= total; x += 1) stands.push({ label: String(label++), x, y });
    y += (y % 3 === 1) ? 2 : 1; // cada dos filas de puestos, un pasillo
  }
  return { cols, rows, stands, marks: [{ type: 'ENTRADA', x: Math.floor(cols / 2), y: rows - 1 }] };
};

/** Editor del plano de puestos: el organizador toca celdas con la herramienta elegida. */
export function StandPlanEditor({ initialPlan, capacity, onSave, onCancel, busy }) {
  const [plan, setPlan] = useState(() => initialPlan || autoPlan(capacity));
  const [tool, setTool] = useState('PUESTO');
  const [error, setError] = useState('');

  const resize = (field, value) => {
    const size = Math.max(2, Math.min(field === 'cols' ? 24 : 16, Number(value) || 2));
    setPlan((current) => {
      const next = { ...current, [field]: size };
      const inside = (item) => item.x < next.cols && item.y < next.rows;
      return { ...next, stands: current.stands.filter(inside), marks: current.marks.filter(inside) };
    });
  };

  const onCellClick = (x, y, item) => {
    setError('');
    setPlan((current) => {
      const stands = current.stands.filter((stand) => !(stand.x === x && stand.y === y));
      const marks = current.marks.filter((mark) => !(mark.x === x && mark.y === y));
      if (tool === 'BORRAR') return { ...current, stands, marks };
      if (tool === 'RENOMBRAR') {
        if (item?.kind !== 'stand') return current;
        const label = window.prompt('Número o nombre del puesto (hasta 8 caracteres):', item.label)?.trim().slice(0, 8);
        if (!label || label === item.label) return current;
        if (current.stands.some((stand) => stand.label === label)) { setError(`Ya existe el puesto ${label}.`); return current; }
        return { ...current, stands: current.stands.map((stand) => (stand.x === x && stand.y === y ? { ...stand, label } : stand)) };
      }
      if (tool === 'PUESTO') {
        if (item?.kind === 'stand') return current;
        if (capacity && stands.length >= capacity) { setError(`La convocatoria tiene ${capacity} puestos.`); return current; }
        return { ...current, stands: [...stands, { label: nextLabel(stands), x, y }], marks };
      }
      return { ...current, stands, marks: [...marks, { type: tool, x, y }] };
    });
  };

  return (
    <div className="plan-editor">
      <div className="plan-toolbar" role="toolbar" aria-label="Herramientas del plano">
        {TOOLS.map(([id, label, Icon]) => (
          <button key={id} type="button" className={tool === id ? 'active' : ''} aria-pressed={tool === id} onClick={() => setTool(id)}><Icon size={14} /> {label}</button>
        ))}
        <button type="button" onClick={() => setPlan(autoPlan(capacity))}><Sparkles size={14} /> Armar automático</button>
      </div>
      <div className="plan-size">
        <label>Columnas<input type="number" min="2" max="24" value={plan.cols} onChange={(e) => resize('cols', e.target.value)} /></label>
        <label>Filas<input type="number" min="2" max="16" value={plan.rows} onChange={(e) => resize('rows', e.target.value)} /></label>
        <span>{plan.stands.length}{capacity ? `/${capacity}` : ''} puestos</span>
      </div>
      <StandPlanView plan={plan} onCellClick={onCellClick} />
      {error && <p className="messages-error" role="alert">{error}</p>}
      <div className="plan-actions">
        {onCancel && <button type="button" className="market-button outline" onClick={onCancel}>Cancelar</button>}
        <button type="button" className="market-button primary" disabled={busy} onClick={() => onSave(plan)}>{busy ? 'Guardando…' : 'Guardar plano'}</button>
      </div>
    </div>
  );
}
