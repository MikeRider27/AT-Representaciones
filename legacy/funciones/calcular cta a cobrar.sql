CREATE OR REPLACE FUNCTION trg_ctaacobrar()
  RETURNS trigger AS
$BODY$

declare contador integer;
declare vf date;
declare vtocuota date;
declare ultimo date;
declare tipo record;
declare primero date;
declare cuota integer;
declare ultcuota integer;
declare importevto integer;


begin
if TG_OP='INSERT' THEN 
		
	SELECT id_factura,fac_monto,fac_cant, fac_fecha  from factura where id_condicion = 2 and id_factura = new.id_factura into tipo;

		
   
    contador:=1;

    vf:=tipo.fac_fecha;
	
     WHILE contador <= tipo.fac_cant LOOP --Cuando 
            
		if tipo.fac_cant = 1 then
			select date (vf  + '15 day '::interval) into primero;
			vf:= primero;
				INSERT INTO public.cta_acobrar(
					id_factura, nrocuota, fechavto, importevto, saldo)
				VALUES ( tipo.id_factura, contador,vf ,tipo.fac_monto/tipo.fac_cant ,tipo.fac_monto);		
		        contador := contador +1;
		else 
			select date (vf  + '15 day '::interval) into ultimo; 
				vtocuota:=ultimo;  
			       if contador = tipo.fac_cant  then
					
					ultcuota = ((tipo.fac_monto/tipo.fac_cant)+1);
					--vmonto := ultcuota;
				  	        
				       INSERT INTO public.cta_acobrar(
						id_factura, nrocuota, fechavto, importevto, saldo)
				      VALUES ( tipo.id_factura, contador,vf , ultcuota,tipo.fac_monto );	
				else

					INSERT INTO public.cta_acobrar(
						id_factura, nrocuota, fechavto, importevto, saldo)
				VALUES ( tipo.id_factura, contador,vf ,tipo.fac_monto/tipo.fac_cant ,tipo.fac_monto);		
			       end if  ; 
		   		     vf:=vtocuota;
					
				    contador := contador +1;
				
		end if;
     
   

     END LOOP;
 end if;   
return new ; 	
end;
$BODY$
  LANGUAGE plpgsql 

-- creamos el disparador trigger
create trigger tg_ctaacobrar
after insert or update or delete on factura
for each row execute procedure trg_ctaacobrar();  
