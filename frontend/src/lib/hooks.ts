import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage, type Page } from './api';
import type { Catalogo, Configuracion, Impuesto, SesionCaja } from './types';

export function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

type Filters = Record<string, string | number | boolean | undefined | null>;

/** Listado paginado con búsqueda debounced. */
export function usePagedList<T>(path: string, filters: Filters = {}, pageSize = 25) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q);
  const key = JSON.stringify(filters);

  useEffect(() => setPage(1), [debouncedQ, key]);

  const query = useQuery({
    queryKey: [path, { page, pageSize, q: debouncedQ, ...filters }],
    queryFn: () => api.get<Page<T>>(path, { page, pageSize, q: debouncedQ, ...filters }),
    placeholderData: keepPreviousData,
  });
  return { ...query, page, setPage, q, setQ, pageSize };
}

/** Opciones activas de un catálogo para selects. */
export function useCatalogo(path: string) {
  return useQuery({
    queryKey: [path, 'opciones'],
    queryFn: () => api.get<Page<Catalogo>>(path, { activo: 'true', pageSize: 500 }),
    select: (r) => r.data,
    staleTime: 60_000,
  });
}

export function useImpuestos() {
  return useQuery({
    queryKey: ['/impuestos'],
    queryFn: () => api.get<Page<Impuesto>>('/impuestos'),
    select: (r) => r.data,
    staleTime: Infinity,
  });
}

export function useConfiguracion() {
  return useQuery({ queryKey: ['/configuracion'], queryFn: () => api.get<Configuracion>('/configuracion'), staleTime: 60_000 });
}

export function useCajaActual() {
  return useQuery({ queryKey: ['/caja/actual'], queryFn: () => api.get<SesionCaja | null>('/caja/actual') });
}

/** Mutación con toast de éxito/error e invalidación de queries. */
export function useApiMutation<TVars = void, TRes = unknown>(
  fn: (vars: TVars) => Promise<TRes>,
  opts: { success?: string; invalidate?: string[]; onSuccess?: (res: TRes, vars: TVars) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (res, vars) => {
      if (opts.success) toast.success(opts.success);
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      opts.onSuccess?.(res, vars);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
