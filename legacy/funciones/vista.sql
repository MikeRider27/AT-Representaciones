SELECT  dt.id_factura, cli.cli_nombre,cli.cli_ruc,art.prod_descri, dt.det_cant, dt.det_precio, dt.det_exenta, 
       dt.det_iva5, dt.det_iva10
  FROM det_factura dt 
inner join factura f on f.id_factura = dt.id_factura
inner join cliente cli on cli.id_cliente = f.id_cliente
 inner join productos art on art.id_prod = dt.id_prod
where dt.id_factura = 1
  ;



  


