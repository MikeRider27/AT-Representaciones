import clsx from 'clsx';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Button, Card, DataTable, EstadoBadge, Field, Input, Modal, PageHeader, Pagination, Toolbar } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiMutation, usePagedList } from '@/lib/hooks';
import type { Catalogo } from '@/lib/types';

const CATALOGOS = [
  { path: '/marcas', label: 'Marcas' },
  { path: '/depositos', label: 'Depósitos' },
  { path: '/cajas', label: 'Cajas' },
  { path: '/operadoras', label: 'Operadoras' },
  { path: '/tipos-carga', label: 'Tipos de carga' },
];

function CatalogoTabla({ path, label }: { path: string; label: string }) {
  const list = usePagedList<Catalogo>(path);
  const [editar, setEditar] = useState<Catalogo | null | undefined>(undefined);
  const [descripcion, setDescripcion] = useState('');
  const [activo, setActivo] = useState(true);

  const abrir = (c: Catalogo | null) => {
    setEditar(c);
    setDescripcion(c?.descripcion ?? '');
    setActivo(c?.activo ?? true);
  };

  const guardar = useApiMutation(
    () => (editar ? api.put(`${path}/${editar.id}`, { descripcion, activo }) : api.post(path, { descripcion })),
    { success: 'Guardado', invalidate: [path, '/saldos'], onSuccess: () => setEditar(undefined) },
  );
  const eliminar = useApiMutation((id: number) => api.delete(`${path}/${id}`), {
    success: 'Eliminado',
    invalidate: [path],
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    guardar.mutate();
  };

  return (
    <Card>
      <Toolbar>
        <Field label="Buscar" className="min-w-[200px] flex-1">
          <Input value={list.q} onChange={(e) => list.setQ(e.target.value)} />
        </Field>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => abrir(null)}>Agregar</Button>
      </Toolbar>
      <DataTable
        loading={list.isLoading}
        rows={list.data?.data}
        rowKey={(r) => r.id}
        columns={[
          { key: 'id', header: '#' },
          { key: 'descripcion', header: 'Descripción', render: (r) => <span className="font-medium">{r.descripcion}</span> },
          { key: 'activo', header: 'Estado', render: (r) => <EstadoBadge estado={r.activo ? 'ACTIVO' : 'INACTIVO'} /> },
          {
            key: 'acc',
            header: '',
            render: (r) => (
              <div className="flex justify-end gap-1">
                <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => abrir(r)} title="Editar">
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Eliminar"
                  onClick={() => confirm(`¿Eliminar "${r.descripcion}"? Si está en uso, desactívelo en su lugar.`) && eliminar.mutate(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
          },
        ]}
      />
      {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onChange={list.setPage} />}
      <Modal
        open={editar !== undefined}
        onClose={() => setEditar(undefined)}
        size="sm"
        title={`${editar ? 'Editar' : 'Agregar'} · ${label}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditar(undefined)}>Cancelar</Button>
            <Button type="submit" form="cat-form" loading={guardar.isPending} disabled={!descripcion.trim()}>Guardar</Button>
          </>
        }
      >
        <form id="cat-form" onSubmit={submit} className="space-y-4">
          <Field label="Descripción" required>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} autoFocus maxLength={80} />
          </Field>
          {editar && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Activo
            </label>
          )}
        </form>
      </Modal>
    </Card>
  );
}

export function CatalogosPage() {
  const [tab, setTab] = useState(CATALOGOS[0].path);
  const actual = CATALOGOS.find((c) => c.path === tab)!;
  return (
    <>
      <PageHeader title="Catálogos" subtitle="Tablas auxiliares del sistema" />
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-200/60 p-1 sm:w-fit">
        {CATALOGOS.map((c) => (
          <button
            key={c.path}
            onClick={() => setTab(c.path)}
            className={clsx('rounded-md px-4 py-1.5 text-sm font-medium', tab === c.path ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600')}
          >
            {c.label}
          </button>
        ))}
      </div>
      <CatalogoTabla key={actual.path} path={actual.path} label={actual.label} />
    </>
  );
}
