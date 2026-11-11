
SELECT MAX(operad_fecha) as fecha , MAX(operad_saldoactual)AS SALDO  from recarga_operadoras 
WHERE id_operadora = 1  GROUP BY operad_fecha;