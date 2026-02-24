# 📋 KEMASTER POS — REGLAS FUNCIONALES DE NEGOCIO
## Qué suma, qué resta, cómo se calcula cada módulo

---

## 1. APERTURA DE CAJA

### ¿Qué pasa al abrir?
```
ANTES de abrir no se puede facturar. PUNTO.

Al abrir caja se registra:
  → Fecha y hora de apertura
  → Nombre del cajero
  → Monto inicial en USD (dinero físico en caja)
  → Monto inicial en Bs  (dinero físico en caja)
  → Estado: ABIERTA

Esto crea una SESIÓN DE CAJA activa.
Todas las ventas del día se vinculan a esta sesión.
```

### Regla crítica:
```
Sin apertura = sistema bloqueado para facturar
El botón "Cerrar Venta" debe estar deshabilitado
con mensaje: "Debe abrir la caja para facturar"
```

---

## 2. VENTAS — QUÉ SUMA Y QUÉ RESTA

### Al agregar un producto al carrito:
```
NO cambia nada en la base de datos todavía
Solo es una lista temporal en pantalla
El stock NO se descuenta hasta procesar la venta
```

### Al PROCESAR la venta:
```
INVENTARIO:
  stock.principal del producto  →  RESTA la cantidad vendida
  Si stock llega a 0            →  agotada = SI automáticamente

CAJA (sesión activa):
  ventas_del_dia                →  SUMA el total de esta venta
  total_por_metodo[metodo]      →  SUMA según cómo pagó

CUENTAS POR COBRAR:
  Si tipo_pago = CRÉDITO        →  CREA una cuenta por cobrar
  Si tipo_pago = CONTADO        →  No crea nada

AUDITORÍA:
  Siempre registra:
    quién vendió, a qué hora, qué vendió, cuánto
```

### Cálculo del ticket:
```
SUBTOTAL     = suma de (precio_unitario × cantidad) por cada item
DESCUENTO    = subtotal × % descuento (si aplica)
BASE IMPONIBLE = subtotal - descuento
IVA          = base_imponible × 16% (si toggle IVA está ON)
IGTF         = total × 3% (SOLO si el pago es en USD físico,
                            Zelle, divisas extranjeras)
               NO aplica si paga en Bs o PagoMóvil
TOTAL USD    = base_imponible + IVA + IGTF
TOTAL Bs     = total_usd × tasa_bcv_del_dia

VUELTO:
  Si pagó más de lo que debe:
  vuelto = total_pagado - total_venta
  Mostrar en la moneda que pagó de más
```

### Pago mixto (ejemplo real):
```
Venta total: $50.00

Cliente paga:
  Efectivo $:   $20.00
  Pago Móvil:   Bs 108,000 (equivale a $30 a tasa 3,600)

Sistema verifica:
  $20 + $30 = $50 ✅ Venta cubierta

Si paga de más:
  Efectivo $:   $60.00
  Vuelto:       $10.00 en efectivo
```

---

## 3. DEVOLUCIONES — QUÉ SUMA Y QUÉ RESTA

### Devolución total (todo el pedido):
```
INVENTARIO:
  Los productos devueltos  →  SUMAN al almacén DEFECTUOSO
  NO regresan directo al principal
  Un supervisor debe evaluar y mover manualmente
  
VENTA ORIGINAL:
  Estado  →  cambia a ANULADA
  Requiere motivo obligatorio
  Registra quién anuló y cuándo

CAJA:
  Si la venta fue HOY en el turno activo:
    total_ventas_dia  →  RESTA el monto devuelto
  Si fue en otro día:
    Se genera un EGRESO por devolución
    No afecta cierres pasados (ya están cerrados)

CUENTAS POR COBRAR:
  Si la venta era a crédito:
    La cuenta por cobrar  →  se ELIMINA o reduce
```

### Devolución parcial (solo algunos items):
```
INVENTARIO:
  Solo los items devueltos  →  SUMAN a DEFECTUOSO

VENTA ORIGINAL:
  Se genera una NOTA DE CRÉDITO
  La venta original queda intacta
  La nota de crédito resta del total

CAJA:
  El monto de la nota de crédito  →  RESTA del día
  Si se devuelve dinero al cliente →  SALE de caja

CUENTAS POR COBRAR:
  Si era crédito:
    saldo_pendiente  →  REDUCE por el monto devuelto
```

