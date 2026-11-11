import { Download } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, DataTable, Field, Input, PageHeader, Pagination, Select, StatCard, Toolbar } from '@/components/ui';
import { api, type Page } from '@/lib/api';
import { descargarCSV, fmtGs, fmtNum } from '@/lib/format';
import { useCatalogo, usePagedList } from '@/lib/hooks';

interface StockRow {
  producto_id: number;
  codigo: string;
  descripcion: string;
  marca: string;
  deposito_id: number;
  deposito: string;
  cantidad: number;
  stock_minimo: number;
  precio_compra: number;
  precio_venta: number;
  valor_costo: number;
}

export function StockPage() {
  const depositos = useCatalogo('/depositos');
  const [deposito, setDeposito] = useState('');
  const [bajo, setBajo] = useState(false);
  const list = usePagedList<StockRow>('/stock', { deposito_id: deposito, bajo_minimo: bajo ? 'true' : undefined }, 50);
  const tot = list.data?.totales;

  const exportar = async () => {
    const r = await api.get<Page<StockRow>>('/stock', { deposito_id: deposito, bajo_minimo: bajo ? 'true' : undefined, q: list.q, pageSize: 500 });
    descargarCSV(
      'stock',
      [
        { key: 'codigo', label: 'Código' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'marca', label: 'Marca' },
        { key: 'deposito', label: 'Depósito' },
        { key: 'cantidad', label: 'Cantidad' },
        { key: 'stock_minimo', label: 'Mínimo' },
        { key: 'precio_compra', label: 'Costo' },
        { key: 'valor_costo', label: 'Valor a costo' },
      ],
      r.data,
    );
  };

  return (
    <>
      <PageHeader title="Stock" subtitle="Existencias por depósito" actions={<Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportar}>Exportar</Button>} />
      {tot && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Unidades" value={fmtNum(tot.unidades)} />
          <StatCard label="Valor a costo" value={fmtGs(tot.valor_costo)} tone="amber" />
          <StatCard label="Valor a precio de venta" value={fmtGs(tot.valor_venta)} tone="green" />
        </div>
      )}
      <Card>
        <Toolbar>
          <Field label="Buscar" className="min-w-[240px] flex-1">
            <Input placeholder="Código o descripción" value={list.q} onChange={(e) => list.setQ(e.target.value)} />
          </Field>
          <Field label="Depósito">
            <Select value={deposito} onChange={(e) => setDeposito(e.target.value)}>
              <option value="">Todos</option>
              {depositos.data?.map((d) => <option key={d.id} value={d.id}>{d.descripcion}</option>)}
            </Select>
          </Field>
          <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={bajo} onChange={(e) => setBajo(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Sólo bajo mínimo
          </label>
        </Toolbar>
        <DataTable
          loading={list.isLoading}
          rows={list.data?.data}
          rowKey={(r) => `${r.producto_id}-${r.deposito_id}`}
          columns={[
            { key: 'codigo', header: 'Código', className: 'font-mono text-xs' },
            { key: 'descripcion', header: 'Producto', render: (r) => <div className="max-w-xs"><p className="truncate font-medium">{r.descripcion}</p><p className="text-xs text-slate-500">{r.marca}</p></div> },
            { key: 'deposito', header: 'Depósito' },
            { key: 'cantidad', header: 'Cantidad', align: 'right', render: (r) => <Badge tone={r.cantidad <= r.stock_minimo ? (r.cantidad === 0 ? 'red' : 'amber') : 'green'}>{fmtNum(r.cantidad)}</Badge> },
            { key: 'stock_minimo', header: 'Mínimo', align: 'right' },
            { key: 'precio_compra', header: 'Costo', align: 'right', render: (r) => fmtNum(r.precio_compra) },
            { key: 'valor_costo', header: 'Valor', align: 'right', render: (r) => fmtNum(r.valor_costo) },
          ]}
        />
        {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onChange={list.setPage} />}
      </Card>
    </>
  );
}
