# GUAICAIPURO POS — PLAN MAESTRO DE IMPLEMENTACIÓN

> Documento de referencia para cualquier IA o desarrollador que trabaje en este sistema.
> Última actualización: 2026-03-02
> Estado: Fase de Hibridación Supabase EN PROCESO (Fase 6 adelantada).

---

## 1. CONTEXTO DEL PROYECTO

**Nombre:** Sistema de Gestión Comercial — Automotores Guaicaipuro C.A.
**Stack:** React 18 + Vite + Zustand + Dexie.js (IndexedDB) + Supabase (Nube) + Tailwind CSS
**Almacenamiento:** Híbrido "Offline-First". Dexie.js (Velocidad/Local) + Supabase (Nube/Backup/Auditoría).
**Tema visual actual:** Slate-900 Command Center (Premium).

---

## 2. ESTRUCTURA ACTUAL DE ARCHIVOS

```
src/
├── main.jsx
├── App.jsx
├── router.jsx                         ← 14 rutas registradas
├── index.css                          ← Variables CSS + clases Tailwind custom
├── store/useStore.js                  ← Zustand: tasa, carrito, toasts, admin
├── db/
│   ├── db.js                          ← Dexie v4, 13 tablas, helpers
│   └── seed_data.js                   ← ~680 productos reales (35k líneas)
├── utils/
│   ├── format.js                      ← fmtUSD, fmtBS, fmtDate, today, isVencido
│   └── print.js                       ← printNota, printCotizacion, printReporte
├── components/
│   ├── Layout/
│   │   ├── Layout.jsx
│   │   ├── Header.jsx                 ← Tasa BCV editable por cualquiera
│   │   ├── NavTop.jsx                 ← Menú desktop
│   │   └── NavBottom.jsx              ← Menú mobile + drawer
│   └── UI/
│       ├── Modal.jsx
│       ├── Toast.jsx
│       ├── Confirm.jsx
│       └── AdminModal.jsx             ← Solo pide clave admin
└── pages/
    ├── Dashboard/index.jsx            ← KPIs + gráficos Recharts (colores VIEJOS aún)
    ├── Facturacion/index.jsx          ← Carrito + venta + demo lock
    ├── Cotizaciones/index.jsx
    ├── Inventario/index.jsx           ← CRUD completo + ajuste stock
    ├── Clientes/index.jsx
    ├── Proveedores/index.jsx
    ├── CuentasCobrar/index.jsx        ← Cobro total (no parcial)
    ├── CuentasPagar/index.jsx         ← Pago total (no parcial)
    ├── Devoluciones/index.jsx         ← Inventario/Merma toggle
    ├── CajaChica/index.jsx
    ├── CierreDia/index.jsx            ← Básico, sin apertura
    ├── Reportes/index.jsx             ← 4 tabs, sin utilidad
    ├── Admin/index.jsx                ← Backup/restore + clave
    └── Planes/index.jsx
```

---

## 3. SCHEMA DEXIE ACTUAL (v4)

```js
articulos:     '++id, codigo, referencia, descripcion, marca, departamento, sub_depto, stock, precio, costo, proveedor, unidad'
clientes:      '++id, rif, nombre'
proveedores:   '++id, rif, nombre'
ventas:        '++id, nro, fecha, cliente_id, tipo_pago, estado'
venta_items:   '++id, venta_id'
cotizaciones:  '++id, nro, fecha, cliente_id'
cot_items:     '++id, cot_id'
ctas_cobrar:   '++id, venta_id, cliente_id, estado, vencimiento'
ctas_pagar:    '++id, proveedor_id, estado, vencimiento'
devoluciones:  '++id, venta_id, fecha'
dev_items:     '++id, devolucion_id'
caja_chica:    '++id, fecha, tipo'
cierre_dia:    '++id, fecha'
config:        'clave'
```

**Config seeds on ready:** `tasa_bcv`, `nro_nota`, `nro_cot`, `clave_admin`

---

## 4. DIAGNÓSTICO — ESTADO REAL DE CADA MÓDULO