### Evaluación del producto devuelto (en almacén defectuoso):
```
Supervisor evalúa:
  ¿El producto está en buen estado?
    SÍ → Mover a ALMACÉN PRINCIPAL
         stock.defectuoso  →  RESTA
         stock.principal   →  SUMA
    NO → Queda como MERMA
         Se registra la pérdida en reportes
         stock.defectuoso  →  RESTA (ajuste de inventario)
```

---

## 4. INGRESO DE MERCANCÍA — QUÉ SUMA Y QUÉ RESTA

### Al recibir mercancía del proveedor:
```
PASO 1 — Entra a RECEPCIÓN:
  stock.recepcion  →  SUMA la cantidad recibida
  Se registra: proveedor, fecha, costo, cantidad

PASO 2 — Verificación (contar y revisar):
  ¿Todo está correcto?
    SÍ → Mover a ALMACÉN PRINCIPAL
         stock.recepcion  →  RESTA
         stock.principal  →  SUMA
         agotada = NO (si estaba agotado)
    NO → Parte va a DEFECTUOSO, parte a PRINCIPAL

PASO 3 — Actualización de costos:
  costo_existencia       = stock.principal × costo_unitario
  costo_existencia_pond  = promedio ponderado de todos
                           los ingresos del producto
```

### Cálculo del Costo de Existencia Ponderado:
```
Ejemplo:
  Ingreso 1: 10 unidades a $5.00 c/u  = $50.00
  Ingreso 2: 20 unidades a $6.00 c/u  = $120.00
  
  Total unidades: 30
  Total invertido: $170.00
  
  Costo ponderado = $170 / 30 = $5.67 c/u
  
  costo_existencia_pond = $5.67
  costo_existencia      = 30 × $5.67 = $170.10
```

---

## 5. TRANSFERENCIAS ENTRE ALMACENES

### Reglas de movimiento:
```
RECEPCIÓN → PRINCIPAL:    ✅ Libre (supervisor)
RECEPCIÓN → DEFECTUOSO:   ✅ Libre (supervisor)
PRINCIPAL → TRÁNSITO:     ✅ Requiere motivo
PRINCIPAL → DEFECTUOSO:   ✅ Requiere motivo (merma)
TRÁNSITO  → PRINCIPAL:    ✅ Al confirmar recepción
DEFECTUOSO → PRINCIPAL:   ✅ Requiere supervisor + motivo
DEFECTUOSO → MERMA:       ✅ Solo Admin, es irreversible

Cada transferencia registra:
  → Quién la hizo
  → Fecha y hora
  → Cantidad
  → Motivo
  → Almacén origen y destino
```

### Qué se vende:
```
SOLO se puede vender lo que está en ALMACÉN PRINCIPAL
El stock de RECEPCIÓN, TRÁNSITO y DEFECTUOSO
NO aparece como disponible en facturación
```

---

## 6. CORTE X (PARCIAL) — QUÉ MUESTRA

### Se puede hacer varias veces al día sin cerrar:
```
El Corte X muestra ACUMULADO desde la apertura hasta ahora:

VENTAS DEL TURNO:
  Cantidad de notas procesadas: XX
  Cantidad de items vendidos:   XX

INGRESOS POR MÉTODO DE PAGO:
  Efectivo USD:    $ XX.XX
  Efectivo Bs:     Bs XX.XX
  Pago Móvil:      Bs XX.XX
  Punto de Venta:  Bs XX.XX
  Zelle:           $ XX.XX
  Crédito (fiado): $ XX.XX  ← pendiente de cobrar

TOTAL VENDIDO:
  En USD:  $ XX.XX
  En Bs:   Bs XX.XX

EFECTIVO EN CAJA ESPERADO:
  Monto inicial apertura:    $ XX.XX
  + Ventas efectivo USD:     $ XX.XX
  - Devoluciones efectivo:   $ XX.XX
  ────────────────────────────────────
  TOTAL ESPERADO EN CAJA:    $ XX.XX

NOTA: El Corte X NO cierra la sesión.
      Las ventas continúan normalmente.
      Es solo un reporte informativo.
```

---

## 7. CORTE Z (CIERRE DEFINITIVO) — QUÉ SUMA Y QUÉ RESTA

