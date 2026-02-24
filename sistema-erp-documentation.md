# Sistema ERP - Documentación Técnica para IA Generadora

---
sistema: "ERP Modular Bimonetario"
version: "2.0.0"
tecnologias: ["React", "React Router", "TypeScript", "Node.js", "PostgreSQL/MongoDB"]
modulos_principales: ["Facturación", "Inventario", "Caja", "Cuentas por Cobrar", "Cuentas por Pagar", "Compras", "Reportes"]
especializacion: "PYMES Venezuela - Multimoneda (USD/VES)"
autor: "Knowledge Base para IA"
---

## 1. VISIÓN GENERAL DEL SISTEMA

### 1.1 Propósito
Sistema ERP web diseñado para pequeñas y medianas empresas en Venezuela que operan en entorno bimonetario. Gestiona el ciclo completo de operaciones: desde la compra de mercancía hasta el cierre de caja diario, incluyendo control de inventario, facturación, gestión de cartera y reportes financieros.

### 1.2 Arquitectura General
```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│  Dashboard  │  Facturación│  Inventario │  Caja/Cierre        │
├─────────────┼─────────────┼─────────────┼─────────────────────┤
│  Clientes   │  Proveedores│  Ctas.Cobrar│  Ctas.Pagar         │
├─────────────┴─────────────┴─────────────┴─────────────────────┤
│                      API REST (Node.js)                      │
├─────────────────────────────────────────────────────────────┤
│  Base de Datos (PostgreSQL)  │  Cache (Redis)  │  Files      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. MAPA DE MÓDULOS Y NAVEGACIÓN

### 2.1 Estructura de Rutas (React Router)

| Ruta | Componente | Tipo | Descripción |
|------|------------|------|-------------|
| `/login` | Login.tsx | Pública | Autenticación de usuarios |
| `/` | Layout.tsx | Protegida | Shell principal con sidebar |
| `/dashboard` | Dashboard.tsx | Protegida | KPIs y métricas en tiempo real |
| `/facturacion` | Facturacion.tsx | Protegida | Emisión de facturas de venta |
| `/cotizaciones` | Cotizaciones.tsx | Protegida | Presupuestos (no contables) |
| `/inventario` | Inventario.tsx | Protegida | Control de stock y productos |
| `/compras` | Compras.tsx | Protegida | Recepción de mercancía |
| `/clientes` | Clientes.tsx | Protegida | Directorio de clientes |
| `/proveedores` | Proveedores.tsx | Protegida | Directorio de proveedores |
| `/cobrar` | CuentasCobrar.tsx | Protegida | Cartera de clientes (crédito) |
| `/pagar` | CuentasPagar.tsx | Protegida | Deudas con proveedores |
| `/devoluciones` | Devoluciones.tsx | Protegida | Notas de crédito/retornos |
| `/caja` | Caja.tsx | Protegida | Control de efectivo diario |
| `/caja-chica` | CajaChica.tsx | Protegida | Gastos menores operativos |
| `/cierre` | CierreDia.tsx | Protegida | Arqueo y conciliación diaria |
| `/reportes` | Reportes.tsx | Protegida | Análisis financiero y operativo |
| `/usuarios` | Usuarios.tsx | Admin | Gestión de permisos y roles |
| `/config` | Config.tsx | Admin | Ajustes del sistema |
| `/etiquetas` | Etiquetas.tsx | Protegida | Generación de códigos de barras |

### 2.2 Jerarquía de Permisos

```
ROL_SUPER_ADMIN
├── Acceso total a todos los módulos
├── Configuración del sistema
├── Gestión de suscripción/planes
└── Auditoría completa

ROL_ADMIN
├── Dashboard, Facturación, Inventario
├── Caja, Cierre, Reportes
├── Clientes, Proveedores
├── Cuentas por Cobrar/Pagar
└── Configuración básica

ROL_VENDEDOR
├── Facturación (solo contado)
├── Cotizaciones
├── Clientes (solo consulta/creación)
└── Dashboard (solo sus métricas)

ROL_CAJERO
├── Caja (apertura/cierre)
├── Facturación (contado)
├── Cuentas por Cobrar (abonos)
└── Cierre de Día
```

---

## 3. FLUJOS DE NEGOCIO CRÍTICOS

### 3.1 FLUJO DE VENTAS (Facturación → Caja → Inventario)

```mermaid
Secuencia del Proceso:
1. USUARIO crea factura en /facturacion
   ├── Selecciona cliente (o cliente genérico)
   ├── Agrega productos (búsqueda por código/nombre)
   ├── Define forma de pago (Contado/Crédito/Mixto)
   └── Especifica moneda (USD/VES) y tasa de cambio

2. VALIDACIÓN automática del sistema
   ├── ¿Stock disponible? (stock_actual >= cantidad)
   ├── ¿Cliente tiene cupo crediticio? (si es crédito)
   └── ¿Caja está abierta? (obligatorio para contado)

3. AL GUARDAR la factura, el sistema ejecuta:
   
   A. INVENTARIO (Transacción tipo "SALIDA_VENTA")
      ├── RESTA cantidad de stock_actual
      ├── SUMA cantidad a vendido_acumulado
      ├── REGISTRA movimiento en historial_inventario
      └── ACTUALIZA costo_promedio_ponderado (si aplica)
   
   B. CAJA (Solo si pago contado o parcial)
      ├── CREA registro en movimientos_caja
      ├── TIPO: "INGRESO_VENTA"
      ├── MONTO: según forma de pago (efectivo/zelle/pm)
      └── SUMA al saldo_actual de la caja
   
   C. CUENTAS POR COBRAR (Si es crédito o parcial)
      ├── CREA/ACTUALIZA cuenta del cliente
      ├── MONTO_PENDIENTE += saldo_pendiente
      ├── FECHA_VENCIMIENTO = hoy + días_crédito_cliente
      └── VINCULA factura a la cuenta por cobrar
   
   D. DASHBOARD (Actualización en tiempo real)
      ├── ventas_hoy += total_factura
      ├── ingresos_hoy += monto_contado
      ├── cuentas_cobrar_pendientes += monto_credito
      └── productos_mas_vendidos (actualizar ranking)
