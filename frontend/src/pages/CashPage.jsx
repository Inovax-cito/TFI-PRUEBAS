import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  MinusCircle,
  Lock,
  Unlock,
  History,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Calendar,
  X,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';
import { useAuth } from '../context/AuthContext.jsx';

export const CashPage = () => {
  const { isAdmin, user } = useAuth();

  const [activeTab, setActiveTab] = useState('current'); // 'current' | 'history'

  // Estado de caja actual
  const [cashData, setCashData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modales
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [initialAmount, setInitialAmount] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');
  const [openingLoading, setOpeningLoading] = useState(false);

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [realAmountCounted, setRealAmountCounted] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movType, setMovType] = useState('INGRESO');
  const [movAmount, setMovAmount] = useState('');
  const [movConcept, setMovConcept] = useState('');
  const [movCategory, setMovCategory] = useState('MANUAL');
  const [movLoading, setMovLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Historial de cajas cerradas
  const [cashHistory, setCashHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  useEffect(() => {
    fetchCurrentRegister();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchCashHistory();
    }
  }, [activeTab, historyPage]);

  const fetchCurrentRegister = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiRequest('/cash/current');
      setCashData(res);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error al obtener caja actual');
    } finally {
      setLoading(false);
    }
  };

  const fetchCashHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await apiRequest(`/cash/history?page=${historyPage}&limit=10`);
      setCashHistory(res.registers || []);
      setHistoryTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Abrir caja
  const handleOpenRegister = async (e) => {
    e.preventDefault();
    setOpeningLoading(true);
    setErrorMsg(null);

    try {
      await apiRequest('/cash/open', {
        method: 'POST',
        body: {
          initialAmount: parseFloat(initialAmount) || 0,
          notes: openingNotes,
        },
      });
      setShowOpenModal(false);
      setSuccessMsg('¡Apertura de caja realizada exitosamente!');
      fetchCurrentRegister();
    } catch (err) {
      setErrorMsg(err.message || 'Error al abrir caja');
    } finally {
      setOpeningLoading(false);
    }
  };

  // Cerrar caja (Arqueo)
  const handleCloseRegister = async (e) => {
    e.preventDefault();
    setClosingLoading(true);
    setErrorMsg(null);

    try {
      const res = await apiRequest('/cash/close', {
        method: 'POST',
        body: {
          realAmount: parseFloat(realAmountCounted) || 0,
          notes: closingNotes,
        },
      });
      setShowCloseModal(false);
      setSuccessMsg(`Cierre de caja completado. Diferencia final: ${formatCurrency(res.difference)}`);
      fetchCurrentRegister();
    } catch (err) {
      setErrorMsg(err.message || 'Error al cerrar caja');
    } finally {
      setClosingLoading(false);
    }
  };

  // Registrar movimiento manual
  const handleCreateMovement = async (e) => {
    e.preventDefault();
    setMovLoading(true);
    setErrorMsg(null);

    try {
      await apiRequest('/cash/movements', {
        method: 'POST',
        body: {
          type: movType,
          amount: parseFloat(movAmount),
          concept: movConcept,
          category: movCategory,
        },
      });
      setShowMovementModal(false);
      setMovAmount('');
      setMovConcept('');
      fetchCurrentRegister();
    } catch (err) {
      setErrorMsg(err.message || 'Error al asentar movimiento');
    } finally {
      setMovLoading(false);
    }
  };

  const isOpen = cashData?.isOpen;
  const summary = cashData?.summary;
  const movements = cashData?.register?.movements || [];

  // Cálculos para modal de cierre
  const countedNum = parseFloat(realAmountCounted) || 0;
  const theoreticalNum = summary?.theoreticalAmount || 0;
  const diffNum = countedNum - theoreticalNum;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            <Wallet size={24} className="text-primary" /> Control de Caja & Arqueo Diario
          </h1>
          <p className="page-subtitle">
            Gestión de ingresos, egresos, saldos teóricos y conciliación de dinero contado
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${activeTab === 'current' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('current')}
          >
            <Wallet size={16} /> Turno Actual
          </button>
          {isAdmin && (
            <button
              className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={16} /> Historial de Turnos
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '12px 16px', background: '#ecfdf5', color: '#065f46', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {activeTab === 'current' ? (
        <div>
          {/* Banner de Estado de Caja */}
          <div
            className="card"
            style={{
              marginBottom: '20px',
              borderLeft: `5px solid ${isOpen ? '#10b981' : '#ef4444'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    backgroundColor: isOpen ? '#ecfdf5' : '#fef2f2',
                    color: isOpen ? '#059669' : '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isOpen ? <Unlock size={24} /> : <Lock size={24} />}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                      Caja {isOpen ? 'Abierta y Operativa' : 'Cerrada'}
                    </h3>
                    <span className={`badge ${isOpen ? 'badge-success' : 'badge-danger'}`}>
                      {isOpen ? 'TURNO ACTIVO' : 'TURNO FINALIZADO'}
                    </span>
                  </div>

                  <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                    {isOpen ? (
                      <>
                        Abierta por <strong>{cashData?.register?.openingUser?.name} {cashData?.register?.openingUser?.lastName}</strong> el {formatDateTime(cashData?.register?.openedAt)}
                      </>
                    ) : (
                      'Para registrar ventas en efectivo o movimientos de fondos, debe realizar una apertura de caja.'
                    )}
                  </p>
                </div>
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: '10px' }}>
                {!isOpen ? (
                  <button className="btn btn-primary" onClick={() => setShowOpenModal(true)}>
                    <Unlock size={16} /> Abrir Turno de Caja
                  </button>
                ) : (
                  <>
                    <button className="btn btn-secondary" onClick={() => setShowMovementModal(true)}>
                      <PlusCircle size={16} /> Movimiento Manual
                    </button>
                    <button className="btn btn-danger" onClick={() => { setRealAmountCounted(''); setShowCloseModal(true); }}>
                      <Lock size={16} /> Arqueo & Cierre de Caja
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tarjetas de Balance del Turno Actual */}
          {isOpen && summary && (
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Fondo Inicial de Apertura</span>
                  <span className="metric-value">{formatCurrency(summary.initialAmount)}</span>
                  <span className="metric-subtext">Dinero en caja al abrir</span>
                </div>
                <div className="metric-icon-box icon-slate">
                  <Wallet size={20} />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Ingresos Registrados</span>
                  <span className="metric-value text-success">{formatCurrency(summary.totalIncomes)}</span>
                  <span className="metric-subtext">Ventas y aportes de caja</span>
                </div>
                <div className="metric-icon-box icon-green">
                  <ArrowUpRight size={20} />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Egresos Registrados</span>
                  <span className="metric-value text-danger">{formatCurrency(summary.totalExpenses)}</span>
                  <span className="metric-subtext">Compras y pagos operativos</span>
                </div>
                <div className="metric-icon-box icon-red">
                  <ArrowDownRight size={20} />
                </div>
              </div>

              <div className="metric-card" style={{ borderColor: '#bfdbfe', background: '#f0f9ff' }}>
                <div className="metric-content">
                  <span className="metric-label" style={{ color: '#1e40af' }}>Saldo Teórico Esperado</span>
                  <span className="metric-value" style={{ color: '#1d4ed8' }}>{formatCurrency(summary.theoreticalAmount)}</span>
                  <span className="metric-subtext">Debe haber físicamente en caja</span>
                </div>
                <div className="metric-icon-box icon-blue">
                  <DollarSign size={20} />
                </div>
              </div>
            </div>
          )}

          {/* Tabla de Movimientos del Turno Actual */}
          {isOpen && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <History size={18} className="text-primary" /> Movimientos del Turno Actual ({movements.length})
                </h3>
                <button className="btn btn-secondary btn-sm" onClick={fetchCurrentRegister}>
                  <RefreshCw size={14} /> Actualizar
                </button>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>HORA</th>
                      <th>TIPO</th>
                      <th>CATEGORÍA</th>
                      <th>CONCEPTO</th>
                      <th>IMPORTE</th>
                      <th>RESPONSABLE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                          Aún no se registran movimientos en este turno.
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => (
                        <tr key={m.id}>
                          <td>{formatDateTime(m.createdAt)}</td>
                          <td>
                            <span className={`badge ${m.type === 'INGRESO' ? 'badge-success' : 'badge-danger'}`}>
                              {m.type === 'INGRESO' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {m.type}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-neutral">{m.category}</span>
                          </td>
                          <td><strong>{m.concept}</strong></td>
                          <td>
                            <span style={{ fontWeight: 700, color: m.type === 'INGRESO' ? '#16a34a' : '#dc2626' }}>
                              {m.type === 'INGRESO' ? `+${formatCurrency(m.amount)}` : `-${formatCurrency(m.amount)}`}
                            </span>
                          </td>
                          <td>{m.user ? `${m.user.name} ${m.user.lastName}` : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* PESTAÑA 2: HISTORIAL DE TURNOS DE CAJA */
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <History size={18} className="text-primary" /> Historial de Turnos de Caja (Aperturas y Cierres)
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={fetchCashHistory}>
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ESTADO</th>
                  <th>APERTURA</th>
                  <th>RESPONSABLE APERTURA</th>
                  <th>FONDO INICIAL</th>
                  <th>CIERRE</th>
                  <th>SALDO TEÓRICO</th>
                  <th>DINERO CONTADO</th>
                  <th>DIFERENCIA</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>
                      Cargando historial de turnos...
                    </td>
                  </tr>
                ) : cashHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      No se encontraron turnos de caja registrados.
                    </td>
                  </tr>
                ) : (
                  cashHistory.map((reg) => {
                    const diff = Number(reg.difference || 0);
                    const isBalanced = Math.abs(diff) < 0.01;

                    return (
                      <tr key={reg.id}>
                        <td>
                          <span className={`badge ${reg.status === 'ABIERTA' ? 'badge-success' : 'badge-neutral'}`}>
                            {reg.status}
                          </span>
                        </td>
                        <td>{formatDateTime(reg.openedAt)}</td>
                        <td>{reg.openingUser?.name} {reg.openingUser?.lastName}</td>
                        <td>{formatCurrency(reg.initialAmount)}</td>
                        <td>{reg.closedAt ? formatDateTime(reg.closedAt) : 'En curso'}</td>
                        <td>{reg.theoreticalAmount ? formatCurrency(reg.theoreticalAmount) : '-'}</td>
                        <td>{reg.realAmount ? formatCurrency(reg.realAmount) : '-'}</td>
                        <td>
                          {reg.status === 'CERRADA' ? (
                            <span style={{ fontWeight: 700, color: isBalanced ? '#16a34a' : diff > 0 ? '#2563eb' : '#dc2626' }}>
                              {isBalanced ? 'Exacto ($0,00)' : diff > 0 ? `+${formatCurrency(diff)} (Sobrante)` : `${formatCurrency(diff)} (Faltante)`}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>En curso</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span>Página {historyPage} de {historyTotalPages}</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={historyPage >= historyTotalPages}
                onClick={() => setHistoryPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Apertura de Caja */}
      {showOpenModal && (
        <div className="modal-overlay" onClick={() => setShowOpenModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Unlock size={20} className="text-primary" /> Apertura de Turno de Caja
              </h2>
              <button className="modal-close-btn" onClick={() => setShowOpenModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleOpenRegister}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Usuario Responsable</label>
                  <input className="form-input" value={`${user?.name} ${user?.lastName}`} disabled style={{ background: '#f1f5f9' }} />
                </div>

                <div className="form-group">
                  <label className="form-label">Saldo Inicial en Efectivo (Fondo de Cambio) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(e.target.value)}
                    required
                    autoFocus
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Dinero físico en billetes y monedas con el que arranca la jornada.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Observaciones de Apertura</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="ej: Turno mañana, billetes chicos..."
                    value={openingNotes}
                    onChange={(e) => setOpeningNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowOpenModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={openingLoading}>
                  {openingLoading ? 'Abriendo...' : 'Confirmar Apertura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cierre de Caja / Arqueo */}
      {showCloseModal && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title text-danger">
                <Lock size={20} /> Arqueo y Cierre de Caja
              </h2>
              <button className="modal-close-btn" onClick={() => setShowCloseModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCloseRegister}>
              <div className="modal-body">
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                    <span>Saldo inicial:</span>
                    <span>{formatCurrency(summary?.initialAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', color: '#16a34a' }}>
                    <span>(+) Total Ingresos:</span>
                    <span>+{formatCurrency(summary?.totalIncomes)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', color: '#dc2626' }}>
                    <span>(-) Total Egresos:</span>
                    <span>-{formatCurrency(summary?.totalExpenses)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '8px', fontSize: '1.05rem', fontWeight: 700 }}>
                    <span>SALDO TEÓRICO:</span>
                    <span className="text-primary">{formatCurrency(theoreticalNum)}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                    Dinero Contado en Mano (Arqueo Físico) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    style={{ fontSize: '1.1rem', fontWeight: 700, padding: '10px' }}
                    placeholder="Monto real contado..."
                    value={realAmountCounted}
                    onChange={(e) => setRealAmountCounted(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {realAmountCounted !== '' && (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      background: Math.abs(diffNum) < 0.01 ? '#ecfdf5' : diffNum > 0 ? '#eff6ff' : '#fef2f2',
                      border: `1px solid ${Math.abs(diffNum) < 0.01 ? '#a7f3d0' : diffNum > 0 ? '#bfdbfe' : '#fecaca'}`,
                      marginBottom: '14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Diferencia de Caja:</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: Math.abs(diffNum) < 0.01 ? '#065f46' : diffNum > 0 ? '#1e40af' : '#991b1b' }}>
                      {Math.abs(diffNum) < 0.01
                        ? 'Exacto ($0,00)'
                        : diffNum > 0
                        ? `+${formatCurrency(diffNum)} (Sobrante)`
                        : `${formatCurrency(diffNum)} (Faltante)`}
                    </span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Observaciones del Cierre</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Comentarios sobre el recuento o motivos de diferencia..."
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCloseModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger" disabled={closingLoading}>
                  {closingLoading ? 'Cerrando...' : 'Confirmar Cierre de Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimiento Manual */}
      {showMovementModal && (
        <div className="modal-overlay" onClick={() => setShowMovementModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <DollarSign size={20} className="text-primary" /> Registrar Movimiento Manual
              </h2>
              <button className="modal-close-btn" onClick={() => setShowMovementModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateMovement}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tipo de Movimiento *</label>
                  <select
                    className="form-select"
                    value={movType}
                    onChange={(e) => setMovType(e.target.value)}
                  >
                    <option value="INGRESO">Ingreso de Dinero (+)</option>
                    <option value="EGRESO">Egreso de Dinero / Retiro (-)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Importe $ *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={movAmount}
                    onChange={(e) => setMovAmount(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select
                    className="form-select"
                    value={movCategory}
                    onChange={(e) => setMovCategory(e.target.value)}
                  >
                    <option value="MANUAL">Manual / Varios</option>
                    <option value="GASTO_OPERATIVO">Gasto Operativo (Limpieza, viáticos, etc.)</option>
                    <option value="RETIRO">Retiro de Ganancias del Titular</option>
                    <option value="APORTE">Aporte Extraordinario de Fondos</option>
                    <option value="PAGO_SERVICIO">Pago de Servicios (Luz, Internet, etc.)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Concepto o Detalle *</label>
                  <input
                    className="form-input"
                    placeholder="ej: Pago de flete, compra de bolsas, etc."
                    value={movConcept}
                    onChange={(e) => setMovConcept(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMovementModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={movLoading}>
                  {movLoading ? 'Registrando...' : 'Registrar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
