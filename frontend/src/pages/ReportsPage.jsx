import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Download,
  Printer,
  Calendar,
  Filter,
  PieChart as PieChartIcon,
  Boxes,
  Truck,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { apiRequest } from '../utils/api.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { CHART, TOOLTIP_STYLE, shortMoney } from '../utils/chartTheme.js';

export const ReportsPage = () => {
  const [reportType, setReportType] = useState('sales'); // 'sales' | 'financial' | 'inventory'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Datos
  const [salesReport, setSalesReport] = useState(null);
  const [financialReport, setFinancialReport] = useState(null);
  const [inventoryReport, setInventoryReport] = useState(null);

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      }).toString();

      if (reportType === 'sales') {
        const res = await apiRequest(`/reports/sales?${query}`);
        setSalesReport(res);
      } else if (reportType === 'financial') {
        const res = await apiRequest(`/reports/financial?${query}`);
        setFinancialReport(res);
      } else if (reportType === 'inventory') {
        const res = await apiRequest('/reports/inventory');
        setInventoryReport(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = (e) => {
    e.preventDefault();
    fetchReport();
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (reportType === 'sales' && salesReport?.sales) {
      csvContent += 'Numero Venta,Fecha,Cajero,Metodo Pago,Descuento,Total\n';
      salesReport.sales.forEach((s) => {
        csvContent += `"${s.saleNumber}","${s.createdAt}","${s.user?.name || ''}","${s.paymentMethod}",${s.discount},${s.total}\n`;
      });
    } else if (reportType === 'financial' && financialReport) {
      csvContent += 'Concepto,Monto\n';
      csvContent += `"Total Ventas",${financialReport.totalSalesRevenue}\n`;
      csvContent += `"Costo Mercaderia Vendida (COGS)",${financialReport.costOfGoodsSold}\n`;
      csvContent += `"Margen Bruto",${financialReport.grossMargin}\n`;
      csvContent += `"Gastos Operativos",${financialReport.operatingExpenses}\n`;
      csvContent += `"Ganancia Neta Estimada",${financialReport.netEstimatedProfit}\n`;
    } else if (reportType === 'inventory' && inventoryReport?.items) {
      csvContent += 'SKU,Producto,Categoria,Stock,Stock Minimo,Costo,Precio Venta,Valuacion Costo\n';
      inventoryReport.items.forEach((i) => {
        csvContent += `"${i.sku}","${i.name}","${i.category}",${i.stock},${i.minStock},${i.purchasePrice},${i.salePrice},${i.totalCostValuation}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const paymentBreakdown = salesReport?.paymentBreakdown || [];
  const paymentTotal = paymentBreakdown.reduce((sum, pm) => sum + Number(pm.amount || 0), 0);

  return (
    <div>
      <div className="page-header no-print">
        <div className="page-title-group">
          <h1>
            <BarChart3 size={24} className="text-primary" /> Reportes
          </h1>
          <p className="page-subtitle">
            Análisis de ventas, márgenes reales de rentabilidad y valuación de existencias
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={16} /> Exportar CSV
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* Selector de tipo de reporte y filtros de fecha */}
      <div className="card no-print" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn ${reportType === 'sales' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setReportType('sales')}
            >
              <TrendingUp size={15} /> Ventas
            </button>
            <button
              className={`btn ${reportType === 'financial' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setReportType('financial')}
            >
              <DollarSign size={15} /> Ganancias
            </button>
            <button
              className={`btn ${reportType === 'inventory' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setReportType('inventory')}
            >
              <Boxes size={15} /> Inventario
            </button>
          </div>

          {reportType !== 'inventory' && (
            <form onSubmit={handleApplyFilter} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto', padding: '5px 10px', fontSize: '0.85rem' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>hasta</span>
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto', padding: '5px 10px', fontSize: '0.85rem' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary btn-sm">
                <Filter size={14} /> Filtrar
              </button>
              {(startDate || endDate) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setStartDate(''); setEndDate(''); fetchReport(); }}
                >
                  Limpiar
                </button>
              )}
            </form>
          )}
        </div>
      </div>

      {/* ÁREA DE CONTENIDO (Imprimible) */}
      <div className="printable-area">
        {/* REPORTE DE VENTAS */}
        {reportType === 'sales' && (
          <div>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Facturación Bruta</span>
                  <span className="metric-value">{formatCurrency(salesReport?.summary?.totalRevenue)}</span>
                  <span className="metric-subtext">Total vendido en el período</span>
                </div>
                <div className="metric-icon-box icon-blue">
                  <DollarSign size={20} />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Operaciones</span>
                  <span className="metric-value">{salesReport?.summary?.salesCount || 0}</span>
                  <span className="metric-subtext">Tickets de venta emitidos</span>
                </div>
                <div className="metric-icon-box icon-slate">
                  <TrendingUp size={20} />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Ticket Promedio</span>
                  <span className="metric-value">{formatCurrency(salesReport?.summary?.averageTicket)}</span>
                  <span className="metric-subtext">Gasto medio por cliente</span>
                </div>
                <div className="metric-icon-box icon-green">
                  <DollarSign size={20} />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Margen Bruto de Venta</span>
                  <span className="metric-value text-success">{formatCurrency(salesReport?.summary?.grossProfit)}</span>
                  <span className="metric-subtext">
                    Rentabilidad: {salesReport?.summary?.profitMarginPct?.toFixed(1) || 0}%
                  </span>
                </div>
                <div className="metric-icon-box icon-green">
                  <TrendingUp size={20} />
                </div>
              </div>
            </div>

            {/* Desglose por método de pago */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card-header">
                <h3 className="card-title">
                  <PieChartIcon size={18} className="text-primary" /> ¿Cómo pagaron los clientes?
                </h3>
              </div>
              <p className="chart-help">Reparto del total vendido según el medio de pago. Los porcentajes suman 100%.</p>
              {paymentBreakdown.length === 0 ? (
                <div className="chart-empty" style={{ height: 200 }}>
                  <PieChartIcon size={22} />
                  <strong>No hay ventas en el período elegido</strong>
                  <span>Probá ampliar las fechas o limpiar el filtro.</span>
                </div>
              ) : (
                <div className="chart-split">
                  <div style={{ width: '100%', height: 220, position: 'relative' }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={paymentBreakdown}
                          dataKey="amount"
                          nameKey="method"
                          innerRadius={62}
                          outerRadius={96}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {paymentBreakdown.map((entry, index) => (
                            <Cell key={entry.method} fill={CHART.series[index % CHART.series.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="chart-donut-center">
                      <small>Total</small>
                      <strong>{shortMoney(paymentTotal)}</strong>
                    </div>
                  </div>
                  <div className="chart-legend">
                    {paymentBreakdown.map((pm, index) => (
                      <div className="chart-legend-row" key={pm.method}>
                        <span className="chart-legend-dot" style={{ background: CHART.series[index % CHART.series.length] }} />
                        <span>{pm.method}</span>
                        <span className="chart-legend-value">
                          {formatCurrency(pm.amount)}
                          <small>{paymentTotal ? Math.round((Number(pm.amount) / paymentTotal) * 100) : 0}%</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* REPORTE FINANCIERO */}
        {reportType === 'financial' && (
          <div>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Ingresos por Ventas</span>
                  <span className="metric-value">{formatCurrency(financialReport?.totalSalesRevenue)}</span>
                  <span className="metric-subtext">Facturación de operaciones</span>
                </div>
                <div className="metric-icon-box icon-blue">
                  <DollarSign size={20} />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Costo de Mercadería (COGS)</span>
                  <span className="metric-value text-danger">{formatCurrency(financialReport?.costOfGoodsSold)}</span>
                  <span className="metric-subtext">Costo de adquisición de lo vendido</span>
                </div>
                <div className="metric-icon-box icon-red">
                  <DollarSign size={20} />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Margen Bruto Comercial</span>
                  <span className="metric-value text-success">{formatCurrency(financialReport?.grossMargin)}</span>
                  <span className="metric-subtext">Ventas menos costo de productos</span>
                </div>
                <div className="metric-icon-box icon-green">
                  <TrendingUp size={20} />
                </div>
              </div>

              <div className="metric-card" style={{ borderColor: '#a7f3d0', background: '#f0fdf4' }}>
                <div className="metric-content">
                  <span className="metric-label" style={{ color: '#065f46' }}>Ganancia Neta Estimada</span>
                  <span className="metric-value text-success" style={{ fontSize: '1.7rem' }}>
                    {formatCurrency(financialReport?.netEstimatedProfit)}
                  </span>
                  <span className="metric-subtext" style={{ color: '#047857' }}>
                    Margen neto final: {financialReport?.marginPercentage?.toFixed(1) || 0}%
                  </span>
                </div>
                <div className="metric-icon-box icon-green">
                  <DollarSign size={20} />
                </div>
              </div>
            </div>

            {/* Cuadro de Conciliación Económica */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <DollarSign size={18} className="text-primary" /> Cómo se calcula la ganancia
                </h3>
              </div>
              <div style={{ maxWidth: '600px', margin: '0 auto', padding: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0', fontSize: '0.95rem' }}>
                  <span>(+) Ingresos Totales por Ventas:</span>
                  <strong className="text-primary">{formatCurrency(financialReport?.totalSalesRevenue)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0', fontSize: '0.95rem', color: '#dc2626' }}>
                  <span>(-) Costo de Mercadería Vendida (COGS):</span>
                  <strong>-{formatCurrency(financialReport?.costOfGoodsSold)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '2px solid #cbd5e1', fontSize: '1rem', fontWeight: 700 }}>
                  <span>(=) MARGEN BRUTO:</span>
                  <span className="text-success">{formatCurrency(financialReport?.grossMargin)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0', fontSize: '0.95rem', color: '#dc2626' }}>
                  <span>(-) Gastos y Egresos Operativos de Caja:</span>
                  <strong>-{formatCurrency(financialReport?.operatingExpenses)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0', fontSize: '0.95rem', color: '#16a34a' }}>
                  <span>(+) Otros Ingresos Extraordinarios de Caja:</span>
                  <strong>+{formatCurrency(financialReport?.otherIncomes)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderTop: '2px solid var(--color-text-main)', fontSize: '1.25rem', fontWeight: 800 }}>
                  <span>(=) GANANCIA NETA ESTIMADA:</span>
                  <span className="text-success">{formatCurrency(financialReport?.netEstimatedProfit)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORTE DE INVENTARIO */}
        {reportType === 'inventory' && (
          <div>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Valuación Stock (Costo)</span>
                  <span className="metric-value">{formatCurrency(inventoryReport?.summary?.totalCostValuation)}</span>
                  <span className="metric-subtext">Capital invertido</span>
                </div>
                <div className="metric-icon-box icon-slate">
                  <DollarSign size={20} />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Valuación Stock (Venta)</span>
                  <span className="metric-value text-primary">{formatCurrency(inventoryReport?.summary?.totalSaleValuation)}</span>
                  <span className="metric-subtext">Potencial de venta total</span>
                </div>
                <div className="metric-icon-box icon-blue">
                  <Boxes size={20} />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Margen Proyectado</span>
                  <span className="metric-value text-success">{formatCurrency(inventoryReport?.summary?.projectedGrossProfit)}</span>
                  <span className="metric-subtext">Beneficio bruto a realizar</span>
                </div>
                <div className="metric-icon-box icon-green">
                  <TrendingUp size={20} />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-content">
                  <span className="metric-label">Estado de Existencias</span>
                  <span className="metric-value">{inventoryReport?.summary?.totalProducts || 0}</span>
                  <span className="metric-subtext text-warning">
                    {inventoryReport?.summary?.lowStockCount || 0} productos en punto de quiebre
                  </span>
                </div>
                <div className="metric-icon-box icon-amber">
                  <Boxes size={20} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Inventario valorizado al día de hoy</h3>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>PRODUCTO</th>
                      <th>CATEGORÍA</th>
                      <th>STOCK</th>
                      <th>COSTO UNITARIO</th>
                      <th>PRECIO VENTA</th>
                      <th>VALOR COSTO</th>
                      <th>VALOR VENTA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryReport?.items?.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontFamily: 'monospace' }}>{item.sku}</td>
                        <td><strong>{item.name}</strong></td>
                        <td><span className="badge badge-neutral">{item.category}</span></td>
                        <td>
                          <span className={`badge ${item.stock <= item.minStock ? 'badge-warning' : 'badge-neutral'}`}>
                            {item.stock}
                          </span>
                        </td>
                        <td>{formatCurrency(item.purchasePrice)}</td>
                        <td>{formatCurrency(item.salePrice)}</td>
                        <td><strong>{formatCurrency(item.totalCostValuation)}</strong></td>
                        <td style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                          {formatCurrency(item.totalSaleValuation)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