```

**REGLAS DE NEGOCIO ESTRICTAS:**
- No permitir facturar con stock en cero (a menos que flag "permitir_negativos" esté activo en Config)
- Si el cliente tiene deudas vencidas > 30 días, bloquear ventas a crédito
- Una factura no puede ser eliminada, solo anulada (genera nota de crédito automática)
- El tipo de cambio debe confirmarse si varía >5% respecto al último registrado

---

### 3.2 FLUJO DE COMPRAS (Compras → Inventario → Cuentas por Pagar)

```mermaid
Secuencia del Proceso:
1. USUARIO registra compra en /compras
   ├── Selecciona proveedor
   ├── Agrega productos (existentes o nuevos)
   ├── Define costo unitario (histórico sugerido)
   ├── Indica forma de pago (Contado/Crédito)
   └── Especifica fecha de recepción

2. AL GUARDAR la compra:
   
   A. INVENTARIO (Transacción tipo "ENTRADA_COMPRA")
      ├── SUMA cantidad a stock_actual
      ├── ACTUALIZA ultimo_costo = costo_unitario
      ├── RECALCULA costo_promedio_ponderado
      │   └── Fórmula: ((stock_ant * cpp_ant) + (cant_new * costo_new)) / (stock_ant + cant_new)
      └── REGISTRA movimiento en historial_inventario
   
   B. CUENTAS POR PAGAR (Si es crédito)
      ├── CREA registro en cuentas_pagar
      ├── PROVEEDOR_ID vinculado
      ├── MONTO_TOTAL = suma de productos
      ├── MONTO_PENDIENTE = MONTO_TOTAL - anticipo (si aplica)
      ├── FECHA_VENCIMIENTO = fecha_compra + días_crédito_proveedor
      └── ESTADO = "PENDIENTE"
   
   C. CAJA (Si hay pago contado o anticipo)
      ├── CREA registro tipo "EGRESO_COMPRA"
      └── RESTA del saldo_actual
```

---

### 3.3 FLUJO DE CAJA CHICA (Reposición y Control)

```mermaid
Concepto: Fondo fijo para gastos menores operativos

ESTRUCTURA:
├── MONTO_FIJO: Monto asignado (ej: $100)
├── MONTO_ACTUAL: Lo que hay físicamente ahora
├── GASTOS_PENDIENTES: Vales sin reposición
└── ESTADO: Abierta / Cerrada / En_Reposición

PROCESO DE GASTO:
1. Usuario registra gasto en /caja-chica
   ├── CONCEPTO: "Compra de papel higiénico"
   ├── MONTO: $15
   ├── COMPROBANTE: foto/factura (adjunto)
   └── RESPONSABLE: Usuario que autoriza

2. SISTEMA ejecuta:
   ├── RESTA $15 de caja_chica.monto_actual
   ├── CREA registro en gastos_operativos
   └── MARCA como "pendiente_de_reposicion"

PROCESO DE REPOSICIÓN (cuando monto_actual < umbral):
1. Admin solicita reposición
2. Sistema calcula: MONTO_REPOSICION = MONTO_FIJO - MONTO_ACTUAL
3. Se transfiere desde Caja Principal → Caja Chica
4. Sistema crea:
   ├── EGRESO en caja principal (tipo "REPOSICION_CAJA_CHICA")
   ├── INGRESO en caja chica (tipo "REPOSICION")
   └── MARCA todos los vales como "reposados"
```

---

### 3.4 FLUJO DE CIERRE DE DÍA (Arqueo y Conciliación)

```mermaid
PASOS DEL CIERRE:

1. PRE-VALIDACIÓN (Sistema verifica antes de permitir cierre)
   ├── ¿Todas las facturas del día están completas? (no pendientes)
   ├── ¿Hay movimientos de caja sin categorizar?
   └── ¿Las tasas de cambio del día están registradas?

2. USUARIO ejecuta cierre en /cierre
   ├── INGRESA conteos físicos:
   │   ├── Efectivo USD: $XXX.XX
   │   ├── Efectivo VES: Bs.XXX.XX
   │   ├── Zelle confirmado: $XXX.XX
   │   └── Pago Móvil: Bs.XXX.XX
   └── OBSERVACIONES: campo texto libre

3. SISTEMA CALCULA (Teórico vs Físico):
   
   SALDO_TEÓRICO_USD = (
       saldo_inicial_usd 
       + sum(ingresos_usd) 
       - sum(egresos_usd)
   )
   
   SALDO_TEÓRICO_VES = (
       saldo_inicial_ves 
       + sum(ingresos_ves) 
       - sum(egresos_ves)
   )
   
   DIFERENCIA_USD = SALDO_TEÓRICO_USD - CONTEO_FISICO_USD
   DIFERENCIA_VES = SALDO_TEÓRICO_VES - CONTEO_FISICO_VES

4. RESULTADOS POSIBLES:
   ├── DIFERENCIA = 0 → Cierre "CUADRA" ✅
   ├── DIFERENCIA > 0 → FALTANTE (sobrante en teoría)
   │   └── REGISTRA: tipo "FALTANTE", monto, responsable
   ├── DIFERENCIA < 0 → SOBRANTE (faltante en teoría)
   │   └── REGISTRA: tipo "SOBRANTE", monto
   └── GENERA: Reporte de Cierre en PDF

5. POST-CIERRE:
   ├── BLOQUEA edición de facturas de esa fecha
   ├── ARCHIVA movimientos en historial_cierres
   ├── PREPARA caja para siguiente día (saldo_inicial = saldo_final)
   └── ACTUALIZA dashboard: cierre_del_dia = completado
```

**REGLAS CRÍTICAS:**
- Solo un cierre por día por caja
- Si hay diferencia > 1% del total, requiere autorización de ADMIN
- Los cierres no pueden eliminarse, solo "revertirse" con documentación

---

## 4. MODELO DE DATOS (Esquema de Base de Datos)

### 4.1 Entidades Principales

```sql
-- ============================================
-- TABLA: usuarios
-- ============================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    rol ENUM('SUPER_ADMIN', 'ADMIN', 'VENDEDOR', 'CAJERO') DEFAULT 'VENDEDOR',
    sucursal_id UUID REFERENCES sucursales(id),
    activo BOOLEAN DEFAULT true,
    ultimo_acceso TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: clientes
