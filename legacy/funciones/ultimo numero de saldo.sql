--Select operad_saldoactual, max(operad_fecha)
--From recarga_operadoras where id_operadora = 2
--Group By operad_saldoactual,operad_fecha HAVING COUNT (id_operadora) = 2 ORDER BY operad_saldoactual asc limit 1;


--select operad_saldoactual, id_operadora, operad_fecha from recarga_operadoras
--where operad_fecha = (select Max(operad_fecha) from recarga_operadoras where id_operadora = 1  AND CP=tbl.CP)

--SELECT max(operad_saldoactual)
--FROM recarga_operadoras
--where id_operadora =1
-- ORDER BY operad_saldoactual desc;

SELECT operad_saldoactual,operad_fecha ,operad_hora FROM recarga_operadoras where id_operadora = 4




Select operad_saldoactual from recarga_operadoras where id_operadora = 4 order by operad_fecha desc , operad_hora  DESC limit 1

select operad_saldoactual  , MAX(operad_hora), MAX(operad_fecha)
from recarga_operadoras 
where id_operadora = 3 
group by  operad_saldoactual 
order by  operad_saldoactual  desc 