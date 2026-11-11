import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { AjustesPage, NuevoAjustePage } from './pages/Ajustes';
import { BilleteraPage } from './pages/Billetera';
import { CajaPage, SesionCajaPage } from './pages/Caja';
import { CatalogosPage } from './pages/Catalogos';
import { CobranzasPage } from './pages/Cobranzas';
import { CompraDetallePage, ComprasPage, NuevaCompraPage } from './pages/Compras';
import { ConfiguracionPage } from './pages/Configuracion';
import { DashboardPage } from './pages/Dashboard';
import { LoginPage } from './pages/Login';
import { PersonasPage } from './pages/Personas';
import { ProductosPage } from './pages/Productos';
import { RecargasPage } from './pages/Recargas';
import { ReportesPage } from './pages/Reportes';
import { SaldosPage } from './pages/Saldos';
import { StockPage } from './pages/Stock';
import { UsuariosPage } from './pages/Usuarios';
import { FacturaPrintPage, NuevaVentaPage, VentaDetallePage, VentasPage } from './pages/Ventas';

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/ventas/:id/imprimir" element={<FacturaPrintPage />} />
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="ventas" element={<VentasPage />} />
        <Route path="ventas/nueva" element={<NuevaVentaPage />} />
        <Route path="ventas/:id" element={<VentaDetallePage />} />
        <Route path="cobranzas" element={<CobranzasPage />} />
        <Route path="caja" element={<CajaPage />} />
        <Route path="caja/sesiones/:id" element={<SesionCajaPage />} />
        <Route path="recargas" element={<RecargasPage />} />
        <Route path="billetera" element={<BilleteraPage />} />
        <Route path="saldos" element={<SaldosPage />} />
        <Route path="productos" element={<ProductosPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="compras" element={<ComprasPage />} />
        <Route path="compras/nueva" element={<RequireAdmin><NuevaCompraPage /></RequireAdmin>} />
        <Route path="compras/:id" element={<CompraDetallePage />} />
        <Route path="ajustes" element={<AjustesPage />} />
        <Route path="ajustes/nuevo" element={<RequireAdmin><NuevoAjustePage /></RequireAdmin>} />
        <Route path="clientes" element={<PersonasPage tipo="clientes" />} />
        <Route path="proveedores" element={<PersonasPage tipo="proveedores" />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="catalogos" element={<RequireAdmin><CatalogosPage /></RequireAdmin>} />
        <Route path="usuarios" element={<RequireAdmin><UsuariosPage /></RequireAdmin>} />
        <Route path="configuracion" element={<RequireAdmin><ConfiguracionPage /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
