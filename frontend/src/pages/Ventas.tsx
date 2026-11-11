import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, Ban, CheckCircle2, Download, Plus, Printer, ShoppingCart, Trash2, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { PersonaPicker, ProductPicker, type ProductPickerHandle } from '@/components/Pickers';
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
  Textarea,
  Toolbar,
} from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { descargarCSV, etiqueta, fmtFecha, fmtFechaHora, fmtGs, fmtNum, hoyISO, totalizar } from '@/lib/format';
import { useApiMutation, useCajaActual, useCatalogo, useConfiguracion, usePagedList } from '@/lib/hooks';
import { MEDIOS_PAGO, type MedioPago, type Persona, type Producto, type Venta } from '@/lib/types';

interface VentaRow {
  nro_factura: string;
  id: number;
  fecha: string;
  cliente: string;
  cliente_ruc: string;
  condicion: string;
  medio_pago: string | null;
  cuotas: number;
  total: number;
  estado: string;
  usuario: string;
}

// =============================================================== Listado ====
export function VentasPage() {
  const navigate = useNavigate();
  const [desde, setDesde] = useState(hoyISO(-30));
  const [hasta, setHasta] = useState(hoyISO());
  const [estado, setEstado] = useState('');
  const [condicion, setCondicion] = useState('');
  const list = usePagedList<VentaRow>('/ventas', { desde, hasta, estado, condicion });

  const exportar = async () => {
    const r = await api.get<Page<VentaRow>>('/ventas', { desde, hasta, estado, condicion, q: list.q, pageSize: 500 });
    descargarCSV(
      `ventas_${desde}_${hasta}`,
      [
        { key: 'nro_factura', label: 'Factura' },
        { key: 'fecha', label: 'Fecha' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'cliente_ruc', label: 'RUC' },
        { key: 'condicion', label: 'Condición' },
        { key: 'total', label: 'Total' },
        { key: 'estado', label: 'Estado' },
        { key: 'usuario', label: 'Usuario' },
      ],
      r.data,
    );
  };

  return (
    <>
      <PageHeader
        title="Ventas"
        subtitle="Facturas emitidas al contado y a crédito"
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportar}>
              Exportar
            </Button>
            <Link to="/ventas/nueva">
              <Button icon={<Plus className="h-4 w-4" />}>Nueva venta</Button>
            </Link>
          </>
        }
      />
      <Card>
        <Toolbar>
          <Field label="Buscar" className="min-w-[220px] flex-1">
            <Input placeholder="Cliente, RUC o número" value={list.q} onChange={(e) => list.setQ(e.target.value)} />
          </Field>
          <Field label="Desde">
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </Field>
          <Field label="Condición">
            <Select value={condicion} onChange={(e) => setCondicion(e.target.value)}>
              <option value="">Todas</option>
              <option value="CONTADO">Contado</option>
              <option value="CREDITO">Crédito</option>
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="EMITIDA">Emitida</option>
              <option value="ANULADA">Anulada</option>
            </Select>
          </Field>
        </Toolbar>
        <DataTable
          loading={list.isLoading}
          rows={list.data?.data}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/ventas/${r.id}`)}
          columns={[
            { key: 'nro_factura', header: 'Factura', className: 'font-mono text-xs' },
            { key: 'fecha', header: 'Fecha', render: (r) => fmtFecha(r.fecha) },
            { key: 'cliente', header: 'Cliente', render: (r) => <div><p className="font-medium">{r.cliente}</p><p className="text-xs text-slate-500">{r.cliente_ruc}</p></div> },
            { key: 'condicion', header: 'Condición', render: (r) => (r.condicion === 'CREDITO' ? `Crédito ${r.cuotas}c` : `Contado · ${etiqueta(r.medio_pago)}`) },
            { key: 'total', header: 'Total', align: 'right', render: (r) => fmtNum(r.total) },
            { key: 'estado', header: 'Estado', render: (r) => <EstadoBadge estado={r.estado} /> },
            { key: 'usuario', header: 'Usuario' },
          ]}
          footer={
            list.data?.totales && (
              <tr>
                <td colSpan={4} className="px-4 py-2.5 text-right text-slate-600">Total emitido del período</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(list.data.totales.monto)}</td>
                <td colSpan={2} />
              </tr>
            )
          }
        />
        {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onChange={list.setPage} />}
      </Card>
    </>
  );
}

// ======================================================== Punto de venta ====
interface Item {
  producto: Producto;
  cantidad: number;
  precio: number;
}

export function NuevaVentaPage() {
  const navigate = useNavigate();
  const caja = useCajaActual();
  const depositos = useCatalogo('/depositos');
  const picker = useRef<ProductPickerHandle>(null);

  const [cliente, setCliente] = useState<Persona | null>(null);
  const [depositoId, setDepositoId] = useState<number>(0);
  const [items, setItems] = useState<Item[]>([]);
  const [condicion, setCondicion] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO');
  const [cuotas, setCuotas] = useState(1);
  const [intervalo, setIntervalo] = useState(30);
  const [recibido, setRecibido] = useState(0);
  const [creada, setCreada] = useState<Venta | null>(null);

  useEffect(() => {
    if (!depositoId && depositos.data?.length) setDepositoId(depositos.data[0].id);
  }, [depositos.data, depositoId]);

  const t = useMemo(() => totalizar(items.map((i) => ({ subtotal: i.cantidad * i.precio, tasa: i.producto.tasa_iva }))), [items]);

  const agregar = (p: Producto) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.producto.id === p.id);
      if (idx >= 0) return prev.map((i, n) => (n === idx ? { ...i, cantidad: i.cantidad + 1 } : i));
      return [...prev, { producto: p, cantidad: 1, precio: p.precio_venta }];
    });
  };
  const actualizar = (id: number, patch: Partial<Item>) => setItems((prev) => prev.map((i) => (i.producto.id === id ? { ...i, ...patch } : i)));
  const quitar = (id: number) => setItems((prev) => prev.filter((i) => i.producto.id !== id));

  const consumidorFinal = async () => {
    const r = await api.get<Page<Persona>>('/clientes', { q: '44444401', activo: 'true', pageSize: 1 });
    if (r.data[0]) setCliente(r.data[0]);
  };

  const errores: string[] = [];
  items.forEach((i) => {
    if (i.cantidad > (i.producto.stock_deposito ?? 0)) errores.push(`${i.producto.descripcion}: stock insuficiente (${i.producto.stock_deposito ?? 0})`);
    if (i.precio < i.producto.precio_compra) errores.push(`${i.producto.descripcion}: precio menor al costo (${fmtNum(i.producto.precio_compra)})`);
  });

  const mut = useApiMutation(
    () =>
      api.post<Venta>('/ventas', {
        cliente_id: cliente!.id,
        deposito_id: depositoId,
        condicion,
        medio_pago: medio,
        cuotas,
        intervalo_dias: intervalo,
        items: items.map((i) => ({ producto_id: i.producto.id, cantidad: i.cantidad, precio_unitario: i.precio })),
      }),
    {
      invalidate: ['/ventas', '/productos', '/stock', '/caja/actual', '/reportes/dashboard'],
      onSuccess: (v) => setCreada(v),
    },
  );

  const puedeGuardar = !!cliente && items.length > 0 && errores.length === 0 && !!caja.data && !mut.isPending;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9' && puedeGuardar) {
        e.preventDefault();
        mut.mutate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [puedeGuardar, mut]);

  const reiniciar = () => {
    setItems([]);
    setCliente(null);
    setCondicion('CONTADO');
    setMedio('EFECTIVO');
    setCuotas(1);
    setRecibido(0);
    setCreada(null);
    setTimeout(() => picker.current?.focus(), 50);
  };

  if (caja.isLoading) return <Spinner />;

  return (
    <>
      <PageHeader title="Punto de venta" subtitle="Escanee o busque productos. F9 para confirmar." />
      {!caja.data && (
        <div className="mb-4">
          <Alert>
            Debe realizar la <Link to="/caja" className="font-semibold underline">apertura de caja</Link> antes de vender.
          </Alert>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="p-4">
            <ProductPicker ref={picker} depositoId={depositoId || undefined} onSelect={agregar} />
          </Card>
          <Card>
            <DataTable
              rowKey={(r) => r.producto.id}
              rows={items}
              empty="Agregue productos para comenzar"
              columns={[
                {
                  key: 'producto',
                  header: 'Producto',
                  render: (r) => (
                    <div className="max-w-[260px]">
                      <p className="truncate font-medium">{r.producto.descripcion}</p>
                      <p className="text-xs text-slate-500">
                        {r.producto.codigo} · IVA {r.producto.tasa_iva}% · Stock {r.producto.stock_deposito ?? 0}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'cantidad',
                  header: 'Cant.',
                  render: (r) => (
                    <Input
                      type="number"
                      min={1}
                      value={r.cantidad}
                      onChange={(e) => actualizar(r.producto.id, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                      className={clsx('w-20 text-right', r.cantidad > (r.producto.stock_deposito ?? 0) && 'border-red-400 text-red-600')}
                    />
                  ),
                },
                {
                  key: 'precio',
                  header: 'Precio',
                  render: (r) => (
                    <MoneyInput
                      value={r.precio}
                      onValueChange={(v) => actualizar(r.producto.id, { precio: v })}
                      className={clsx('w-32', r.precio < r.producto.precio_compra && 'border-red-400 text-red-600')}
                    />
                  ),
                },
                { key: 'subtotal', header: 'Subtotal', align: 'right', render: (r) => fmtNum(r.cantidad * r.precio) },
                {
                  key: 'x',
                  header: '',
                  render: (r) => (
                    <button onClick={() => quitar(r.producto.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Quitar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ),
                },
              ]}
            />
          </Card>
          {errores.length > 0 && (
            <Alert tone="red">
              <ul className="list-inside list-disc">
                {errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Cliente" actions={<button onClick={consumidorFinal} className="text-xs font-medium text-brand-700 hover:underline"><UserRound className="mr-1 inline h-3 w-3" />Consumidor final</button>} className="overflow-visible">
            <div className="space-y-3 p-4">
              <PersonaPicker tipo="clientes" value={cliente} onChange={setCliente} />
              <Field label="Depósito">
                <Select value={depositoId} onChange={(e) => { setDepositoId(Number(e.target.value)); setItems([]); }}>
                  {depositos.data?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.descripcion}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Pago">
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-2">
                {(['CONTADO', 'CREDITO'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCondicion(c)}
                    className={clsx(
                      'h-10 rounded-lg border text-sm font-medium',
                      condicion === c ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {c === 'CONTADO' ? 'Contado' : 'Crédito'}
                  </button>
                ))}
              </div>
              {condicion === 'CONTADO' ? (
                <>
                  <Field label="Medio de pago">
                    <Select value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
                      {MEDIOS_PAGO.map((m) => (
                        <option key={m} value={m}>
                          {etiqueta(m)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {medio === 'EFECTIVO' && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Recibido">
                        <MoneyInput value={recibido} onValueChange={setRecibido} />
                      </Field>
                      <Field label="Vuelto">
                        <div className={clsx('flex h-10 items-center justify-end rounded-lg bg-slate-100 px-3 text-sm font-semibold tabular-nums', recibido - t.total < 0 && 'text-red-600')}>
                          {recibido ? fmtNum(recibido - t.total) : '—'}
                        </div>
                      </Field>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cuotas">
                    <Input type="number" min={1} max={60} value={cuotas} onChange={(e) => setCuotas(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} />
                  </Field>
                  <Field label="Cada (días)">
                    <Select value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))}>
                      {[15, 30, 45, 60].map((d) => (
                        <option key={d} value={d}>
                          {d} días
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <p className="col-span-2 text-xs text-slate-500">
                    {cuotas} cuota(s) de aprox. {fmtGs(Math.floor(t.total / cuotas))}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <dl className="space-y-1.5 text-sm">
              {[
                ['Exentas', t.exenta],
                ['Gravadas 5%', t.gravada5],
                ['Gravadas 10%', t.gravada10],
                ['IVA 5%', t.iva5],
                ['IVA 10%', t.iva10],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-slate-600">
                  <dt>{k}</dt>
                  <dd className="tabular-nums">{fmtNum(v as number)}</dd>
                </div>
              ))}
              <div className="flex items-end justify-between border-t border-slate-200 pt-3">
                <dt className="font-semibold text-slate-800">Total</dt>
                <dd className="text-3xl font-bold tabular-nums text-brand-800">{fmtGs(t.total)}</dd>
              </div>
            </dl>
            <Button className="mt-4 h-12 w-full text-base" icon={<ShoppingCart className="h-5 w-5" />} disabled={!puedeGuardar} loading={mut.isPending} onClick={() => mut.mutate()}>
              Confirmar venta (F9)
            </Button>
            {!cliente && items.length > 0 && <p className="mt-2 text-center text-xs text-slate-500">Seleccione un cliente</p>}
          </Card>
        </div>
      </div>

      <Modal
        open={!!creada}
        onClose={reiniciar}
        title="Venta registrada"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => navigate(`/ventas/${creada!.id}`)}>
              Ver detalle
            </Button>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.open(`/ventas/${creada!.id}/imprimir`, '_blank')}>
              Imprimir
            </Button>
            <Button onClick={reiniciar} autoFocus>
              Nueva venta
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <p className="text-lg font-semibold">Venta #{creada?.id}</p>
          <p className="text-2xl font-bold text-brand-800">{fmtGs(creada?.total)}</p>
          {creada?.condicion === 'CONTADO' && creada.medio_pago === 'EFECTIVO' && recibido > 0 && (
            <p className="text-slate-600">Vuelto: <span className="font-semibold">{fmtGs(recibido - creada.total)}</span></p>
          )}
        </div>
      </Modal>
    </>
  );
}

// =============================================================== Detalle ====
export function VentaDetallePage() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [anular, setAnular] = useState(false);
  const [motivo, setMotivo] = useState('');
  const { data: v, isLoading } = useQuery({ queryKey: ['/ventas', id], queryFn: () => api.get<Venta>(`/ventas/${id}`) });

  const mut = useApiMutation(() => api.post(`/ventas/${id}/anular`, { motivo }), {
    success: 'Venta anulada',
    invalidate: ['/ventas', '/productos', '/stock', '/caja/actual', '/cobranzas', '/reportes/dashboard'],
    onSuccess: () => setAnular(false),
  });

  if (isLoading || !v) return <Spinner />;

  return (
    <>
      <PageHeader
        title={`Factura ${v.nro_factura}`}
        subtitle={`${fmtFechaHora(v.created_at)} · ${v.usuario}`}
        actions={
          <>
            <Link to="/ventas">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>
                Volver
              </Button>
            </Link>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.open(`/ventas/${v.id}/imprimir`, '_blank')}>
              Imprimir
            </Button>
            {isAdmin && v.estado === 'EMITIDA' && (
              <Button variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setAnular(true)}>
                Anular
              </Button>
            )}
          </>
        }
      />
      {v.estado === 'ANULADA' && (
        <div className="mb-4">
          <Alert tone="red">
            Anulada el {fmtFechaHora(v.anulada_at)} por {v.anulada_por_nombre}. Motivo: {v.motivo_anulacion}
          </Alert>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Productos" className="lg:col-span-2">
          <DataTable
            rowKey={(r) => r.id}
            rows={v.items}
            columns={[
              { key: 'codigo', header: 'Código' },
              { key: 'descripcion', header: 'Descripción' },
              { key: 'cantidad', header: 'Cant.', align: 'right' },
              { key: 'precio_unitario', header: 'Precio', align: 'right', render: (r) => fmtNum(r.precio_unitario) },
              { key: 'tasa_iva', header: 'IVA', align: 'right', render: (r) => `${r.tasa_iva}%` },
              { key: 'subtotal', header: 'Subtotal', align: 'right', render: (r) => fmtNum(r.subtotal) },
            ]}
          />
        </Card>
        <div className="space-y-6">
          <Card title="Resumen">
            <dl className="space-y-2 p-4 text-sm">
              <Row k="Estado" v={<EstadoBadge estado={v.estado} />} />
              <Row k="Cliente" v={v.cliente} />
              <Row k="RUC" v={v.cliente_ruc} />
              <Row k="Condición" v={v.condicion === 'CREDITO' ? `Crédito (${v.cuotas} cuotas)` : `Contado · ${etiqueta(v.medio_pago)}`} />
              <Row k="Depósito" v={v.deposito} />
              <Row k="IVA 5%" v={fmtNum(v.total_iva5)} />
              <Row k="IVA 10%" v={fmtNum(v.total_iva10)} />
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{fmtGs(v.total)}</span>
              </div>
            </dl>
          </Card>
          {v.plan_cuotas.length > 0 && (
            <Card title="Plan de cuotas">
              <DataTable
                rowKey={(r) => r.id}
                rows={v.plan_cuotas}
                columns={[
                  { key: 'nro_cuota', header: 'N°' },
                  { key: 'vencimiento', header: 'Vence', render: (r) => fmtFecha(r.vencimiento) },
                  { key: 'monto', header: 'Monto', align: 'right', render: (r) => fmtNum(r.monto) },
                  { key: 'saldo', header: 'Saldo', align: 'right', render: (r) => fmtNum(r.saldo) },
                  { key: 'estado', header: '', render: (r) => <EstadoBadge estado={r.estado} /> },
                ]}
              />
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={anular}
        onClose={() => setAnular(false)}
        title={`Anular venta #${v.id}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAnular(false)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={mut.isPending} disabled={motivo.trim().length < 3} onClick={() => mut.mutate()}>
              Anular venta
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          Se devolverá el stock, se anularán las cuotas pendientes y se revertirá el ingreso en caja.
        </p>
        <Field label="Motivo" required>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        </Field>
      </Modal>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium text-slate-800">{v}</dd>
    </div>
  );
}

