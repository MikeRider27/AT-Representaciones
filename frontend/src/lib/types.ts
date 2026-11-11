export type Rol = 'ADMIN' | 'CAJERO';
export type MedioPago = 'EFECTIVO' | 'TARJETA' | 'CHEQUE' | 'TRANSFERENCIA';
export const MEDIOS_PAGO: MedioPago[] = ['EFECTIVO', 'TARJETA', 'CHEQUE', 'TRANSFERENCIA'];

export interface Usuario {
  id: number;
  username: string;
  nombre: string;
  rol: Rol;
  activo?: boolean;
}

export interface Catalogo {
  id: number;
  descripcion: string;
  activo: boolean;
}

export interface Persona {
  id: number;
  nombre: string;
  ruc: string;
  telefono: string | null;
  direccion: string | null;
  email: string | null;
  activo: boolean;
}

export interface Impuesto {
  id: number;
  descripcion: string;
  tasa: number;
}

export interface Producto {
  id: number;
  codigo: string;
  descripcion: string;
  marca_id: number;
  marca: string;
  impuesto_id: number;
  tasa_iva: number;
  precio_compra: number;
  precio_venta: number;
  stock_minimo: number;
  stock_total: number;
  stock_deposito?: number;
  tiene_imagen: boolean;
  activo: boolean;
  updated_at: string;
}

export interface Configuracion {
  razon_social: string;
  ruc: string;
  direccion: string;
  telefono: string;
  email: string;
  timbrado: string;
  timbrado_vigencia: string | null;
  establecimiento: string;
  punto_expedicion: string;
  comision_envio_pct: number;
  ultimo_numero_factura: number;
}

export interface ResumenCaja {
  monto_apertura: number;
  medios: { medio_pago: MedioPago; ingresos: number; egresos: number; esperado: number }[];
  total_ingresos: number;
  total_egresos: number;
  total_esperado: number;
}

export interface SesionCaja {
  id: number;
  caja_id: number;
  caja: string;
  usuario_id: number;
  usuario: string;
  estado: 'ABIERTA' | 'CERRADA';
  abierta_at: string;
  monto_apertura: number;
  resumen?: ResumenCaja;
}

export interface LineaDetalle {
  id: number;
  producto_id: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  tasa_iva: number;
  subtotal: number;
}

export interface Venta {
  id: number;
  nro_factura: string;
  fecha: string;
  created_at: string;
  cliente_id: number;
  cliente: string;
  cliente_ruc: string;
  cliente_direccion: string | null;
  cliente_telefono: string | null;
  deposito: string;
  condicion: 'CONTADO' | 'CREDITO';
  medio_pago: MedioPago | null;
  cuotas: number;
  intervalo_dias: number;
  total_exenta: number;
  total_gravada5: number;
  total_gravada10: number;
  total_iva5: number;
  total_iva10: number;
  total: number;
  estado: 'EMITIDA' | 'ANULADA';
  usuario: string;
  anulada_at: string | null;
  anulada_por_nombre: string | null;
  motivo_anulacion: string | null;
  items: (LineaDetalle & { precio_unitario: number })[];
  plan_cuotas: { id: number; nro_cuota: number; vencimiento: string; monto: number; saldo: number; estado: string }[];
}