### 4.1 Facturación (`pages/Facturacion/index.jsx`)
- ❌ **BUG:** No valida stock al agregar al carrito — permite vender infinito
- ❌ **BUG:** Si stock=0 el botón `+` se deshabilita pero `addToCart` no valida internamente
- ❌ Solo 3 tipos de pago fijos: CONTADO / CREDITO / TRANSF.
- ❌ Sin IVA
- ❌ Sin descuentos
- ❌ Sin selector de vendedor
- ❌ Sin requerir apertura de caja
- ❌ La anulación de venta no existe
- ⚠️ `text-white` residual en algunos elementos (invisible sobre fondo blanco) — parcialmente limpiado

### 4.2 Inventario (`pages/Inventario/index.jsx`)
- ✅ Campo `costo` ya existe en schema y en UI
- ✅ Campos referencia, sub_depto, proveedor, unidad ya existen
- ❌ **BUG:** Campos vacíos se renderizan como string vacío — no muestra "—"
- ❌ Sin búsqueda por referencia
- ❌ Sin botón "Vender" directo
- ❌ Sin ficha técnica modal
- ❌ `text-white font-bold` en columna precio — invisible sobre fondo blanco

### 4.3 Cuentas por Cobrar (`pages/CuentasCobrar/index.jsx`)
- ❌ Solo cobra el total completo — sin abonos parciales
- ❌ Sin tabla de historial de abonos
- ❌ `text-white` en monto y modal — invisible
- ❌ `bg-red-950/20` en filas vencidas — color sucio en tema claro
- ❌ `bg-red-900/20` en alerta — color sucio

### 4.4 Cuentas por Pagar (`pages/CuentasPagar/index.jsx`)
- ❌ Solo paga el total completo — sin abonos parciales
- ❌ `text-white` en total y modal — invisible
- ❌ `bg-red-950/20` en filas vencidas

### 4.5 Cierre de Día (`pages/CierreDia/index.jsx`)
- ❌ No existe concepto de "apertura de caja"
- ❌ Cierre no valida si ya se cerró ese día (permite duplicados)
- ❌ Sin desglose por método de pago (solo contado/crédito)
- ❌ Sin cuadre de caja (sistema vs físico)
- ❌ Sin monto inicial de caja
- ❌ `text-white` en Card values — invisible
- ❌ `text-green-400`, `text-amber-400`, etc. colores raw sin usar variables

### 4.6 Devoluciones (`pages/Devoluciones/index.jsx`)
- ✅ Toggle Inventario/Merma funciona correctamente
- ✅ Registra y devuelve stock
- ❌ `text-white` en modal — invisible
- ❌ `accent-red-600` en checkboxes — debería ser azul
- ❌ No genera nota de crédito
- ❌ No afecta al cierre del día si ya se cerró

### 4.7 Reportes (`pages/Reportes/index.jsx`)
- ❌ Sin columna de utilidad (precio - costo)
- ❌ `text-white` en múltiples celdas — invisible
- ❌ `hover:bg-white/5` (era para tema oscuro, no hace nada visible en claro)
- ❌ `hover:text-white` en tabs — invisible
- ❌ `bg-amber-900/30`, `bg-green-900/30` badges — colores oscuros en tema claro
- ❌ `bg-red-900/40`, `bg-orange-900/40`, `bg-green-900/40` en stock badges — oscuros
- ❌ `from-rojo/20 to-black` gradiente en info box — negro sobre claro

### 4.8 Dashboard (`pages/Dashboard/index.jsx`)
- ❌ **CRÍTICO:** Paleta de colores COMPLETAMENTE desactualizada (usa `#d97706`, `#92400e`, `#fbbf24`, `#0a0a0a` — tema viejo amber/negro)
- ❌ `text-white` en KPI y tooltips — invisible
- ❌ Los gráficos Recharts usan colores hardcoded del viejo tema

### 4.9 Admin (`pages/Admin/index.jsx`)
- ❌ `bg-amber-900/20 border-amber-700 text-amber-400` alerta — colores viejos
- ❌ `text-white` en info del sistema — invisible
- ❌ `text-red-400` en limpiar — debería ser `text-rojo`

### 4.10 Store (`store/useStore.js`)
- ❌ Sin flag de caja abierta/cerrada
- ❌ Sin usuario activo / rol
- ❌ `addToCart` no valida stock disponible