### Solo se hace UNA VEZ al día. Solo Admin o Supervisor:
```
PASO 1 — Verificar que no haya turnos abiertos
  Si hay cajeros con turnos abiertos:
    Opción A: Esperarlos a que cierren
    Opción B: Forzar cierre con motivo (Admin)

PASO 2 — Ingresar conteo físico del dinero:
  ¿Cuánto hay físicamente en caja?
    Efectivo USD contado:  $ XX.XX
    Efectivo Bs contado:   Bs XX.XX

PASO 3 — El sistema calcula la diferencia:
  Diferencia USD = efectivo_contado - efectivo_esperado
  
  Si diferencia > 0  →  SOBRANTE (alguien cobró de más)
  Si diferencia < 0  →  FALTANTE (alguien cobró de menos)
  Si diferencia = 0  →  CUADRE PERFECTO ✅

PASO 4 — Confirmar cierre:
  La sesión cambia a: CERRADA
  La facturación se BLOQUEA hasta nueva apertura
  Se guarda en historial permanente
  NO se puede modificar (solo ajustes con motivo)

PASO 5 — Reporte generado automáticamente:
  Resumen completo del día
  Desglose por cajero (si hubo varios turnos)
  Desglose por método de pago
  Diferencias encontradas
  Listo para imprimir
```

### Si hubo varios cajeros en el día:
```
Cierre Z agrupa TODOS los turnos:

  Turno Juan (08:00 - 14:00):
    Ventas:       $ 450.00
    Efectivo $:   $ 200.00
    PagoMóvil:    Bs 900,000

  Turno María (14:00 - 20:00):
    Ventas:       $ 380.00
    Efectivo $:   $ 150.00
    Punto:        Bs 828,000

  TOTAL DÍA:
    Total vendido:    $ 830.00
    Efectivo $ total: $ 350.00
    PagoMóvil total:  Bs 900,000
    Punto total:      Bs 828,000
```

---

## 8. CUENTAS POR COBRAR — QUÉ SUMA Y QUÉ RESTA

### Se crea automáticamente cuando:
```
Una venta se procesa con tipo_pago = CRÉDITO

Se registra:
  → Cliente
  → Monto total en USD y Bs
  → Fecha de vencimiento (acordada con cliente)
  → Estado: PENDIENTE
  → Referencia a la nota de venta original
```

### Al recibir un abono:
```
El cliente paga parte de la deuda:

  abonos[] SUMA el nuevo pago:
    {fecha, monto, metodo_pago, registrado_por}

  saldo_pendiente RESTA el abono:
    saldo_pendiente = monto_total - suma_de_abonos

  Estado cambia según saldo:
    saldo > 0    →  PARCIAL
    saldo = 0    →  PAGADA

CAJA:
  El abono recibido SUMA al método de pago usado
  Se incluye en el Corte X y Z del día
```

### Vencimiento:
```
Si fecha_actual > fecha_vencimiento
  Y estado ≠ PAGADA
  → Marcar como VENCIDA (color rojo)
  → Generar alerta al supervisor/admin
```

---

## 9. CUENTAS POR PAGAR — QUÉ SUMA Y QUÉ RESTA

### Se crea manualmente o desde una orden de compra:
```
Al registrar una cuenta por pagar:
  → Proveedor
  → Monto en USD
  → Fecha de vencimiento
  → Estado: PENDIENTE
```

### Al hacer un pago al proveedor:
```
abonos[] SUMA el nuevo pago

saldo_pendiente RESTA el abono

Estado cambia:
  saldo > 0  →  PARCIAL
  saldo = 0  →  PAGADA

CAJA:
  El pago al proveedor SALE de caja
  RESTA del efectivo disponible
  Se registra en egresos del día
```

---

## 10. DESCUENTOS — REGLAS

```
DESCUENTO POR ITEM:
  Cualquier cajero puede aplicar hasta 5%
  Entre 5% y 10%  →  requiere autorización Supervisor
  Más de 10%      →  requiere autorización Admin

DESCUENTO GLOBAL (sobre el total):
  Mismas reglas que por item
  Se aplica sobre el subtotal ANTES del IVA

CÁLCULO:
  precio_item × cantidad = subtotal_item
  subtotal_item × (1 - descuento%) = total_item

REGISTRO:
  Todo descuento queda registrado con:
  → % aplicado
  → Quién lo autorizó
  → En la nota de venta
```

---