-- ============================================
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(20) UNIQUE,
    tipo_documento ENUM('V', 'E', 'J', 'G', 'P') DEFAULT 'V',
    numero_documento VARCHAR(20) UNIQUE NOT NULL,
    nombre_razon_social VARCHAR(150) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(20),
    email VARCHAR(100),
    tipo_cliente ENUM('MAYORISTA', 'MINORISTA', 'DISTRIBUIDOR') DEFAULT 'MINORISTA',
    limite_credito DECIMAL(15,2) DEFAULT 0,
    dias_credito INT DEFAULT 0,
    saldo_pendiente DECIMAL(15,2) DEFAULT 0,
    estado ENUM('ACTIVO', 'INACTIVO', 'BLOQUEADO') DEFAULT 'ACTIVO',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: proveedores
-- ============================================
CREATE TABLE proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(20) UNIQUE,
    rif VARCHAR(20) UNIQUE NOT NULL,
    nombre_razon_social VARCHAR(150) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(20),
    email VARCHAR(100),
    contacto_nombre VARCHAR(100),
    dias_credito INT DEFAULT 30,
    saldo_pendiente DECIMAL(15,2) DEFAULT 0,
    estado ENUM('ACTIVO', 'INACTIVO') DEFAULT 'ACTIVO',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: productos (Catálogo maestro)
-- ============================================
CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_barras VARCHAR(50) UNIQUE,
    codigo_interno VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    categoria_id UUID REFERENCES categorias(id),
    unidad_medida VARCHAR(20) DEFAULT 'UNIDAD',
    
    -- Control de inventario
    stock_actual DECIMAL(10,2) DEFAULT 0,
    stock_minimo DECIMAL(10,2) DEFAULT 0,
    stock_maximo DECIMAL(10,2) DEFAULT 0,
    ubicacion_almacen VARCHAR(50),
    
    -- Precios (multimoneda)
    precio_venta_usd DECIMAL(12,2) DEFAULT 0,
    precio_venta_ves DECIMAL(12,2) DEFAULT 0,
    precio_mayor_usd DECIMAL(12,2) DEFAULT 0,
    costo_promedio_usd DECIMAL(12,2) DEFAULT 0,
    ultimo_costo_usd DECIMAL(12,2) DEFAULT 0,
    
    -- Control
    maneja_lotes BOOLEAN DEFAULT false,
    maneja_vencimiento BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: facturas (Documento de venta)
-- ============================================
CREATE TABLE facturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_factura VARCHAR(20) UNIQUE NOT NULL,
    serie VARCHAR(10) DEFAULT 'A',
    
    -- Relaciones
    cliente_id UUID REFERENCES clientes(id),
    vendedor_id UUID REFERENCES usuarios(id),
    caja_id UUID REFERENCES cajas(id),
    
    -- Fechas
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento TIMESTAMP,
    
    -- Totales
    subtotal_usd DECIMAL(12,2) DEFAULT 0,
    impuesto_usd DECIMAL(12,2) DEFAULT 0,
    total_usd DECIMAL(12,2) DEFAULT 0,
    subtotal_ves DECIMAL(12,2) DEFAULT 0,
    impuesto_ves DECIMAL(12,2) DEFAULT 0,
    total_ves DECIMAL(12,2) DEFAULT 0,
    
    -- Forma de pago
    forma_pago ENUM('CONTADO', 'CREDITO', 'MIXTO') DEFAULT 'CONTADO',
    monto_contado_usd DECIMAL(12,2) DEFAULT 0,
    monto_credito_usd DECIMAL(12,2) DEFAULT 0,
    
    -- Estado
    estado ENUM('EMITIDA', 'PAGADA', 'PENDIENTE', 'ANULADA', 'DEVUELTA') DEFAULT 'EMITIDA',
    
    -- Tasas
    tasa_cambio_usd_ves DECIMAL(10,2),
    
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: factura_detalles (Líneas de factura)
-- ============================================
CREATE TABLE factura_detalles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_id UUID REFERENCES facturas(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id),
    
    cantidad DECIMAL(10,2) NOT NULL,
    precio_unitario_usd DECIMAL(12,2) NOT NULL,
    precio_unitario_ves DECIMAL(12,2) NOT NULL,
    subtotal_linea_usd DECIMAL(12,2) NOT NULL,
    
    descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
    impuesto_porcentaje DECIMAL(5,2) DEFAULT 0,
    
    -- Para control de lotes/vencimientos
    lote_id UUID REFERENCES lotes(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: cajas (Control de efectivo)
-- ============================================
CREATE TABLE cajas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) NOT NULL,
    sucursal_id UUID REFERENCES sucursales(id),
    
    -- Saldos actuales
    saldo_actual_usd DECIMAL(12,2) DEFAULT 0,
    saldo_actual_ves DECIMAL(12,2) DEFAULT 0,
    
    -- Estado
    estado ENUM('ABIERTA', 'CERRADA', 'BLOQUEADA') DEFAULT 'CERRADA',
    
    -- Usuario responsable actual
    cajero_actual_id UUID REFERENCES usuarios(id),
    
    -- Último cierre
    ultimo_cierre_id UUID,
    fecha_ultimo_cierre TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: movimientos_caja (Registro de entradas/salidas)
-- ============================================
CREATE TABLE movimientos_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caja_id UUID REFERENCES cajas(id),
    
    -- Tipo de movimiento
    tipo ENUM(
        'INGRESO_VENTA',          -- Venta de contado
        'INGRESO_COBRO',          -- Abono de cliente
        'INGRESO_REPOSICION',     -- De caja chica
        'EGRESO_COMPRA',          -- Pago a proveedor
        'EGRESO_GASTO',           -- Gasto operativo
        'EGRESO_DEVOLUCION',      -- Reembolso
        'EGRESO_CAJA_CHICA',      -- Reposición de caja chica
        'AJUSTE_CIERRE',          -- Diferencia de cierre
        'TRANSFERENCIA_ENTRADA',  -- De otra caja
        'TRANSFERENCIA_SALIDA'    -- A otra caja
    ) NOT NULL,
    
    -- Montos
    monto_usd DECIMAL(12,2) DEFAULT 0,
    monto_ves DECIMAL(12,2) DEFAULT 0,
    moneda_principal ENUM('USD', 'VES') NOT NULL,
    
    -- Referencias
    factura_id UUID REFERENCES facturas(id),
    cuenta_cobrar_id UUID REFERENCES cuentas_cobrar(id),
    cuenta_pagar_id UUID REFERENCES cuentas_pagar(id),
    
    -- Metadatos
    descripcion TEXT,
    usuario_id UUID REFERENCES usuarios(id),
    fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Conciliación
    conciliado BOOLEAN DEFAULT false,
    fecha_conciliacion TIMESTAMP
);