### 4.11 Impresión (`utils/print.js`)
- ❌ `border-bottom: 2px solid #dc2626` en printReporte — color viejo rojo
- ❌ `color: #dc2626` en título reporte — color viejo
- ❌ Sin función printNotaTermica (papel 7.6cm)
- ❌ Sin función de etiquetas

---

## 5. COLORES RESIDUALES DEL TEMA VIEJO (LIMPIAR)

Estos patrones aparecen en archivos que aún no se han limpiado:

| Patrón | Aparece en | Reemplazar por |
|---|---|---|
| `text-white` (texto sobre fondo claro) | Dashboard, Reportes, CuentasCobrar, CuentasPagar, CierreDia, Devoluciones, Admin, Inventario | `style={{color:'#201f1e'}}` o `style={{color:'#323130'}}` |
| `hover:bg-white/5` | Reportes | `hover:bg-blue-50` o eliminar |
| `hover:text-white` | Reportes tabs | `hover:text-rojo` |
| `bg-red-950/20` | CuentasCobrar, CuentasPagar | `bg-red-50` o `style={{background:'#fde7e9'}}` |
| `bg-red-900/20` | CuentasCobrar alerta | `style={{background:'#fde7e9'}}` |
| `bg-amber-900/30` | Reportes badges | Usar clases `badge-y` |
| `bg-green-900/30` | Reportes badges | Usar clases `badge-g` |
| `bg-red-900/40`, `bg-orange-900/40`, `bg-green-900/40` | Reportes stock | Usar clases `badge-r`, `badge-y`, `badge-g` |
| `bg-amber-900/20`, `text-amber-400`, `border-amber-700` | Admin alerta | `style={{background:'#fff4ce', color:'#a16e00', borderColor:'#ffe389'}}` |
| `text-green-400` | CierreDia, Reportes | `style={{color:'#107c10'}}` |
| `text-amber-400` | CierreDia, Reportes | `style={{color:'#d97706'}}` |
| `text-red-400` | CierreDia, Reportes, CuentasCobrar, CuentasPagar, Admin | `style={{color:'#d13438'}}` |
| `text-blue-400` | CierreDia, Reportes | `style={{color:'#0078d4'}}` |
| `text-orange-500` | Reportes | `style={{color:'#d97706'}}` |
| `from-rojo/20 to-black` | Reportes info box | `bg-blue-50 border-rojo` |
| `accent-red-600` | Devoluciones checkboxes | `accent-blue-600` o `accent-[#0078d4]` |
| Colores DASHBOARD hardcoded | Dashboard COLORS obj | Rehacer con paleta azul/blanco |
| `#dc2626` | print.js | `#0078d4` |
| `shadow-[0_0_8px_rgba(...)]` glow effects | Reportes barras | Eliminar o suavizar |

---

## 6. PLAN DE IMPLEMENTACIÓN POR SESIONES

### ═══════════════════════════════════════════
### SESIÓN 1 — LIMPIEZA VISUAL + BUGS CRÍTICOS
### ═══════════════════════════════════════════
**Archivos a tocar: ~10** | **Riesgo: bajo** | **Dependencias: ninguna**

#### PASO 1.1 — Limpiar colores residuales tema oscuro
**Archivos:** Dashboard, Reportes, CierreDia, CuentasCobrar, CuentasPagar, Devoluciones, Admin, Inventario
**Acción:** Reemplazar todos los patrones de la tabla de §5 con los colores correctos del tema Windows.
**Prioridad en este orden:**
1. `Dashboard/index.jsx` — el más roto (paleta COLORS completa incorrecta)
2. `Reportes/index.jsx` — muchos text-white y badges raw
3. `CierreDia/index.jsx` — text-white en Cards
4. `CuentasCobrar/index.jsx` — text-white + bg-red-950
5. `CuentasPagar/index.jsx` — text-white + bg-red-950
6. `Devoluciones/index.jsx` — text-white + accent-red
7. `Admin/index.jsx` — amber alert + text-white
8. `Inventario/index.jsx` — text-white en precio
9. `utils/print.js` — #dc2626 → #0078d4

