import clsx from 'clsx';
import { Ban, Send } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Alert, Button, Card, DataTable, EstadoBadge, Field, Input, MoneyInput, PageHeader, Pagination, Select, Toolbar } from '@/components/ui';
import { api } from '@/lib/api';
import { etiqueta, fmtFechaHora, fmtGs, fmtNum, hoyISO } from '@/lib/format';
import { useApiMutation, useCajaActual, useConfiguracion, usePagedList } from '@/lib/hooks';
import { OperadoraSelector } from './Recargas';

type Tipo = 'ENVIO' | 'RETIRO' | 'CARGA' | 'PAGO_SERVICIO';
const TIPOS: { value: Tipo; label: string; ayuda: string }[] = [
  { value: 'ENVIO', label: 'Envío', ayuda: 'El cliente entrega efectivo y se envía dinero desde la billetera (cobra comisión).' },
  { value: 'RETIRO', label: 'Retiro', ayuda: 'El cliente retira efectivo; el dinero electrónico ingresa a la billetera.' },
  { value: 'CARGA', label: 'Carga', ayuda: 'Se carga saldo a la billetera del cliente a cambio de efectivo.' },
  { value: 'PAGO_SERVICIO', label: 'Pago de servicios', ayuda: 'Pago de ANDE, ESSAP, etc. desde la billetera.' },
];

interface MovRow {
  id: number;
  created_at: string;
  operadora: string;
  tipo: Tipo;
  nro_envia: string | null;
  nro_recibe: string | null;
  nombre: string | null;
  servicio: string | null;
  monto: number;
  comision: number;
  total: number;
  estado: string;
  usuario: string;
}

const vacio = { nro_boleta: '', nro_envia: '', nro_recibe: '', nombre: '', ci: '', servicio: '', referencia: '' };
const INVALIDAR = ['/saldos', '/caja/actual', '/reportes/dashboard'];

