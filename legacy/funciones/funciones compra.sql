CREATE OR REPLACE FUNCTION public.trg_stockcompra()
  RETURNS trigger AS
$BODY$
declare datos record;
declare verificar record;
begin
 if TG_OP='INSERT' THEN 
		 -- recorremos la tabla de detalle, por cada registro actualizar el stock

               for datos in select id_prod,det_cant,det_preciocompra,det_exenta,det_iva5,det_iva10,id_compra,id_deposito from det_compra where id_compra = new.id_compra loop  -- recorrer el detalle
                                     -- por cada deposito actualiza
		--raise EXCEPTION 'cantidad: %', datos.id_ventas;
		
              
                         -- si no tiene registro sale del recorrido
               end loop;
                           update productos set prod_precioc  = datos.det_preciocompra where id_prod = datos.id_prod;
		           update stock set stock_cantidad = stock_cantidad + datos.det_cant where id_prod = datos.id_prod and id_deposito = datos.id_deposito;
		
		if datos.det_exenta <> '0' then
			update productos set id_impuesto = 3 where id_prod = datos.id_prod; 
		end if;
		if datos.det_iva5 <> '0' then
			update productos set id_impuesto = 2 where id_prod = datos.id_prod; 
		end if ;
		if datos.det_iva10 <> '0' then
			update productos set id_impuesto = 1 where id_prod = datos.id_prod; 
		end if ;

	return null;
  end if;
  if TG_OP= 'UPDATE' then 

			-- verificamos el estado anterior de la factura 
		if OLD.id_estado = '2' THEN
		--	RAISE EXCEPTION 'La factura ya esta anulada';	
		 END IF;	 	
			-- verificamos el estado de la factura cuando es anulada la misma devuelve la cantidad al stock
		 for verificar in select id_estado from compra where id_compra = new.id_compra loop

		   if verificar.id_estado = '2' then
  
		 -- recorremos la tabla de detalle, por cada registro actualizar el stock
	                for datos in select id_prod,det_cant,det_preciocompra,det_exenta,det_iva5,det_iva10,id_compra,id_deposito from det_compra where id_compra = new.id_compra loop  -- recorrer el detalle
                                     -- por cada deposito actualiza
			update stock set stock_cantidad = stock_cantidad - datos.det_cant where id_prod = datos.id_prod and id_deposito = datos.id_deposito;
                         -- si no tiene registro sale del recorrido
			end loop;

                   
	 else 
			
	 end if;
                end loop;

	 return null;
          
  end if;
  if TG_OP= 'DELETE' then
	  -- raise exception 'No puede eliminar una factura solo Anular';
  end if;
  return new ; 	
end ;
$BODY$
  LANGUAGE plpgsql 

;


-- creamos el disparador trigger
create trigger tg_actualizarstockcompra
after insert or update or delete on det_compra
for each row execute procedure trg_stockcompra();  

-- cuando la factura es anulada devuelve la cantidad al stock
create trigger tg_actualizarstockanuladocompra
after insert or update or delete on compra
for each row execute procedure trg_stockcompra(); 


  