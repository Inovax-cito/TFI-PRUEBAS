// Colores compartidos por todos los gráficos (mismos valores que --chart-* en variables.css)
export const CHART = {
  primary: '#008c91',
  grid: '#eef2f5',
  axis: '#8793a5',
  label: '#253654',
  series: ['#008c91', '#132344', '#f2a541', '#7c8db5', '#e07a5f', '#64748b'],
};

export const TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid #dfe5eb',
  boxShadow: '0 4px 10px -2px rgba(19, 35, 68, 0.1)',
  fontSize: '0.85rem',
};

// $ 48.750 -> "$49k" para ejes y etiquetas cortas
export const shortMoney = (value) => {
  const n = Number(value || 0);
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
};