-- ============================================
-- TABLA: cierres_caja (Arqueos diarios)
-- ============================================
CREATE TABLE cierres_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caja_id UUID REFERENCES cajas(id),
    cajero_id UUID REFERENCES usuarios(id),
    
    -- Fecha del cierre
    fecha_cierre DATE NOT NULL,
    hora_cierre TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Saldos iniciales (inicio del día)
    saldo_inicial_usd DECIMAL(12,2),
    saldo_inicial_ves DECIMAL(12,2),
    
    -- Totales del día (movimientos)
    total_ingresos_usd DECIMAL(12,2) DEFAULT 0,
    total_egresos_usd DECIMAL(12,2) DEFAULT 0,
    total_ingresos_ves DECIMAL(12,2) DEFAULT 0,
    total_egresos_ves DECIMAL(12,2) DEFAULT 0,
    
    -- Saldos teóricos (calculados)
    saldo_teorico_usd DECIMAL(12,2),
    saldo_teorico_ves DECIMAL(12,2),
    
    -- Conteos físicos (ingresados por cajero)
    conteo_fisico_usd DECIMAL(12,2),
    conteo_fisico_ves DECIMAL(12,2),
    conteo_zelle DECIMAL(12,2),
    conteo_pm DECIMAL(12,2),
    
    -- Diferencias
    diferencia_usd DECIMAL(12,2) DEFAULT 0,
    diferencia_ves DECIMAL(12,2) DEFAULT 0,
    
    -- Estado del cierre
    estado ENUM('CUADRA', 'DIFERENCIA', 'PENDIENTE') DEFAULT 'PENDIENTE',
    
    -- Observaciones
    observaciones TEXT,
    justificacion_diferencia TEXT,
    
    -- Aprobación
    aprobado_por UUID REFERENCES usuarios(id),
    fecha_aprobacion TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: cuentas_cobrar (Cartera de clientes)
-- ============================================
CREATE TABLE cuentas_cobrar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id),
    factura_id UUID REFERENCES facturas(id),
    
    -- Montos
    monto_original DECIMAL(12,2) NOT NULL,
    monto_pagado DECIMAL(12,2) DEFAULT 0,
    monto_pendiente DECIMAL(12,2) NOT NULL,
    
    -- Fechas
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento TIMESTAMP NOT NULL,
    fecha_ultimo_pago TIMESTAMP,
    
    -- Estado
    estado ENUM('PENDIENTE', 'PARCIAL', 'PAGADA', 'VENCIDA', 'COBRANZA') DEFAULT 'PENDIENTE',
    
    -- Seguimiento
    dias_mora INT DEFAULT 0,
    intereses_mora DECIMAL(12,2) DEFAULT 0,
    
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: cuentas_pagar (Deudas con proveedores)
-- ============================================
CREATE TABLE cuentas_pagar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id UUID REFERENCES proveedores(id),
    compra_id UUID REFERENCES compras(id),
    
    -- Montos
    monto_original DECIMAL(12,2) NOT NULL,
    monto_pagado DECIMAL(12,2) DEFAULT 0,
    monto_pendiente DECIMAL(12,2) NOT NULL,
    retencion_islr DECIMAL(12,2) DEFAULT 0,
    retencion_iva DECIMAL(12,2) DEFAULT 0,
    
    -- Fechas
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento TIMESTAMP NOT NULL,
    fecha_ultimo_pago TIMESTAMP,
    
    -- Estado
    estado ENUM('PENDIENTE', 'PARCIAL', 'PAGADA', 'VENCIDA') DEFAULT 'PENDIENTE',
    
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: compras (Recepción de mercancía)
-- ============================================
CREATE TABLE compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_compra VARCHAR(20) UNIQUE NOT NULL,
    proveedor_id UUID REFERENCES proveedores(id),
    usuario_id UUID REFERENCES usuarios(id),
    
    -- Fechas
    fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_recepcion TIMESTAMP,
    
    -- Totales
    subtotal_usd DECIMAL(12,2) DEFAULT 0,
    impuesto_usd DECIMAL(12,2) DEFAULT 0,
    total_usd DECIMAL(12,2) DEFAULT 0,
    
    -- Forma de pago
    forma_pago ENUM('CONTADO', 'CREDITO', 'ANTICIPO') DEFAULT 'CREDITO',
    
    -- Estado
    estado ENUM('PENDIENTE', 'RECIBIDA', 'PARCIAL', 'CANCELADA') DEFAULT 'PENDIENTE',
    
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: historial_inventario (Auditoría de movimientos)
-- ============================================
CREATE TABLE historial_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID REFERENCES productos(id),
    
    -- Tipo de movimiento
    tipo ENUM('ENTRADA_COMPRA', 'SALIDA_VENTA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 
              'DEVOLUCION_CLIENTE', 'DEVOLUCION_PROVEEDOR', 'TRANSFERENCIA') NOT NULL,
    
    -- Cantidades
    cantidad_anterior DECIMAL(10,2),
    cantidad_movimiento DECIMAL(10,2),
    cantidad_nueva DECIMAL(10,2),
    
    -- Referencias
    documento_id UUID, -- Puede ser factura_id, compra_id, ajuste_id
    documento_tipo VARCHAR(30),
    
    -- Costos (para trazabilidad)
    costo_unitario DECIMAL(12,2),
    costo_total DECIMAL(12,2),
    
    -- Metadatos
    usuario_id UUID REFERENCES usuarios(id),
    sucursal_id UUID REFERENCES sucursales(id),
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: cotizaciones (Presupuestos - no contables)
-- ============================================
CREATE TABLE cotizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_cotizacion VARCHAR(20) UNIQUE NOT NULL,
    cliente_id UUID REFERENCES clientes(id),
    vendedor_id UUID REFERENCES usuarios(id),
    
    -- Fechas
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento TIMESTAMP,
    
    -- Totales
    subtotal_usd DECIMAL(12,2) DEFAULT 0,
    total_usd DECIMAL(12,2) DEFAULT 0,
    
    -- Estado
    estado ENUM('EMITIDA', 'APROBADA', 'RECHAZADA', 'FACTURADA', 'VENCIDA') DEFAULT 'EMITIDA',
    
    -- Conversión
    factura_id UUID REFERENCES facturas(id),
    
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: configuracion_sistema
-- ============================================
CREATE TABLE configuracion_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Empresa
    nombre_empresa VARCHAR(150),
    rif VARCHAR(20),
    direccion TEXT,
    telefono VARCHAR(20),
    email VARCHAR(100),
    logo_url VARCHAR(255),
    
    -- Configuración fiscal
    porcentaje_iva DECIMAL(5,2) DEFAULT 16.00,
    porcentaje_retencion_iva DECIMAL(5,2) DEFAULT 75.00,
    
    -- Configuración de inventario
    permitir_stock_negativo BOOLEAN DEFAULT false,
    calcular_costo_promedio BOOLEAN DEFAULT true,
    alerta_stock_minimo BOOLEAN DEFAULT true,
    
    -- Configuración de caja
    monto_caja_chica DECIMAL(12,2) DEFAULT 100.00,
    umbral_reposicion_caja_chica DECIMAL(5,2) DEFAULT 20.00, -- %
    
    -- Configuración de ventas
    permitir_venta_credito BOOLEAN DEFAULT true,
    permitir_descuentos BOOLEAN DEFAULT true,
    maximo_descuento DECIMAL(5,2) DEFAULT 15.00,
    
    -- Tasas de cambio
    tasa_usd_ves_default DECIMAL(10,2),
    fecha_ultima_tasa TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. REGLAS DE NEGOCIO Y VALIDACIONES

