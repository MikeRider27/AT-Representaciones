import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History, ImageOff, Pencil, Plus, Upload } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { Badge, Button, Card, DataTable, EstadoBadge, Field, Input, Modal, MoneyInput, PageHeader, Pagination, Select, Toolbar } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { etiqueta, fmtFechaHora, fmtNum } from '@/lib/format';
import { useApiMutation, useCatalogo, useImpuestos, usePagedList } from '@/lib/hooks';
import type { Producto } from '@/lib/types';

const vacio = { codigo: '', descripcion: '', marca_id: 0, impuesto_id: 0, precio_compra: 0, precio_venta: 0, stock_minimo: 0, activo: true };

function ProductoForm({ producto, onClose }: { producto: Producto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const marcas = useCatalogo('/marcas');
  const impuestos = useImpuestos();
  const [f, setF] = useState(vacio);
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (producto) {
      const { codigo, descripcion, marca_id, impuesto_id, precio_compra, precio_venta, stock_minimo, activo } = producto;
      setF({ codigo, descripcion, marca_id, impuesto_id, precio_compra, precio_venta, stock_minimo, activo });
      setPreview(producto.tiene_imagen ? `/api/productos/${producto.id}/imagen?v=${encodeURIComponent(producto.updated_at)}` : null);
    } else {
      setF(vacio);
      setPreview(null);
    }
    setImagen(null);
  }, [producto]);

  useEffect(() => {
    if (!f.marca_id && marcas.data?.length) setF((p) => ({ ...p, marca_id: marcas.data![0].id }));
    if (!f.impuesto_id && impuestos.data?.length) setF((p) => ({ ...p, impuesto_id: impuestos.data!.find((i) => i.tasa === 10)?.id ?? impuestos.data![0].id }));
  }, [marcas.data, impuestos.data, f.marca_id, f.impuesto_id]);

  const mut = useApiMutation(
    async () => {
      const saved = producto ? await api.put<Producto>(`/productos/${producto.id}`, f) : await api.post<Producto>('/productos', f);
      if (imagen) {
        const fd = new FormData();
        fd.append('imagen', imagen);
        await api.put(`/productos/${saved.id}/imagen`, fd).catch((e) => toast.error(`Producto guardado, pero falló la imagen: ${errorMessage(e)}`));
      }
      return saved;
    },
    {
      success: producto ? 'Producto actualizado' : 'Producto creado',
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['/productos'] });
        qc.invalidateQueries({ queryKey: ['/stock'] });
        onClose();
      },
    },
  );

  const margen = f.precio_venta && f.precio_compra ? ((f.precio_venta - f.precio_compra) / f.precio_venta) * 100 : 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    mut.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={producto ? `Editar ${producto.codigo}` : 'Nuevo producto'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="prod-form" loading={mut.isPending}>Guardar</Button>
        </>
      }
    >
      <form id="prod-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-4 sm:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Código" required>
              <Input value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} autoFocus required maxLength={50} />
            </Field>
            <Field label="Marca" required>
              <Select value={f.marca_id} onChange={(e) => setF({ ...f, marca_id: Number(e.target.value) })}>
                {marcas.data?.map((m) => <option key={m.id} value={m.id}>{m.descripcion}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Descripción" required>
            <Input value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} required maxLength={150} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Precio de compra">
              <MoneyInput value={f.precio_compra} onValueChange={(v) => setF({ ...f, precio_compra: v })} />
            </Field>
            <Field
              label="Precio de venta"
              error={f.precio_venta < f.precio_compra ? 'Menor al precio de compra' : undefined}
              hint={margen ? `Margen ${margen.toFixed(1)}%` : undefined}
            >
              <MoneyInput value={f.precio_venta} onValueChange={(v) => setF({ ...f, precio_venta: v })} />
            </Field>
            <Field label="Impuesto">
              <Select value={f.impuesto_id} onChange={(e) => setF({ ...f, impuesto_id: Number(e.target.value) })}>
                {impuestos.data?.map((i) => <option key={i.id} value={i.id}>{i.descripcion}</option>)}
              </Select>
            </Field>
            <Field label="Stock mínimo">
              <Input type="number" min={0} value={f.stock_minimo} onChange={(e) => setF({ ...f, stock_minimo: Math.max(0, Number(e.target.value)) })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            Producto activo
          </label>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Imagen</span>
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-brand-400">
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-contain" />
            ) : (
              <>
                <Upload className="h-6 w-6" />
                <span className="mt-1 text-xs">PNG/JPG hasta 2 MB</span>
              </>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) return toast.error('La imagen supera 2 MB');
                setImagen(file);
                setPreview(URL.createObjectURL(file));
              }}
            />
          </label>
        </div>
      </form>
    </Modal>
  );
}

interface Kardex {
  id: number;
  created_at: string;
  tipo: string;
  cantidad: number;
  saldo: number;
  referencia_tipo: string | null;
  referencia_id: number | null;
  deposito: string;
  usuario: string;
}

