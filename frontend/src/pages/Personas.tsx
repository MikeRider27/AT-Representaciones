import { Pencil, Plus, UserX } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, DataTable, EstadoBadge, Field, Input, Modal, PageHeader, Pagination, Select, Toolbar } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiMutation, usePagedList } from '@/lib/hooks';
import type { Persona } from '@/lib/types';

const vacio = { nombre: '', ruc: '', telefono: '', direccion: '', email: '', activo: true };

export function PersonasPage({ tipo }: { tipo: 'clientes' | 'proveedores' }) {
  const singular = tipo === 'clientes' ? 'cliente' : 'proveedor';
  const titulo = tipo === 'clientes' ? 'Clientes' : 'Proveedores';
  const [activo, setActivo] = useState('true');
  const list = usePagedList<Persona>(`/${tipo}`, { activo });
  const [editar, setEditar] = useState<Persona | null | undefined>(undefined);
  const [f, setF] = useState(vacio);

  useEffect(() => {
    if (editar) setF({ ...vacio, ...editar, telefono: editar.telefono ?? '', direccion: editar.direccion ?? '', email: editar.email ?? '' });
    else if (editar === null) setF(vacio);
  }, [editar]);

  const guardar = useApiMutation(() => (editar ? api.put(`/${tipo}/${editar.id}`, f) : api.post(`/${tipo}`, f)), {
    success: `${singular[0].toUpperCase() + singular.slice(1)} guardado`,
    invalidate: [`/${tipo}`],
    onSuccess: () => setEditar(undefined),
  });
  const desactivar = useApiMutation((id: number) => api.delete(`/${tipo}/${id}`), { success: `${singular} desactivado`, invalidate: [`/${tipo}`] });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    guardar.mutate();
  };

  return (
    <>
      <PageHeader title={titulo} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditar(null)}>Nuevo {singular}</Button>} />
      <Card>
        <Toolbar>
          <Field label="Buscar" className="min-w-[240px] flex-1">
            <Input placeholder="Nombre, RUC o código" value={list.q} onChange={(e) => list.setQ(e.target.value)} />
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
            { key: 'id', header: 'Cód.' },
            { key: 'nombre', header: 'Nombre / razón social', render: (r) => <span className="font-medium">{r.nombre}</span> },
            { key: 'ruc', header: 'RUC / CI' },
            { key: 'telefono', header: 'Teléfono', render: (r) => r.telefono ?? '' },
            { key: 'direccion', header: 'Dirección', className: 'max-w-xs truncate', render: (r) => r.direccion ?? '' },
            { key: 'activo', header: '', render: (r) => <EstadoBadge estado={r.activo ? 'ACTIVO' : 'INACTIVO'} /> },
            {
              key: 'acc',
              header: '',
              render: (r) => (
                <div className="flex gap-1">
                  <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar" onClick={() => setEditar(r)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  {r.activo && (
                    <button
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Desactivar"
                      onClick={() => confirm(`¿Desactivar a ${r.nombre}?`) && desactivar.mutate(r.id)}
                    >
                      <UserX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
        {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onChange={list.setPage} />}
      </Card>

      <Modal
        open={editar !== undefined}
        onClose={() => setEditar(undefined)}
        title={editar ? `Editar ${singular}` : `Nuevo ${singular}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditar(undefined)}>Cancelar</Button>
            <Button type="submit" form="persona-form" loading={guardar.isPending}>Guardar</Button>
          </>
        }
      >
        <form id="persona-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre / razón social" required className="sm:col-span-2">
            <Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required autoFocus maxLength={120} />
          </Field>
          <Field label="RUC / CI" required>
            <Input value={f.ruc} onChange={(e) => setF({ ...f, ruc: e.target.value })} required maxLength={20} placeholder="1234567-8" />
          </Field>
          <Field label="Teléfono">
            <Input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} maxLength={60} />
          </Field>
          <Field label="Dirección" className="sm:col-span-2">
            <Input value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} maxLength={200} />
          </Field>
          <Field label="Correo electrónico" className="sm:col-span-2">
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} maxLength={120} />
          </Field>
          {editar && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
              Activo
            </label>
          )}
        </form>
      </Modal>
    </>
  );
}
