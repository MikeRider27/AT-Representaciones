CREATE OR REPLACE FUNCTION trg_stock()
  RETURNS trigger AS
$BODY$
declare datos record;
declare verificar record;
begin
 if TG_OP='INSERT' THEN 
		 -- recorremos la tabla de detalle, por cada registro actualizar el stock

               for datos in select id_prod,det_cant, id_deposito,id_factura from det_factura where id_factura = new.id_factura loop  -- recorrer el detalle
                                     -- por cada deposito actualiza
		--raise EXCEPTION 'cantidad: %', datos.id_ventas;
		
              
                         -- si no tiene registro sale del recorrido
               end loop;
                           -- update productos set prod_precioc  = datos.det_preciocompra where id_prod = datos.id_prod;
		           update stock set stock_cantidad = stock_cantidad - datos.det_cant where id_prod = datos.id_prod and id_deposito = datos.id_deposito;

	return null;
  end if;
  if TG_OP= 'UPDATE' then 

			-- verificamos el estado anterior de la factura 
		--if OLD.id_estado =  2 THEN
			 -- RAISE EXCEPTION 'La factura ya esta anulada';	
		 --END IF;	 	
			-- verificamos el estado de la factura cuando es anulada la misma devuelve la cantidad al stock
		  for verificar in select id_estado from factura where id_factura = new.id_factura loop

		      if verificar.id_estado = 2 then
  
		 -- recorremos la tabla de detalle, por cada registro actualizar el stock
	                for datos in select id_prod,det_cant, id_deposito,id_factura from det_factura where id_factura = new.id_factura loop  -- recorrer el detalle
                                     -- por cada deposito actualiza
			
                         -- si no tiene registro sale del recorrido
			end loop;
			update stock set stock_cantidad = stock_cantidad + datos.det_cant where id_prod = datos.id_prod and id_deposito = datos.id_deposito;

                   
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
create trigger tg_actualizarstock
after insert or update or delete on det_factura
for each row execute procedure trg_stock();  

-- cuando la factura es anulada devuelve la cantidad al stock
create trigger tg_actualizarstockanulado
after insert or update or delete on factura
for each row execute procedure trg_stock(); 


