import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Card, DataTable, Field, Input, Modal, MoneyInput, PageHeader, Pagination, Select, Toolbar } from '@/components/ui';
import { api } from '@/lib/api';
import { etiqueta, fmtFechaHora, fmtGs, fmtNum } from '@/lib/format';
import { useApiMutation, usePagedList } from '@/lib/hooks';
import { useSaldos } from './Recargas';

interface MovSaldo {
  id: number;
  created_at: string;
  operadora: string;
  cuenta: string;
  tipo: string;
  monto: number;
  saldo_resultante: number;
  observacion: string | null;
  usuario: string;
}

function CargarSaldoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: saldos } = useSaldos();
  const [operadoraId, setOperadoraId] = useState(0);
  const [cuenta, setCuenta] = useState<'RECARGA' | 'BILLETERA'>('RECARGA');
  const [monto, setMonto] = useState(0);
  const [obs, setObs] = useState('');
  const opId = operadoraId || saldos?.[0]?.operadora_id || 0;
  const mut = useApiMutation(() => api.post('/saldos/cargas', { operadora_id: opId, cuenta, monto, observacion: obs }), {
    success: 'Saldo acreditado',
    invalidate: ['/saldos', '/reportes/dashboard'],
    onSuccess: () => {
      setMonto(0);
      setObs('');
      onClose();
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Compra de saldo / carga de billetera"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={mut.isPending} disabled={!monto || !opId} onClick={() => mut.mutate()}>Acreditar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Operadora">
          <Select value={opId} onChange={(e) => setOperadoraId(Number(e.target.value))}>
            {saldos?.map((s) => <option key={s.operadora_id} value={s.operadora_id}>{s.operadora}</option>)}
          </Select>
        </Field>
        <Field label="Cuenta">
          <Select value={cuenta} onChange={(e) => setCuenta(e.target.value as 'RECARGA' | 'BILLETERA')}>
            <option value="RECARGA">Saldo para recargas</option>
            <option value="BILLETERA">Billetera electrónica</option>
          </Select>
        </Field>
        <Field label="Monto" required>
          <MoneyInput value={monto} onValueChange={setMonto} autoFocus />
        </Field>
        <Field label="Observación">
          <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej.: compra a distribuidor" />
        </Field>
      </div>
    </Modal>
  );
}

export function SaldosPage() {
  const { isAdmin } = useAuth();
  const { data: saldos } = useSaldos();
  const [cargar, setCargar] = useState(false);
  const [cuenta, setCuenta] = useState('');
  const [operadora, setOperadora] = useState('');
  const list = usePagedList<MovSaldo>('/saldos/movimientos', { cuenta, operadora_id: operadora });

  return (
    <>
      <PageHeader
        title="Saldos de operadoras"
        subtitle="Saldo disponible para recargas y billeteras electrónicas"
        actions={isAdmin && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCargar(true)}>Cargar saldo</Button>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {saldos?.map((s) => (
          <Card key={s.operadora_id} className="p-5">
            <p className="text-sm font-semibold text-slate-800">{s.operadora}</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Recargas</span><span className="font-semibold tabular-nums">{fmtGs(s.saldo_recarga)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Billetera</span><span className="font-semibold tabular-nums">{fmtGs(s.saldo_billetera)}</span></div>
            </div>
          </Card>
        ))}
      </div>
      <Card title="Movimientos de saldo">
        <Toolbar>
          <Field label="Operadora">
            <Select value={operadora} onChange={(e) => setOperadora(e.target.value)}>
              <option value="">Todas</option>
              {saldos?.map((s) => <option key={s.operadora_id} value={s.operadora_id}>{s.operadora}</option>)}
            </Select>
          </Field>
          <Field label="Cuenta">
            <Select value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
              <option value="">Todas</option>
              <option value="RECARGA">Recargas</option>
              <option value="BILLETERA">Billetera</option>
            </Select>
          </Field>
        </Toolbar>
        <DataTable
          loading={list.isLoading}
          rows={list.data?.data}
          rowKey={(r) => r.id}
          columns={[
            { key: 'created_at', header: 'Fecha', render: (r) => fmtFechaHora(r.created_at) },
            { key: 'operadora', header: 'Operadora' },
            { key: 'cuenta', header: 'Cuenta', render: (r) => etiqueta(r.cuenta) },
            { key: 'tipo', header: 'Movimiento', render: (r) => etiqueta(r.tipo) },
            { key: 'monto', header: 'Monto', align: 'right', render: (r) => <span className={r.monto < 0 ? 'text-red-600' : 'text-emerald-700'}>{r.monto > 0 ? '+' : ''}{fmtNum(r.monto)}</span> },
            { key: 'saldo_resultante', header: 'Saldo', align: 'right', render: (r) => fmtNum(r.saldo_resultante) },
            { key: 'observacion', header: 'Obs.', render: (r) => r.observacion ?? '' },
            { key: 'usuario', header: 'Usuario' },
          ]}
        />
        {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onChange={list.setPage} />}
      </Card>
      <CargarSaldoModal open={cargar} onClose={() => setCargar(false)} />
    </>
  );
}