// ============================================================== Factura =====
export function FacturaPrintPage() {
  const { id } = useParams();
  const { data: cfg } = useConfiguracion();
  const { data: v } = useQuery({ queryKey: ['/ventas', id], queryFn: () => api.get<Venta>(`/ventas/${id}`) });

  if (!v || !cfg) return <div className="p-10"><Spinner /></div>;

  const col = (tasa: number, r: { tasa_iva: number; subtotal: number }) => (r.tasa_iva === tasa ? fmtNum(r.subtotal) : '');

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 print:hidden">
        <Button variant="secondary" onClick={() => window.close()}>Cerrar</Button>
        <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Imprimir</Button>
      </div>
      <div className="relative mx-auto max-w-[210mm] bg-white p-8 text-[12px] text-slate-900 shadow print:max-w-none print:p-0 print:shadow-none">
        {v.estado === 'ANULADA' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-25deg] text-8xl font-black text-red-500/20">ANULADA</span>
          </div>
        )}
        <div className="grid grid-cols-3 border border-slate-800">
          <div className="col-span-2 border-r border-slate-800 p-3">
            <p className="text-lg font-bold">{cfg.razon_social}</p>
            <p>Venta de artículos electrónicos, electrodomésticos y accesorios</p>
            <p>{cfg.direccion}</p>
            <p>Tel.: {cfg.telefono} {cfg.email && `· ${cfg.email}`}</p>
          </div>
          <div className="p-3 text-center">
            <p>Timbrado N° <b>{cfg.timbrado || '—'}</b></p>
            {cfg.timbrado_vigencia && <p>Vigente hasta {fmtFecha(cfg.timbrado_vigencia)}</p>}
            <p>RUC: <b>{cfg.ruc || '—'}</b></p>
            <p className="mt-1 text-base font-bold">FACTURA</p>
            <p className="font-mono text-sm">{v.nro_factura}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 border-x border-b border-slate-800 p-3">
          <p>Fecha de emisión: <b>{fmtFecha(v.fecha)}</b></p>
          <p>Condición: <b>{v.condicion === 'CONTADO' ? 'CONTADO' : `CRÉDITO (${v.cuotas} cuotas)`}</b></p>
          <p>Nombre o razón social: <b>{v.cliente}</b></p>
          <p>RUC / CI: <b>{v.cliente_ruc}</b></p>
          <p>Dirección: {v.cliente_direccion || '—'}</p>
          <p>Teléfono: {v.cliente_telefono || '—'}</p>
        </div>
        <table className="w-full border-x border-b border-slate-800">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-100 print:bg-transparent">
              <th className="w-14 border-r border-slate-800 p-1">Cant.</th>
              <th className="border-r border-slate-800 p-1 text-left">Descripción</th>
              <th className="w-24 border-r border-slate-800 p-1 text-right">Precio unit.</th>
              <th className="w-24 border-r border-slate-800 p-1 text-right">Exentas</th>
              <th className="w-24 border-r border-slate-800 p-1 text-right">5%</th>
              <th className="w-24 p-1 text-right">10%</th>
            </tr>
          </thead>
          <tbody>
            {v.items.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="border-r border-slate-800 p-1 text-center">{r.cantidad}</td>
                <td className="border-r border-slate-800 p-1">{r.descripcion}</td>
                <td className="border-r border-slate-800 p-1 text-right">{fmtNum(r.precio_unitario)}</td>
                <td className="border-r border-slate-800 p-1 text-right">{col(0, r)}</td>
                <td className="border-r border-slate-800 p-1 text-right">{col(5, r)}</td>
                <td className="p-1 text-right">{col(10, r)}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 10 - v.items.length) }).map((_, i) => (
              <tr key={`e${i}`}>
                <td className="border-r border-slate-800 p-1">&nbsp;</td>
                <td className="border-r border-slate-800" />
                <td className="border-r border-slate-800" />
                <td className="border-r border-slate-800" />
                <td className="border-r border-slate-800" />
                <td />
              </tr>
            ))}
            <tr className="border-t border-slate-800 font-semibold">
              <td colSpan={3} className="border-r border-slate-800 p-1 text-right">Subtotales</td>
              <td className="border-r border-slate-800 p-1 text-right">{fmtNum(v.total_exenta)}</td>
              <td className="border-r border-slate-800 p-1 text-right">{fmtNum(v.total_gravada5)}</td>
              <td className="p-1 text-right">{fmtNum(v.total_gravada10)}</td>
            </tr>
            <tr className="border-t border-slate-800 text-sm font-bold">
              <td colSpan={5} className="border-r border-slate-800 p-1 text-right">TOTAL A PAGAR Gs.</td>
              <td className="p-1 text-right">{fmtNum(v.total)}</td>
            </tr>
            <tr className="border-t border-slate-800">
              <td colSpan={6} className="p-1">
                Liquidación del IVA: (5%) {fmtNum(v.total_iva5)} &nbsp;·&nbsp; (10%) {fmtNum(v.total_iva10)} &nbsp;·&nbsp; Total IVA{' '}
                {fmtNum(v.total_iva5 + v.total_iva10)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-right text-[10px] text-slate-500">Original: cliente · Duplicado: archivo tributario</p>
      </div>
    </div>
  );
}
