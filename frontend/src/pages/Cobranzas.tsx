import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Ban, HandCoins } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Alert, Badge, Button, Card, DataTable, EstadoBadge, Field, Input, Modal, MoneyInput, PageHeader, Pagination, Select, Toolbar } from '@/components/ui';
import { api } from '@/lib/api';
import { etiqueta, fmtFecha, fmtFechaHora, fmtGs, fmtNum } from '@/lib/format';
import { useApiMutation, useCajaActual, usePagedList } from '@/lib/hooks';
import { MEDIOS_PAGO, type MedioPago } from '@/lib/types';

interface Deudor {
  cliente_id: number;
  nombre: string;
  ruc: string;
  telefono: string | null;
  cuotas_pendientes: number;
  deuda_total: number;
  deuda_vencida: number;
  proximo_vencimiento: string;
}

interface Cuota {
  id: number;
  venta_id: number;
  fecha_venta: string;
  nro_cuota: number;
  total_cuotas: number;
  vencimiento: string;
  monto: number;
  saldo: number;
  dias_atraso: number;
}

interface CobroRow {
  id: number;
  created_at: string;
  cliente: string;
  total: number;
  medio_pago: string;
  estado: string;
  usuario: string;
}

const INVALIDAR = ['/cobranzas', '/caja/actual', '/ventas', '/reportes/dashboard'];

function CobrarModal({ deudor, onClose }: { deudor: Deudor; onClose: () => void }) {
  const caja = useCajaActual();
  const { data: cuotas } = useQuery({
    queryKey: ['/cobranzas', 'cuotas', deudor.cliente_id],
    queryFn: () => api.get<Cuota[]>(`/cobranzas/clientes/${deudor.cliente_id}/cuotas`),
  });
  const [pagos, setPagos] = useState<Record<number, number>>({});
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO');

  // Preselecciona la cuota más antigua
  useEffect(() => {
    if (cuotas?.length && !Object.keys(pagos).length) setPagos({ [cuotas[0].id]: cuotas[0].saldo });
  }, [cuotas, pagos]);

  const total = Object.values(pagos).reduce((a, b) => a + b, 0);
  const toggle = (c: Cuota) =>
    setPagos((p) => {
      const n = { ...p };
      if (c.id in n) delete n[c.id];
      else n[c.id] = c.saldo;
      return n;
    });

  const mut = useApiMutation(
    () =>
      api.post('/cobranzas', {
        cliente_id: deudor.cliente_id,
        medio_pago: medio,
        pagos: Object.entries(pagos)
          .filter(([, m]) => m > 0)
          .map(([id, monto]) => ({ cuenta_cobrar_id: Number(id), monto })),
      }),
    { success: 'Cobro registrado', invalidate: INVALIDAR, onSuccess: onClose },
  );

  const invalido = cuotas?.some((c) => c.id in pagos && (pagos[c.id] <= 0 || pagos[c.id] > c.saldo)) ?? false;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Cobrar a ${deudor.nombre}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button icon={<HandCoins className="h-4 w-4" />} disabled={!total || invalido || !caja.data} loading={mut.isPending} onClick={() => mut.mutate()}>
            Cobrar {fmtGs(total)}
          </Button>
        </>
      }
    >
      {!caja.data && (
        <div className="mb-4">
          <Alert>Debe <Link to="/caja" className="font-semibold underline">abrir la caja</Link> para registrar cobros.</Alert>
        </div>
      )}
      <DataTable
        rows={cuotas}
        rowKey={(r) => r.id}
        columns={[
          { key: 'sel', header: '', render: (r) => <input type="checkbox" checked={r.id in pagos} onChange={() => toggle(r)} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> },
          { key: 'venta_id', header: 'Venta', render: (r) => <Link to={`/ventas/${r.venta_id}`} className="text-brand-700 hover:underline">#{r.venta_id}</Link> },
          { key: 'nro_cuota', header: 'Cuota', render: (r) => `${r.nro_cuota}/${r.total_cuotas}` },
          {
            key: 'vencimiento',
            header: 'Vence',
            render: (r) => (
              <span className={clsx(r.dias_atraso > 0 && 'font-medium text-red-600')}>
                {fmtFecha(r.vencimiento)} {r.dias_atraso > 0 && <span className="text-xs">({r.dias_atraso} d)</span>}
              </span>
            ),
          },
          { key: 'saldo', header: 'Saldo', align: 'right', render: (r) => fmtNum(r.saldo) },
          {
            key: 'pago',
            header: 'A cobrar',
            render: (r) => (
              <MoneyInput
                value={pagos[r.id] ?? 0}
                disabled={!(r.id in pagos)}
                onValueChange={(v) => setPagos((p) => ({ ...p, [r.id]: v }))}
                className={clsx('w-32', r.id in pagos && pagos[r.id] > r.saldo && 'border-red-400')}
              />
            ),
          },
        ]}
      />
      <div className="mt-4 flex items-end justify-between gap-4">
        <Field label="Medio de pago" className="w-56">
          <Select value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
            {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{etiqueta(m)}</option>)}
          </Select>
        </Field>
        <p className="text-right">
          <span className="block text-sm text-slate-500">Total a cobrar</span>
          <span className="text-2xl font-bold tabular-nums text-brand-800">{fmtGs(total)}</span>
        </p>
      </div>
    </Modal>
  );
}

