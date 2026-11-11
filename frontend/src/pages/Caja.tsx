import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, Lock, Printer, Unlock } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  DataTable,
  EstadoBadge,
  Field,
  Input,
  Modal,
  MoneyInput,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  StatCard,
  Textarea,
} from '@/components/ui';
import { api } from '@/lib/api';
import { etiqueta, fmtFechaHora, fmtGs, fmtNum } from '@/lib/format';
import { useApiMutation, useCajaActual, useCatalogo, usePagedList } from '@/lib/hooks';
import { MEDIOS_PAGO, type MedioPago, type ResumenCaja } from '@/lib/types';

const INVALIDAR = ['/caja/actual', '/caja/sesiones', '/reportes/dashboard'];

function ResumenMedios({ resumen }: { resumen: ResumenCaja }) {
  return (
    <DataTable
      rowKey={(r) => r.medio_pago}
      rows={resumen.medios}
      columns={[
        { key: 'medio_pago', header: 'Medio', render: (r) => etiqueta(r.medio_pago) },
        { key: 'ingresos', header: 'Ingresos', align: 'right', render: (r) => fmtNum(r.ingresos) },
        { key: 'egresos', header: 'Egresos', align: 'right', render: (r) => fmtNum(r.egresos) },
        { key: 'esperado', header: 'Esperado', align: 'right', render: (r) => <b>{fmtNum(r.esperado)}</b> },
      ]}
      footer={
        <tr>
          <td className="px-4 py-2.5">Total</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(resumen.total_ingresos)}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(resumen.total_egresos)}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(resumen.total_esperado)}</td>
        </tr>
      }
    />
  );
}

function Apertura() {
  const cajas = useCatalogo('/cajas');
  const [cajaId, setCajaId] = useState(0);
  const [monto, setMonto] = useState(0);
  const mut = useApiMutation(() => api.post('/caja/apertura', { caja_id: cajaId || cajas.data?.[0]?.id, monto_apertura: monto }), {
    success: 'Caja abierta',
    invalidate: INVALIDAR,
  });
  return (
    <Card title="Apertura de caja" className="max-w-lg">
      <div className="space-y-4 p-5">
        <p className="text-sm text-slate-500">Registre el efectivo inicial con el que comienza el turno.</p>
        <Field label="Caja" required>
          <Select value={cajaId || cajas.data?.[0]?.id || ''} onChange={(e) => setCajaId(Number(e.target.value))}>
            {cajas.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.descripcion}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Monto de apertura (efectivo)" required>
          <MoneyInput value={monto} onValueChange={setMonto} autoFocus />
        </Field>
        <Button icon={<Unlock className="h-4 w-4" />} loading={mut.isPending} onClick={() => mut.mutate()} className="w-full">
          Abrir caja
        </Button>
      </div>
    </Card>
  );
}

function MovimientoManualModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tipo, setTipo] = useState<'INGRESO' | 'EGRESO'>('EGRESO');
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO');
  const [monto, setMonto] = useState(0);
  const [descripcion, setDescripcion] = useState('');
  const mut = useApiMutation(() => api.post('/caja/movimientos', { tipo, medio_pago: medio, monto, descripcion }), {
    success: 'Movimiento registrado',
    invalidate: INVALIDAR,
    onSuccess: () => {
      setMonto(0);
      setDescripcion('');
      onClose();
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Movimiento manual de caja"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={mut.isPending} disabled={!monto || descripcion.trim().length < 1} onClick={() => mut.mutate()}>
            Registrar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['INGRESO', 'EGRESO'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={clsx(
                'h-10 rounded-lg border text-sm font-medium',
                tipo === t ? (t === 'INGRESO' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-red-600 bg-red-50 text-red-700') : 'border-slate-300 text-slate-600',
              )}
            >
              {t === 'INGRESO' ? 'Ingreso' : 'Egreso / gasto'}
            </button>
          ))}
        </div>
        <Field label="Medio">
          <Select value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
            {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{etiqueta(m)}</option>)}
          </Select>
        </Field>
        <Field label="Monto" required>
          <MoneyInput value={monto} onValueChange={setMonto} />
        </Field>
        <Field label="Descripción" required>
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej.: pago de delivery" />
        </Field>
      </div>
    </Modal>
  );
}