### 5.1 Inventario

```yaml
REGLA_INV_001:
  nombre: "Stock no negativo"
  descripcion: "No permitir ventas que dejen stock negativo"
  condicion: "stock_actual - cantidad_solicitada >= 0"
  excepcion: "config.permitir_stock_negativo = true"
  accion: "RECHAZAR factura con mensaje 'Stock insuficiente'"

REGLA_INV_002:
  nombre: "Costo promedio ponderado"
  descripcion: "Recalcular costo promedio en cada compra"
  formula: |
    CPP_nuevo = ((Stock_ant * CPP_ant) + (Cant_compra * Costo_compra)) 
                / (Stock_ant + Cant_compra)
  trigger: "INSERT en tabla compras"

REGLA_INV_003:
  nombre: "Alerta stock mínimo"
  descripcion: "Notificar cuando stock <= stock_minimo"
  accion: "Crear notificación en Dashboard"
  frecuencia: "En cada movimiento de salida"
```

### 5.2 Facturación

```yaml
REGLA_FAC_001:
  nombre: "Caja abierta obligatoria"
  descripcion: "Para facturas de contado, la caja debe estar abierta"
  validacion: "caja.estado = 'ABIERTA' AND caja.cajero_actual_id = usuario_actual"
  accion_rechazo: "Mostrar mensaje: 'Debe abrir caja primero'"

REGLA_FAC_002:
  nombre: "Límite de crédito"
  descripcion: "Validar cupo disponible antes de vender a crédito"
  formula: |
    Cupo_disponible = Cliente.limite_credito - Cliente.saldo_pendiente
  validacion: "Cupo_disponible >= Monto_credito_factura"

REGLA_FAC_003:
  nombre: "Cliente moroso"
  descripcion: "Bloquear ventas a crédito si tiene deudas vencidas"
  condicion: |
    EXISTS (SELECT 1 FROM cuentas_cobrar 
            WHERE cliente_id = ? 
            AND estado = 'VENCIDA' 
            AND dias_mora > 30)
  accion: "Permitir solo ventas de contado"

REGLA_FAC_004:
  nombre: "No eliminación de facturas"
  descripcion: "Las facturas no se eliminan, se anulan"
  proceso_anulacion:
    - Crear nota de crédito
    - Reversar movimientos de inventario
    - Reversar movimientos de caja
    - Actualizar estado a 'ANULADA'
    - Registrar usuario y fecha de anulación
```

### 5.3 Caja

```yaml
REGLA_CAJ_001:
  nombre: "Una caja por usuario"
  descripcion: "Un cajero no puede tener dos cajas abiertas simultáneamente"
  validacion: "NOT EXISTS (caja_abierta WHERE cajero_id = usuario_actual)"

REGLA_CAJ_002:
  nombre: "Cierre obligatorio diario"
  descripcion: "No permitir operar día siguiente sin cerrar el anterior"
  validacion: "ultimo_cierre.fecha = fecha_actual OR caja.estado = 'CERRADA'"

REGLA_CAJ_003:
  nombre: "Diferencia máxima permitida"
  descripcion: "Si diferencia > 1%, requiere autorización"
  formula: |
    Porcentaje_diferencia = ABS(diferencia) / total_movimientos * 100
  umbral: "1%"
  accion: "Requerir aprobación de ADMIN"
```

### 5.4 Cuentas por Cobrar/Pagar

```yaml
REGLA_CXC_001:
  nombre: "Actualización automática de saldo"
  descripcion: "Al registrar abono, actualizar saldo del cliente"
  trigger: "INSERT en pagos_cuentas_cobrar"
  accion: |
    UPDATE clientes SET saldo_pendiente = saldo_pendiente - monto_abono
    UPDATE cuentas_cobrar SET 
      monto_pagado = monto_pagado + monto_abono,
      monto_pendiente = monto_pendiente - monto_abono,
      estado = CASE WHEN monto_pendiente = 0 THEN 'PAGADA' ELSE 'PARCIAL' END

REGLA_CXP_001:
  nombre: "Orden de pago sugerida"
  descripcion: "Priorizar facturas más próximas a vencer"
  algoritmo: "ORDER BY fecha_vencimiento ASC, monto_pendiente ASC"
```

---

## 6. DASHBOARD Y KPIs

### 6.1 Métricas Principales (Tiempo Real)

