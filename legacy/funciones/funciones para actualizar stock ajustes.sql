CREATE OR REPLACE FUNCTION trg_cobro()
  RETURNS trigger AS
$BODY$
declare datos record;
declare verificar record;
begin
 if TG_OP='INSERT' THEN 
		 -- recorremos la tabla de detalle, por cada registro actualizar el stock

               for datos in select id_cobro, id_estado from cobro where id_cobro = new.id_cobro loop  -- recorrer el detalle
                                     -- por cada deposito actualiza
		raise EXCEPTION 'cantidad: %', datos.id_cobro;
		
              
                         -- si no tiene registro sale del recorrido
               end loop;
                           -- update productos set prod_precioc  = datos.det_preciocompra where id_prod = datos.id_prod;
		           
	return null;
  end if;
  
  return new ; 	
end ;
$BODY$
  LANGUAGE plpgsql 

;


-- creamos el disparador trigger
create trigger tg_actualizarcobros
after insert or update or delete on apert_cierre
for each row execute procedure trg_cobro();  