export function BilleteraPage() {
  const { isAdmin } = useAuth();
  const caja = useCajaActual();
  const { data: cfg } = useConfiguracion();
  const [operadoraId, setOperadoraId] = useState(0);
  const [tipo, setTipo] = useState<Tipo>('ENVIO');
  const [f, setF] = useState(vacio);
  const [monto, setMonto] = useState(0);
  const [comisionManual, setComisionManual] = useState(0);
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [filtroTipo, setFiltroTipo] = useState('');
  const list = usePagedList<MovRow>('/saldos/billetera', { desde, hasta, tipo: filtroTipo });

  const pct = cfg?.comision_envio_pct ?? 5;
  const comision = tipo === 'ENVIO' ? Math.round((monto * pct) / 100) : tipo === 'RETIRO' ? 0 : comisionManual;
  const total = monto + comision;
  const set = (k: keyof typeof vacio) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const mut = useApiMutation(() => api.post('/saldos/billetera', { operadora_id: operadoraId, tipo, ...f, monto, comision: comisionManual }), {
    success: 'Movimiento registrado',
    invalidate: [...INVALIDAR, '/saldos/billetera'],
    onSuccess: () => {
      setF(vacio);
      setMonto(0);
      setComisionManual(0);
    },
  });
  const anular = useApiMutation((id: number) => api.post(`/saldos/billetera/${id}/anular`), {
    success: 'Movimiento anulado',
    invalidate: [...INVALIDAR, '/saldos/billetera'],
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mut.mutate();
  };

  return (
    <>
      <PageHeader title="Billetera electrónica" subtitle="Tigo Money, Billetera Personal y otras" />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Nuevo movimiento" className="xl:col-span-2">
          <form onSubmit={submit} className="space-y-4 p-5">
            {!caja.data && (
              <Alert>
                Debe <Link to="/caja" className="font-semibold underline">abrir la caja</Link> para operar.
              </Alert>
            )}
            <Field label="Operadora" required>
              <OperadoraSelector value={operadoraId} onChange={setOperadoraId} cuenta="saldo_billetera" />
            </Field>
            <div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TIPOS.map((t) => (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setTipo(t.value)}
                    className={clsx(
                      'h-10 rounded-lg border text-sm font-medium',
                      tipo === t.value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">{TIPOS.find((t) => t.value === tipo)?.ayuda}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="N° de boleta">
                <Input value={f.nro_boleta} onChange={set('nro_boleta')} />
              </Field>
              <Field label="Referencia">
                <Input value={f.referencia} onChange={set('referencia')} />
              </Field>
              {tipo !== 'PAGO_SERVICIO' && (
                <>
                  <Field label="Nro. que envía">
                    <Input inputMode="tel" value={f.nro_envia} onChange={set('nro_envia')} />
                  </Field>
                  <Field label="Nro. que recibe" required={tipo === 'ENVIO' || tipo === 'CARGA'}>
                    <Input inputMode="tel" value={f.nro_recibe} onChange={set('nro_recibe')} />
                  </Field>
                </>
              )}
              <Field label="Nombre">
                <Input value={f.nombre} onChange={set('nombre')} />
              </Field>
              <Field label="C.I.">
                <Input value={f.ci} onChange={set('ci')} />
              </Field>
              {tipo === 'PAGO_SERVICIO' && (
                <Field label="Servicio" required className="col-span-2">
                  <Input value={f.servicio} onChange={set('servicio')} placeholder="Ej.: ANDE - NIS 1234567" />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto" required>
                <MoneyInput value={monto} onValueChange={setMonto} />
              </Field>
              <Field label={tipo === 'ENVIO' ? `Comisión (${pct}%)` : 'Comisión'}>
                {tipo === 'ENVIO' || tipo === 'RETIRO' ? (
                  <div className="flex h-10 items-center justify-end rounded-lg bg-slate-100 px-3 text-sm tabular-nums">{fmtNum(comision)}</div>
                ) : (
                  <MoneyInput value={comisionManual} onValueChange={setComisionManual} />
                )}
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3">
              <span className="text-sm text-brand-800">{tipo === 'RETIRO' ? 'Entregar al cliente' : 'Cobrar al cliente'}</span>
              <span className="text-2xl font-bold tabular-nums text-brand-800">{fmtGs(tipo === 'RETIRO' ? monto : total)}</span>
            </div>
            <Button type="submit" className="h-11 w-full" icon={<Send className="h-4 w-4" />} loading={mut.isPending} disabled={!caja.data || !operadoraId || !monto}>
              Registrar {TIPOS.find((t) => t.value === tipo)?.label.toLowerCase()}
            </Button>
          </form>
        </Card>

        <Card title="Movimientos" className="xl:col-span-3">
          <Toolbar>
            <Field label="Buscar" className="min-w-[160px] flex-1">
              <Input value={list.q} onChange={(e) => list.setQ(e.target.value)} placeholder="Nombre, CI, número o boleta" />
            </Field>
            <Field label="Tipo">
              <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <option value="">Todos</option>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
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
              { key: 'tipo', header: 'Tipo', render: (r) => etiqueta(r.tipo) },
              { key: 'detalle', header: 'Detalle', render: (r) => <span className="text-xs text-slate-600">{r.servicio ?? r.nombre ?? r.nro_recibe ?? r.nro_envia ?? ''}</span> },
              { key: 'monto', header: 'Monto', align: 'right', render: (r) => fmtNum(r.monto) },
              { key: 'comision', header: 'Comisión', align: 'right', render: (r) => fmtNum(r.comision) },
              { key: 'estado', header: '', render: (r) => <EstadoBadge estado={r.estado} /> },
              {
                key: 'acc',
                header: '',
                render: (r) =>
                  isAdmin && r.estado === 'ACTIVO' ? (
                    <button
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Anular"
                      onClick={() => confirm(`¿Anular el movimiento #${r.id}?`) && anular.mutate(r.id)}
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  ) : null,
              },
            ]}
            footer={
              list.data?.totales && (
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-right text-slate-600">Comisiones del período</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(list.data.totales.comisiones)}</td>
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