## 11. ANULACIÓN DE NOTA — REGLAS

```
QUIÉN PUEDE ANULAR:
  Cajero          →  NO puede anular
  Supervisor      →  Puede anular con motivo
  Admin           →  Puede anular con motivo

QUÉ PASA AL ANULAR:

  INVENTARIO:
    Los productos vuelven al almacén PRINCIPAL
    stock.principal SUMA las cantidades de la nota

  CAJA:
    Si la nota es del turno ACTIVO de hoy:
      total_ventas_dia RESTA el monto de la nota
    Si la nota es de un día CERRADO:
      Se genera un ajuste en el día actual
      NO se modifica el cierre pasado

  CUENTAS POR COBRAR:
    Si la nota tenía cuenta por cobrar asociada:
      La cuenta se CANCELA
      Si ya tenía abonos: se genera devolución

  REGISTRO:
    La nota NO se borra
    Cambia estado a: ANULADA
    Se guarda: quién anuló, cuándo, por qué
    Queda en el historial para auditoría
```

---

## 12. AJUSTE DE INVENTARIO — REGLAS

```
PARA QUÉ SIRVE:
  Cuando el conteo físico no coincide con el sistema
  Ejemplos: rotura, robo, error de conteo previo

QUIÉN PUEDE HACER AJUSTES:
  Supervisor y Admin únicamente

TIPOS DE AJUSTE:
  POSITIVO: Se encontró más mercancía de la registrada
    stock.principal SUMA la diferencia
    
  NEGATIVO: Hay menos mercancía que la registrada
    stock.principal RESTA la diferencia
    Se registra como MERMA si no hay explicación

REGISTRO OBLIGATORIO:
  → Motivo del ajuste
  → Cantidad ajustada
  → Quién lo hizo
  → Fecha y hora
  → Se guarda en auditoría PERMANENTEMENTE
  → NO se puede borrar ni editar un ajuste
    (solo se puede hacer otro ajuste que corrija)
```

---

## 13. FLUJO COMPLETO DE UN DÍA DE TRABAJO

```
07:50am  ADMIN o SUPERVISOR abre el sistema
         Verifica que no haya turnos sin cerrar del día anterior

08:00am  CAJERO Juan hace login con PIN
         Abre su turno de caja
         Declara: $50 USD y Bs 180,000 en caja

08:05am  Primera venta del día
         Sistema descuenta stock
         Suma a totales del turno de Juan

12:00pm  Corte X del turno de Juan
         Reporte imprimible sin cerrar
         Juan sigue trabajando

02:00pm  Juan cierra su turno
         Declara lo que tiene en caja
         Sistema calcula diferencia
         Turno de Juan: CERRADO

02:05pm  CAJERO María hace login
         Abre su turno de caja
         Declara dinero inicial

08:00pm  María cierra su turno

08:15pm  ADMIN hace el Cierre Z del día
         Sistema agrupa turnos de Juan y María
         Admin cuenta el dinero total en caja
         Sistema muestra diferencias
         CIERRE Z generado y guardado
         Sistema bloqueado hasta mañana

08:30am  Siguiente día → nuevo ciclo comienza
```

---

## 14. REGLAS DE ORO DEL SISTEMA

```
1. NUNCA se borra un registro, solo se marca inactivo o anulado

2. NUNCA se modifica un cierre Z ya ejecutado
   Solo se hacen ajustes con fecha y motivo nuevos

3. TODO movimiento de dinero queda registrado
   con quién, cuándo y por qué

4. El stock SOLO se descuenta al PROCESAR la venta
   No al agregar al carrito

5. El stock devuelto va a DEFECTUOSO primero
   No regresa automáticamente a PRINCIPAL

6. Sin apertura de caja = sin facturación
   No hay excepción a esta regla

7. Los descuentos grandes siempre necesitan autorización
   El sistema no permite saltarse este paso

8. La tasa BCV se fija al momento de la venta
   Si cambia después, las ventas anteriores mantienen
   la tasa con la que se procesaron

9. Una cuenta por cobrar solo se cierra cuando
   saldo_pendiente = 0 exacto

10. El Corte Z incluye TODOS los turnos del día
    aunque los cajeros ya se hayan ido
```

---

*KEMASTER POS — Reglas Funcionales v1.0*
*Automotores Guaicaipuro C.A. — Venezuela 2026*
