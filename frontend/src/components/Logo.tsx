import clsx from 'clsx';

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-400 text-sm font-extrabold text-brand-900">AT</div>
      <div className="leading-tight">
        <p className={clsx('text-sm font-bold tracking-wide', dark ? 'text-slate-900' : 'text-white')}>AT REPRESENTACIONES</p>
        <p className={clsx('text-[11px]', dark ? 'text-slate-500' : 'text-brand-200')}>Gestión comercial</p>
      </div>
    </div>
  );
}