#### PASO 1.2 — BUG: Campos vacíos en inventario
**Archivo:** `pages/Inventario/index.jsx`
**Acción:** En cada `<td>` que muestra campo de artículo, usar:
```jsx
{a.referencia?.trim() || '—'}
```
Aplicar a: referencia, marca, departamento, sub_depto, proveedor, ubicacion.

#### PASO 1.3 — BUG: Validación de stock en carrito
**Archivos:** `store/useStore.js`, `pages/Facturacion/index.jsx`
**Acción en `addToCart`:**
```js
addToCart: (art, qty = 1) => {
  const cart = get().cart
  const existing = cart.find(i => i.id === art.id)
  const currentInCart = existing ? existing.qty : 0
  const stockDisponible = (art.stock ?? 0) - currentInCart

  if (stockDisponible <= 0) {
    // Requiere autorización supervisor → set flag pendiente
    get().toast('⚠️ Stock insuficiente — requiere autorización', 'warn')
    return false
  }

  // ...resto igual
}
```
**Nota:** La validación con clave de supervisor se implementará en Fase 2 (requiere SupervisorModal). Por ahora solo bloquear.

#### PASO 1.4 — BUG: Responsividad
**Archivo:** `src/index.css`
**Revisar:**
- `min-width: 1200px` en `table` (línea 225) — esto fuerza scroll en TODAS las tablas. Es correcto para inventario pero excesivo para tablas simples.
- **Solución:** Mover `min-width: 1200px` a una clase específica `.tabla-inventario` y usar `min-width: 600px` como default para el `table` general.

**VERIFICACIÓN al final de Sesión 1:**
- [ ] Abrir cada página y verificar que NO hay texto invisible
- [ ] Dashboard muestra colores azules/blancos
- [ ] Agregar producto con stock 0 → toast de error
- [ ] Campos vacíos en inventario muestran "—"
- [ ] Las tablas no fuerzan zoom out en pantallas normales

---

### ═══════════════════════════════════════════
### SESIÓN 2 — APERTURA/CIERRE + PAGOS MULTIMONEDA
### ═══════════════════════════════════════════
**Archivos a tocar: ~6** | **Riesgo: medio** | **Dependencia: Sesión 1**

#### PASO 2.1 — Schema Dexie v5 (nuevas tablas y campos)
**Archivo:** `db/db.js`
**Acción:** Incrementar a `db.version(5)` y agregar:
```js
// Tablas nuevas
apertura_caja:  '++id, fecha, hora_apertura, monto_inicial, usuario, estado'
abonos:         '++id, cuenta_id, tipo_cuenta, monto, fecha, metodo_pago, notas'
vendedores:     '++id, nombre, codigo, activo'

// Campos nuevos en ventas (no necesita cambiar schema de Dexie,
// solo asegurar que el objeto guarda los nuevos campos):
// pagos (JSON string) → array de { metodo, monto, referencia }
// vendedor_id, vendedor_nombre
// iva_aplicado (boolean), iva_pct, subtotal, iva_monto
// descuento_pct, descuento_monto
```

**Config seeds nuevas:** `clave_supervisor`, `iva_pct` (16), `metodos_pago` (JSON array), `tasa_fecha`

**⚠️ REGLA CRÍTICA:** Siempre incrementar la versión de Dexie. Nunca modificar una versión existente. Campos nuevos en objetos existentes NO requieren cambio de schema si no son índices.

#### PASO 2.2 — Apertura de Caja
**Archivos:** `pages/CierreDia/index.jsx`, `store/useStore.js`
**Concepto:**
- Al cargar la app, verificar si existe apertura activa para hoy
- Si no hay → mostrar botón "ABRIR CAJA" prominente
- Al abrir: registrar `{ fecha, hora_apertura, monto_inicial, usuario: 'admin', estado: 'ABIERTA' }`
- En useStore agregar: `cajaAbierta: false`, `loadCajaEstado()`, `abrirCaja()`, `cerrarCaja()`
- En Facturación: si `!cajaAbierta` → bloquear con mensaje

**Reglas de cascada:**
- No se puede abrir sin cerrar el día anterior (verificar `cierre_dia` del día anterior)
- Excepción: si es el primer uso, no hay cierre anterior → permitir
- Si se fue la luz y no cerró → mostrar alerta pero permitir abrir con clave supervisor

