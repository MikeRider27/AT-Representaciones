import { describe, expect, it } from 'vitest';
import { comision, generarCuotas, ivaIncluido, totalizar } from '../src/lib/fiscal';

describe('ivaIncluido', () => {
  it('calcula IVA 10% incluido', () => expect(ivaIncluido(110_000, 10)).toBe(10_000));
  it('calcula IVA 5% incluido', () => expect(ivaIncluido(210_000, 5)).toBe(10_000));
  it('exenta no tiene IVA', () => expect(ivaIncluido(50_000, 0)).toBe(0));
});

describe('totalizar', () => {
  it('separa gravadas, exentas e IVA', () => {
    const t = totalizar([
      { subtotal: 110_000, tasa: 10 },
      { subtotal: 21_000, tasa: 5 },
      { subtotal: 5_000, tasa: 0 },
    ]);
    expect(t).toEqual({
      total_exenta: 5_000,
      total_gravada5: 21_000,
      total_gravada10: 110_000,
      total_iva5: 1_000,
      total_iva10: 10_000,
      total: 136_000,
    });
  });
});

describe('generarCuotas', () => {
  it('reparte el total y asigna el redondeo a la última cuota', () => {
    const cuotas = generarCuotas(100_000, 3, 30, '2026-01-31');
    expect(cuotas.map((c) => c.monto)).toEqual([33_333, 33_333, 33_334]);
    expect(cuotas.reduce((a, c) => a + c.monto, 0)).toBe(100_000);
  });

  it('calcula vencimientos a partir de la fecha de venta', () => {
    const cuotas = generarCuotas(30_000, 2, 15, '2026-12-25');
    expect(cuotas.map((c) => c.vencimiento)).toEqual(['2027-01-09', '2027-01-24']);
  });
});

describe('comision', () => {
  it('aplica el porcentaje y redondea', () => expect(comision(150_001, 5)).toBe(7_500));
});