export function CobranzasPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<'deudores' | 'cobros'>('deudores');
  const [cobrar, setCobrar] = useState<Deudor | null>(null);
  const deudores = usePagedList<Deudor>('/cobranzas/deudores');
  const cobros = usePagedList<CobroRow>('/cobranzas');
  const anular = useApiMutation((id: number) => api.post(`/cobranzas/${id}/anular`), { success: 'Cobro anulado', invalidate: INVALIDAR });

  return (
    <>
      <PageHeader title="Cobranzas" subtitle="Cuentas a cobrar por ventas a crédito" />
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-200/60 p-1 sm:w-fit">
        {(['deudores', 'cobros'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx('flex-1 rounded-md px-4 py-1.5 text-sm font-medium', tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600')}
          >
            {t === 'deudores' ? 'Clientes con deuda' : 'Historial de cobros'}
          </button>
        ))}
      </div>

      {tab === 'deudores' ? (
        <Card>
          <Toolbar>
            <Field label="Buscar" className="min-w-[240px] flex-1">
              <Input placeholder="Cliente o RUC" value={deudores.q} onChange={(e) => deudores.setQ(e.target.value)} />
            </Field>
            {deudores.data?.totales && (
              <div className="flex gap-6 text-sm">
                <div><p className="text-slate-500">Deuda total</p><p className="font-semibold tabular-nums">{fmtGs(deudores.data.totales.deuda_total)}</p></div>
                <div><p className="text-slate-500">Vencida</p><p className="font-semibold tabular-nums text-red-600">{fmtGs(deudores.data.totales.deuda_vencida)}</p></div>
              </div>
            )}
          </Toolbar>
          <DataTable
            loading={deudores.isLoading}
            rows={deudores.data?.data}
            rowKey={(r) => r.cliente_id}
            empty="No hay cuentas pendientes"
            onRowClick={setCobrar}
            columns={[
              { key: 'nombre', header: 'Cliente', render: (r) => <div><p className="font-medium">{r.nombre}</p><p className="text-xs text-slate-500">{r.ruc} {r.telefono && `· ${r.telefono}`}</p></div> },
              { key: 'cuotas_pendientes', header: 'Cuotas', align: 'right' },
              { key: 'proximo_vencimiento', header: 'Próx. venc.', render: (r) => fmtFecha(r.proximo_vencimiento) },
              { key: 'deuda_vencida', header: 'Vencido', align: 'right', render: (r) => (r.deuda_vencida ? <Badge tone="red">{fmtNum(r.deuda_vencida)}</Badge> : '—') },
              { key: 'deuda_total', header: 'Deuda total', align: 'right', render: (r) => <b>{fmtNum(r.deuda_total)}</b> },
              { key: 'accion', header: '', render: () => <Button size="sm" variant="secondary">Cobrar</Button> },
            ]}
          />
          {deudores.data && <Pagination page={deudores.page} pageSize={deudores.pageSize} total={deudores.data.total} onChange={deudores.setPage} />}
        </Card>
      ) : (
        <Card>
          <Toolbar>
            <Field label="Buscar" className="min-w-[240px] flex-1">
              <Input placeholder="Cliente o RUC" value={cobros.q} onChange={(e) => cobros.setQ(e.target.value)} />
            </Field>
          </Toolbar>
          <DataTable
            loading={cobros.isLoading}
            rows={cobros.data?.data}
            rowKey={(r) => r.id}
            columns={[
              { key: 'id', header: '#' },
              { key: 'created_at', header: 'Fecha', render: (r) => fmtFechaHora(r.created_at) },
              { key: 'cliente', header: 'Cliente' },
              { key: 'medio_pago', header: 'Medio', render: (r) => etiqueta(r.medio_pago) },
              { key: 'total', header: 'Total', align: 'right', render: (r) => fmtNum(r.total) },
              { key: 'estado', header: 'Estado', render: (r) => <EstadoBadge estado={r.estado} /> },
              { key: 'usuario', header: 'Usuario' },
              {
                key: 'acciones',
                header: '',
                render: (r) =>
                  isAdmin && r.estado === 'ACTIVO' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Ban className="h-4 w-4" />}
                      onClick={() => confirm(`¿Anular el cobro #${r.id}? Las cuotas volverán a quedar pendientes.`) && anular.mutate(r.id)}
                    >
                      Anular
                    </Button>
                  ) : null,
              },
            ]}
          />
          {cobros.data && <Pagination page={cobros.page} pageSize={cobros.pageSize} total={cobros.data.total} onChange={cobros.setPage} />}
        </Card>
      )}
      {cobrar && <CobrarModal deudor={cobrar} onClose={() => setCobrar(null)} />}
    </>
  );
}
