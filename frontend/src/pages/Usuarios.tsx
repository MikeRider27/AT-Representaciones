import { KeyRound, Pencil, Plus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Badge, Button, Card, DataTable, EstadoBadge, Field, Input, Modal, PageHeader, Pagination, Select, Toolbar } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtFecha } from '@/lib/format';
import { useApiMutation, usePagedList } from '@/lib/hooks';
import type { Rol, Usuario } from '@/lib/types';

type Row = Usuario & { activo: boolean; created_at: string };

export function UsuariosPage() {
  const list = usePagedList<Row>('/usuarios');
  const [editar, setEditar] = useState<Row | null | undefined>(undefined);
  const [reset, setReset] = useState<Row | null>(null);
  const [f, setF] = useState({ username: '', nombre: '', rol: 'CAJERO' as Rol, activo: true, password: '' });
  const [nueva, setNueva] = useState('');

  const abrir = (u: Row | null) => {
    setEditar(u);
    setF(u ? { username: u.username, nombre: u.nombre, rol: u.rol, activo: u.activo, password: '' } : { username: '', nombre: '', rol: 'CAJERO', activo: true, password: '' });
  };

  const guardar = useApiMutation(
    () => {
      if (editar) {
        const { password: _omit, ...body } = f;
        void _omit;
        return api.put(`/usuarios/${editar.id}`, body);
      }
      return api.post('/usuarios', f);
    },
    { success: 'Usuario guardado', invalidate: ['/usuarios'], onSuccess: () => setEditar(undefined) },
  );
  const resetear = useApiMutation(() => api.put(`/usuarios/${reset!.id}/password`, { password: nueva }), {
    success: 'Contraseña restablecida',
    onSuccess: () => {
      setReset(null);
      setNueva('');
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    guardar.mutate();
  };

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Accesos al sistema" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => abrir(null)}>Nuevo usuario</Button>} />
      <Card>
        <Toolbar>
          <Field label="Buscar" className="min-w-[240px] flex-1">
            <Input value={list.q} onChange={(e) => list.setQ(e.target.value)} />
          </Field>
        </Toolbar>
        <DataTable
          loading={list.isLoading}
          rows={list.data?.data}
          rowKey={(r) => r.id}
          columns={[
            { key: 'username', header: 'Usuario', className: 'font-mono' },
            { key: 'nombre', header: 'Nombre' },
            { key: 'rol', header: 'Rol', render: (r) => <Badge tone={r.rol === 'ADMIN' ? 'blue' : 'gray'}>{r.rol === 'ADMIN' ? 'Administrador' : 'Cajero'}</Badge> },
            { key: 'activo', header: 'Estado', render: (r) => <EstadoBadge estado={r.activo ? 'ACTIVO' : 'INACTIVO'} /> },
            { key: 'created_at', header: 'Alta', render: (r) => fmtFecha(r.created_at) },
            {
              key: 'acc',
              header: '',
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar" onClick={() => abrir(r)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Restablecer contraseña" onClick={() => setReset(r)}>
                    <KeyRound className="h-4 w-4" />
                  </button>
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
        title={editar ? 'Editar usuario' : 'Nuevo usuario'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditar(undefined)}>Cancelar</Button>
            <Button type="submit" form="user-form" loading={guardar.isPending}>Guardar</Button>
          </>
        }
      >
        <form id="user-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Usuario" required>
            <Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} required minLength={3} autoFocus />
          </Field>
          <Field label="Rol">
            <Select value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value as Rol })}>
              <option value="CAJERO">Cajero</option>
              <option value="ADMIN">Administrador</option>
            </Select>
          </Field>
          <Field label="Nombre completo" required className="sm:col-span-2">
            <Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required />
          </Field>
          {!editar && (
            <Field label="Contraseña" hint="Mínimo 8 caracteres" required className="sm:col-span-2">
              <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} autoComplete="new-password" />
            </Field>
          )}
          {editar && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
              Activo
            </label>
          )}
        </form>
      </Modal>

      <Modal
        open={!!reset}
        onClose={() => setReset(null)}
        size="sm"
        title={`Restablecer contraseña de ${reset?.username}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReset(null)}>Cancelar</Button>
            <Button loading={resetear.isPending} disabled={nueva.length < 8} onClick={() => resetear.mutate()}>Restablecer</Button>
          </>
        }
      >
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">
          <Input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoFocus autoComplete="new-password" />
        </Field>
      </Modal>
    </>
  );
}
