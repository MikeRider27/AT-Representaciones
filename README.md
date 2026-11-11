# AT Representaciones · Sistema de gestión comercial

Sistema web para ventas, stock, caja, cuentas a cobrar, venta de saldo (recargas) y billeteras electrónicas.
Es la reescritura del sistema de escritorio Java Swing original, que se conserva en [`legacy/`](legacy/).

**Stack:** React 18 + TypeScript (Vite, Tailwind, TanStack Query) · Express 5 + TypeScript · PostgreSQL 16 · Docker Compose.

---

## Puesta en marcha

Requisitos: Docker Desktop (o Docker Engine con Compose v2).

```bash
cp .env.example .env        # completar claves (ver abajo)
docker compose up -d --build
```

Abrir **http://localhost:8090** (o el `APP_PORT` configurado) e ingresar con `ADMIN_USERNAME` / `ADMIN_PASSWORD` del `.env`.
El usuario administrador se crea sólo en el primer arranque (si la tabla de usuarios está vacía); cambie la contraseña
desde el ícono de llave en la barra superior.

Para generar claves seguras:

```bash
openssl rand -hex 16   # DB_PASSWORD
openssl rand -hex 32   # JWT_SECRET
```

| Variable | Descripción | Por defecto |
|---|---|---|
| `APP_PORT` | Puerto publicado de la aplicación | `8090` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Credenciales de PostgreSQL | — (obligatoria la clave) |
| `JWT_SECRET` | Firma de las sesiones (≥ 32 caracteres) | — (obligatoria) |
| `JWT_EXPIRES_HOURS` | Duración de la sesión | `10` |
| `COOKIE_SECURE` | `true` si se publica detrás de HTTPS | `false` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Administrador inicial | `admin` / — |
| `BACKUP_RETENTION_DAYS` | Días que se conservan los respaldos | `14` |

## Arquitectura

```
                 ┌──────────── red "frontend" ────────────┐   ┌──────── red "backend" (internal) ────────┐
 navegador ──▶ :8090 web (nginx)  ──/api──▶  api (Express) ──────────▶  db (PostgreSQL 16)
                 SPA React estática                                     ▲
                                                                        └── backup (pg_dump diario → ./backups)
```

- **PostgreSQL es interno**: no publica puertos y vive en una red Docker `internal`, sólo la API y el servicio de respaldo lo alcanzan.
- **nginx** sirve la SPA y hace de proxy a `/api`, por lo que front y API comparten origen (cookies `SameSite=Strict`, sin CORS).
- **Migraciones** SQL versionadas en [`backend/migrations`](backend/migrations); la API las aplica al iniciar (con bloqueo consultivo).
- **Respaldos**: el servicio `backup` ejecuta `pg_dump -Fc` cada 24 h en `./backups` y elimina los mayores a `BACKUP_RETENTION_DAYS`.

```
.
├── backend/                 API REST (Express 5 + TypeScript)
│   ├── migrations/          Esquema y datos iniciales (SQL)
│   ├── src/
│   │   ├── config/env.ts    Variables de entorno validadas con zod
│   │   ├── db/              Pool, transacciones y migrador
│   │   ├── lib/             Errores, validación, cálculos fiscales, CRUD genérico
│   │   ├── middleware/      Autenticación (JWT en cookie httpOnly) y manejo de errores
│   │   └── modules/         Rutas y servicios por dominio
│   └── test/                Tests unitarios (vitest)
├── frontend/                SPA React + Vite + Tailwind, servida por nginx
├── docker-compose.yml
├── backups/                 Respaldos automáticos (ignorado por git)
└── legacy/                  Sistema original Java Swing + scripts SQL + respaldo 2018
```

## Módulos

| Módulo | Equivalente en el sistema original | Notas |
|---|---|---|
| Punto de venta | `ventas.java` | Lector de código de barras (Enter), contado/crédito, medio de pago, vuelto, atajo **F9** |
| Ventas y factura | `ventas.java` + `facturaventa.jrxml` | Numeración fiscal correlativa, factura A4 imprimible, anulación con motivo |
| Cobranzas | `cobro_cliente.java` (estaba vacío) | Implementado: deudores, cuotas vencidas, cobro parcial/total, anulación |
| Caja | `caja.java`, `cierre.java` | Apertura, ingresos/egresos manuales, arqueo por medio de pago, diferencia, historial |
| Venta de saldo | `recarga_saldo.java` | Descuenta saldo de la operadora e ingresa a caja |
| Billetera | `billetera.java` | Envío (comisión configurable, 5% por defecto), retiro, carga, pago de servicios |
| Saldos de operadoras | `carga_saldos.java`, `carga_billetera.java` | Compra de saldo / carga de billetera con historial de movimientos |
| Productos | `mercaderia.java` | Imagen, stock mínimo, margen, kardex por producto |
| Compras | `compra.java` | Ingresa stock y actualiza el costo; anulación revierte stock |
| Ajustes de stock | `ajustes.java` | Altas y bajas con motivo |
| Clientes, proveedores, marcas | `cliente.java`, `proveedor.java`, `marca.java` | Más depósitos, cajas, operadoras y tipos de carga |
| Reportes | — (nuevo) | Ventas por día, margen bruto, más vendidos, recargas y billetera; exportación CSV |
| Usuarios y empresa | `inicio.java` | Roles ADMIN/CAJERO, datos de timbrado y empresa |

### Reglas de negocio

