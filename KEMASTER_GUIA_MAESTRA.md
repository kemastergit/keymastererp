# 🏗️ KEMASTER POS — GUÍA MAESTRA DE ARQUITECTURA
## ERP de Clase Mundial para el Mercado Venezolano
> Documento técnico para alimentar IA de programación (Antigravity/Gemini)
> Versión 1.0 — 2026

---

## ÍNDICE DE NÚCLEOS

```
Núcleo 1 → Multimoneda y Tasa de Cambio
Núcleo 2 → Integridad de Inventario y Costeo
Núcleo 3 → Tesorería, Caja y Arqueo
Núcleo 4 → Ciclo de Cartera (Cobrar / Pagar)
Núcleo 5 → Ventas y Facturación
Núcleo 6 → Devoluciones y Notas de Crédito
Núcleo 7 → Auditoría y Cierre de Día
Núcleo 8 → Reportes y KPIs Profesionales
```

---

## NÚCLEO 1 — MULTIMONEDA Y TASA DE CAMBIO

### Contexto Venezuela
El sistema opera en entorno **bimonetario obligatorio**:
- `USD` → moneda de gestión y precio base
- `VES` → moneda legal, calculada dinámicamente

### Entidades de Datos

| Entidad | Campo | Tipo | Descripción |
|---|---|---|---|
| tasa_cambio | fecha | DATE | Fecha de la tasa |
| tasa_cambio | valor_ves_usd | DECIMAL(10,2) | Bs por cada $1 USD |
| tasa_cambio | fuente | STRING | BCV / Paralelo / Manual |
| tasa_cambio | registrado_por | FK Usuario | Quién la ingresó |
| tasa_cambio | hora_registro | TIMESTAMP | Momento exacto |

### Fórmulas de Conversión

```
CONVERSIÓN USD → VES:
  monto_ves = monto_usd × tasa_del_dia

CONVERSIÓN VES → USD:
  monto_usd = monto_ves / tasa_del_dia

REGISTRO DUAL OBLIGATORIO:
  Toda transacción guarda AMBOS valores
  + la tasa con la que se calculó
  (inmutable después de procesada)
```

### Pago Mixto — Lógica de Descomposición

```
Ejemplo: Factura total = $50.00 (tasa: 36.50 Bs/$)

Pago 1: Efectivo USD     = $20.00
        equivalente_ves  = $20 × 36.50 = Bs 730,000

Pago 2: Pago Móvil VES   = Bs 1,095,000
        equivalente_usd  = Bs 1,095,000 / 36.50 = $30.00

Verificación:
  total_pagado_usd = $20 + $30 = $50.00 ✅
  deuda_cubierta   = TRUE

Vuelto (si paga de más):
  vuelto = total_pagado - total_factura
  vuelto se entrega en la moneda en que pagó de más
```

### Métodos de Pago Venezolanos

| Método | Moneda | IGTF 3% | Observación |
|---|---|---|---|
| Efectivo USD | USD | ✅ Aplica | Billetes físicos |
| Efectivo VES | VES | ❌ No aplica | Billetes Bs |
| Pago Móvil | VES | ❌ No aplica | Requiere banco + teléfono |
| Punto de Venta | VES | ❌ No aplica | Requiere banco emisor |
| Zelle | USD | ✅ Aplica | Transferencia EEUU |
| Divisas (€/COP) | Extranjera | ✅ Aplica | Conversión al día |
| Cripto (USDT) | USD | ✅ Aplica | Conversión al día |
| Crédito/Fiado | - | Según pago | Genera Cta. por Cobrar |

### Cálculo IGTF

```
IGTF = 3% sobre el monto en divisa extranjera

Aplica SOLO en: USD físico, Zelle, €, COP, cripto
NO aplica en:   VES, Pago Móvil, Punto de Venta

Fórmula completa de factura con IGTF:
  subtotal     = Σ (precio_unit × cantidad)
  descuento    = subtotal × %descuento
  base_impon   = subtotal - descuento
  iva          = base_impon × 0.16  (si aplica)
  subtotal_con_iva = base_impon + iva
  igtf         = pago_en_divisa × 0.03
  TOTAL        = subtotal_con_iva + igtf
```

### Ganancia / Pérdida Cambiaria

