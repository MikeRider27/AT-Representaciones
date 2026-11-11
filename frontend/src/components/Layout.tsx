import clsx from 'clsx';
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  HandCoins,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Package,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tags,
  Truck,
  UserCog,
  Users,
  Wallet,
  WalletCards,
  X,
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useCajaActual } from '@/lib/hooks';
import { CambiarPasswordModal } from './CambiarPasswordModal';
import { Logo } from './Logo';

interface Item {
  to: string;
  label: string;
  icon: ReactNode;
  admin?: boolean;
}

const ic = 'h-4 w-4';
const NAV: { title: string; items: Item[] }[] = [
  { title: '', items: [{ to: '/', label: 'Inicio', icon: <LayoutDashboard className={ic} /> }] },
  {
    title: 'Ventas',
    items: [
      { to: '/ventas/nueva', label: 'Punto de venta', icon: <ShoppingCart className={ic} /> },
      { to: '/ventas', label: 'Ventas', icon: <Receipt className={ic} /> },
      { to: '/cobranzas', label: 'Cobranzas', icon: <HandCoins className={ic} /> },
      { to: '/caja', label: 'Caja', icon: <Wallet className={ic} /> },
    ],
  },
  {
    title: 'Recargas y billetera',
    items: [
      { to: '/recargas', label: 'Venta de saldo', icon: <Smartphone className={ic} /> },
      { to: '/billetera', label: 'Billetera', icon: <WalletCards className={ic} /> },
      { to: '/saldos', label: 'Saldos operadoras', icon: <BarChart3 className={ic} /> },
    ],
  },
  {
    title: 'Inventario',
    items: [
      { to: '/productos', label: 'Productos', icon: <Package className={ic} /> },
      { to: '/stock', label: 'Stock', icon: <Boxes className={ic} /> },
      { to: '/compras', label: 'Compras', icon: <ShoppingBag className={ic} /> },
      { to: '/ajustes', label: 'Ajustes de stock', icon: <ListChecks className={ic} /> },
    ],
  },
  {
    title: 'Registros',
    items: [
      { to: '/clientes', label: 'Clientes', icon: <Users className={ic} /> },
      { to: '/proveedores', label: 'Proveedores', icon: <Truck className={ic} /> },
      { to: '/reportes', label: 'Reportes', icon: <ClipboardList className={ic} /> },
    ],
  },
  {
    title: 'Administración',
    items: [
      { to: '/catalogos', label: 'Catálogos', icon: <Tags className={ic} />, admin: true },
      { to: '/usuarios', label: 'Usuarios', icon: <UserCog className={ic} />, admin: true },
      { to: '/configuracion', label: 'Empresa', icon: <Building2 className={ic} />, admin: true },
    ],
  },
];

function CajaIndicator() {
  const { data } = useCajaActual();
  return (
    <Link
      to="/caja"
      className={clsx(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset',
        data ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-800 ring-amber-600/20',
      )}
    >
      <span className={clsx('h-2 w-2 rounded-full', data ? 'bg-emerald-500' : 'bg-amber-500')} />
      {data ? `${data.caja} abierta` : 'Caja cerrada'}
    </Link>
  );
}

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState(false);
  const location = useLocation();

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.admin || isAdmin);
          if (!items.length) return null;
          return (
            <div key={group.title || 'root'}>
              {group.title && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-200/70">{group.title}</p>}
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/' || item.to === '/ventas'}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          isActive ? 'bg-white/15 font-medium text-white' : 'text-brand-100 hover:bg-white/10 hover:text-white',
                        )
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-brand-900 lg:block print:hidden">{sidebar}</aside>

      {/* Sidebar móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-64 bg-brand-900">
            <button className="absolute right-3 top-4 text-brand-100" onClick={() => setOpen(false)} aria-label="Cerrar menú">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 print:hidden">
          <button className="text-slate-500 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <CajaIndicator />
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-800">{user?.nombre}</p>
            <p className="text-xs text-slate-500">{user?.rol === 'ADMIN' ? 'Administrador' : 'Cajero'}</p>
          </div>
          <button onClick={() => setPwd(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Cambiar contraseña">
            <KeyRound className="h-5 w-5" />
          </button>
          <button onClick={logout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Cerrar sesión">
            <LogOut className="h-5 w-5" />
          </button>
        </header>
        <main key={location.pathname} className="mx-auto max-w-7xl p-4 sm:p-6 print:max-w-none print:p-0">
          <Outlet />
        </main>
      </div>
      <CambiarPasswordModal open={pwd} onClose={() => setPwd(false)} />
    </div>
  );
}
