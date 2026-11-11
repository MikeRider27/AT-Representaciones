CREATE OR REPLACE FUNCTION trg_restasaldo()
  RETURNS trigger AS
$BODY$
declare datos record;
declare saldo record;
declare verificar record;
declare calc record;
begin
 if TG_OP='INSERT' THEN 
		 -- recorremos la tabla de detalle, por cada registro actualizar el stock
		--	for datos in
		
                select id_operadora, vent_monto::numeric from venta_saldo where id_ventasaldo = new.id_ventasaldo into datos ;
		for calc in select operad_saldoactual from recarga_operadoras where id_operadora = datos.id_operadora loop
				if (calc.operad_saldoactual::numeric <= 0) then
					update recarga_operadoras set operad_saldoactual  = 0.000 where id_operadora = datos.id_operadora;
				
				end if ; 
		end loop;
		select operad_saldoactual::numeric from recarga_operadoras where id_operadora = datos.id_operadora order by operad_fecha desc , operad_hora desc limit 1 into saldo ;
  -- recorrer el detalle
                                     -- por cada deposito actualiza
		--raise EXCEPTION 'cantidad: %', saldo.operad_saldoactual;
		             
                         -- si no tiene registro sale del recorrido
			       
		--end loop;

		--for saldo in select operad_saldoactual::numeric from recarga_operadoras where id_operadora = datos.id_operadora loop


		--end loop;
			
					update recarga_operadoras set operad_saldoactual  = operad_saldoactual::numeric - datos.vent_monto where id_operadora = datos.id_operadora;
			
			  

           
		     				
	return null;
  end if;
  if TG_OP= 'UPDATE' then 

	
          
  end if;
  if TG_OP= 'DELETE' then
	
  end if;
  return new ; 	
end ;
$BODY$
  LANGUAGE plpgsql 

;


-- creamos el disparador trigger
create trigger tg_actualizarsaldoventa
after insert or update or delete on venta_saldo
for each row execute procedure trg_restasaldo();  

-- cuando la factura es anulada devuelve la cantidad al stock
--create trigger tg_actualizarstockanuladocompra
--after insert or update or delete on compra
--for each row execute procedure trg_stockcompra(); 


  