```
Al momento de conciliación:

  ganancia_perdida = (saldo_usd × tasa_actual) - saldo_ves_libros

  Si resultado > 0 → Ganancia cambiaria (ingreso no operativo)
  Si resultado < 0 → Pérdida cambiaria (gasto no operativo)
```

---

## NÚCLEO 2 — INTEGRIDAD DE INVENTARIO Y COSTEO

### Almacenes del Sistema

| Almacén | Código | Disponible para Venta | Descripción |
|---|---|---|---|
| Recepción | ALM-REC | ❌ NO | Mercancía recién llegada sin verificar |
| Principal | ALM-MAIN | ✅ SÍ | Stock disponible para facturación |
| Tránsito | ALM-TRANS | ❌ NO | En movimiento entre almacenes |
| Defectuoso | ALM-DEF | ❌ NO | Devoluciones y mercancía dañada |
| Merma | ALM-MERMA | ❌ NO | Pérdida definitiva (irreversible) |

### Entidades de Datos

| Entidad | Campo | Tipo | Descripción |
|---|---|---|---|
| stock | producto_id | FK | Referencia al producto |
| stock | almacen | ENUM | ALM-REC/MAIN/TRANS/DEF/MERMA |
| stock | cantidad | DECIMAL | Unidades en ese almacén |
| movimiento_stock | tipo | ENUM | ENTRADA/SALIDA/TRANSFERENCIA |
| movimiento_stock | documento_id | FK | Nota venta / Recepción / Ajuste |
| movimiento_stock | cantidad | DECIMAL | Unidades movidas |
| movimiento_stock | costo_unitario | DECIMAL | Costo al momento del movimiento |
| movimiento_stock | usuario_id | FK | Quién ejecutó el movimiento |
| movimiento_stock | timestamp | DATETIME | Momento exacto |

### Fórmula: Costo Promedio Ponderado (AVCO)

```
Al recibir nueva mercancía:

  CP_nuevo = ( (stock_anterior × costo_anterior) +
               (cantidad_entrante × costo_compra) )
             / (stock_anterior + cantidad_entrante)

Ejemplo:
  Lote 1: 10 unid × $5.00 = $50.00  (existente)
  Lote 2: 20 unid × $6.00 = $120.00 (nuevo ingreso)

  CP = ($50 + $120) / (10 + 20)
  CP = $170 / 30
  CP = $5.67 por unidad ← nuevo costo promedio

  costo_existencia       = 30 × $5.67 = $170.10
  costo_existencia_pond  = $5.67
```

### Fórmula: FIFO (PEPS)

```
Las primeras unidades que entraron son las primeras en salir.
El sistema mantiene una cola ordenada por fecha de ingreso:

  Cola FIFO del producto AB001:
  [Lote 1: 10 unid × $5.00 — ingresó 01/01/2026]
  [Lote 2: 20 unid × $6.00 — ingresó 15/01/2026]

  Al vender 15 unidades:
    Toma 10 del Lote 1 × $5.00 = $50.00
    Toma  5 del Lote 2 × $6.00 = $30.00
    Costo total de la venta = $80.00
    Costo unitario de venta = $80 / 15 = $5.33
```

### Flujo de Movimientos de Stock

```
ENTRADA DE MERCANCÍA:
  Proveedor entrega
    → stock[ALM-REC] += cantidad
    → Crear movimiento tipo ENTRADA

  Supervisor verifica y aprueba:
    → stock[ALM-REC] -= cantidad_aprobada
    → stock[ALM-MAIN] += cantidad_aprobada
    → Recalcular AVCO o actualizar cola FIFO
    → Crear movimiento tipo TRANSFERENCIA

VENTA (al procesar nota):
  → stock[ALM-MAIN] -= cantidad_vendida
  → Si stock[ALM-MAIN] <= 0 → agotada = TRUE
  → Crear movimiento tipo SALIDA
  → Registrar costo de la venta (para P&L)

DEVOLUCIÓN DEL CLIENTE:
  → stock[ALM-DEF] += cantidad_devuelta
  → Crear movimiento tipo ENTRADA (defectuoso)
  Supervisor evalúa:
    Sirve → stock[ALM-DEF] -= cant
             stock[ALM-MAIN] += cant
             Recalcular AVCO
    No sirve → stock[ALM-DEF] -= cant
               stock[ALM-MERMA] += cant (irreversible)

AJUSTE DE INVENTARIO (supervisor/admin):
  Positivo → stock[ALM-MAIN] += diferencia
  Negativo → stock[ALM-MAIN] -= diferencia
             Si no hay explicación → va a MERMA
  Siempre requiere motivo obligatorio
```

