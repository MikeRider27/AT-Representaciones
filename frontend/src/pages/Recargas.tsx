import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Ban, Smartphone } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Alert, Button, Card, DataTable, EstadoBadge, Field, Input, MoneyInput, PageHeader, Pagination, Select, Toolbar } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtFechaHora, fmtGs, fmtNum, hoyISO } from '@/lib/format';
import { useApiMutation, useCajaActual, useCatalogo, usePagedList } from '@/lib/hooks';

export interface SaldoOperadora {
  operadora_id: number;
  operadora: string;
  saldo_recarga: number;
  saldo_billetera: number;
}

export function useSaldos() {
  return useQuery({ queryKey: ['/saldos'], queryFn: () => api.get<SaldoOperadora[]>('/saldos') });
}

/** Botones para elegir operadora mostrando el saldo disponible. */
export function OperadoraSelector({
  value,
  onChange,
  cuenta,
}: {
  value: number;
  onChange: (id: number) => void;
  cuenta: 'saldo_recarga' | 'saldo_billetera';
}) {
  const { data } = useSaldos();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {data?.map((o) => (
        <button
          type="button"
          key={o.operadora_id}
          onClick={() => onChange(o.operadora_id)}
          className={clsx(
            'rounded-lg border p-3 text-left transition-colors',
            value === o.operadora_id ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-200 hover:bg-slate-50',
          )}
        >
          <p className="text-sm font-semibold text-slate-800">{o.operadora}</p>
          <p className={clsx('text-xs tabular-nums', o[cuenta] > 0 ? 'text-slate-500' : 'text-red-500')}>Saldo {fmtNum(o[cuenta])}</p>
        </button>
      ))}
    </div>
  );
}

interface VentaSaldoRow {
  id: number;
  created_at: string;
  operadora: string;
  tipo_carga: string;
  numero_destino: string;
  monto: number;
  estado: string;
  usuario: string;
}

const INVALIDAR = ['/saldos', '/caja/actual', '/reportes/dashboard'];
const MONTOS_RAPIDOS = [5000, 10000, 20000, 30000, 50000, 100000];

export function RecargasPage() {
  const { isAdmin } = useAuth();
  const caja = useCajaActual();
  const tipos = useCatalogo('/tipos-carga');
  const [operadoraId, setOperadoraId] = useState(0);
  const [tipoId, setTipoId] = useState(0);
  const [numero, setNumero] = useState('');
  const [monto, setMonto] = useState(0);
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const list = usePagedList<VentaSaldoRow>('/saldos/ventas', { desde, hasta });

  useEffect(() => {
    if (!tipoId && tipos.data?.length) setTipoId(tipos.data[0].id);
  }, [tipos.data, tipoId]);

  const mut = useApiMutation(
    () => api.post('/saldos/ventas', { operadora_id: operadoraId, tipo_carga_id: tipoId, numero_destino: numero, monto }),
    {
      success: 'Recarga registrada',
      invalidate: [...INVALIDAR, '/saldos/ventas'],
      onSuccess: () => {
        setNumero('');
        setMonto(0);
      },
    },
  );
  const anular = useApiMutation((id: number) => api.post(`/saldos/ventas/${id}/anular`), {
    success: 'Recarga anulada',
    invalidate: [...INVALIDAR, '/saldos/ventas'],
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mut.mutate();
  };

  return (
    <>
      <PageHeader title="Venta de saldo" subtitle="Recargas, paquetes y maxicargas" />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Nueva recarga" className="xl:col-span-2">
          <form onSubmit={submit} className="space-y-4 p-5">
            {!caja.data && (
              <Alert>
                Debe <Link to="/caja" className="font-semibold underline">abrir la caja</Link> para vender saldo.
              </Alert>
            )}
            <Field label="Operadora" required>
              <OperadoraSelector value={operadoraId} onChange={setOperadoraId} cuenta="saldo_recarga" />
            </Field>
            <Field label="Tipo de carga" required>
              <Select value={tipoId} onChange={(e) => setTipoId(Number(e.target.value))}>
                {tipos.data?.map((t) => <option key={t.id} value={t.id}>{t.descripcion}</option>)}
              </Select>
            </Field>
            <Field label="Número de línea" required>
              <Input inputMode="tel" placeholder="09XXXXXXXX" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 15))} />
            </Field>
            <Field label="Monto" required>
              <MoneyInput value={monto} onValueChange={setMonto} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MONTOS_RAPIDOS.map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setMonto(m)}
                    className={clsx('rounded-md border px-2.5 py-1 text-xs', monto === m ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50')}
                  >
                    {fmtNum(m)}
                  </button>
                ))}
              </div>
            </Field>
            <Button
              type="submit"
              className="h-11 w-full"
              icon={<Smartphone className="h-4 w-4" />}
              loading={mut.isPending}
              disabled={!caja.data || !operadoraId || !tipoId || numero.length < 6 || !monto}
            >
              Registrar recarga {monto ? fmtGs(monto) : ''}
            </Button>
          </form>
        </Card>

        <Card title="Recargas realizadas" className="xl:col-span-3">
          <Toolbar>
            <Field label="Número" className="min-w-[160px] flex-1">
              <Input value={list.q} onChange={(e) => list.setQ(e.target.value)} placeholder="Buscar número" />
            </Field>
            <Field label="Desde">
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </Field>
          </Toolbar>
          <DataTable
            loading={list.isLoading}
            rows={list.data?.data}
            rowKey={(r) => r.id}
            columns={[
              { key: 'created_at', header: 'Fecha', render: (r) => fmtFechaHora(r.created_at) },
              { key: 'operadora', header: 'Operadora' },
              { key: 'tipo_carga', header: 'Tipo' },
              { key: 'numero_destino', header: 'Número' },
              { key: 'monto', header: 'Monto', align: 'right', render: (r) => fmtNum(r.monto) },
              { key: 'estado', header: '', render: (r) => <EstadoBadge estado={r.estado} /> },
              {
                key: 'acc',
                header: '',
                render: (r) =>
                  isAdmin && r.estado === 'ACTIVA' ? (
                    <button
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Anular"
                      onClick={() => confirm(`¿Anular la recarga #${r.id}? Se devolverá el saldo a la operadora.`) && anular.mutate(r.id)}
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  ) : null,
              },
            ]}
            footer={
              list.data?.totales && (
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-right text-slate-600">Total del período</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(list.data.totales.monto)}</td>
                  <td colSpan={2} />
                </tr>
              )
            }
          />
          {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onChange={list.setPage} />}
        </Card>
      </div>
    </>
  );
}