#### PASO 2.3 — Pagos Multimoneda
**Archivos:** `pages/Facturacion/index.jsx`, `db/db.js` (config)
**Concepto:**
- Reemplazar los 3 botones CONTADO/CREDITO/TRANSF. por sistema de pagos combinados
- Métodos por defecto:
  ```js
  ['Efectivo USD', 'Efectivo BS', 'Pago Móvil', 'Punto de Venta', 'Transferencia', 'Crédito']
  ```
- UI: Toggle para seleccionar métodos activos + campo de monto para cada uno
- Los pagos se almacenan como JSON string en `ventas.pagos`
- `tipo_pago` se mantiene como campo retro-compatible (el primer método seleccionado)
- Si incluye "Crédito" → genera cta_cobrar igual que antes
- Validar: suma de montos de pago ≥ total factura

#### PASO 2.4 — Cierre de Día mejorado
**Archivo:** `pages/CierreDia/index.jsx`
**Concepto:**
- Solo se puede cerrar si hay apertura activa
- Desglosar por método de pago (parsear `ventas.pagos` JSON)
- Registrar hora de cierre
- Marcar apertura como `estado: 'CERRADA'`
- No permitir duplicar cierre del mismo día
- El cierre queda INMUTABLE una vez registrado

**VERIFICACIÓN al final de Sesión 2:**
- [ ] Abrir caja → registra en DB
- [ ] Intentar facturar sin abrir caja → bloqueado
- [ ] Facturar con pagos combinados (ej: 50 USD + Pago Móvil 100)
- [ ] Cerrar día → muestra desglose por método
- [ ] Intentar cerrar de nuevo → impedido

---

### ═══════════════════════════════════════════
### SESIÓN 3 — ABONOS + IVA + DESCUENTOS + TASA PROTEGIDA
### ═══════════════════════════════════════════
**Archivos a tocar: ~6** | **Riesgo: medio** | **Dependencia: Sesión 2**

#### PASO 3.1 — Clave supervisor (componente reutilizable)
**Crear:** `components/UI/SupervisorModal.jsx`
**Concepto:** Idéntico a AdminModal pero usando `clave_supervisor` en config.
- En useStore: `supervisorCb`, `askSupervisor(cb)`, `clearSupervisor()`
- Uso: `askSupervisor(() => { /* acción protegida */ })`

#### PASO 3.2 — Tasa del día protegida
**Archivos:** `components/Layout/Header.jsx`, `store/useStore.js`
**Concepto:**
- Input de tasa → `readOnly` por defecto
- Al hacer click → llama `askSupervisor()`
- Si autorizado → quitar readOnly temporalmente
- Guardar `tasa_fecha` junto con `tasa_bcv`
- Si `tasa_fecha !== hoy` → mostrar icono ⚠️ "Tasa desactualizada"

#### PASO 3.3 — Abonos parciales (Cuentas por Cobrar)
**Archivo:** `pages/CuentasCobrar/index.jsx`
**Concepto:**
- Botón "ABONAR" abre modal con campo de monto
- Registrar abono en tabla `abonos`: `{ cuenta_id, tipo_cuenta: 'cobrar', monto, fecha, metodo_pago }`
- En la tabla mostrar: Monto original | Abonado | Saldo pendiente
- Saldo = monto_original - SUM(abonos donde cuenta_id)
- Si saldo ≤ 0 → cambiar estado a 'COBRADA' automáticamente
- El modal actual de "COBRAR" se convierte en modal de "ABONAR"

#### PASO 3.4 — Abonos parciales (Cuentas por Pagar)
**Archivo:** `pages/CuentasPagar/index.jsx`
**Concepto:** Mismo que 3.3 pero con `tipo_cuenta: 'pagar'` y estado 'PAGADA'.

#### PASO 3.5 — IVA configurable
**Archivos:** `pages/Facturacion/index.jsx`, `pages/Admin/index.jsx`
**Concepto:**
- En Admin → campo "IVA %" (default 16)
- En Facturación → checkbox "Aplicar IVA"
- Si activo: subtotal, IVA (subtotal × %), total_con_iva
- En la venta guardar: `iva_aplicado`, `iva_pct`, `subtotal`, `iva_monto`, `total` (con IVA)
- En impresión: desglosar IVA si aplica