### Punto de Reorden

```
punto_reorden = stock_seguridad + (consumo_diario × tiempo_entrega_dias)

Ejemplo:
  Consumo diario: 5 unidades
  Tiempo entrega proveedor: 3 días
  Stock de seguridad: 10 unidades

  punto_reorden = 10 + (5 × 3) = 25 unidades

  Si stock_actual <= punto_reorden → ALERTA de reabastecimiento
```

---

## NÚCLEO 3 — TESORERÍA, CAJA Y ARQUEO

### Jerarquía de Caja

```
NIVEL 1 — Caja POS (por cajero y turno)
  ↓ consolida en
NIVEL 2 — Caja Principal del Local
  ↓ consolida en
NIVEL 3 — Bóveda / Banco
  ↓ consolida en
NIVEL 4 — Dashboard Gerencial (multi-sucursal)
```

### Entidades de Datos

| Entidad | Campo | Tipo | Descripción |
|---|---|---|---|
| sesion_caja | cajero_id | FK | Usuario responsable |
| sesion_caja | apertura | TIMESTAMP | Inicio del turno |
| sesion_caja | monto_inicial_usd | DECIMAL | Fondo inicial declarado |
| sesion_caja | monto_inicial_ves | DECIMAL | Fondo inicial en Bs |
| sesion_caja | estado | ENUM | ABIERTA/CERRADA/FORZADA |
| arqueo | saldo_teorico_usd | DECIMAL | Lo que dice el sistema |
| arqueo | saldo_fisico_usd | DECIMAL | Lo que contó el cajero |
| arqueo | diferencia_usd | DECIMAL | teorico - fisico |
| arqueo | tipo_diferencia | ENUM | SOBRANTE/FALTANTE/CUADRE |
| caja_chica | responsable_id | FK | Encargado del fondo |
| caja_chica | fondo_maximo | DECIMAL | Límite autorizado |
| caja_chica | saldo_actual | DECIMAL | Disponible ahora |

### Fórmulas de Arqueo

```
SALDO TEÓRICO (lo que debe haber):
  saldo_teorico = monto_inicial
                + Σ ventas_efectivo_usd
                + Σ cobros_cuentas_por_cobrar
                - Σ devoluciones_efectivo
                - Σ pagos_a_proveedores
                - Σ egresos_caja_chica

SALDO FÍSICO (lo que el cajero cuenta):
  saldo_fisico = (billetes_100 × 100)
               + (billetes_50  × 50)
               + (billetes_20  × 20)
               + (billetes_10  × 10)
               + (billetes_5   × 5)
               + (billetes_1   × 1)

DIFERENCIA:
  diferencia = saldo_teorico - saldo_fisico

  diferencia > 0 → SOBRANTE (riesgo: no se reportó un gasto)
  diferencia < 0 → FALTANTE (riesgo: descuadre o error)
  diferencia = 0 → CUADRE PERFECTO ✅

CAJA CHICA — Regla de Reposición:
  Si (saldo_actual / fondo_maximo) <= 0.20
  → Alerta: "Caja chica al 20%, solicitar reposición"
  reposicion = fondo_maximo - saldo_actual
```

### Flujo de Caja Neto del Día

```
INGRESOS:
  + ventas_contado_usd
  + ventas_contado_ves (convertidas a USD)
  + cobros_parciales_ctas_cobrar
  + otros_ingresos

EGRESOS:
  - devoluciones_pagadas
  - pagos_proveedores
  - gastos_operativos
  - egresos_caja_chica

FLUJO NETO = Σ ingresos - Σ egresos

Si FLUJO NETO > 0 → día positivo (solvente)
Si FLUJO NETO < 0 → día negativo (alerta gerencia)
```

### Conciliación por Método de Pago

```
Cada método se concilia de forma INDEPENDIENTE:

EFECTIVO USD:
  sistema_dice   = Σ pagos_efectivo_usd del turno
  cajero_cuenta  = billetes físicos contados
  diferencia_usd = sistema_dice - cajero_cuenta

PAGO MÓVIL:
  sistema_dice   = Σ pagos_movil del turno
  banco_reporta  = extracto bancario o confirmaciones
  diferencia_ves = sistema_dice - banco_reporta

PUNTO DE VENTA:
  sistema_dice   = Σ pagos_punto del turno
  vouchers       = suma de comprobantes físicos
  diferencia_ves = sistema_dice - vouchers

Si alguna diferencia ≠ 0 → ALERTA para supervisor
```

