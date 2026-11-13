import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';
import { ReportButton } from './ReportButton.jsx';

const POLL_MS = 6000;
const timeLabel = (value) => new Date(value).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Conversación de una postulación entre emprendedor y organizador. Se actualiza sola cada pocos segundos. */
export function MessagesPanel({ applicationId, onClose }) {
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const countRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const result = await apiRequest(`/participation/${applicationId}/messages`);
      setData(result);
      window.dispatchEvent(new Event('messages:read'));
    } catch (err) { setError(err.message); }
  }, [applicationId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const count = data?.messages.length || 0;
    if (count !== countRef.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    countRef.current = count;
  }, [data]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async (event) => {
    event?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true); setError('');
    try {
      await apiRequest(`/participation/${applicationId}/messages`, { method: 'POST', body: { body: text } });
      setText('');
      await load();
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  };

  return (
    <div className="messages-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="messages-panel" role="dialog" aria-modal="true" aria-label="Mensajes">
        <header>
          <div><span className="market-kicker">MENSAJES</span><h2>{data?.title || 'Conversación'}</h2>{data && data.role !== 'admin' && <ReportButton targetType="CONVERSACION" targetId={applicationId} label="Denunciar conversación" compact />}</div>
          <button type="button" className="market-close-button" onClick={onClose} aria-label="Cerrar mensajes"><X size={18} /></button>
        </header>
        <div className="messages-list" ref={listRef} aria-live="polite">
          {!data ? <p className="market-muted">Cargando…</p> : data.messages.length === 0 ? (
            <p className="messages-empty">Todavía no hay mensajes. Escribí para coordinar el puesto, el horario o cualquier duda.</p>
          ) : data.messages.map((message) => (
            <div key={message.id} className={`message ${message.mine ? 'mine' : 'theirs'} ${message.kind === 'AUTOMATICO' ? 'auto' : ''}`}>
              {message.kind === 'AUTOMATICO' && <span className="message-tag"><Bot size={12} /> Mensaje automático</span>}
              <p>{message.body}</p>
              <small>{message.mine ? 'Vos' : `${message.sender.name} ${message.sender.lastName}`} · {timeLabel(message.createdAt)}{message.mine && message.readAt ? ' · Leído' : ''}</small>
            </div>
          ))}
        </div>
        {error && <p className="messages-error" role="alert">{error}</p>}
        {data?.canWrite ? (
          <form className="messages-compose" onSubmit={send}>
            <textarea
              rows="2" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí un mensaje…"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button type="submit" className="market-button primary" disabled={sending || !text.trim()} aria-label="Enviar"><Send size={16} /></button>
          </form>
        ) : data && <p className="messages-readonly">{data.role === 'admin' ? 'La administración puede leer esta conversación, pero no escribir.' : 'Enviá la postulación para poder escribir.'}</p>}
      </section>
    </div>
  );
}

export default MessagesPanel;