function KardexModal({ producto, onClose }: { producto: Producto; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['/stock/movimientos', producto.id, page],
    queryFn: () => api.get<{ data: Kardex[]; total: number }>('/stock/movimientos', { producto_id: producto.id, page, pageSize: 15 }),
  });
  return (
    <Modal open onClose={onClose} size="xl" title={`Kardex · ${producto.codigo} ${producto.descripcion}`}>
      <DataTable
        loading={isLoading}
        rows={data?.data}
        rowKey={(r) => r.id}
        empty="Sin movimientos"
        columns={[
          { key: 'created_at', header: 'Fecha', render: (r) => fmtFechaHora(r.created_at) },
          { key: 'tipo', header: 'Movimiento', render: (r) => etiqueta(r.tipo) },
          { key: 'ref', header: 'Referencia', render: (r) => (r.referencia_tipo ? `${etiqueta(r.referencia_tipo)} #${r.referencia_id}` : '') },
          { key: 'deposito', header: 'Depósito' },
          { key: 'cantidad', header: 'Cantidad', align: 'right', render: (r) => <span className={r.cantidad < 0 ? 'text-red-600' : 'text-emerald-700'}>{r.cantidad > 0 ? '+' : ''}{r.cantidad}</span> },
          { key: 'saldo', header: 'Saldo', align: 'right' },
          { key: 'usuario', header: 'Usuario' },
        ]}
      />
      {data && <Pagination page={page} pageSize={15} total={data.total} onChange={setPage} />}
    </Modal>
  );
}

export function ProductosPage() {
  const { isAdmin } = useAuth();
  const marcas = useCatalogo('/marcas');
  const [marca, setMarca] = useState('');
  const [activo, setActivo] = useState('true');
  const list = usePagedList<Producto>('/productos', { marca_id: marca, activo });
  const [editar, setEditar] = useState<Producto | null | undefined>(undefined);
  const [kardex, setKardex] = useState<Producto | null>(null);
  const quitarImagen = useApiMutation((id: number) => api.delete(`/productos/${id}/imagen`), { success: 'Imagen eliminada', invalidate: ['/productos'] });

  return (
    <>
      <PageHeader
        title="Productos"
        subtitle="Catálogo de mercaderías"
        actions={isAdmin && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditar(null)}>Nuevo producto</Button>}
      />
      <Card>
        <Toolbar>
          <Field label="Buscar" className="min-w-[240px] flex-1">
            <Input placeholder="Código, descripción o marca" value={list.q} onChange={(e) => list.setQ(e.target.value)} />
          </Field>
          <Field label="Marca">
            <Select value={marca} onChange={(e) => setMarca(e.target.value)}>
              <option value="">Todas</option>
              {marcas.data?.map((m) => <option key={m.id} value={m.id}>{m.descripcion}</option>)}
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={activo} onChange={(e) => setActivo(e.target.value)}>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
              <option value="">Todos</option>
            </Select>
          </Field>
        </Toolbar>
        <DataTable
          loading={list.isLoading}
          rows={list.data?.data}
          rowKey={(r) => r.id}
          columns={[
            {
              key: 'img',
              header: '',
              render: (r) =>
                r.tiene_imagen ? (
                  <img src={`/api/productos/${r.id}/imagen?v=${encodeURIComponent(r.updated_at)}`} alt="" className="h-10 w-10 rounded object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-slate-300"><ImageOff className="h-4 w-4" /></div>
                ),
            },
            { key: 'codigo', header: 'Código', className: 'font-mono text-xs' },
            { key: 'descripcion', header: 'Descripción', render: (r) => <div className="max-w-xs"><p className="truncate font-medium">{r.descripcion}</p><p className="text-xs text-slate-500">{r.marca}</p></div> },
            { key: 'tasa_iva', header: 'IVA', render: (r) => (r.tasa_iva ? `${r.tasa_iva}%` : 'Exenta') },
            { key: 'precio_compra', header: 'Costo', align: 'right', render: (r) => fmtNum(r.precio_compra) },
            { key: 'precio_venta', header: 'Precio', align: 'right', render: (r) => <b>{fmtNum(r.precio_venta)}</b> },
            { key: 'stock_total', header: 'Stock', align: 'right', render: (r) => <Badge tone={r.stock_total <= r.stock_minimo ? (r.stock_total === 0 ? 'red' : 'amber') : 'green'}>{r.stock_total}</Badge> },
            { key: 'activo', header: '', render: (r) => <EstadoBadge estado={r.activo ? 'ACTIVO' : 'INACTIVO'} /> },
            {
              key: 'acc',
              header: '',
              render: (r) => (
                <div className="flex gap-1">
                  <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Kardex" onClick={() => setKardex(r)}>
                    <History className="h-4 w-4" />
                  </button>
                  {isAdmin && (
                    <>
                      <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar" onClick={() => setEditar(r)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      {r.tiene_imagen && (
                        <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Quitar imagen" onClick={() => quitarImagen.mutate(r.id)}>
                          <ImageOff className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
        {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onChange={list.setPage} />}
      </Card>
      {editar !== undefined && <ProductoForm producto={editar} onClose={() => setEditar(undefined)} />}
      {kardex && <KardexModal producto={kardex} onClose={() => setKardex(null)} />}
    </>
  );
}