---

## NÚCLEO 4 — CICLO DE CARTERA (COBRAR / PAGAR)

### Entidades de Datos

| Entidad | Campo | Tipo | Descripción |
|---|---|---|---|
| cta_cobrar | nota_id | FK | Venta que generó la deuda |
| cta_cobrar | cliente_id | FK | Quien debe |
| cta_cobrar | monto_original_usd | DECIMAL | Deuda inicial |
| cta_cobrar | saldo_pendiente_usd | DECIMAL | Lo que falta por cobrar |
| cta_cobrar | fecha_vencimiento | DATE | Cuándo vence |
| cta_cobrar | estado | ENUM | PENDIENTE/PARCIAL/PAGADA/VENCIDA |
| abono | cta_id | FK | A qué cuenta abona |
| abono | monto | DECIMAL | Cuánto abona |
| abono | metodo_pago | FK | Cómo pagó |
| abono | fecha | DATETIME | Cuándo abonó |
| abono | registrado_por | FK | Quién lo registró |

### Fórmulas de Cartera

```
SALDO PENDIENTE (se recalcula en cada abono):
  saldo_pendiente = monto_original - Σ abonos_recibidos

ESTADO DE LA CUENTA:
  saldo_pendiente == monto_original → PENDIENTE (no ha abonado nada)
  0 < saldo_pendiente < monto_original → PARCIAL
  saldo_pendiente == 0 → PAGADA ✅
  fecha_actual > fecha_vencimiento AND saldo > 0 → VENCIDA 🔴

ANTIGÜEDAD DE CARTERA:
  dias_vencidos = fecha_actual - fecha_vencimiento

  Tramo 1: dias_vencidos entre  1 y  30 → amarillo ⚠️
  Tramo 2: dias_vencidos entre 31 y  60 → naranja 🟠
  Tramo 3: dias_vencidos entre 61 y  90 → rojo 🔴
  Tramo 4: dias_vencidos > 90           → crítico ⛔
```

### Reglas de Crédito

```
LÍMITE DE CRÉDITO POR CLIENTE:
  Si (saldo_pendiente_actual + nueva_venta) > limite_credito
    → BLOQUEAR la venta
    → Mensaje: "Límite de crédito excedido"
    → Requiere autorización de Admin para continuar

CONTROL DE VENTAS A MOROSOS:
  Si cliente tiene cuentas VENCIDAS
    → ADVERTENCIA al cajero
    → No puede agregar nuevas ventas a crédito
    → Puede vender solo de contado
    → Supervisor puede autorizar excepción

ALERTAS AUTOMÁTICAS:
  5 días antes del vencimiento → notificación verde
  1 día antes del vencimiento → notificación amarilla
  Día del vencimiento → notificación naranja
  Después del vencimiento → notificación roja diaria
```

### Ciclo de Cuentas por Pagar (Proveedores)

```
CREACIÓN:
  Manual al registrar factura de proveedor
  O automática desde orden de compra aprobada

ABONO A PROVEEDOR:
  saldo_pagar = monto_original - Σ pagos_realizados
  Al pagar → EGRESA de caja (resta del flujo del día)

VENCIMIENTO:
  Misma lógica de tramos que cuentas por cobrar
  Alerta al Admin 5 días antes
```

---

## NÚCLEO 5 — VENTAS Y FACTURACIÓN

### Ciclo Completo de una Venta