#### PASO 3.6 — Descuentos
**Archivo:** `pages/Facturacion/index.jsx`
**Concepto:**
- Por item: campo de descuento % (inline en cada fila del carrito)
- Global: campo de descuento % sobre el total
- Descuento > X% (configurable, default 10%) → pide clave supervisor
- En la venta guardar: `descuento_pct`, `descuento_monto`
- En impresión: mostrar precio original tachado + precio con descuento

**VERIFICACIÓN al final de Sesión 3:**
- [ ] Cambiar tasa → pide clave supervisor
- [ ] Abonar parcialmente a cuenta por cobrar → recalcula saldo
- [ ] Saldar totalmente → cambia estado a COBRADA
- [ ] Facturar con IVA 16% → desglose correcto en impresión
- [ ] Descuento 15% → pide clave supervisor
- [ ] Descuento 5% → se aplica sin preguntar

---

### ═══════════════════════════════════════════
### SESIÓN 4 — VENDEDORES + REPORTES UTILIDAD + FICHA TÉCNICA
### ═══════════════════════════════════════════
**Archivos a tocar: ~5 + 1 nuevo** | **Riesgo: bajo** | **Dependencia: Sesión 3**

#### PASO 4.1 — CRUD Vendedores
**Crear:** `pages/Vendedores/index.jsx`
**Modificar:** `router.jsx` (agregar ruta `/vendedores`), `NavTop.jsx`, `NavBottom.jsx`
**Concepto:** Tabla con nombre, código, activo/inactivo, fecha ingreso. CRUD simple.

#### PASO 4.2 — Selector de vendedor en Facturación
**Archivo:** `pages/Facturacion/index.jsx`
**Concepto:** Dropdown de vendedores activos. El vendedor queda en la venta como `vendedor_id` y `vendedor_nombre`.

#### PASO 4.3 — Reporte de utilidad
**Archivo:** `pages/Reportes/index.jsx`
**Concepto:**
- Tab nuevo "UTILIDAD"
- Para cada venta del período: buscar los venta_items → para cada item buscar articulo → obtener costo
- Columnas: Artículo | Qty | Precio venta | Costo | Utilidad $ | Utilidad %
- Totales: Total vendido, Total costo, Utilidad bruta, Margen %
- Top productos por utilidad generada

#### PASO 4.4 — Búsqueda por referencia
**Archivos:** `pages/Facturacion/index.jsx`, `pages/Inventario/index.jsx`
**Concepto:** Agregar `a.referencia?.toLowerCase().includes(busq.toLowerCase())` al filtro existente.

#### PASO 4.5 — Botón "Vender" desde Inventario
**Archivo:** `pages/Inventario/index.jsx`
**Concepto:**
```jsx
<button className="btn btn-g btn-sm" onClick={() => {
  addToCart(a)
  navigate('/facturacion')
}}>⚡</button>
```

#### PASO 4.6 — Ficha Técnica
**Crear:** `components/UI/FichaTecnica.jsx`
**Concepto:** Modal que muestra TODOS los campos del producto con layout bonito. Accesible desde click en código de inventario y desde dropdown de facturación.

**VERIFICACIÓN al final de Sesión 4:**
- [ ] CRUD vendedores funciona
- [ ] Factura lleva vendedor asignado
- [ ] Reporte de utilidad calcula correctamente
- [ ] Buscar por referencia funciona
- [ ] Click en código abre ficha técnica

---

### ═══════════════════════════════════════════
### SESIÓN 5 — IMPRESIÓN + ETIQUETAS + ANULACIONES
### ═══════════════════════════════════════════
**Archivos a tocar: ~4** | **Riesgo: medio-alto** | **Dependencia: Sesión 4**

#### PASO 5.1 — Impresión térmica 7.6cm
**Archivo:** `utils/print.js`
**Concepto:**
- Nueva función `printNotaTermica()` separada
- 32 chars max por línea
- Sin tablas HTML — texto plano monoespaciado
- Mantener `printNota()` para carta/A4

