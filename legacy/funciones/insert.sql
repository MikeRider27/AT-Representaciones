INSERT INTO public.estado(
            id_estado, descri_est)
    VALUES (1, 'ACTIVO');
INSERT INTO public.estado(
            id_estado, descri_est)
    VALUES (2, 'ANULADO');

INSERT INTO public.marca(
            id_marca, mar_descri)
    VALUES (1, 'LOGITECH');

INSERT INTO public.marca(
            id_marca, mar_descri)
    VALUES (2, 'TOSHIBA');

INSERT INTO public.impuesto(
            id_impuesto, imp_descri)
    VALUES (1, 'IVA 10%');
INSERT INTO public.impuesto(
            id_impuesto, imp_descri)
    VALUES (2, 'IVA 5%');
INSERT INTO public.impuesto(
            id_impuesto, imp_descri)
    VALUES (3, 'EXENTA');

INSERT INTO public.condiciones(
            id_condicion, cond_descri)
    VALUES (1, 'CONTADO');

INSERT INTO public.condiciones(
            id_condicion, cond_descri)
    VALUES (2, 'CREDITO');

INSERT INTO public.deposito(
            id_deposito, dep_descri)
    VALUES (1, 'DEPOSITO 1');

INSERT INTO public.usuario(
            id_usuario, nom_usu, usu_clave, id_estado)
    VALUES (1, 'ADM', MD5('12345'), 1);

INSERT INTO public.cliente(
            id_cliente, cli_nombre, cli_ruc, cli_telef, cli_direc, id_estado)
    VALUES (1, 'JAVIER', '5422361-0', '0994988479', 'ASUNCION', 1);

INSERT INTO public.proveedor(
            id_proveedor, prov_nombre, prov_ruc, prov_telef, prov_direc, 
            prov_correo, id_estado)
    VALUES (1, 'SIN NOMBRE', '123456-1', '021365478', 'LUQUE', 
            'SINMBRE@GMAIL.COM', 1);

INSERT INTO public.caja(
            id_caja, caja_descri)
    VALUES (1, 'Caja 1');

INSERT INTO public.carga(
            id_carga, carg_descri)
    VALUES (1, 'Recarga');

INSERT INTO public.carga(
            id_carga, carg_descri)
    VALUES (2, 'Paqueton');
INSERT INTO public.carga(
            id_carga, carg_descri)
    VALUES (3, 'Paquetigos - Llamadas');
INSERT INTO public.carga(
            id_carga, carg_descri)
    VALUES (4, 'Paquetigos - Mensajes');
INSERT INTO public.carga(
            id_carga, carg_descri)
    VALUES (5, 'Internet');
INSERT INTO public.carga(
            id_carga, carg_descri)
    VALUES (6, 'Maxicarga');

INSERT INTO public.operadoras(
            id_operadora, op_descri)
    VALUES (1, 'TIGO');

INSERT INTO public.operadoras(
            id_operadora, op_descri)
    VALUES (2, 'PERSONAL');

INSERT INTO public.operadoras(
            id_operadora, op_descri)
    VALUES (3, 'CLARO');

INSERT INTO public.operadoras(
            id_operadora, op_descri)
    VALUES (4, 'VOX');

INSERT INTO public.tipo_billetera(
            id_tipobilletera, tipo_descri)
    VALUES (1, 'ENVIO');
INSERT INTO public.tipo_billetera(
            id_tipobilletera, tipo_descri)
    VALUES (2, 'RETIRO');
INSERT INTO public.tipo_billetera(
            id_tipobilletera, tipo_descri)
    VALUES (3, 'CARGA');
INSERT INTO public.tipo_billetera(
            id_tipobilletera, tipo_descri)
    VALUES (4, 'PAGO SERVICIOS');