```
PASO 1 — VALIDACIONES PREVIAS:
  ✅ ¿Hay sesión de caja abierta?
  ✅ ¿El cajero está autenticado?
  ✅ ¿La tasa BCV del día está cargada?
  Si alguna falla → BLOQUEAR, mostrar mensaje

PASO 2 — SELECCIÓN DE PRODUCTOS:
  Buscar por: código, referencia, descripción, marca
  Mostrar: stock disponible (solo ALM-MAIN), precio $, precio Bs
  Validar: ¿stock_disponible >= cantidad_solicitada?
    NO → BLOQUEAR o pedir autorización supervisor

PASO 3 — CONSTRUCCIÓN DEL CARRITO:
  El carrito es temporal (NO afecta DB todavía)
  Calcular por item:
    subtotal_item = precio_unit × cantidad
    descuento_item = subtotal_item × %desc_item
    total_item = subtotal_item - descuento_item

PASO 4 — CÁLCULO DE TOTALES:
  subtotal        = Σ total_item
  descuento_global = subtotal × %desc_global
  base_imponible  = subtotal - descuento_global
  iva             = base_imponible × 0.16 (si toggle ON)
  igtf            = pago_divisa × 0.03 (si aplica)
  TOTAL_USD       = base_imponible + iva + igtf
  TOTAL_VES       = TOTAL_USD × tasa_del_dia

PASO 5 — REGISTRO DEL PAGO:
  Registrar cada método con su monto
  Verificar: Σ pagos >= TOTAL_USD
  Calcular vuelto si Σ pagos > TOTAL_USD

PASO 6 — PROCESAR (COMMIT):
  Crear registro en notas[]
  stock[ALM-MAIN] -= cantidad por cada item
  Si tipo = CREDITO → crear cta_cobrar
  Vincular nota a sesion_caja activa
  Registrar en auditoría
  Incrementar correlativo
  Imprimir ticket (si auto-print ON)
```

### Estructura de una Nota de Venta

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | Identificador único |
| correlativo | STRING | NE-000001 (secuencial) |
| fecha | DATE | Fecha de la venta |
| hora | TIME | Hora exacta |
| cajero_id | FK | Quién procesó |
| turno_id | FK | Sesión de caja activa |
| cliente | STRING | Nombre o "CONTADO" |
| items | ARRAY | Lista de productos |
| pagos | ARRAY | Métodos de pago usados |
| subtotal_usd | DECIMAL | Antes de descuentos |
| descuento_total | DECIMAL | Suma de descuentos |
| base_imponible | DECIMAL | Base para IVA |
| iva_monto | DECIMAL | Monto del IVA |
| igtf_monto | DECIMAL | Monto del IGTF |
| total_usd | DECIMAL | Total final en USD |
| tasa_bcv | DECIMAL | Tasa usada en la venta |
| total_ves | DECIMAL | Total en Bolívares |
| estado | ENUM | PROCESADA / ANULADA |
| anulada_por | FK | NULL si no está anulada |
| motivo_anulacion | STRING | NULL si no está anulada |

---

## NÚCLEO 6 — DEVOLUCIONES Y NOTAS DE CRÉDITO

### Tipos de Devolución

```
TIPO A — Devolución Total (anulación):
  → Toda la nota se revierte
  → Todos los items van a ALM-DEF
  → La nota queda estado = ANULADA
  → Si era crédito → se cancela cta_cobrar

TIPO B — Devolución Parcial (nota de crédito):
  → Solo algunos items se devuelven
  → Esos items van a ALM-DEF
  → Se crea una NOTA DE CRÉDITO vinculada
  → La nota original queda intacta
  → Si era crédito → saldo_pendiente -= monto_nc
```

### Fórmula de Nota de Crédito

```
monto_nc = Σ (precio_unit × cantidad_devuelta)
           + IVA proporcional si aplica
           - descuentos proporcionales

nuevo_saldo = saldo_anterior - monto_nc

Si cliente pagó de contado:
  → Devolver dinero físico (egreso de caja)
  
Si cliente tiene crédito:
  → Aplicar NC como abono a su cuenta
  → O generar saldo a favor para próxima compra
```

### Impacto en Costo Promedio (AVCO) al Devolver

```
Al devolver producto a ALM-DEF:
  El AVCO NO cambia hasta que el producto
  regrese a ALM-MAIN

Al mover de ALM-DEF → ALM-MAIN:
  CP_nuevo = ( (stock_main × cp_actual) +
               (cant_devuelta × cp_original_venta) )
             / (stock_main + cant_devuelta)

Al mover de ALM-DEF → ALM-MERMA:
  costo_merma = cant_merma × cp_actual
  Este costo se registra como PÉRDIDA en P&L
```

---

## NÚCLEO 7 — AUDITORÍA Y CIERRE DE DÍA

