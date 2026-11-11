import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, HandCoins, ShoppingCart, Smartphone, TrendingUp, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/auth/AuthProvider';
import { Badge, Button, Card, DataTable, PageHeader, Spinner, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtFecha, fmtFechaHora, fmtGs, fmtNum } from '@/lib/format';
import { useCajaActual } from '@/lib/hooks';

interface Dashboard {
  ventas_hoy: { cantidad: number; total: number };
  ventas_mes: { cantidad: number; total: number };
  cuentas_cobrar: { total: number; vencido: number };
  stock_bajo: { id: number; codigo: string; descripcion: string; stock_minimo: number; stock: number }[];
  saldos: { operadora: string; saldo_recarga: number; saldo_billetera: number }[];
  serie_14_dias: { fecha: string; ventas: number; recargas: number }[];
  cajas_abiertas: { id: number; caja: string; usuario: string; abierta_at: string }[];
}

const compact = new Intl.NumberFormat('es-PY', { notation: 'compact', maximumFractionDigits: 1 });

export function DashboardPage() {
  const { user } = useAuth();
  const caja = useCajaActual();
  const { data, isLoading } = useQuery({
    queryKey: ['/reportes/dashboard'],
    queryFn: () => api.get<Dashboard>('/reportes/dashboard'),
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader
        title={`Hola, ${user?.nombre.split(' ')[0] ?? ''}`}
        subtitle={new Date().toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          <>
            <Link to="/recargas">
              <Button variant="secondary" icon={<Smartphone className="h-4 w-4" />}>
                Recarga
              </Button>
            </Link>
            <Link to="/ventas/nueva">
              <Button icon={<ShoppingCart className="h-4 w-4" />}>Nueva venta</Button>
            </Link>
          </>
        }
      />

      {!caja.isLoading && !caja.data && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3 text-amber-800">
            <Wallet className="h-5 w-5" />
            <span className="text-sm">No tiene una caja abierta. Debe realizar la apertura antes de vender o cobrar.</span>
          </div>
          <Link to="/caja">
            <Button size="sm">Abrir caja</Button>
          </Link>
        </Card>
      )}

      {isLoading || !data ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Ventas de hoy" value={fmtGs(data.ventas_hoy.total)} hint={`${data.ventas_hoy.cantidad} comprobantes`} icon={<TrendingUp className="h-5 w-5" />} />
            <StatCard label="Ventas del mes" value={fmtGs(data.ventas_mes.total)} hint={`${data.ventas_mes.cantidad} comprobantes`} icon={<CalendarDays className="h-5 w-5" />} tone="green" />
            <StatCard
              label="Cuentas a cobrar"
              value={fmtGs(data.cuentas_cobrar.total)}
              hint={<span className={data.cuentas_cobrar.vencido ? 'text-red-600' : ''}>Vencido: {fmtGs(data.cuentas_cobrar.vencido)}</span>}
              icon={<HandCoins className="h-5 w-5" />}
              tone="amber"
            />
            <StatCard label="Productos con stock bajo" value={fmtNum(data.stock_bajo.length)} hint="Bajo o igual al mínimo" icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card title="Últimos 14 días" className="xl:col-span-2">
              <div className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.serie_14_dias.map((d) => ({ ...d, dia: fmtFecha(d.fecha).slice(0, 5) }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => compact.format(v)} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip formatter={(v: number) => fmtGs(v)} cursor={{ fill: '#f1f5f9' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="ventas" name="Ventas" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="recargas" name="Recargas" fill="#eab308" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Saldos de operadoras" actions={<Link to="/saldos" className="text-xs font-medium text-brand-700 hover:underline">Ver todo</Link>}>
              <DataTable
                rowKey={(r) => r.operadora}
                rows={data.saldos}
                columns={[
                  { key: 'operadora', header: 'Operadora' },
                  { key: 'saldo_recarga', header: 'Recargas', align: 'right', render: (r) => fmtNum(r.saldo_recarga) },
                  { key: 'saldo_billetera', header: 'Billetera', align: 'right', render: (r) => fmtNum(r.saldo_billetera) },
                ]}
              />
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Stock bajo" actions={<Link to="/stock" className="text-xs font-medium text-brand-700 hover:underline">Ver stock</Link>}>
              <DataTable
                rowKey={(r) => r.id}
                rows={data.stock_bajo}
                empty="Todo el stock está por encima del mínimo"
                columns={[
                  { key: 'codigo', header: 'Código' },
                  { key: 'descripcion', header: 'Producto', className: 'max-w-xs truncate' },
                  { key: 'stock', header: 'Stock', align: 'right', render: (r) => <Badge tone={r.stock === 0 ? 'red' : 'amber'}>{r.stock}</Badge> },
                  { key: 'stock_minimo', header: 'Mínimo', align: 'right' },
                ]}
              />
            </Card>
            <Card title="Cajas abiertas">
              <DataTable
                rowKey={(r) => r.id}
                rows={data.cajas_abiertas}
                empty="No hay cajas abiertas"
                columns={[
                  { key: 'caja', header: 'Caja' },
                  { key: 'usuario', header: 'Cajero' },
                  { key: 'abierta_at', header: 'Apertura', render: (r) => fmtFechaHora(r.abierta_at) },
                ]}
              />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