- Toda operación que mueve dinero (ventas, cobros, recargas, billetera) exige **caja abierta** del usuario.
- No se puede vender por debajo del **precio de compra** ni más que el **stock** del depósito.
- IVA incluido en el precio (Paraguay): IVA 10% = gravada/11, IVA 5% = gravada/21.
- Crédito: el total se divide en N cuotas cada X días; el redondeo se suma a la última cuota.
- Billetera: *envío, carga y pago de servicios* debitan la billetera e ingresan efectivo; *retiro* acredita la billetera y egresa efectivo.
- Anulaciones (sólo ADMIN): revierten stock, saldos y caja. Si la sesión de caja original ya cerró, el reverso se registra en la caja abierta actual.
- Una venta con cuotas ya cobradas no puede anularse sin anular antes los cobros.

## Mejoras respecto del sistema original

| Problema en `legacy/` | Solución |
|---|---|
| Consultas armadas concatenando texto (SQL injection, incluso en el login) | Consultas parametrizadas en todo el backend |
| Contraseñas en MD5 y clave de la base en el código | bcrypt (costo 12), secretos por variables de entorno |
| Montos y fechas guardados como `varchar` (“50.000”) | `bigint` para guaraníes, `date`/`timestamptz` para fechas, `CHECK` constraints |
| IDs con `max()+1` (choques con dos usuarios simultáneos) | Columnas `IDENTITY` y numeración fiscal con bloqueo de fila |
| Triggers que sólo actualizaban el stock de la **última** línea del detalle | Lógica en servicios transaccionales, con bloqueo `FOR UPDATE` y kardex |
| Sin transacciones: una venta podía quedar grabada a medias | Cada operación es una única transacción (todo o nada) |
| Usuario siempre `1` en los registros | Auditoría real: usuario y fecha en cada operación y anulación |
| Cobro de clientes sin implementar | Módulo de cobranzas completo |
| Respaldos con `.bat` manual | Respaldo diario automático con retención |

## Operación

```bash
docker compose ps                     # estado de los servicios
docker compose logs -f api            # logs de la API (JSON estructurado)
docker compose up -d --build          # actualizar tras cambios en el código
docker compose down                   # detener (los datos persisten en el volumen pgdata)
```

**Respaldo manual:**

```bash
docker compose exec backup sh -c 'pg_dump -Fc -f /backups/manual_$(date +%Y%m%d_%H%M).dump'
```

**Restaurar un respaldo** (reemplaza los datos actuales):

```bash
docker compose stop api web
docker compose exec backup sh -c 'pg_restore --clean --if-exists --no-owner -d "$PGDATABASE" /backups/ARCHIVO.dump'
docker compose start api web
```

**Producción con HTTPS:** publicar detrás de un proxy con TLS (Caddy, Traefik, nginx) apuntando a `APP_PORT` y definir `COOKIE_SECURE=true`.

## Desarrollo local

```bash
# Base de datos para desarrollo
docker run -d --name at-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=atrepresentaciones -p 5432:5432 postgres:16.6-alpine

# API (http://localhost:3000)
cd backend && npm install
DB_PASSWORD=dev DB_USER=postgres JWT_SECRET=$(openssl rand -hex 32) ADMIN_PASSWORD=admin1234 npm run dev

# Front (http://localhost:5173, proxy de /api hacia :3000)
cd frontend && npm install && npm run dev
```

Tests y verificación de tipos:

```bash
cd backend && npm test && npm run typecheck
cd frontend && npm run typecheck
```

## API

Todas las rutas están bajo `/api` y requieren sesión, salvo `/api/health` y `/api/auth/login`.
Los errores tienen la forma `{ "error": { "code": "STOCK_INSUFICIENTE", "message": "...", "details": ... } }`.

| Recurso | Endpoints principales |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PUT /auth/password` |
| Catálogos | `/marcas`, `/depositos`, `/cajas`, `/operadoras`, `/tipos-carga`, `/clientes`, `/proveedores`, `GET /impuestos` |
| Productos | `/productos` (CRUD), `PUT/DELETE /productos/:id/imagen`, `GET /productos/:id/imagen` |
| Stock | `GET /stock`, `GET /stock/movimientos?producto_id=` |
| Caja | `GET /caja/actual`, `POST /caja/apertura`, `POST /caja/movimientos`, `GET /caja/sesiones`, `POST /caja/sesiones/:id/cierre` |
| Ventas | `GET/POST /ventas`, `GET /ventas/:id`, `POST /ventas/:id/anular` |
| Compras | `GET/POST /compras`, `GET /compras/:id`, `POST /compras/:id/anular` |
| Ajustes | `GET/POST /ajustes`, `GET /ajustes/:id` |
| Cobranzas | `GET /cobranzas/deudores`, `GET /cobranzas/clientes/:id/cuotas`, `GET/POST /cobranzas`, `POST /cobranzas/:id/anular` |
| Saldos | `GET /saldos`, `POST /saldos/cargas`, `GET /saldos/movimientos`, `GET/POST /saldos/ventas`, `GET/POST /saldos/billetera` (+ `/:id/anular`) |
| Reportes | `GET /reportes/dashboard`, `/reportes/ventas`, `/reportes/productos-mas-vendidos`, `/reportes/servicios` |
| Administración | `/usuarios` (ADMIN), `GET/PUT /configuracion` |

## Datos del sistema anterior

El respaldo `legacy/backups/atrepresentaciones.backup` (diciembre 2018) contiene sólo datos de prueba
(catálogos base, un cliente y 5 facturas sin detalle), por lo que no se migra: los catálogos equivalentes se cargan
en [`002_datos_iniciales.sql`](backend/migrations/002_datos_iniciales.sql).
