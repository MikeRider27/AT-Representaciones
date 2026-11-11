const gs = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 });

/** 1500000 -> "1.500.000" */
export const fmtNum = (n: number | null | undefined) => gs.format(Number(n ?? 0));

/** 1500000 -> "Gs. 1.500.000" */
export const fmtGs = (n: number | null | undefined) => `Gs. ${fmtNum(n)}`;

/** Convierte texto con separadores de miles a número entero. */
export const parseGs = (s: string): number => {
  const digits = s.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
};

export function fmtFecha(value: string | null | undefined): string {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  return new Date(value).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtFechaHora(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Fecha local en formato AAAA-MM-DD. */
export function hoyISO(offsetDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function primerDiaMesISO(): string {
  return hoyISO().slice(0, 8) + '01';
}

export const etiqueta = (s: string | null | undefined) =>
  (s ?? '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** Ivas incluidos en precio (Paraguay). */
export function totalizar(lineas: { subtotal: number; tasa: number }[]) {
  const t = { exenta: 0, gravada5: 0, gravada10: 0, iva5: 0, iva10: 0, total: 0 };
  for (const l of lineas) {
    if (l.tasa === 10) t.gravada10 += l.subtotal;
    else if (l.tasa === 5) t.gravada5 += l.subtotal;
    else t.exenta += l.subtotal;
    t.total += l.subtotal;
  }
  t.iva10 = Math.round(t.gravada10 / 11);
  t.iva5 = Math.round(t.gravada5 / 21);
  return t;
}

/** Descarga un CSV (separador ;) compatible con Excel en español. */
export function descargarCSV<T extends object>(nombre: string, columnas: { key: keyof T & string; label: string }[], filas: T[]) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [columnas.map((c) => esc(c.label)).join(';'), ...filas.map((f) => columnas.map((c) => esc(f[c.key])).join(';'))];
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${nombre}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