```javascript
const KPIs_Dashboard = {
  // Ventas
  ventas_hoy_usd: "SUM(facturas.total_usd WHERE fecha = hoy)",
  ventas_hoy_ves: "SUM(facturas.total_ves WHERE fecha = hoy)",
  ventas_mes_usd: "SUM(facturas.total_usd WHERE mes = actual)",
  comparativo_ayer: "((ventas_hoy - ventas_ayer) / ventas_ayer) * 100",
  
  // Caja
  saldo_caja_usd: "cajas.saldo_actual_usd",
  saldo_caja_ves: "cajas.saldo_actual_ves",
  ingresos_hoy: "SUM(movimientos_caja WHERE tipo LIKE 'INGRESO%' AND fecha = hoy)",
  egresos_hoy: "SUM(movimientos_caja WHERE tipo LIKE 'EGRESO%' AND fecha = hoy)",
  
  // Inventario
  total_productos: "COUNT(productos WHERE activo = true)",
  productos_bajo_stock: "COUNT(productos WHERE stock_actual <= stock_minimo)",
  valor_inventario_usd: "SUM(productos.stock_actual * productos.costo_promedio_usd)",
  
  // Cartera
  por_cobrar_total: "SUM(cuentas_cobrar.monto_pendiente)",
  por_cobrar_vencido: "SUM(cuentas_cobrar.monto_pendiente WHERE estado = 'VENCIDA')",
  por_pagar_total: "SUM(cuentas_pagar.monto_pendiente)",
  por_pagar_proximo: "SUM(cuentas_pagar.monto_pendiente WHERE fecha_vencimiento <= hoy + 7 dias)",
  
  // Top productos
  productos_mas_vendidos: [
    "SELECT producto_id, SUM(cantidad) as total",
    "FROM factura_detalles",
    "WHERE fecha >= hoy - 30 dias",
    "GROUP BY producto_id",
    "ORDER BY total DESC",
    "LIMIT 10"
  ],
  
  // Clientes
  clientes_activos: "COUNT(clientes WHERE estado = 'ACTIVO')",
  nuevos_clientes_mes: "COUNT(clientes WHERE created_at >= inicio_mes)",
  top_clientes: "Clientes con mayor volumen de compras"
};
```

### 6.2 Alertas y Notificaciones

```yaml
ALERTAS:
  - tipo: "STOCK_BAJO"
    condicion: "producto.stock_actual <= producto.stock_minimo"
    severidad: "ALTA"
    accion: "Mostrar en dashboard + notificación email"
    
  - tipo: "CUENTA_VENCIDA"
    condicion: "cuentas_cobrar.fecha_vencimiento < hoy AND estado != 'PAGADA'"
    severidad: "MEDIA"
    accion: "Notificar a cobranza + resaltar en lista"
    
  - tipo: "CAJA_SIN_CERRAR"
    condicion: "caja.estado = 'ABIERTA' AND fecha_apertura < hoy"
    severidad: "ALTA"
    accion: "Bloquear nuevas operaciones hasta cerrar"
    
  - tipo: "PAGO_PROXIMO"
    condicion: "cuentas_pagar.fecha_vencimiento <= hoy + 3 dias"
    severidad: "BAJA"
    accion: "Recordatorio en dashboard"
```

---

## 7. CASOS DE USO DETALLADOS

### 7.1 Caso: Venta de Contado

```yaml
Actor: Vendedor
Precondiciones:
  - Usuario autenticado con rol VENDEDOR o ADMIN
  - Caja abierta para la sucursal
  - Productos con stock disponible

Flujo Principal:
  1. Vendedor accede a /facturacion
  2. Sistema muestra formulario de nueva factura
  3. Vendedor selecciona cliente (búsqueda por nombre/RIF)
  4. Vendedor agrega productos:
     - Escanea código de barras O busca por nombre
     - Sistema muestra precio sugerido (USD/VES)
     - Vendedor ajusta cantidad (default: 1)
     - Sistema calcula subtotal línea
  5. Vendedor selecciona forma de pago: CONTADO
  6. Vendedor especifica método de pago:
     - Efectivo USD
     - Efectivo VES
     - Zelle
     - Pago Móvil
     - Mixto (múltiples métodos)
  7. Vendedor hace clic en "Guardar Factura"
  
Validaciones del Sistema:
  - Verifica stock disponible
  - Verifica caja abierta
  - Calcula totales (subtotal, impuesto, total)
  - Si mixto: verifica que suma de métodos = total

Post-condiciones:
  - Factura creada con estado "EMITIDA"
  - Stock de productos reducido
  - Movimiento de caja creado (INGRESO_VENTA)
  - Dashboard actualizado
  - Impresión de factura disponible
```

### 7.2 Caso: Venta a Crédito

```yaml
Actor: Vendedor (con permiso de crédito)
Precondiciones:
  - Cliente registrado con límite de crédito > 0
  - Cliente sin deudas vencidas
  - Cupo disponible >= monto de la venta

Flujo Principal:
  1-4: Igual que venta de contado
  5. Vendedor selecciona forma de pago: CREDITO
  6. Sistema muestra:
     - Límite de crédito del cliente
     - Saldo actual pendiente
     - Cupo disponible
     - Días de crédito configurados
  7. Vendedor confirma
  8. Sistema calcula fecha de vencimiento: hoy + dias_credito
  
Validaciones:
  - Cupo disponible >= total_factura
  - No tiene deudas vencidas > 30 días
  
Post-condiciones:
  - Factura creada con estado "PENDIENTE"
  - Cuenta por cobrar creada
  - Saldo pendiente del cliente actualizado
  - Stock reducido
  - NO hay movimiento de caja (aún)
```

### 7.3 Caso: Registro de Compra

```yaml
Actor: Administrador o Comprador
Precondiciones:
  - Proveedor registrado
  
Flujo:
  1. Usuario accede a /compras
  2. Selecciona proveedor
  3. Agrega productos:
     - Busca producto existente O crea nuevo
     - Ingresa cantidad
     - Ingresa costo unitario
     - Sistema sugiere costo histórico
  4. Selecciona forma de pago (Contado/Crédito)
  5. Guarda compra
  
Post-condiciones:
  - Compra registrada
  - Stock de productos aumentado
  - Costo promedio recalculado
  - Si crédito: cuenta por pagar creada
  - Si contado: egreso de caja registrado
```

