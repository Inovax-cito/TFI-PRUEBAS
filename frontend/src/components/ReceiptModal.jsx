import React from 'react';
import { X, Printer } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

export const ReceiptModal = ({ isOpen, onClose, sale, businessConfig }) => {
  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const config = businessConfig || {
    businessName: 'Mi Comercio',
    cuit: '20-00000000-0',
    address: 'Av. Principal 1234',
    phone: '+54 11 0000-0000',
    receiptFooter: '¡Gracias por su compra! Comprobante de autogestión comercial no fiscal.',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header no-print">
          <h2 className="modal-title">
            Comprobante de Venta {sale.saleNumber}
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body printable-area">
          <div className="ticket-container">
            <div className="ticket-header">
              <div className="ticket-store-name">{config.businessName}</div>
              {config.cuit && <div>CUIT: {config.cuit}</div>}
              {config.address && <div>{config.address}</div>}
              {config.phone && <div>Tel: {config.phone}</div>}
              <div style={{ marginTop: '8px', fontWeight: 'bold' }}>
                COMPROBANTE INTERNO (NO FISCAL)
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', marginBottom: '8px' }}>
              <div><strong>N° Operación:</strong> {sale.saleNumber}</div>
              <div><strong>Fecha:</strong> {formatDateTime(sale.createdAt)}</div>
              <div>
                <strong>Atendido por:</strong> {sale.user ? `${sale.user.name} ${sale.user.lastName}` : 'Cajero'}
              </div>
              <div><strong>Medio de pago:</strong> {sale.paymentMethod}</div>
              {sale.status === 'CANCELADA' && (
                <div style={{ color: '#dc2626', fontWeight: 'bold', marginTop: '4px' }}>
                  *** VENTA ANULADA ***
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
              <table className="ticket-table">
                <thead>
                  <tr style={{ borderBottom: '1px dashed #cbd5e1', fontSize: '0.78rem' }}>
                    <th style={{ width: '45%' }}>DESCRIPCIÓN</th>
                    <th style={{ textAlign: 'center' }}>CANT</th>
                    <th style={{ textAlign: 'right' }}>P.UNIT</th>
                    <th style={{ textAlign: 'right' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.details?.map((item) => (
                    <tr key={item.id} style={{ fontSize: '0.8rem' }}>
                      <td>{item.product?.name || 'Producto'}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ticket-totals">
              {Number(sale.discount) > 0 && (
                <div className="ticket-row" style={{ color: '#16a34a' }}>
                  <span>Descuento aplicado:</span>
                  <span>- {formatCurrency(sale.discount)}</span>
                </div>
              )}
              <div className="ticket-row" style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>
                <span>TOTAL A PAGAR:</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
            </div>

            <div className="ticket-footer">
              <p>{config.receiptFooter || '¡Muchas gracias por su compra!'}</p>
              <p style={{ marginTop: '4px', fontSize: '0.68rem', color: '#94a3b8' }}>
                Emprende
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print">
          <button className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Imprimir Comprobante
          </button>
        </div>
      </div>
    </div>
  );
};
