import { Router } from 'express';
import { z } from 'zod';
import { Db, one, pool } from '../db/pool';
import { fechaISO, parse } from '../lib/validation';
import { requireRole } from '../middleware/auth';

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

const COLS =
  'razon_social, ruc, direccion, telefono, email, timbrado, timbrado_vigencia, establecimiento, punto_expedicion, comision_envio_pct, ultimo_numero_factura';

export async function obtenerConfiguracion(db: Db = pool): Promise<Configuracion> {
  const row = await one<Configuracion>(db, `SELECT ${COLS} FROM configuracion WHERE id = 1`);
  if (!row) throw new Error('Falta la fila de configuración');
  return row;
}

const schema = z.object({
  razon_social: z.string().trim().min(1).max(150),
  ruc: z.string().trim().max(20),
  direccion: z.string().trim().max(200),
  telefono: z.string().trim().max(60),
  email: z.string().trim().max(120),
  timbrado: z.string().trim().max(20),
  timbrado_vigencia: fechaISO.nullable().optional(),
  establecimiento: z.string().regex(/^\d{3}$/, 'Debe tener 3 dígitos'),
  punto_expedicion: z.string().regex(/^\d{3}$/, 'Debe tener 3 dígitos'),
  comision_envio_pct: z.coerce.number().min(0).max(100),
  /** Permite continuar la numeración de un talonario/timbrado anterior. */
  ultimo_numero_factura: z.coerce.number().int().min(0).max(9_999_999),
});

const router = Router();

router.get('/', async (_req, res) => {
  res.json(await obtenerConfiguracion());
});

router.put('/', requireRole('ADMIN'), async (req, res) => {
  const d = parse(schema, req.body);
  const row = await one(
    pool,
    `UPDATE configuracion SET razon_social=$1, ruc=$2, direccion=$3, telefono=$4, email=$5, timbrado=$6,
       timbrado_vigencia=$7, establecimiento=$8, punto_expedicion=$9, comision_envio_pct=$10,
       ultimo_numero_factura=$11, updated_at=now()
     WHERE id = 1 RETURNING ${COLS}`,
    [
      d.razon_social,
      d.ruc,
      d.direccion,
      d.telefono,
      d.email,
      d.timbrado,
      d.timbrado_vigencia ?? null,
      d.establecimiento,
      d.punto_expedicion,
      d.comision_envio_pct,
      d.ultimo_numero_factura,
    ],
  );
  res.json(row);
});

export default router;
