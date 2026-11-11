import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { ProductPicker } from '@/components/Pickers';
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Pagination, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtFechaHora } from '@/lib/format';
import { useApiMutation, useCatalogo, usePagedList } from '@/lib/hooks';
import type { Producto } from '@/lib/types';

interface AjusteRow {
  id: number;
  created_at: string;
  tipo: 'ALTA' | 'BAJA';
  observacion: string;
  deposito: string;
  usuario: string;
  items: number;
}

interface AjusteDetalle extends Omit<AjusteRow, 'items'> {
  items: { id: number; codigo: string; descripcion: string; cantidad: number }[];
}

function DetalleModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ['/ajustes', id], queryFn: () => api.get<AjusteDetalle>(`/ajustes/${id}`) });
  return (
    <Modal open onClose={onClose} size="lg" title={`Ajuste #${id}`}>
      {data && (
        <>
          <p className="mb-3 text-sm text-slate-600">
            <Badge tone={data.tipo === 'ALTA' ? 'green' : 'red'}>{data.tipo}</Badge> · {data.deposito} · {fmtFechaHora(data.created_at)} · {data.usuario}
            <br />
            {data.observacion}
          </p>
          <DataTable
            rows={data.items}
            rowKey={(r) => r.id}
            columns={[
              { key: 'codigo', header: 'Código' },
              { key: 'descripcion', header: 'Producto' },
              { key: 'cantidad', header: 'Cantidad', align: 'right' },
            ]}
          />
        </>
      )}
    </Modal>
  );
}

export function AjustesPage() {
  const { isAdmin } = useAuth();
  const list = usePagedList<AjusteRow>('/ajustes');
  const [ver, setVer] = useState<number | null>(null);
  return (
    <>
      <PageHeader
        title="Ajustes de stock"
        subtitle="Altas y bajas por inventario, roturas, pérdidas, etc."
        actions={isAdmin && <Link to="/ajustes/nuevo"><Button icon={<Plus className="h-4 w-4" />}>Nuevo ajuste</Button></Link>}
      />
      <Card>
        <DataTable
          loading={list.isLoading}
          rows={list.data?.data}
          rowKey={(r) => r.id}
          onRowClick={(r) => setVer(r.id)}
          columns={[
            { key: 'id', header: '#' },
            { key: 'created_at', header: 'Fecha', render: (r) => fmtFechaHora(r.created_at) },
            { key: 'tipo', header: 'Tipo', render: (r) => <Badge tone={r.tipo === 'ALTA' ? 'green' : 'red'}>{r.tipo}</Badge> },
            { key: 'deposito', header: 'Depósito' },
            { key: 'observacion', header: 'Observación', className: 'max-w-xs truncate' },
            { key: 'items', header: 'Ítems', align: 'right' },
            { key: 'usuario', header: 'Usuario' },
          ]}
        />
        {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onChange={list.setPage} />}
      </Card>
      {ver && <DetalleModal id={ver} onClose={() => setVer(null)} />}
    </>
  );
}

export function NuevoAjustePage() {
  const navigate = useNavigate();
  const depositos = useCatalogo('/depositos');
  const [tipo, setTipo] = useState<'ALTA' | 'BAJA'>('ALTA');
  const [depositoId, setDepositoId] = useState(0);
  const [obs, setObs] = useState('');
  const [lineas, setLineas] = useState<{ producto: Producto; cantidad: number }[]>([]);

  useEffect(() => {
    if (!depositoId && depositos.data?.length) setDepositoId(depositos.data[0].id);
  }, [depositos.data, depositoId]);

  const mut = useApiMutation(
    () =>
      api.post('/ajustes', {
        tipo,
        deposito_id: depositoId,
        observacion: obs,
        items: lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
      }),
    { success: 'Ajuste registrado', invalidate: ['/ajustes', '/productos', '/stock'], onSuccess: () => navigate('/ajustes') },
  );

  return (
    <>
      <PageHeader title="Nuevo ajuste de stock" actions={<Link to="/ajustes"><Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Volver</Button></Link>} />
      <Card className="overflow-visible">
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <Field label="Tipo">
            <div className="grid grid-cols-2 gap-2">
              {(['ALTA', 'BAJA'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={clsx(
                    'h-10 rounded-lg border text-sm font-medium',
                    tipo === t ? (t === 'ALTA' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-red-600 bg-red-50 text-red-700') : 'border-slate-300 text-slate-600',
                  )}
                >
                  {t === 'ALTA' ? 'Alta (suma)' : 'Baja (resta)'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Depósito">
            <Select value={depositoId} onChange={(e) => { setDepositoId(Number(e.target.value)); setLineas([]); }}>
              {depositos.data?.map((d) => <option key={d.id} value={d.id}>{d.descripcion}</option>)}
            </Select>
          </Field>
          <Field label="Motivo / observación" required>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej.: inventario físico" />
          </Field>
        </div>
        <div className="border-t border-slate-100 p-4">
          <ProductPicker
            depositoId={depositoId || undefined}
            onSelect={(p) => setLineas((prev) => (prev.some((l) => l.producto.id === p.id) ? prev : [...prev, { producto: p, cantidad: 1 }]))}
          />
        </div>
        <DataTable
          rows={lineas}
          rowKey={(r) => r.producto.id}
          empty="Agregue productos"
          columns={[
            { key: 'p', header: 'Producto', render: (r) => <div><p className="font-medium">{r.producto.descripcion}</p><p className="text-xs text-slate-500">{r.producto.codigo}</p></div> },
            { key: 'stock', header: 'Stock actual', align: 'right', render: (r) => r.producto.stock_deposito ?? 0 },
            {
              key: 'cantidad',
              header: 'Cantidad',
              render: (r) => (
                <Input
                  type="number"
                  min={1}
                  className={clsx('w-24 text-right', tipo === 'BAJA' && r.cantidad > (r.producto.stock_deposito ?? 0) && 'border-red-400 text-red-600')}
                  value={r.cantidad}
                  onChange={(e) => setLineas((prev) => prev.map((l) => (l.producto.id === r.producto.id ? { ...l, cantidad: Math.max(1, Number(e.target.value) || 1) } : l)))}
                />
              ),
            },
            {
              key: 'nuevo',
              header: 'Stock resultante',
              align: 'right',
              render: (r) => (r.producto.stock_deposito ?? 0) + (tipo === 'ALTA' ? r.cantidad : -r.cantidad),
            },
            { key: 'x', header: '', render: (r) => <button className="rounded p-1 text-slate-400 hover:text-red-600" onClick={() => setLineas((p) => p.filter((l) => l.producto.id !== r.producto.id))}><Trash2 className="h-4 w-4" /></button> },
          ]}
        />
        <div className="flex justify-end border-t border-slate-100 p-4">
          <Button icon={<Save className="h-4 w-4" />} disabled={!lineas.length || obs.trim().length < 3} loading={mut.isPending} onClick={() => mut.mutate()}>
            Registrar ajuste
          </Button>
        </div>
      </Card>
    </>
  );
}
