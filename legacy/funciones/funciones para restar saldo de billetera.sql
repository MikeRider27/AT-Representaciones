CREATE OR REPLACE FUNCTION trg_restasaldobilletera()
  RETURNS trigger AS
$BODY$
declare datos record;
declare saldo record;
declare verificar record;
declare calc record;
begin
 if TG_OP='INSERT' THEN 

	      for datos in select id_operadora, mov_total::numeric , id_estado , id_tipobilletera from movimiento_billetera where id_movimientobilletera = new.id_movimientobilletera loop
		      
				
	      end loop;

	      if datos.id_tipobilletera = 2 then 
				update billetera SET billetera_saldoactual = billetera_saldoactual::numeric + datos.mov_total where id_operadora = datos.id_operadora;
	     else 
	                update billetera SET billetera_saldoactual = billetera_saldoactual::numeric - datos.mov_total where id_operadora = datos.id_operadora;

	    end if;
           
		     				
	return null;
  end if;
  if TG_OP= 'UPDATE' then 

		if OLD.id_estado =  2 THEN
			  RAISE EXCEPTION 'La fue anulada';	
		 END IF;
			for datos in select id_operadora, mov_total::numeric    from movimiento_billetera where id_movimientobilletera = new.id_movimientobilletera loop
		      
				update billetera SET billetera_saldoactual = billetera_saldoactual::numeric + datos.mov_total where id_operadora = datos.id_operadora;
			end loop;

	
          
  end if;
  if TG_OP= 'DELETE' then
	
  end if;
  return new ; 	
end ;
$BODY$
  LANGUAGE plpgsql 

;


-- creamos el disparador trigger
create trigger tg_actualizarsaldbilletera
after insert or update or delete on movimiento_billetera
for each row execute procedure trg_restasaldobilletera();  

-- cuando la factura es anulada devuelve la cantidad al stock
--create trigger tg_actualizarstockanuladocompra
--after insert or update or delete on compra
--for each row execute procedure trg_stockcompra(); 


  