import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { PersonaPicker, ProductPicker } from '@/components/Pickers';
import { Alert, Button, Card, DataTable, EstadoBadge, Field, Input, Modal, MoneyInput, PageHeader, Pagination, Select, Spinner, Textarea, Toolbar } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtFecha, fmtFechaHora, fmtGs, fmtNum, hoyISO, totalizar } from '@/lib/format';
import { useApiMutation, useCatalogo, usePagedList } from '@/lib/hooks';
import type { LineaDetalle, Persona, Producto } from '@/lib/types';

interface CompraRow {
  id: number;
  fecha: string;
  numero_factura: string;
  proveedor: string;
  condicion: string;
  total: number;
  estado: string;
  usuario: string;
}

interface Compra extends CompraRow {
  proveedor_ruc: string;
  deposito: string;
  created_at: string;
  total_iva5: number;
  total_iva10: number;
  anulada_at: string | null;
  anulada_por_nombre: string | null;
  motivo_anulacion: string | null;
  items: (LineaDetalle & { costo_unitario: number })[];
}

export function ComprasPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [desde, setDesde] = useState(hoyISO(-90));
  const [hasta, setHasta] = useState(hoyISO());
  const [estado, setEstado] = useState('');
  const list = usePagedList<CompraRow>('/compras', { desde, hasta, estado });

  return (
    <>
      <PageHeader
        title="Compras"
        subtitle="Facturas de proveedores · actualizan stock y costo"
        actions={isAdmin && <Link to="/compras/nueva"><Button icon={<Plus className="h-4 w-4" />}>Nueva compra</Button></Link>}
      />
      <Card>
        <Toolbar>
          <Field label="Buscar" className="min-w-[220px] flex-1">
            <Input placeholder="Proveedor o N° de factura" value={list.q} onChange={(e) => list.setQ(e.target.value)} />
          </Field>
          <Field label="Desde"><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Field>
          <Field label="Hasta"><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Field>
          <Field label="Estado">
            <Select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="ACTIVA">Activa</option>
              <option value="ANULADA">Anulada</option>
            </Select>
          </Field>
        </Toolbar>
        <DataTable
          loading={list.isLoading}
          rows={list.data?.data}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/compras/${r.id}`)}
          columns={[
            { key: 'id', header: '#' },
            { key: 'fecha', header: 'Fecha', render: (r) => fmtFecha(r.fecha) },
            { key: 'numero_factura', header: 'Factura', className: 'font-mono text-xs' },
            { key: 'proveedor', header: 'Proveedor' },
            { key: 'condicion', header: 'Condición' },
            { key: 'total', header: 'Total', align: 'right', render: (r) => fmtNum(r.total) },
            { key: 'estado', header: 'Estado', render: (r) => <EstadoBadge estado={r.estado} /> },
          ]}
        />
        {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onChange={list.setPage} />}
      </Card>
    </>
  );
}

interface Linea {
  producto: Producto;
  cantidad: number;
  costo: number;
}

export function NuevaCompraPage() {
  const navigate = useNavigate();
  const depositos = useCatalogo('/depositos');
  const [proveedor, setProveedor] = useState<Persona | null>(null);
  const [factura, setFactura] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [condicion, setCondicion] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [depositoId, setDepositoId] = useState(0);
  const [actualizarCosto, setActualizarCosto] = useState(true);
  const [lineas, setLineas] = useState<Linea[]>([]);

  useEffect(() => {
    if (!depositoId && depositos.data?.length) setDepositoId(depositos.data[0].id);
  }, [depositos.data, depositoId]);

  const t = useMemo(() => totalizar(lineas.map((l) => ({ subtotal: l.cantidad * l.costo, tasa: l.producto.tasa_iva }))), [lineas]);

  const agregar = (p: Producto) =>
    setLineas((prev) => (prev.some((l) => l.producto.id === p.id) ? prev : [...prev, { producto: p, cantidad: 1, costo: p.precio_compra }]));
  const upd = (id: number, patch: Partial<Linea>) => setLineas((prev) => prev.map((l) => (l.producto.id === id ? { ...l, ...patch } : l)));

  const mut = useApiMutation(
    () =>
      api.post<{ id: number }>('/compras', {
        proveedor_id: proveedor!.id,
        deposito_id: depositoId,
        numero_factura: factura,
        fecha,
        condicion,
        actualizar_precio_compra: actualizarCosto,
        items: lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad, costo_unitario: l.costo })),
      }),
    { success: 'Compra registrada', invalidate: ['/compras', '/productos', '/stock'], onSuccess: (c) => navigate(`/compras/${c.id}`) },
  );

  const ok = proveedor && factura.trim() && lineas.length && t.total > 0;

  return (
    <>
      <PageHeader
        title="Nueva compra"
        actions={<Link to="/compras"><Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Volver</Button></Link>}
      />
      <div className="space-y-6">
        <Card className="overflow-visible">
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <Field label="Proveedor" required className="md:col-span-2">
              <PersonaPicker tipo="proveedores" value={proveedor} onChange={setProveedor} />
            </Field>
            <Field label="N° de factura" required>
              <Input value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="001-001-0000000" />
            </Field>
            <Field label="Fecha">
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Field>
            <Field label="Condición">
              <Select value={condicion} onChange={(e) => setCondicion(e.target.value as 'CONTADO' | 'CREDITO')}>
                <option value="CONTADO">Contado</option>
                <option value="CREDITO">Crédito</option>
              </Select>
            </Field>
            <Field label="Depósito destino">
              <Select value={depositoId} onChange={(e) => setDepositoId(Number(e.target.value))}>
                {depositos.data?.map((d) => <option key={d.id} value={d.id}>{d.descripcion}</option>)}
              </Select>
            </Field>
          </div>
        </Card>
        <Card className="overflow-visible">
          <div className="p-4">
            <ProductPicker onSelect={agregar} mostrarStock={false} placeholder="Buscar producto para agregar a la compra" />
          </div>
          <DataTable
            rows={lineas}
            rowKey={(r) => r.producto.id}
            empty="Agregue productos"
            columns={[
              { key: 'p', header: 'Producto', render: (r) => <div><p className="font-medium">{r.producto.descripcion}</p><p className="text-xs text-slate-500">{r.producto.codigo} · IVA {r.producto.tasa_iva}%</p></div> },
              { key: 'cantidad', header: 'Cantidad', render: (r) => <Input type="number" min={1} className="w-24 text-right" value={r.cantidad} onChange={(e) => upd(r.producto.id, { cantidad: Math.max(1, Number(e.target.value) || 1) })} /> },
              { key: 'costo', header: 'Costo unit. (IVA incl.)', render: (r) => <MoneyInput className="w-36" value={r.costo} onValueChange={(v) => upd(r.producto.id, { costo: v })} /> },
              { key: 'sub', header: 'Subtotal', align: 'right', render: (r) => fmtNum(r.cantidad * r.costo) },
              { key: 'x', header: '', render: (r) => <button className="rounded p-1 text-slate-400 hover:text-red-600" onClick={() => setLineas((p) => p.filter((l) => l.producto.id !== r.producto.id))}><Trash2 className="h-4 w-4" /></button> },
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 p-5">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={actualizarCosto} onChange={(e) => setActualizarCosto(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Actualizar precio de compra de los productos
            </label>
            <div className="flex items-center gap-6">
              <div className="text-right text-sm text-slate-500">
                <p>IVA 5%: {fmtNum(t.iva5)}</p>
                <p>IVA 10%: {fmtNum(t.iva10)}</p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-brand-800">{fmtGs(t.total)}</p>
              <Button icon={<Save className="h-4 w-4" />} disabled={!ok} loading={mut.isPending} onClick={() => mut.mutate()}>
                Registrar compra
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

export function CompraDetallePage() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [anular, setAnular] = useState(false);
  const [motivo, setMotivo] = useState('');
  const { data: c, isLoading } = useQuery({ queryKey: ['/compras', id], queryFn: () => api.get<Compra>(`/compras/${id}`) });
  const mut = useApiMutation(() => api.post(`/compras/${id}/anular`, { motivo }), {
    success: 'Compra anulada',
    invalidate: ['/compras', '/productos', '/stock'],
    onSuccess: () => setAnular(false),
  });
  if (isLoading || !c) return <Spinner />;

  return (
    <>
      <PageHeader
        title={`Compra #${c.id} · Factura ${c.numero_factura}`}
        subtitle={`${c.proveedor} (${c.proveedor_ruc}) · ${fmtFecha(c.fecha)} · registrada por ${c.usuario}`}
        actions={
          <>
            <Link to="/compras"><Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Volver</Button></Link>
            {isAdmin && c.estado === 'ACTIVA' && <Button variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setAnular(true)}>Anular</Button>}
          </>
        }
      />
      {c.estado === 'ANULADA' && (
        <div className="mb-4"><Alert tone="red">Anulada el {fmtFechaHora(c.anulada_at)} por {c.anulada_por_nombre}. Motivo: {c.motivo_anulacion}</Alert></div>
      )}
      <Card>
        <DataTable
          rows={c.items}
          rowKey={(r) => r.id}
          columns={[
            { key: 'codigo', header: 'Código' },
            { key: 'descripcion', header: 'Descripción' },
            { key: 'cantidad', header: 'Cant.', align: 'right' },
            { key: 'costo_unitario', header: 'Costo', align: 'right', render: (r) => fmtNum(r.costo_unitario) },
            { key: 'tasa_iva', header: 'IVA', align: 'right', render: (r) => `${r.tasa_iva}%` },
            { key: 'subtotal', header: 'Subtotal', align: 'right', render: (r) => fmtNum(r.subtotal) },
          ]}
          footer={
            <tr>
              <td colSpan={5} className="px-4 py-2.5 text-right">Total ({c.condicion.toLowerCase()} · {c.deposito})</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(c.total)}</td>
            </tr>
          }
        />
      </Card>
      <Modal
        open={anular}
        onClose={() => setAnular(false)}
        size="sm"
        title="Anular compra"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAnular(false)}>Cancelar</Button>
            <Button variant="danger" loading={mut.isPending} disabled={motivo.trim().length < 3} onClick={() => mut.mutate()}>Anular</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">Se descontará del stock la mercadería ingresada. Si ya fue vendida, la anulación no será posible.</p>
        <Field label="Motivo" required><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus /></Field>
      </Modal>
    </>
  );
}
