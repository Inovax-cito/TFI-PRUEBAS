import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BarChart3, Check, ChevronRight, CircleHelp,
  Clock3, DollarSign, FileText, Lightbulb, Plus, Save, Trash2, TrendingUp,
} from 'lucide-react';
import './AnalysisPage.css';

const STORAGE_KEY = 'tfi-business-analyses-v1';
const TEMPLATES = [
  {
    id: 'product-profitability', title: 'Rentabilidad de productos',
    description: 'Compará precio y costo para entender cuánto deja cada producto.',
    icon: DollarSign, tag: 'Costos y margen',
  },
  {
    id: 'sales-products', title: 'Ventas y productos más vendidos',
    description: 'Registrá las ventas de un período y encontrá qué productos se mueven más.',
    icon: TrendingUp, tag: 'Ventas',
  },
];

const blankProduct = () => ({ name: '', salePrice: '', unitCost: '', unitsSold: '' });
const blankSale = () => ({ name: '', units: '', total: '' });
const readSaved = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const currency = (value) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 2,
}).format(value);
const number = (value) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
const dateLabel = (value) => new Date(value).toLocaleDateString('es-AR', {
  day: '2-digit', month: 'short', year: 'numeric',
});

function calcProfitability(rows) {
  const products = rows.map((row) => {
    const salePrice = Number(row.salePrice);
    const unitCost = row.unitCost === '' ? null : Number(row.unitCost);
    const unitsSold = row.unitsSold === '' ? null : Number(row.unitsSold);
    return {
      name: row.name.trim(), salePrice, unitCost, unitsSold,
      unitMargin: unitCost === null ? null : salePrice - unitCost,
      marginPct: unitCost === null || salePrice <= 0 ? null : ((salePrice - unitCost) / salePrice) * 100,
      estimatedTotal: unitCost === null || unitsSold === null ? null : (salePrice - unitCost) * unitsSold,
    };
  });
  const withCost = products.filter((item) => item.unitCost !== null);
  const withQuantityAndCost = products.filter((item) => item.estimatedTotal !== null);
  return {
    products,
    knownCostCount: withCost.length,
    totalCount: products.length,
    avgMarginPct: withCost.length ? withCost.reduce((sum, p) => sum + p.marginPct, 0) / withCost.length : null,
    estimatedTotal: withQuantityAndCost.length ? withQuantityAndCost.reduce((sum, p) => sum + p.estimatedTotal, 0) : null,
    estimatedCount: withQuantityAndCost.length,
    best: withCost.length ? [...withCost].sort((a, b) => b.unitMargin - a.unitMargin)[0] : null,
  };
}

function calcSales(rows) {
  const products = rows.map((row) => ({
    name: row.name.trim(), units: Number(row.units), total: Number(row.total),
  }));
  const totalSales = products.reduce((sum, row) => sum + row.total, 0);
  const totalUnits = products.reduce((sum, row) => sum + row.units, 0);
  return {
    products: [...products].sort((a, b) => b.units - a.units),
    totalSales, totalUnits,
    best: [...products].sort((a, b) => b.units - a.units)[0],
    average: products.length ? totalSales / products.length : 0,
  };
}

