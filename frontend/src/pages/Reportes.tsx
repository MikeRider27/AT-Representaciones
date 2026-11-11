import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, Card, DataTable, Field, Input, PageHeader, Spinner, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { descargarCSV, etiqueta, fmtFecha, fmtGs, fmtNum, hoyISO, primerDiaMesISO } from '@/lib/format';

interface ReporteVentas {
  por_dia: { fecha: string; cantidad: number; total: number; iva: number }[];
  resumen: { cantidad: number; total: number; costo: number; margen: number };
  por_condicion: { condicion: string; cantidad: number; total: number }[];
}
interface MasVendido {
  id: number;
  codigo: string;
  descripcion: string;
  marca: string;
  cantidad: number;
  total: number;
  margen: number;
}
interface Servicios {
  recargas: { operadora: string; tipo_carga: string; cantidad: number; total: number }[];
  billetera: { operadora: string; tipo: string; cantidad: number; monto: number; comision: number }[];
}

const compact = new Intl.NumberFormat('es-PY', { notation: 'compact', maximumFractionDigits: 1 });

export function ReportesPage() {
  const [desde, setDesde] = useState(primerDiaMesISO());
  const [hasta, setHasta] = useState(hoyISO());
  const params = { desde, hasta };
  const valido = desde <= hasta;

  const ventas = useQuery({ queryKey: ['/reportes/ventas', params], queryFn: () => api.get<ReporteVentas>('/reportes/ventas', params), enabled: valido });
  const top = useQuery({ queryKey: ['/reportes/productos', params], queryFn: () => api.get<MasVendido[]>('/reportes/productos-mas-vendidos', params), enabled: valido });
  const serv = useQuery({ queryKey: ['/reportes/servicios', params], queryFn: () => api.get<Servicios>('/reportes/servicios', params), enabled: valido });

  const r = ventas.data?.resumen;

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle={`Período ${fmtFecha(desde)} al ${fmtFecha(hasta)}`}
        actions={
          <div className="flex items-end gap-2">
            <Field label="Desde"><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Field>
            <Field label="Hasta"><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Field>
          </div>
        }
      />
      {ventas.isLoading ? (
        <Spinner />
      ) : (
        r && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Ventas" value={fmtGs(r.total)} hint={`${r.cantidad} comprobantes`} />
              <StatCard label="Costo de mercadería" value={fmtGs(r.costo)} tone="amber" />
              <StatCard label="Margen bruto" value={fmtGs(r.margen)} hint={r.total ? `${((r.margen / r.total) * 100).toFixed(1)}% sobre ventas` : undefined} tone="green" />
              <StatCard
                label="Contado / Crédito"
                value={`${fmtNum(ventas.data!.por_condicion.find((c) => c.condicion === 'CONTADO')?.total ?? 0)} / ${fmtNum(ventas.data!.por_condicion.find((c) => c.condicion === 'CREDITO')?.total ?? 0)}`}
              />
            </div>

            <Card
              title="Ventas por día"
              actions={
                <Button size="sm" variant="ghost" icon={<Download className="h-4 w-4" />} onClick={() => descargarCSV(`ventas_diarias_${desde}_${hasta}`, [{ key: 'fecha', label: 'Fecha' }, { key: 'cantidad', label: 'Comprobantes' }, { key: 'total', label: 'Total' }, { key: 'iva', label: 'IVA' }], ventas.data!.por_dia)}>
                  CSV
                </Button>
              }
            >
              <div className="h-64 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ventas.data!.por_dia.map((d) => ({ ...d, dia: fmtFecha(d.fecha).slice(0, 5) }))}>
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => compact.format(v)} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip formatter={(v: number) => fmtGs(v)} />
                    <Area type="monotone" dataKey="total" name="Ventas" stroke="#1d4ed8" fill="url(#g)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card
              title="Productos más vendidos"
              actions={
                top.data && (
                  <Button size="sm" variant="ghost" icon={<Download className="h-4 w-4" />} onClick={() => descargarCSV(`mas_vendidos_${desde}_${hasta}`, [{ key: 'codigo', label: 'Código' }, { key: 'descripcion', label: 'Producto' }, { key: 'marca', label: 'Marca' }, { key: 'cantidad', label: 'Cantidad' }, { key: 'total', label: 'Total' }, { key: 'margen', label: 'Margen' }], top.data)}>
                    CSV
                  </Button>
                )
              }
            >
              <DataTable
                loading={top.isLoading}
                rows={top.data}
                rowKey={(r) => r.id}
                columns={[
                  { key: 'codigo', header: 'Código', className: 'font-mono text-xs' },
                  { key: 'descripcion', header: 'Producto' },
                  { key: 'marca', header: 'Marca' },
                  { key: 'cantidad', header: 'Unidades', align: 'right' },
                  { key: 'total', header: 'Total', align: 'right', render: (r) => fmtNum(r.total) },
                  { key: 'margen', header: 'Margen', align: 'right', render: (r) => fmtNum(r.margen) },
                ]}
              />
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card title="Recargas por operadora">
                <DataTable
                  loading={serv.isLoading}
                  rows={serv.data?.recargas}
                  rowKey={(r) => `${r.operadora}-${r.tipo_carga}`}
                  columns={[
                    { key: 'operadora', header: 'Operadora' },
                    { key: 'tipo_carga', header: 'Tipo' },
                    { key: 'cantidad', header: 'Cant.', align: 'right' },
                    { key: 'total', header: 'Total', align: 'right', render: (r) => fmtNum(r.total) },
                  ]}
                />
              </Card>
              <Card title="Billetera por operadora">
                <DataTable
                  loading={serv.isLoading}
                  rows={serv.data?.billetera}
                  rowKey={(r) => `${r.operadora}-${r.tipo}`}
                  columns={[
                    { key: 'operadora', header: 'Operadora' },
                    { key: 'tipo', header: 'Tipo', render: (r) => etiqueta(r.tipo) },
                    { key: 'cantidad', header: 'Cant.', align: 'right' },
                    { key: 'monto', header: 'Monto', align: 'right', render: (r) => fmtNum(r.monto) },
                    { key: 'comision', header: 'Comisión', align: 'right', render: (r) => fmtNum(r.comision) },
                  ]}
                />
              </Card>
            </div>
          </div>
        )
      )}
    </>
  );
}