function CierreModal({ open, onClose, sesionId, resumen }: { open: boolean; onClose: () => void; sesionId: number; resumen: ResumenCaja }) {
  const navigate = useNavigate();
  const esperado = Object.fromEntries(resumen.medios.map((m) => [m.medio_pago, m.esperado])) as Record<MedioPago, number>;
  const [efectivo, setEfectivo] = useState(esperado.EFECTIVO);
  const [tarjeta, setTarjeta] = useState(esperado.TARJETA);
  const [cheque, setCheque] = useState(esperado.CHEQUE);
  const [transferencia, setTransferencia] = useState(esperado.TRANSFERENCIA);
  const [obs, setObs] = useState('');
  const declarado = efectivo + tarjeta + cheque + transferencia;
  const diferencia = declarado - resumen.total_esperado;

  const mut = useApiMutation(
    () =>
      api.post(`/caja/sesiones/${sesionId}/cierre`, {
        declarado_efectivo: efectivo,
        declarado_tarjeta: tarjeta,
        declarado_cheque: cheque,
        declarado_transferencia: transferencia,
        observacion: obs,
      }),
    { success: 'Caja cerrada', invalidate: INVALIDAR, onSuccess: () => navigate(`/caja/sesiones/${sesionId}`) },
  );

  const fila = (label: string, medio: MedioPago, val: number, set: (n: number) => void) => (
    <div className="grid grid-cols-3 items-center gap-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-right text-sm tabular-nums text-slate-500">{fmtNum(esperado[medio])}</span>
      <MoneyInput value={val} onValueChange={set} />
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Arqueo y cierre de caja"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" icon={<Lock className="h-4 w-4" />} loading={mut.isPending} onClick={() => mut.mutate()}>
            Cerrar caja
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-xs font-semibold uppercase text-slate-500">
          <span>Medio</span>
          <span className="text-right">Esperado</span>
          <span className="text-right">Contado</span>
        </div>
        {fila('Efectivo', 'EFECTIVO', efectivo, setEfectivo)}
        {fila('Tarjeta', 'TARJETA', tarjeta, setTarjeta)}
        {fila('Cheque', 'CHEQUE', cheque, setCheque)}
        {fila('Transferencia', 'TRANSFERENCIA', transferencia, setTransferencia)}
        <div className="grid grid-cols-3 gap-3 border-t pt-3 text-sm font-semibold">
          <span>Total</span>
          <span className="text-right tabular-nums">{fmtNum(resumen.total_esperado)}</span>
          <span className="text-right tabular-nums">{fmtNum(declarado)}</span>
        </div>
        <Alert tone={diferencia === 0 ? 'blue' : 'red'}>
          Diferencia: <b>{fmtGs(diferencia)}</b> {diferencia > 0 ? '(sobrante)' : diferencia < 0 ? '(faltante)' : ''}
        </Alert>
        <Field label="Observación">
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

interface SesionRow {
  id: number;
  caja: string;
  usuario: string;
  estado: string;
  abierta_at: string;
  cerrada_at: string | null;
  monto_apertura: number;
  total_esperado: number | null;
  total_declarado: number | null;
  diferencia: number | null;
}

export function CajaPage() {
  const navigate = useNavigate();
  const { data: sesion, isLoading } = useCajaActual();
  const [manual, setManual] = useState(false);
  const [cierre, setCierre] = useState(false);
  const historial = usePagedList<SesionRow>('/caja/sesiones', {}, 10);

  if (isLoading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Caja"
        subtitle={sesion ? `${sesion.caja} · abierta el ${fmtFechaHora(sesion.abierta_at)}` : 'No tiene una caja abierta'}
        actions={
          sesion && (
            <>
              <Button variant="secondary" icon={<ArrowDownCircle className="h-4 w-4" />} onClick={() => setManual(true)}>
                Ingreso / egreso
              </Button>
              <Link to={`/caja/sesiones/${sesion.id}`}>
                <Button variant="secondary">Ver movimientos</Button>
              </Link>
              <Button variant="danger" icon={<Lock className="h-4 w-4" />} onClick={() => setCierre(true)}>
                Cerrar caja
              </Button>
            </>
          )
        }
      />

      {sesion?.resumen ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Apertura" value={fmtGs(sesion.monto_apertura)} />
            <StatCard label="Ingresos" value={fmtGs(sesion.resumen.total_ingresos)} tone="green" icon={<ArrowUpCircle className="h-5 w-5" />} />
            <StatCard label="Egresos" value={fmtGs(sesion.resumen.total_egresos)} tone="red" icon={<ArrowDownCircle className="h-5 w-5" />} />
            <StatCard label="Efectivo en caja" value={fmtGs(sesion.resumen.medios.find((m) => m.medio_pago === 'EFECTIVO')?.esperado)} tone="amber" />
          </div>
          <Card title="Resumen por medio de pago">
            <ResumenMedios resumen={sesion.resumen} />
          </Card>
          <MovimientoManualModal open={manual} onClose={() => setManual(false)} />
          {cierre && <CierreModal open onClose={() => setCierre(false)} sesionId={sesion.id} resumen={sesion.resumen} />}
        </div>
      ) : (
        <Apertura />
      )}

      <Card title="Historial de sesiones" className="mt-6">
        <DataTable
          loading={historial.isLoading}
          rows={historial.data?.data}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/caja/sesiones/${r.id}`)}
          columns={[
            { key: 'id', header: '#' },
            { key: 'caja', header: 'Caja' },
            { key: 'usuario', header: 'Cajero' },
            { key: 'abierta_at', header: 'Apertura', render: (r) => fmtFechaHora(r.abierta_at) },
            { key: 'cerrada_at', header: 'Cierre', render: (r) => fmtFechaHora(r.cerrada_at) },
            { key: 'total_esperado', header: 'Esperado', align: 'right', render: (r) => (r.total_esperado === null ? '—' : fmtNum(r.total_esperado)) },
            {
              key: 'diferencia',
              header: 'Diferencia',
              align: 'right',
              render: (r) => (r.diferencia === null ? '—' : <span className={r.diferencia < 0 ? 'text-red-600' : r.diferencia > 0 ? 'text-emerald-600' : ''}>{fmtNum(r.diferencia)}</span>),
            },
            { key: 'estado', header: 'Estado', render: (r) => <EstadoBadge estado={r.estado} /> },
          ]}
        />
        {historial.data && <Pagination page={historial.page} pageSize={historial.pageSize} total={historial.data.total} onChange={historial.setPage} />}
      </Card>
    </>
  );
}

interface SesionDetalle extends SesionRow {
  monto_apertura: number;
  declarado_efectivo: number | null;
  declarado_tarjeta: number | null;
  declarado_cheque: number | null;
  declarado_transferencia: number | null;
  observacion: string | null;
  cerrada_por_nombre: string | null;
  resumen: ResumenCaja;
  movimientos: {
    id: number;
    created_at: string;
    tipo: string;
    concepto: string;
    medio_pago: string;
    monto: number;
    descripcion: string | null;
    anulado: boolean;
    usuario: string;
  }[];
}

export function SesionCajaPage() {
  const { id } = useParams();
  const { data: s, isLoading } = useQuery({ queryKey: ['/caja/sesiones', id], queryFn: () => api.get<SesionDetalle>(`/caja/sesiones/${id}`) });
  if (isLoading || !s) return <Spinner />;

  return (
    <>
      <PageHeader
        title={`Sesión de caja #${s.id}`}
        subtitle={`${s.caja} · ${s.usuario} · ${fmtFechaHora(s.abierta_at)} → ${s.cerrada_at ? fmtFechaHora(s.cerrada_at) : 'abierta'}`}
        actions={
          <>
            <Link to="/caja">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Volver</Button>
            </Link>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Imprimir
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Resumen" className="lg:col-span-2">
          <ResumenMedios resumen={s.resumen} />
        </Card>
        <Card title="Arqueo">
          <dl className="space-y-2 p-4 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Estado</dt><dd><EstadoBadge estado={s.estado} /></dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Apertura</dt><dd className="tabular-nums">{fmtNum(s.monto_apertura)}</dd></div>
            {s.estado === 'CERRADA' && (
              <>
                <div className="flex justify-between"><dt className="text-slate-500">Efectivo contado</dt><dd className="tabular-nums">{fmtNum(s.declarado_efectivo)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Tarjeta</dt><dd className="tabular-nums">{fmtNum(s.declarado_tarjeta)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Cheque</dt><dd className="tabular-nums">{fmtNum(s.declarado_cheque)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Transferencia</dt><dd className="tabular-nums">{fmtNum(s.declarado_transferencia)}</dd></div>
                <div className="flex justify-between border-t pt-2 font-semibold"><dt>Diferencia</dt><dd className={clsx('tabular-nums', (s.diferencia ?? 0) < 0 && 'text-red-600')}>{fmtGs(s.diferencia)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Cerrada por</dt><dd>{s.cerrada_por_nombre}</dd></div>
                {s.observacion && <p className="rounded bg-slate-50 p-2 text-slate-600">{s.observacion}</p>}
              </>
            )}
          </dl>
        </Card>
      </div>
      <Card title="Movimientos" className="mt-6">
        <DataTable
          rows={s.movimientos}
          rowKey={(r) => r.id}
          columns={[
            { key: 'created_at', header: 'Fecha', render: (r) => fmtFechaHora(r.created_at) },
            { key: 'concepto', header: 'Concepto', render: (r) => etiqueta(r.concepto) },
            { key: 'descripcion', header: 'Detalle', render: (r) => r.descripcion ?? '' },
            { key: 'medio_pago', header: 'Medio', render: (r) => etiqueta(r.medio_pago) },
            {
              key: 'monto',
              header: 'Monto',
              align: 'right',
              render: (r) => (
                <span className={clsx(r.anulado && 'text-slate-400 line-through', !r.anulado && (r.tipo === 'INGRESO' ? 'text-emerald-700' : 'text-red-600'))}>
                  {r.tipo === 'EGRESO' ? '-' : '+'}
                  {fmtNum(r.monto)}
                </span>
              ),
            },
            { key: 'usuario', header: 'Usuario' },
          ]}
        />
      </Card>
    </>
  );
}