export function AnalysisPage() {
  const [saved, setSaved] = useState(readSaved);
  const [view, setView] = useState('home');
  const [templateId, setTemplateId] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState('');
  const [productRows, setProductRows] = useState([blankProduct()]);
  const [salesRows, setSalesRows] = useState([blankSale()]);
  const [error, setError] = useState('');

  const template = TEMPLATES.find((item) => item.id === templateId);
  const result = useMemo(() => {
    if (templateId === 'product-profitability') return calcProfitability(productRows);
    if (templateId === 'sales-products') return calcSales(salesRows);
    return null;
  }, [productRows, salesRows, templateId]);

  const persist = (items) => {
    setSaved(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      setError('No se pudo guardar en este navegador. Revisá el espacio disponible o la configuración de privacidad.');
    }
  };

  const startAnalysis = (id) => {
    setTemplateId(id);
    setAnalysisId(null);
    setTitle('');
    setPeriod('');
    setProductRows([blankProduct()]);
    setSalesRows([blankSale()]);
    setError('');
    setView('form');
  };

  const editAnalysis = (item) => {
    setTemplateId(item.templateId);
    setAnalysisId(item.id);
    setTitle(item.title);
    setPeriod(item.period || '');
    setProductRows(item.inputs.productRows || [blankProduct()]);
    setSalesRows(item.inputs.salesRows || [blankSale()]);
    setError('');
    setView('form');
  };

  const updateRow = (setter, rows, index, key, value) => {
    setter(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  };

  const validate = () => {
    if (!title.trim()) return 'Escribí un nombre para identificar este análisis.';
    if (templateId === 'product-profitability') {
      if (!productRows.length || productRows.some((row) => !row.name.trim())) return 'Completá el nombre de cada producto.';
      if (productRows.some((row) => row.salePrice === '' || !Number.isFinite(Number(row.salePrice)) || Number(row.salePrice) <= 0)) return 'Ingresá un precio de venta mayor que cero para cada producto.';
      if (productRows.some((row) => row.unitCost !== '' && (!Number.isFinite(Number(row.unitCost)) || Number(row.unitCost) < 0))) return 'El costo debe ser cero o un valor positivo. Si no lo conocés, dejalo vacío.';
      if (productRows.some((row) => row.unitsSold !== '' && (!Number.isFinite(Number(row.unitsSold)) || Number(row.unitsSold) < 0))) return 'Las unidades vendidas deben ser cero o un valor positivo.';
    } else {
      if (!period.trim()) return 'Indicá el período al que corresponden estos datos.';
      if (!salesRows.length || salesRows.some((row) => !row.name.trim())) return 'Completá el nombre de cada producto.';
      if (salesRows.some((row) => row.units === '' || !Number.isFinite(Number(row.units)) || Number(row.units) <= 0)) return 'Ingresá unidades vendidas mayores que cero para cada producto.';
      if (salesRows.some((row) => row.total === '' || !Number.isFinite(Number(row.total)) || Number(row.total) < 0)) return 'El importe vendido debe ser cero o un valor positivo.';
    }
    return '';
  };

  const showResults = (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError('');
    setView('results');
  };

  const saveAnalysis = () => {
    const savedAt = new Date().toISOString();
    const item = {
      id: analysisId || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
      templateId, title: title.trim(), period: period.trim(),
      inputs: { productRows, salesRows }, result, savedAt,
    };
    const next = analysisId ? saved.map((old) => old.id === analysisId ? item : old) : [item, ...saved];
    persist(next);
    setAnalysisId(item.id);
    setView('saved');
  };

  const removeAnalysis = (id) => {
    persist(saved.filter((item) => item.id !== id));
  };

  const goHome = () => { setError(''); setView('home'); };

  if (view === 'home' || view === 'saved') {
    return (
      <div className="analysis-page">
        <header className="analysis-hero">
          <div>
            <div className="analysis-eyebrow"><span className="analysis-eyebrow-dot" /> HERRAMIENTAS PARA TU NEGOCIO</div>
            <h1>Decisiones más claras, con tus propios datos.</h1>
            <p>Elegí un análisis, cargá lo que ya sabés y entendé qué muestran los números.</p>
          </div>
          <div className="analysis-hero-art" aria-hidden="true"><BarChart3 size={56} strokeWidth={1.35} /><span className="analysis-art-spark">✳</span></div>
        </header>

        {view === 'saved' && (
          <div className="analysis-toast" role="status"><Check size={17} /> Análisis guardado en este dispositivo.
            <button type="button" onClick={goHome} aria-label="Cerrar mensaje">×</button>
          </div>
        )}

        <section className="analysis-section">
          <div className="analysis-section-heading">
            <div><span className="analysis-overline">EMPEZÁ POR UNA PREGUNTA</span><h2>¿Qué querés entender?</h2></div>
            <span className="analysis-step-hint"><span>1</span> Elegí una plantilla</span>
          </div>
          <div className="analysis-template-grid">
            {TEMPLATES.map((item, index) => {
              const Icon = item.icon;
              return (
                <button className={`analysis-template-card theme-${index}`} key={item.id} onClick={() => startAnalysis(item.id)}>
                  <span className="analysis-template-icon"><Icon size={21} /></span>
                  <span className="analysis-template-tag">{item.tag}</span>
                  <strong>{item.title}</strong>
                  <span className="analysis-template-description">{item.description}</span>
                  <span className="analysis-template-action">Empezar análisis <ArrowRight size={16} /></span>
                </button>
              );
            })}
          </div>
          <div className="analysis-note"><CircleHelp size={17} /><p><strong>No necesitás tener todo perfecto.</strong> Si no conocés un dato, podés dejarlo sin completar. El resultado indicará qué se pudo calcular y qué información falta.</p></div>
        </section>

        <section className="analysis-section analysis-history-section">
          <div className="analysis-section-heading">
            <div><span className="analysis-overline">TU ACTIVIDAD</span><h2>Análisis guardados <span className="analysis-count">{saved.length}</span></h2></div>
            {saved.length > 0 && <span className="analysis-step-hint"><Clock3 size={15} /> Guardados en este dispositivo</span>}
          </div>
          {saved.length === 0 ? (
            <div className="analysis-empty"><div className="analysis-empty-icon"><FileText size={22} /></div><div><strong>Acá vas a encontrar tus análisis</strong><p>Cuando guardes uno, podrás volver a consultarlo o actualizar sus datos.</p></div></div>
          ) : (
            <div className="analysis-history-list">
              {saved.map((item) => {
                const savedTemplate = TEMPLATES.find((entry) => entry.id === item.templateId);
                const Icon = savedTemplate?.icon || FileText;
                const summary = item.templateId === 'product-profitability'
                  ? `${item.result?.totalCount || 0} productos · ${item.result?.knownCostCount || 0} con costo informado`
                  : `${item.result?.totalUnits || 0} unidades · ${item.period || 'Período sin nombre'}`;
                return (
                  <article className="analysis-history-item" key={item.id}>
                    <span className="analysis-history-icon"><Icon size={19} /></span>
                    <div className="analysis-history-main"><strong>{item.title}</strong><span>{savedTemplate?.title} · {summary}</span></div>
                    <time>{dateLabel(item.savedAt)}</time>
                    <button className="analysis-icon-button" type="button" onClick={() => editAnalysis(item)} aria-label={`Editar ${item.title}`} title="Abrir y editar"><ChevronRight size={19} /></button>
                    <button className="analysis-icon-button danger" type="button" onClick={() => removeAnalysis(item.id)} aria-label={`Eliminar ${item.title}`} title="Eliminar"><Trash2 size={16} /></button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <p className="analysis-storage-caption">Los análisis se guardan únicamente en este navegador.</p>
      </div>
    );
  }

  const rows = templateId === 'product-profitability' ? productRows : salesRows;
  const setRows = templateId === 'product-profitability' ? setProductRows : setSalesRows;
  const addRow = templateId === 'product-profitability' ? blankProduct : blankSale;

  return (
    <div className="analysis-page">
      <button className="analysis-back-link" onClick={goHome}><ArrowLeft size={16} /> Volver a análisis</button>
      <div className="analysis-flow-header">
        <div><span className="analysis-overline">NUEVO ANÁLISIS · PASO {view === 'form' ? '2' : '3'} DE 3</span><h1>{view === 'results' ? 'Revisá tus resultados' : template?.title}</h1><p>{view === 'results' ? 'Los indicadores se calcularon únicamente con los datos que ingresaste.' : template?.description}</p></div>
        <div className="analysis-progress" aria-label={`Paso ${view === 'form' ? 2 : 3} de 3`}><span className="complete" /><span className="complete" /><span className={view === 'results' ? 'complete' : ''} /></div>
      </div>

      {view === 'form' ? (
        <form className="analysis-form" onSubmit={showResults}>
          <div className="analysis-form-card">
            <div className="analysis-form-section-title"><span className="analysis-number">01</span><div><h2>Identificá este análisis</h2><p>Así lo vas a encontrar en tu historial.</p></div></div>
            <label className="analysis-field"><span>Nombre del análisis <b>*</b></span><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Productos de temporada" maxLength={80} /><small>Podés usar un nombre que recuerdes fácilmente.</small></label>
            {templateId === 'sales-products' && <label className="analysis-field"><span>Período de ventas <b>*</b></span><input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Ej.: primera quincena de octubre" maxLength={80} /><small>Ingresá el rango de fechas o período que usaste para reunir estos datos.</small></label>}
          </div>

          <div className="analysis-form-card">
            <div className="analysis-form-section-title"><span className="analysis-number">02</span><div><h2>Agregá tus datos</h2><p>{templateId === 'product-profitability' ? 'Usá los precios actuales. El costo puede quedar vacío si todavía no lo conocés.' : 'Ingresá el total vendido y las unidades de cada producto en el período elegido.'}</p></div></div>
            <div className="analysis-rows">
              {rows.map((row, index) => (
                <div className={`analysis-data-row ${templateId === 'product-profitability' ? 'profit-row' : 'sales-row'}`} key={index}>
                  <div className="analysis-row-index">{String(index + 1).padStart(2, '0')}</div>
                  <label className="analysis-field"><span>Producto <b>*</b></span><input value={row.name} onChange={(e) => updateRow(setRows, rows, index, 'name', e.target.value)} placeholder="Ej.: Café molido 500 g" maxLength={80} /></label>
                  {templateId === 'product-profitability' ? <>
                    <label className="analysis-field"><span>Precio de venta <b>*</b></span><div className="analysis-input-affix"><i>$</i><input type="number" min="0.01" step="0.01" value={row.salePrice} onChange={(e) => updateRow(setRows, rows, index, 'salePrice', e.target.value)} placeholder="0,00" /></div><small>Precio que paga el cliente por unidad.</small></label>
                    <label className="analysis-field"><span>Costo unitario</span><div className="analysis-input-affix"><i>$</i><input type="number" min="0" step="0.01" value={row.unitCost} onChange={(e) => updateRow(setRows, rows, index, 'unitCost', e.target.value)} placeholder="Dejar vacío si no sabés" /></div><small>Lo que te cuesta comprar o producir una unidad.</small></label>
                    <label className="analysis-field"><span>Unidades vendidas</span><input type="number" min="0" step="1" value={row.unitsSold} onChange={(e) => updateRow(setRows, rows, index, 'unitsSold', e.target.value)} placeholder="Opcional" /><small>Sin este dato no se estima el margen total.</small></label>
                  </> : <>
                    <label className="analysis-field"><span>Unidades vendidas <b>*</b></span><input type="number" min="1" step="1" value={row.units} onChange={(e) => updateRow(setRows, rows, index, 'units', e.target.value)} placeholder="0" /><small>Cantidad de unidades en el período.</small></label>
                    <label className="analysis-field"><span>Total vendido <b>*</b></span><div className="analysis-input-affix"><i>$</i><input type="number" min="0" step="0.01" value={row.total} onChange={(e) => updateRow(setRows, rows, index, 'total', e.target.value)} placeholder="0,00" /></div><small>Importe total cobrado por este producto.</small></label>
                  </>}
                  {rows.length > 1 && <button type="button" className="analysis-remove-row" onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} aria-label={`Quitar producto ${index + 1}`} title="Quitar producto"><Trash2 size={17} /></button>}
                </div>
              ))}
            </div>
            <button type="button" className="analysis-add-row" onClick={() => setRows([...rows, addRow()])}><Plus size={16} /> Agregar otro producto</button>
            {templateId === 'product-profitability' && <div className="analysis-note form-note"><Lightbulb size={17} /><p><strong>¿No tenés el costo?</strong> Dejalo vacío. Se mostrarán los datos disponibles, pero no se calculará el margen de ese producto.</p></div>}
          </div>

          {error && <div className="analysis-error" role="alert">{error}</div>}
          <div className="analysis-form-footer"><span><b>*</b> Campo obligatorio</span><button className="analysis-primary-button" type="submit">Ver análisis <ArrowRight size={17} /></button></div>
        </form>
      ) : (
        <div className="analysis-results">
          <div className="analysis-result-meta"><span><FileText size={15} /> {title}</span>{period && <span><Clock3 size={15} /> {period}</span>}</div>
          {templateId === 'product-profitability' ? <>
            <div className="analysis-kpi-grid">
              <div className="analysis-kpi"><span>Productos cargados</span><strong>{result.totalCount}</strong><small>En este análisis</small></div>
              <div className="analysis-kpi"><span>Margen unitario promedio</span><strong>{result.avgMarginPct === null ? '—' : `${number(result.avgMarginPct)}%`}</strong><small>{result.avgMarginPct === null ? 'Falta informar costos' : `Promedio de ${result.knownCostCount} productos con costo`}</small></div>
              <div className="analysis-kpi"><span>Margen total estimado</span><strong>{result.estimatedTotal === null ? '—' : currency(result.estimatedTotal)}</strong><small>{result.estimatedTotal === null ? 'Falta costo o cantidad vendida' : `Calculado para ${result.estimatedCount} productos`}</small></div>
            </div>
            {result.best && <div className="analysis-insight"><span className="analysis-insight-icon"><Lightbulb size={19} /></span><p><strong>Mayor margen por unidad informado</strong><br />{result.best.name}: {currency(result.best.unitMargin)} por unidad ({number(result.best.marginPct)}% del precio de venta).</p></div>}
            {result.knownCostCount < result.totalCount && <div className="analysis-caveat"><CircleHelp size={17} /><p>No se pudo calcular el margen de {result.totalCount - result.knownCostCount} producto(s) porque falta su costo unitario. El promedio solo considera los productos con costo informado.</p></div>}
            <div className="analysis-result-card"><div className="analysis-result-heading"><div><h2>Detalle por producto</h2><p>Margen unitario = precio de venta − costo unitario. Porcentaje = margen ÷ precio de venta.</p></div><span className="analysis-result-pill">CÁLCULO EXPLICADO</span></div>
              <div className="analysis-table-wrap"><table className="analysis-table"><thead><tr><th>Producto</th><th>Precio</th><th>Costo</th><th>Margen / unidad</th><th>Margen %</th><th>Unidades</th><th>Margen total est.</th></tr></thead><tbody>{result.products.map((item, index) => <tr key={`${item.name}-${index}`}><td><strong>{item.name}</strong></td><td>{currency(item.salePrice)}</td><td>{item.unitCost === null ? <span className="analysis-missing">Sin dato</span> : currency(item.unitCost)}</td><td>{item.unitMargin === null ? '—' : currency(item.unitMargin)}</td><td>{item.marginPct === null ? '—' : `${number(item.marginPct)}%`}</td><td>{item.unitsSold === null ? <span className="analysis-missing">Sin dato</span> : number(item.unitsSold)}</td><td>{item.estimatedTotal === null ? '—' : currency(item.estimatedTotal)}</td></tr>)}</tbody></table></div>
            </div>
          </> : <>
            <div className="analysis-kpi-grid">
              <div className="analysis-kpi"><span>Venta total informada</span><strong>{currency(result.totalSales)}</strong><small>Suma de los importes ingresados</small></div>
              <div className="analysis-kpi"><span>Unidades vendidas</span><strong>{number(result.totalUnits)}</strong><small>Suma de las unidades por producto</small></div>
              <div className="analysis-kpi"><span>Promedio por producto</span><strong>{currency(result.average)}</strong><small>Venta total ÷ productos cargados</small></div>
            </div>
            {result.best && <div className="analysis-insight"><span className="analysis-insight-icon"><TrendingUp size={19} /></span><p><strong>Mayor cantidad vendida</strong><br />{result.best.name}: {number(result.best.units)} unidades ({currency(result.best.total)} informados).</p></div>}
            <div className="analysis-result-card"><div className="analysis-result-heading"><div><h2>Productos ordenados por unidades</h2><p>Participación = unidades del producto ÷ unidades totales del período.</p></div><span className="analysis-result-pill">CÁLCULO EXPLICADO</span></div>
              <div className="analysis-ranking">{result.products.map((item, index) => <div className="analysis-ranking-row" key={`${item.name}-${index}`}><span className="analysis-rank-number">{String(index + 1).padStart(2, '0')}</span><div className="analysis-rank-name"><strong>{item.name}</strong><span>{currency(item.total)} vendidos</span></div><div className="analysis-rank-bar"><span style={{ width: `${result.totalUnits ? (item.units / result.totalUnits) * 100 : 0}%` }} /></div><strong className="analysis-rank-units">{number(item.units)} <small>unid.</small></strong></div>)}</div>
            </div>
          </>}
          <div className="analysis-result-actions"><button className="analysis-secondary-button" onClick={() => setView('form')}><ArrowLeft size={16} /> Editar datos</button><button className="analysis-primary-button" onClick={saveAnalysis}><Save size={16} /> Guardar análisis</button></div>
        </div>
      )}
    </div>
  );
}