#### PASO 5.2 — Etiquetas de productos
**Archivo:** `utils/print.js` + botón en `pages/Inventario/index.jsx`
**Concepto:**
- Selección múltiple de productos en inventario
- Generar etiquetas con: código de barras (texto), descripción, precio $, precio Bs
- Tamaños: 5×3cm, 7×4cm, 10×5cm

#### PASO 5.3 — Etiquetas de despacho
**Archivo:** `utils/print.js`
**Concepto:** Desde una venta procesada, imprimir etiqueta con datos del envío.

#### PASO 5.4 — Anulación de factura con cascada
**Archivos:** `pages/Facturacion/index.jsx` (o nueva sección), `db/db.js`
**Concepto:**
- Buscar venta por número → botón "ANULAR" (requiere clave supervisor)
- La anulación:
  1. Cambia estado de venta a 'ANULADA'
  2. Devuelve todo el stock al inventario
  3. Si tenía cuenta por cobrar → la cancela (estado 'ANULADA')
  4. Si ya hubo abonos → quedan como registro histórico
  5. Si el día ya se cerró → genera registro de AJUSTE (no modifica cierre)
  6. Registra motivo de anulación y usuario que la autorizó

**Regla de cascada — Anulación:**
```
Venta ANULADA
├── stock += qty de cada venta_item
├── cta_cobrar.estado = 'ANULADA' (si existía)
│   └── abonos previos → quedan como historial con nota "Venta anulada"
├── cierre_dia ya cerrado?
│   ├── SÍ → crear registro ajuste_cierre { fecha_cierre, motivo, monto }
│   └── NO → el cierre pendiente ya no la contará
└── vendedor estadísticas → se resta automáticamente (query filtra ACTIVAS)
```

---

### ═══════════════════════════════════════════
### SESIÓN 6 (FUTURA) — ROLES + LOGIN + SUPABASE
### ═══════════════════════════════════════════
**No implementar hasta completar sesiones 1-5**

#### Nuevos archivos:
- `pages/Login/index.jsx`
- `context/AuthContext.jsx`
- `hooks/useRole.js`

#### Roles:
| Rol | Permisos |
|---|---|
| CAJERO | Facturar (stock disponible), ver inventario (sin editar), ver sus ventas del día |
| SUPERVISOR | Todo cajero + autorizar stock negativo, tasa, devoluciones, vendedores, reportes diarios |
| ADMIN | Acceso total: reportes, costos, utilidades, configuración, backup, usuarios |

#### Supabase (posterior):
- `src/lib/supabase.js` — cliente
- `supabase/migrations/001_schema.sql` — schema PostgreSQL
- Sincronización bidireccional IndexedDB ↔ Supabase
- Auth con Supabase Auth

---

## 7. REGLAS DE CASCADA — EFECTOS ENTRE MÓDULOS

### 7.1 Facturación → Cascada completa
```
VENTA PROCESADA
├── articulos.stock -= qty (para cada item)
├── Si tipo_pago incluye CRÉDITO → crear ctas_cobrar
├── venta_items → registrar cada item
├── Si vendedor seleccionado → guardar vendedor_id
└── Contabiliza en cierre del día actual (si abierto)
```

### 7.2 Devolución → Cascada
```
DEVOLUCIÓN
├── Tipo: A_INVENTARIO
│   └── articulos.stock += qty
├── Tipo: A_MERMA
│   └── stock NO se toca
├── ventas.estado = 'DEVUELTA'
├── Si venta tenía cta_cobrar → ¿Qué pasa?
│   ├── Si cta_cobrar está PENDIENTE → cancelarla
│   └── Si cta_cobrar tiene abonos → generar nota de crédito
└── Afecta cierre del día como DEVOLUCIÓN (resta)
```

### 7.3 Abono → Cascada
```
ABONO REGISTRADO
├── abonos += registro
├── saldo_pendiente = monto_original - SUM(abonos)
├── Si saldo ≤ 0 → estado = 'COBRADA'/'PAGADA'
└── Contabiliza en cierre del día como COBRO/PAGO
```

