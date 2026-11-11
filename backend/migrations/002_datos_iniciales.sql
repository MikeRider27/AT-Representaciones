-- Datos base equivalentes a legacy/funciones/insert.sql
INSERT INTO configuracion (id, telefono, direccion)
VALUES (1, '021 642 798', 'Moisés Bertoni c/ Cerro Corá - Luque - Paraguay');

INSERT INTO impuestos (descripcion, tasa) VALUES
  ('IVA 10%', 10),
  ('IVA 5%', 5),
  ('EXENTA', 0);

INSERT INTO depositos (descripcion) VALUES ('DEPÓSITO CENTRAL');
INSERT INTO cajas (descripcion) VALUES ('CAJA 1');
INSERT INTO marcas (descripcion) VALUES ('GENÉRICA'), ('LOGITECH'), ('TOSHIBA');

INSERT INTO operadoras (descripcion) VALUES ('TIGO'), ('PERSONAL'), ('CLARO'), ('VOX');

INSERT INTO tipos_carga (descripcion) VALUES
  ('RECARGA'),
  ('PAQUETÓN'),
  ('PAQUETIGOS - LLAMADAS'),
  ('PAQUETIGOS - MENSAJES'),
  ('INTERNET'),
  ('MAXICARGA');

INSERT INTO saldos_operadora (operadora_id, cuenta)
SELECT o.id, c.cuenta
FROM operadoras o
CROSS JOIN (VALUES ('RECARGA'), ('BILLETERA')) AS c (cuenta);

INSERT INTO clientes (nombre, ruc, direccion) VALUES ('SIN NOMBRE', '44444401-7', '');
INSERT INTO proveedores (nombre, ruc) VALUES ('PROVEEDOR VARIOS', '80000000-0');
