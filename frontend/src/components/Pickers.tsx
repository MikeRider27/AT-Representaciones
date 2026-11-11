import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import { forwardRef, KeyboardEvent, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { api, type Page } from '@/lib/api';
import { fmtNum } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import type { Persona, Producto } from '@/lib/types';

function useOutsideClose(ref: React.RefObject<HTMLElement>, onClose: () => void) {
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [ref, onClose]);
}

export interface ProductPickerHandle {
  focus: () => void;
}

/**
 * Buscador de productos por código o descripción.
 * Enter selecciona la primera coincidencia (sirve con lector de código de barras).
 */
export const ProductPicker = forwardRef<
  ProductPickerHandle,
  { depositoId?: number; onSelect: (p: Producto) => void; mostrarStock?: boolean; placeholder?: string }
>(function ProductPicker({ depositoId, onSelect, mostrarStock = true, placeholder }, ref) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const dq = useDebounced(q, 200);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));
  useOutsideClose(box, () => setOpen(false));

  const { data, isFetching } = useQuery({
    queryKey: ['/productos', 'picker', dq, depositoId],
    queryFn: () => api.get<Page<Producto>>('/productos', { q: dq, activo: 'true', pageSize: 10, deposito_id: depositoId }),
    enabled: dq.length > 0,
  });
  const results = data?.data ?? [];

  const pick = (p: Producto) => {
    onSelect(p);
    setQ('');
    setOpen(false);
    setActive(0);
    input.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const exacto = results.find((r) => r.codigo.toUpperCase() === q.trim().toUpperCase());
      const elegido = exacto ?? results[active];
      if (elegido) pick(elegido);
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => q && setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder ?? 'Buscar producto por código o descripción (Enter para agregar)'}
        className="block h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
      {open && dq && (
        <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {isFetching && !results.length && <li className="px-3 py-2 text-sm text-slate-400">Buscando…</li>}
          {!isFetching && !results.length && <li className="px-3 py-2 text-sm text-slate-400">Sin resultados</li>}
          {results.map((p, i) => {
            const stock = depositoId ? p.stock_deposito ?? 0 : p.stock_total;
            return (
              <li
                key={p.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                onMouseEnter={() => setActive(i)}
                className={clsx('flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm', i === active && 'bg-brand-50')}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{p.descripcion}</p>
                  <p className="text-xs text-slate-500">
                    {p.codigo} · {p.marca} · IVA {p.tasa_iva}%
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums text-slate-800">{fmtNum(p.precio_venta)}</p>
                  {mostrarStock && (
                    <p className={clsx('text-xs', stock > 0 ? 'text-emerald-600' : 'text-red-500')}>Stock: {fmtNum(stock)}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

/** Selector con búsqueda de clientes o proveedores. */
export function PersonaPicker({
  tipo,
  value,
  onChange,
  autoFocus,
}: {
  tipo: 'clientes' | 'proveedores';
  value: Persona | null;
  onChange: (p: Persona | null) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const dq = useDebounced(q, 200);
  const box = useRef<HTMLDivElement>(null);
  useOutsideClose(box, () => setOpen(false));

  const { data } = useQuery({
    queryKey: [`/${tipo}`, 'picker', dq],
    queryFn: () => api.get<Page<Persona>>(`/${tipo}`, { q: dq, activo: 'true', pageSize: 8 }),
    enabled: open,
  });
  const results = data?.data ?? [];

  if (value) {
    return (
      <div className="flex h-10 items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm">
        <div className="min-w-0 truncate">
          <span className="font-medium text-slate-900">{value.nombre}</span>
          <span className="ml-2 text-slate-500">RUC {value.ruc}</span>
        </div>
        <button onClick={() => onChange(null)} className="ml-2 text-slate-400 hover:text-slate-600" aria-label="Quitar">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const pick = (p: Persona) => {
    onChange(p);
    setQ('');
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
          if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          if (e.key === 'Enter' && results[active]) {
            e.preventDefault();
            pick(results[active]);
          }
        }}
        placeholder={`Buscar ${tipo === 'clientes' ? 'cliente' : 'proveedor'} por nombre o RUC`}
        className="block h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {!results.length && <li className="px-3 py-2 text-sm text-slate-400">Sin resultados</li>}
          {results.map((p, i) => (
            <li
              key={p.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setActive(i)}
              className={clsx('cursor-pointer px-3 py-2 text-sm', i === active && 'bg-brand-50')}
            >
              <span className="font-medium text-slate-800">{p.nombre}</span>
              <span className="ml-2 text-xs text-slate-500">RUC {p.ruc}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