### Log de Auditoría (inmutable)

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | Identificador único |
| timestamp | DATETIME | Momento exacto (UTC) |
| usuario_id | FK | Quién hizo la acción |
| rol | ENUM | CAJERO/SUPERVISOR/ADMIN |
| accion | STRING | Descripción de la acción |
| tabla_afectada | STRING | Qué entidad cambió |
| id_registro | UUID | Qué registro específico |
| valor_anterior | JSON | Estado antes del cambio |
| valor_nuevo | JSON | Estado después del cambio |
| ip_local | STRING | Dispositivo usado |
| autorizado_por | FK | NULL si no requirió auth |

### Acciones que SIEMPRE se auditan

```
LOGIN / LOGOUT
APERTURA DE TURNO
CIERRE DE TURNO (X y Z)
CADA VENTA PROCESADA
ANULACIÓN DE NOTA
DESCUENTO > 5%
MODIFICACIÓN DE PRECIO
CAMBIO DE TASA BCV
DEVOLUCIÓN PROCESADA
AJUSTE DE INVENTARIO
TRANSFERENCIA DE ALMACÉN
CREACIÓN / EDICIÓN DE USUARIOS
BACKUP / RESTAURACIÓN DB
AUTORIZACIÓN RÁPIDA (quien autorizó qué)
```

### Proceso de Cierre de Día (Corte Z)

```
PASO 1 — VERIFICACIÓN:
  ¿Hay turnos abiertos de otros cajeros?
    SÍ → Esperar o forzar cierre (con motivo)
    NO → Continuar

PASO 2 — RESUMEN DEL DÍA:
  Sistema calcula automáticamente:
    total_ventas          = Σ notas_del_dia (estado=PROCESADA)
    total_devoluciones    = Σ notas_anuladas + notas_credito
    total_cobros_cartera  = Σ abonos_recibidos_hoy
    total_pagos_proveed   = Σ pagos_a_proveedores_hoy
    
    desglose_por_metodo = {
      efectivo_usd:  Σ pagos donde metodo = EfectivoUSD
      efectivo_ves:  Σ pagos donde metodo = EfectivoVES
      pago_movil:    Σ pagos donde metodo = PagoMovil
      punto:         Σ pagos donde metodo = Punto
      zelle:         Σ pagos donde metodo = Zelle
      credito:       Σ ventas donde tipo = CREDITO
    }

PASO 3 — CONTEO FÍSICO (el admin cuenta el dinero):
  Ingresar:
    efectivo_usd_contado  = $ XX.XX
    efectivo_ves_contado  = Bs XX.XX

PASO 4 — CÁLCULO DE DIFERENCIAS:
  diferencia_usd = efectivo_esperado_usd - efectivo_contado_usd
  diferencia_ves = efectivo_esperado_ves - efectivo_contado_ves

  Si diferencia != 0 → ALERTA, requiere explicación

PASO 5 — CONFIRMAR CIERRE:
  estado_sesion = CERRADA
  timestamp_cierre = NOW()
  facturacion = BLOQUEADA hasta nueva apertura
  reporte_z = GENERADO y guardado en historial
  
  REGLA DE ORO:
  Un cierre Z confirmado NUNCA se modifica
  Solo se pueden hacer AJUSTES con nueva fecha
  El historial es INMUTABLE
```

---

## NÚCLEO 8 — REPORTES Y KPIs PROFESIONALES

### Tabla de Reportes del Sistema

| Reporte | Fórmula / Lógica | KPI | Frecuencia |
|---|---|---|---|
| Ventas del Día | Σ total_notas WHERE fecha = hoy | Ingresos diarios | Tiempo real |
| P&L (Utilidad) | ingresos - costo_ventas - gastos_op | Rentabilidad | Diario/Mensual |
| Margen por Producto | (precio_venta - costo_repo) / precio_venta × 100 | % Margen | Por venta |
| Rotación de Inventario | costo_ventas / ((inv_inicial + inv_final) / 2) | Eficiencia stock | Mensual |
| Antigüedad Cartera | Tramos 0-30 / 31-60 / 61-90 / 90+ días | Ciclo cobro | Diario |
| Flujo de Caja Neto | Σ ingresos_efectivo - Σ egresos_efectivo | Liquidez | Tiempo real |
| Top Productos | ORDER BY unidades_vendidas DESC LIMIT 10 | Más vendidos | Semanal |
| Balance de Caja | monto_inicial + entradas - salidas | Saldo actual | Tiempo real |
| Cierre Z | Resumen completo del día con diferencias | Auditoría | Al cierre |
| Inventario Valorado | Σ (stock × costo_promedio) por almacén | Valor en stock | Tiempo real |

