import React, { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

const REASONS = [
  ['ESPACIO_AJENO', 'Ofrece un espacio que no le pertenece'],
  ['COBRO_INDEBIDO', 'Cobro indebido o estafa'],
  ['DATOS_FALSOS', 'Datos o documentación falsos'],
  ['TRATO', 'Trato inadecuado o acoso'],
  ['INCUMPLIMIENTO', 'No cumplió lo acordado'],
  ['OTRO', 'Otro motivo'],
];

/** Botón "Denunciar": envía la denuncia a la administración de la plataforma. */
export function ReportButton({ targetType, targetId, label = 'Denunciar', compact = false }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const send = async (event) => {
    event.preventDefault();
    setBusy(true); setResult(null);
    try {
      const data = await apiRequest('/platform/reports', { method: 'POST', body: { targetType, targetId, reason, details } });
      setResult({ ok: true, text: data.message });
      setReason(''); setDetails('');
    } catch (err) { setResult({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button type="button" className={`report-trigger ${compact ? 'compact' : ''}`} onClick={() => { setOpen(true); setResult(null); }}><Flag size={13} /> {label}</button>
      {open && (
        <div className="report-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <form className="report-dialog" role="dialog" aria-modal="true" aria-label="Denunciar" onSubmit={send}>
            <header><h2>Denunciar</h2><button type="button" className="market-close-button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={18} /></button></header>
            {result?.ok ? <p className="report-ok">{result.text}</p> : (
              <>
                <p className="portal-hint">La administración de Emprende revisa cada denuncia. Tus datos no se muestran a la persona denunciada.</p>
                <fieldset className="report-reasons">
                  {REASONS.map(([id, text]) => (
                    <label key={id}><input type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} /> {text}</label>
                  ))}
                </fieldset>
                <textarea rows="3" maxLength={1500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={reason === 'OTRO' ? 'Contanos qué pasó (obligatorio)' : 'Detalles (opcional): qué pasó, cuándo, montos…'} />
                {result && !result.ok && <p className="messages-error" role="alert">{result.text}</p>}
                <div className="plan-actions">
                  <button type="button" className="market-button outline" onClick={() => setOpen(false)}>Cancelar</button>
                  <button className="market-button danger" disabled={busy || !reason}>{busy ? 'Enviando…' : 'Enviar denuncia'}</button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </>
  );
}

export default ReportButton;
