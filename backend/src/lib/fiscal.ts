/**
 * Cálculos fiscales (Paraguay): los precios incluyen IVA.
 * IVA 10% = gravada / 11, IVA 5% = gravada / 21.
 */
export type Tasa = 0 | 5 | 10;

export interface LineaFiscal {
  subtotal: number;
  tasa: number;
}

export interface Totales {
  total_exenta: number;
  total_gravada5: number;
  total_gravada10: number;
  total_iva5: number;
  total_iva10: number;
  total: number;
}

export function ivaIncluido(monto: number, tasa: number): number {
  if (tasa === 10) return Math.round(monto / 11);
  if (tasa === 5) return Math.round(monto / 21);
  return 0;
}

export function totalizar(lineas: LineaFiscal[]): Totales {
  const t: Totales = { total_exenta: 0, total_gravada5: 0, total_gravada10: 0, total_iva5: 0, total_iva10: 0, total: 0 };
  for (const l of lineas) {
    if (l.tasa === 10) t.total_gravada10 += l.subtotal;
    else if (l.tasa === 5) t.total_gravada5 += l.subtotal;
    else t.total_exenta += l.subtotal;
    t.total += l.subtotal;
  }
  t.total_iva10 = ivaIncluido(t.total_gravada10, 10);
  t.total_iva5 = ivaIncluido(t.total_gravada5, 5);
  return t;
}

export interface Cuota {
  nro_cuota: number;
  vencimiento: string;
  monto: number;
}

function sumarDias(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d + dias));
  return fecha.toISOString().slice(0, 10);
}

/**
 * Divide el total en cuotas iguales; la diferencia por redondeo se suma a la última.
 * El primer vencimiento es `fecha + intervalo`.
 */
export function generarCuotas(total: number, cantidad: number, intervaloDias: number, fechaISO: string): Cuota[] {
  if (cantidad < 1) throw new Error('La cantidad de cuotas debe ser al menos 1');
  const base = Math.floor(total / cantidad);
  const cuotas: Cuota[] = [];
  for (let i = 1; i <= cantidad; i++) {
    const monto = i === cantidad ? total - base * (cantidad - 1) : base;
    cuotas.push({ nro_cuota: i, vencimiento: sumarDias(fechaISO, intervaloDias * i), monto });
  }
  return cuotas;
}

export function comision(monto: number, porcentaje: number): number {
  return Math.round((monto * porcentaje) / 100);
}