### Fórmulas de KPIs

```
MARGEN BRUTO:
  margen_bruto = (ingresos_ventas - costo_mercancia_vendida)
                / ingresos_ventas × 100

COSTO DE MERCANCÍA VENDIDA (CMV):
  CMV = Σ (costo_unitario_venta × cantidad_vendida)
  Donde costo_unitario_venta = AVCO o FIFO según config

UTILIDAD NETA:
  utilidad_neta = ingresos_ventas
                - CMV
                - gastos_operativos
                - gastos_financieros
                ± diferencial_cambiario

ROTACIÓN DE INVENTARIO:
  rotacion = CMV / inventario_promedio
  dias_rotacion = 365 / rotacion
  (Menos días = más eficiente el inventario)

CICLO DE COBRO:
  dias_cobro = (ctas_cobrar_promedio / ventas_credito) × 365
  (Menos días = cobras más rápido)

TICKET PROMEDIO:
  ticket_promedio = total_ventas_periodo / cantidad_notas
```

### Estructura del Dashboard Gerencial

```
PANEL SUPERIOR (tiempo real):
  ┌──────────────┬──────────────┬──────────────┬──────────────┐
  │ VENTAS HOY   │ UTILIDAD HOY │ CTAS COBRAR  │ CAJA ACTUAL  │
  │ $ X,XXX.XX   │ $ XXX.XX     │ $ X,XXX.XX   │ $ XXX.XX     │
  │ +XX% vs ayer │ XX% margen   │ X vencidas   │ X turnos     │
  └──────────────┴──────────────┴──────────────┴──────────────┘

PANEL CENTRAL:
  Gráfico ventas 7 días vs 7 días anteriores
  Top 5 productos más vendidos hoy
  Alertas activas (stock bajo, cuentas vencidas)

PANEL INFERIOR:
  Últimas 10 transacciones en tiempo real
  Estado de turnos de caja activos
  Métodos de pago del día (% participación)
```

---

## REGLAS MAESTRAS DEL SISTEMA

```
INMUTABILIDAD:
  ✅ Los cierres Z no se modifican, solo se ajustan
  ✅ Los logs de auditoría son de solo lectura
  ✅ Las notas anuladas quedan en historial
  ✅ La tasa de una venta no cambia después de procesada

INTEGRIDAD:
  ✅ Todo movimiento de stock tiene documento origen
  ✅ Todo ingreso/egreso de caja tiene justificación
  ✅ Toda acción sensible requiere autenticación
  ✅ Σ débitos = Σ créditos en cada transacción

CONSISTENCIA:
  ✅ El stock visible = solo ALM-MAIN
  ✅ La caja visible = turno activo del cajero
  ✅ Los precios en VES = precio_usd × tasa_del_dia
  ✅ Los saldos se recalculan en cada operación

SEGURIDAD:
  ✅ Sin apertura de caja = sin facturación
  ✅ Cada rol solo ve y hace lo que le corresponde
  ✅ Las acciones sensibles requieren autorización superior
  ✅ Los datos nunca se borran, solo se desactivan
```

---

## GLOSARIO TÉCNICO

| Término | Definición |
|---|---|
| AVCO | Average Cost — Costo Promedio Ponderado |
| FIFO/PEPS | First In First Out — Primero en entrar, primero en salir |
| P&L | Profit & Loss — Estado de Resultados |
| AR | Accounts Receivable — Cuentas por Cobrar |
| AP | Accounts Payable — Cuentas por Pagar |
| VES | Bolívar venezolano (código ISO) |
| USD | Dólar estadounidense |
| IGTF | Impuesto a Grandes Transacciones Financieras (3%) |
| IVA | Impuesto al Valor Agregado (16%) |
| BCV | Banco Central de Venezuela |
| Corte X | Reporte parcial de caja sin cerrar el turno |
| Corte Z | Cierre definitivo del día, bloquea facturación |
| CMV | Costo de Mercancía Vendida |
| KPI | Key Performance Indicator — Indicador clave de rendimiento |
| Tenant | Cliente/empresa en arquitectura multi-usuario SaaS |
| RBAC | Role Based Access Control — Control de acceso por roles |

---

*KEMASTER POS — Guía Maestra de Arquitectura v1.0*
*Generado para alimentar IA de programación (Antigravity)*
*Automotores Guaicaipuro C.A. — Venezuela 2026*
