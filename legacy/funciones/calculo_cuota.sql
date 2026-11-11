 SELECT v.id_ventasaldo as codigo, v.vent_monto as monto,
                    v.vent_numero as numero, op.op_descri as operadora, v.id_usuario as usuario, 
                          ca.carg_descri as obs, v.id_estado as estado, v.vent_fecha as fecha
                     FROM venta_saldo v
                   inner join operadoras op on op.id_operadora = v.id_operadora
                   inner join carga ca on ca.id_carga = v.id_carga
                   
                    order by v.id_ventasaldo desc