### 7.4 Caso: Abono a Cuenta por Cobrar

```yaml
Actor: Cajero
Precondiciones:
  - Cliente con saldo pendiente
  - Caja abierta
  
Flujo:
  1. Cajero accede a /cobrar
  2. Busca cliente
  3. Sistema muestra facturas pendientes
  4. Cajero selecciona factura(s) a abonar
  5. Ingresa monto del abono
  6. Selecciona método de pago
  7. Guarda abono
  
Post-condiciones:
  - Movimiento de caja creado (INGRESO_COBRO)
  - Cuenta por cobrar actualizada
  - Si monto_pendiente = 0: estado cambia a "PAGADA"
  - Saldo del cliente actualizado
```

### 7.5 Caso: Cierre de Caja

```yaml
Actor: Cajero (con supervisión si hay diferencia)
Precondiciones:
  - Caja abierta
  - Todas las facturas del día procesadas
  
Flujo:
  1. Cajero accede a /cierre
  2. Sistema muestra resumen del día:
     - Total ventas
     - Total ingresos/egresos
     - Saldo teórico calculado
  3. Cajero ingresa conteos físicos:
     - Efectivo USD
     - Efectivo VES
     - Zelle confirmado
     - Pago Móvil
  4. Sistema calcula diferencias
  5. Si diferencia = 0:
     - Cierre aprobado automáticamente
  6. Si diferencia > 0:
     - Requiere justificación
     - Si > 1%: requiere aprobación ADMIN
  7. Cierre guardado
  
Post-condiciones:
  - Caja cambia a estado "CERRADA"
  - Movimientos del día archivados
  - Reporte de cierre generado
  - Dashboard actualizado
  - Próxima apertura tendrá saldo_inicial = saldo_final
```

---

## 8. INTEGRACIONES Y APIS

### 8.1 Endpoints Principales (REST API)

```yaml
AUTENTICACIÓN:
  POST /api/auth/login
  POST /api/auth/logout
  POST /api/auth/refresh

FACTURACIÓN:
  GET    /api/facturas              # Listar con filtros
  GET    /api/facturas/:id          # Obtener detalle
  POST   /api/facturas              # Crear factura
  PUT    /api/facturas/:id/anular   # Anular factura
  GET    /api/facturas/:id/print    # Generar PDF

INVENTARIO:
  GET    /api/productos
  GET    /api/productos/:id
  POST   /api/productos
  PUT    /api/productos/:id
  GET    /api/productos/:id/movimientos  # Historial
  POST   /api/productos/ajuste       # Ajuste de inventario

CAJA:
  POST   /api/cajas/:id/abrir
  POST   /api/cajas/:id/cerrar
  GET    /api/cajas/:id/movimientos
  POST   /api/cajas/movimiento       # Ingreso/egreso manual
  GET    /api/cajas/:id/cierre-report

CUENTAS POR COBRAR:
  GET    /api/cuentas-cobrar
  GET    /api/cuentas-cobrar/cliente/:id
  POST   /api/cuentas-cobrar/:id/abono
  GET    /api/cuentas-cobrar/estado-cuenta/:cliente_id

CUENTAS POR PAGAR:
  GET    /api/cuentas-pagar
  POST   /api/cuentas-pagar/:id/pago
  
COMPRAS:
  GET    /api/compras
  POST   /api/compras
  PUT    /api/compras/:id/recibir    # Confirmar recepción

REPORTES:
  GET    /api/reportes/ventas        # Query params: fecha_desde, fecha_hasta
  GET    /api/reportes/inventario-valorizado
  GET    /api/reportes/cartera
  GET    /api/reportes/flujo-caja
  GET    /api/reportes/utilidad      # Ventas - Costos
```

### 8.2 Formato de Respuesta Estándar

```json
{
  "success": true,
  "data": { ... },
  "message": "Operación exitosa",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

## 9. SEGURIDAD Y AUDITORÍA

### 9.1 Reglas de Seguridad

```yaml
AUTENTICACIÓN:
  - JWT con expiración de 8 horas
  - Refresh token de 7 días
  - Bloqueo después de 5 intentos fallidos
  
AUTORIZACIÓN:
  - Middleware de roles en cada endpoint
  - Validación de permisos a nivel de registro
  
AUDITORÍA:
  - Log de todas las operaciones CRUD
  - Registro de: usuario, fecha, IP, acción, datos anteriores/posteriores
  - Tabla: auditoria_sistema
  
DATOS_SENSIBLES:
  - Contraseñas hasheadas con bcrypt
  - No exponer IDs internos en URLs (usar UUIDs)
  - Sanitización de inputs (SQL injection, XSS)
