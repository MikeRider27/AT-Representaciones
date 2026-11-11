import { Save } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, Field, Input, PageHeader, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiMutation, useConfiguracion } from '@/lib/hooks';
import type { Configuracion } from '@/lib/types';

export function ConfiguracionPage() {
  const { data } = useConfiguracion();
  const [f, setF] = useState<Configuracion | null>(null);
  useEffect(() => {
    if (data) setF(data);
  }, [data]);

  const mut = useApiMutation(() => api.put('/configuracion', f), { success: 'Configuración guardada', invalidate: ['/configuracion'] });
  if (!f) return <Spinner />;

  const set = (k: keyof Configuracion) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    mut.mutate();
  };

  return (
    <>
      <PageHeader title="Datos de la empresa" subtitle="Se usan en la factura impresa y en los cálculos" />
      <form onSubmit={submit} className="space-y-6">
        <Card title="Empresa">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Razón social" required className="sm:col-span-2"><Input value={f.razon_social} onChange={set('razon_social')} required /></Field>
            <Field label="RUC"><Input value={f.ruc} onChange={set('ruc')} /></Field>
            <Field label="Teléfono"><Input value={f.telefono} onChange={set('telefono')} /></Field>
            <Field label="Dirección" className="sm:col-span-2"><Input value={f.direccion} onChange={set('direccion')} /></Field>
            <Field label="Correo"><Input type="email" value={f.email} onChange={set('email')} /></Field>
          </div>
        </Card>
        <Card title="Facturación">
          <div className="grid gap-4 p-5 sm:grid-cols-4">
            <Field label="Timbrado"><Input value={f.timbrado} onChange={set('timbrado')} /></Field>
            <Field label="Vigencia"><Input type="date" value={f.timbrado_vigencia ?? ''} onChange={(e) => setF({ ...f, timbrado_vigencia: e.target.value || null })} /></Field>
            <Field label="Establecimiento"><Input value={f.establecimiento} onChange={set('establecimiento')} maxLength={3} pattern="\d{3}" /></Field>
            <Field label="Punto de expedición"><Input value={f.punto_expedicion} onChange={set('punto_expedicion')} maxLength={3} pattern="\d{3}" /></Field>
            <Field label="Último N° de factura emitido" hint={`La próxima factura será ${f.establecimiento}-${f.punto_expedicion}-${String(f.ultimo_numero_factura + 1).padStart(7, '0')}`}>
              <Input type="number" min={0} value={f.ultimo_numero_factura} onChange={(e) => setF({ ...f, ultimo_numero_factura: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
          </div>
        </Card>
        <Card title="Billetera">
          <div className="grid gap-4 p-5 sm:grid-cols-4">
            <Field label="Comisión por envío (%)">
              <Input type="number" step="0.01" min={0} max={100} value={f.comision_envio_pct} onChange={(e) => setF({ ...f, comision_envio_pct: Number(e.target.value) })} />
            </Field>
          </div>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" icon={<Save className="h-4 w-4" />} loading={mut.isPending}>Guardar cambios</Button>
        </div>
      </form>
    </>
  );
}