### 7.4 Cambio de tasa → NO retroactivo
```
TASA CAMBIADA
├── Afecta SOLO facturas NUEVAS desde ese momento
├── Facturas ya emitidas mantienen su tasa original
│   (la tasa debería guardarse en cada venta)
└── En impresión usar venta.tasa, no la tasa actual
```

### 7.5 Cierre → Inmutable
```
CIERRE REGISTRADO
├── Estado: CERRADO (no se puede reabrir)
├── Si eventos posteriores afectan ese día:
│   └── Se crean registros de AJUSTE, NO se modifica el cierre
└── La apertura del día siguiente requiere cierre del anterior
```

---

## 8. NOTAS TÉCNICAS PARA LA IA IMPLEMENTADORA

1. **Dexie versión:** SIEMPRE incrementar al cambiar schema de tablas indexadas.
2. **Campos no-índice:** Se pueden agregar libremente sin cambiar versión (ej: `pagos`, `iva_aplicado`).
3. **Tema visual:** Azul/Blanco. Variables CSS en `:root`. NO usar colores hardcoded Tailwind raw como `red-950`, `amber-900`, etc. Usar las variables definidas o inline styles con los hexadecimales del tema.
4. **Valores por defecto:** Todo campo nuevo debe tener fallback → `campo ?? valorDefault`.
5. **Seed data:** El archivo `seed_data.js` ya incluye campos: codigo, referencia, descripcion, departamento, sub_depto, marca, proveedor, unidad, costo, precio, stock.
6. **after schema changes:** Recordar al usuario borrar IndexedDB del navegador: DevTools → Application → IndexedDB → Guaicaipuro_Retail → Delete database.
7. **Impresión:** Usa `window.open()` + `window.print()` — funciona offline.
8. **Recharts:** Ya instalado. Importar desde `recharts`.
9. **Testing:** `npm run dev` corre en `http://localhost:3005/`.
10. **NO se usa TypeScript** — todo es `.jsx`.

---

## 9. RESUMEN CONTEO DE CAMBIOS

| # | Cambio | Tipo | Sesión |
|---|---|---|---|
| 1 | Dashboard colores nuevos | Visual | 1 |
| 2 | Reportes text-white + badges | Visual | 1 |
| 3 | CierreDia text-white | Visual | 1 |
| 4 | CuentasCobrar text-white + red-950 | Visual | 1 |
| 5 | CuentasPagar text-white + red-950 | Visual | 1 |
| 6 | Devoluciones text-white + accent | Visual | 1 |
| 7 | Admin amber + text-white | Visual | 1 |
| 8 | Inventario text-white precio | Visual | 1 |
| 9 | print.js #dc2626 | Visual | 1 |
| 10 | Campos vacíos → "—" | Bug | 1 |
| 11 | Validar stock en addToCart | Bug | 1 |
| 12 | Responsividad min-width tablas | Bug | 1 |
| 13 | Schema Dexie v5 + tablas nuevas | Infra | 2 |
| 14 | Apertura de caja | Feature | 2 |
| 15 | Pagos multimoneda | Feature | 2 |
| 16 | Cierre de día mejorado | Feature | 2 |
| 17 | SupervisorModal | Feature | 3 |
| 18 | Tasa protegida | Feature | 3 |
| 19 | Abonos ctas cobrar | Feature | 3 |
| 20 | Abonos ctas pagar | Feature | 3 |
| 21 | IVA configurable | Feature | 3 |
| 22 | Descuentos | Feature | 3 |
| 23 | CRUD Vendedores | Feature | 4 |
| 24 | Vendedor en factura | Feature | 4 |
| 25 | Reporte utilidad | Feature | 4 |
| 26 | Búsqueda por referencia | Feature | 4 |
| 27 | Botón vender desde inventario | Feature | 4 |
| 28 | Ficha técnica | Feature | 4 |
| 29 | Impresión térmica 7.6cm | Feature | 5 |
| 30 | Etiquetas de productos | Feature | 5 |
| 31 | Etiquetas de despacho | Feature | 5 |
| 32 | Anulación de factura + cascada | Feature | 5 |
| 33 | Roles y login | Feature | 6 |
| 34 | Supabase | Feature | 6 |

**Total: 34 cambios en 6 sesiones.**