```

### 9.2 Tabla de Auditoría

```sql
CREATE TABLE auditoria_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabla_afectada VARCHAR(50) NOT NULL,
    registro_id UUID NOT NULL,
    accion ENUM('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ERROR') NOT NULL,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    usuario_id UUID REFERENCES usuarios(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 10. CONSIDERACIONES MULTIMONEDA (Venezuela)

### 10.1 Manejo de Tasas de Cambio

```yaml
CONFIGURACIÓN:
  moneda_principal: "USD"  # Para reporting
  moneda_secundaria: "VES"
  
REGISTRO_TASAS:
  - Tabla: historial_tasas
  - Campos: fecha, tasa_usd_ves, fuente (manual/BCV/paralelo)
  - Se registra al inicio del día o cuando cambia significativamente
  
CONVERSIÓN:
  - Todas las operaciones se registran en AMBAS monedas
  - Si pago en VES: monto_usd = monto_ves / tasa
  - Si pago en USD: monto_ves = monto_usd * tasa
  
REPORTES:
  - Dashboard muestra totales en USD (para consistencia)
  - Detalles muestran ambas monedas
```

### 10.2 Formas de Pago Soportadas

```yaml
EFECTIVO_USD:
  tipo: "efectivo_usd"
  requiere_cambio: true  # Si paga con billete grande
  
EFECTIVO_VES:
  tipo: "efectivo_ves"
  
ZELLE:
  tipo: "zelle"
  campos_adicionales:
    - correo_receptor
    - referencia
    - captura_pantalla (opcional)
    
PAGO_MOVIL:
  tipo: "pago_movil"
  campos_adicionales:
    - telefono_emisor
    - referencia
    - banco
    
TRANSFERENCIA:
  tipo: "transferencia"
  campos_adicionales:
    - banco_destino
    - referencia
    - fecha_transferencia
    
PUNTO_VENTA:
  tipo: "punto_venta"
  campos_adicionales:
    - ultimos_4_digitos
    - lote (opcional)
```

---

## 11. GUÍA PARA DESARROLLADORES (IA)

### 11.1 Convenciones de Código

```yaml
FRONTEND (React + TypeScript):
  - Componentes funcionales con hooks
  - Props tipadas con interfaces
  - Estado global: Context API o Zustand
  - Fetching: React Query (TanStack Query)
  - UI: Tailwind CSS + shadcn/ui o Material-UI
  - Formularios: React Hook Form + Zod
  
BACKEND (Node.js):
  - Framework: Express.js o NestJS
  - ORM: Prisma o TypeORM
  - Validación: Zod o Joi
  - Documentación: Swagger/OpenAPI
```

### 11.2 Estructura de Carpetas Sugerida

```
/proyecto-erp
├── /frontend
│   ├── /src
│   │   ├── /components
│   │   │   ├── /ui           # Componentes base
│   │   │   ├── /forms        # Formularios reutilizables
│   │   │   └── /layout       # Layout, Sidebar, Header
│   │   ├── /pages
│   │   │   ├── /facturacion
│   │   │   ├── /inventario
│   │   │   ├── /caja
│   │   │   └── ...
│   │   ├── /hooks            # Custom hooks
│   │   ├── /context          # Context API
│   │   ├── /services         # API calls
│   │   ├── /types            # TypeScript interfaces
│   │   ├── /utils            # Helpers
│   │   └── /router.tsx       # Configuración de rutas
│   └── package.json
│
├── /backend
│   ├── /src
│   │   ├── /modules
│   │   │   ├── /auth
│   │   │   ├── /facturacion
│   │   │   ├── /inventario
│   │   │   └── ...
│   │   ├── /database
│   │   │   ├── /migrations
│   │   │   └── /schema.prisma
│   │   ├── /middleware
│   │   ├── /utils
│   │   └── /app.ts
│   └── package.json
│
└── /docs
    └── sistema-erp-documentation.md  # Este archivo
```

### 11.3 Checklist de Implementación

```yaml
FASE 1 - FUNDAMENTOS:
  - [ ] Setup proyecto React + TypeScript
  - [ ] Configurar React Router
  - [ ] Setup Tailwind + componentes UI
  - [ ] Crear Layout con Sidebar y Header
  - [ ] Implementar autenticación (Login/Protected)
  - [ ] Crear página Dashboard básica

FASE 2 - CATÁLOGOS:
  - [ ] CRUD Productos
  - [ ] CRUD Clientes
  - [ ] CRUD Proveedores
  - [ ] CRUD Usuarios y Roles

FASE 3 - OPERACIONES:
  - [ ] Módulo de Facturación (contado)
  - [ ] Control de Inventario (entradas/salidas)
  - [ ] Apertura/Cierre de Caja
  - [ ] Movimientos de Caja

FASE 4 - CRÉDITO:
  - [ ] Ventas a crédito
  - [ ] Cuentas por Cobrar
  - [ ] Abonos y estados de cuenta
  - [ ] Cuentas por Pagar

FASE 5 - AVANZADO:
  - [ ] Compras y recepción
  - [ ] Devoluciones
  - [ ] Caja Chica
  - [ ] Cotizaciones
  - [ ] Etiquetas/códigos de barras

FASE 6 - REPORTES:
  - [ ] Reporte de ventas
  - [ ] Inventario valorizado
  - [ ] Estado de cartera
  - [ ] Flujo de caja
  - [ ] Utilidad bruta

FASE 7 - POLISH:
  - [ ] Dashboard con KPIs reales
  - [ ] Notificaciones y alertas
  - [ ] Impresión de facturas
  - [ ] Exportar a Excel/PDF
  - [ ] Tests y documentación
```

---

## 12. GLOSARIO DE TÉRMINOS

| Término | Definición |
|---------|------------|
| **Caja** | Control físico del dinero en efectivo y equivalentes |
| **Caja Chica** | Fondo fijo para gastos menores operativos |
| **Cierre de Día** | Proceso de arqueo que cuadra lo teórico vs físico |
| **Costo Promedio Ponderado (CPP)** | Método de valuación de inventario |
| **Cuenta por Cobrar** | Derecho de cobrar a un cliente por venta a crédito |
| **Cuenta por Pagar** | Obligación de pagar a un proveedor |
| **Factura** | Documento legal de venta que afecta inventario y caja |
| **Cotización** | Presupuesto no contable, puede convertirse en factura |
| **Movimiento de Caja** | Cada entrada o salida registrada en la caja |
| **Reposición** | Proceso de reintegrar fondos a la caja chica |
| **Stock** | Cantidad física de producto disponible |
| **Tasa de Cambio** | Relación USD/VES para conversiones |

---

## 13. NOTAS PARA LA IA GENERADORA

> **INSTRUCCIÓN PARA IA:** Este documento describe un sistema ERP completo. Al generar código:
> 
> 1. **Prioriza la integridad de datos**: Cada operación debe mantener consistencia entre módulos
> 2. **Valida siempre**: Nunca confíes en el frontend, valida en backend
> 3. **Registra todo**: Cada movimiento debe dejar rastro auditado
> 4. **Maneja errores gracefully**: Los errores deben ser informativos pero no exponer datos sensibles
> 5. **Optimiza para Venezuela**: Multimoneda nativa, no como parche
> 6. **UI/UX moderna**: Dashboard claro, formularios intuitivos, responsive
> 
> **Preguntas frecuentes de implementación:**
> - ¿Cómo manejar la tasa de cambio? → Registrar en cada operación, no usar tasa global
> - ¿Qué pasa si hay corte de luz durante una factura? → Transacciones atómicas en BD
> - ¿Cómo evitar ventas duplicadas? → Validación de unicidad en numero_factura
> - ¿Cómo manejar permisos granulares? → Middleware que verifica rol + permiso específico

---

*Documentación generada para IA - Sistema ERP Modular*
*Versión: 2.0.0 | Última actualización: 2024*
