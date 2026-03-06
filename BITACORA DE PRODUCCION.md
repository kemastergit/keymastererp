# 📔 BITÁCORA DE PRODUCCIÓN - KEYMASTER ERP
*Control de Blindaje, Estabilidad y Despliegue de Alto Nivel*

Este documento registra la evolución técnica, hitos de desarrollo y protecciones de nivel industrial implementadas en KEYMASTER.

---

## 🚀 Fase actual: Blindaje y Resiliencia (Marzo 2026)

### [2026-03-06] - Refinamiento de Cobranza y Blindaje de Datos 💳🛡️
*   **Hito:** Interfaz de pagos más fluida y protección de integridad referencial en deudas.
*   **Cambios:**
    *   **Edición de Pagos Directa (P21):** En el modal de facturación, se habilitó el "Click to Edit". Al tocar un pago ya registrado, este se recarga en el teclado numérico para corrección inmediata de monto o método.
    *   **UI de Pagos Compacta:** Rediseño dimensional del modal de pagos. Menos padding, fuentes más precisas y ancho reducido (440px) para maximizar la velocidad visual del cajero.
    *   **Bloqueo de Borrado por Deuda (P22):** Se integró una validación bloqueante en Clientes y Proveedores. El sistema impide la eliminación si el ente posee facturas pendientes en `ctas_cobrar` o `ctas_pagar`.
    *   **Análisis de Portabilidad Local:** Auditoría de arquitectura completada para despliegue en Servidores Locales con Docker (Supabase Local Sync).

### [2026-03-04] - Control de Riesgos Restrictivo y Base de Conocimientos (FAQ) 🚦📚
*   **Hito:** Bloqueos automáticos operativos, revisión exhaustiva de permisos y puesta a punto de la documentación de ayuda (FAQ) para terminal y nube.
*   **Cambios:**
    *   **Alerta de Precios Mutables (P4):** Si la base de datos maestra cambia el precio de un artículo mientras un vendedor lo tiene en el carrito abierto, el sistema detiene la venta y muestra un aviso interactivo para actualizar los precios antes de cobrar.
    *   **Bloqueo por Límite de Crédito (P17):** Al seleccionar un cliente y método de pago CRÉDITO, el sistema suma la cuenta actual + cuenta por cobrar. Si excede el límite del cliente, lanza una alerta roja bloqueante (`LÍMITE DE CRÉDITO EXCEDIDO`).
    *   **Privilegios Refactorizados (P11/P20):** Se retiró formalmente el acceso de los roles `CAJERO` hacia los módulos de `Cuentas por Pagar` y `Compras (Proveedores)`. Ahora son módulos exclusivos de Supervisión/Admin.
    *   **Sincronización Autónoma de Clientes:** Nueva rutina `syncClientesFromSupabase()` al arrancar la app. Todas las terminales descargan y actualizan automáticamente su tabla de clientes desde Supabase, garantizando que los **Límites de Crédito** sean globales.
    *   **Integración de FAQs en "Ayuda":** 31 preguntas frecuentes operativas añadidas organizadas por Módulo (Compras, Facturación, Catálogo Web, Reportes, Cierres), validadas 1:1 contra el código fuente funcional.

### [2026-03-02] - Sincronización Híbrida y Login Dual-Core 🔐🛰️
*   **Hito:** El sistema ahora es una plataforma híbrida total (Nube/Local) con validación de seguridad en tiempo real.
*   **Cambios:**
    *   **Login Híbrido:** Validación primaria contra Supabase con fallback automático a Dexie si hay falla de red. Sincronización automática de usuarios al iniciar app.
    *   **Dual-Write Maestro:** Sincronización automática (sin botones) para Clientes, Usuarios, Abonos y Cierres Z. 
    *   **Dashboard Remoto:** Nuevo modo "Nube" para que el dueño monitoree ventas globales, utilidad y stock desde cualquier parte del mundo.
    *   **Tasa BCV Global:** Suscripción Realtime. Si se cambia la tasa en una terminal, todas las demás se actualizan al instante.
    *   **Escudo de Sobreventa:** Chequeo de stock en Supabase un milisegundo antes de facturar. Si otro vendedor vendió el último ítem, el sistema bloquea y avisa.
    *   **Radar de Deudas:** Al seleccionar un cliente, el sistema busca su saldo pendiente en la nube y muestra una alerta si tiene deuda.
    *   **Validación de Precios:** Si el precio de un artículo cambia en el inventario maestro mientras está en el carrito, el sistema avisa y permite actualizar.

### [2026-03-02] - Libros Fiscales SENIAT (Formato Legal Completo) ⚖️
*   **Hito:** Generación de documentos tributarios con formato oficial para revisión fiscal.
*   **Cambios:**
    *   **Libro de Ventas:** Impresión con Base Imponible, IVA Débito Fiscal (16%), IGTF (3%) y totalizadores. Referencia Art. 70 Ley IVA.
    *   **Libro de Compras:** Impresión con RIF proveedor, IVA Crédito Fiscal soportado y deducible. Referencia Art. 70 Ley IVA.
    *   **Libro de Inventario Valorado:** Desglose por costo de adquisición, precio de venta y margen por SKU. Valor total del activo en inventario.
    *   **Formato Premium:** Encabezado corporativo, banda Slate-900 en theads, nota legal y bloque de totales fiscales en KPI cards.

### [2026-03-02] - Unificación Visual "Command Center" en Todas las Tablas 🎨
*   **Hito:** Consistencia premium en toda la interfaz — ningún módulo queda con la estética antigua.
*   **Módulos actualizados:** Historial Compras, Devoluciones (x2), Cotizaciones, Caja Chica, Comisiones, CierreDia (x2), Inventario, Clientes, Proveedores, Usuarios, CuentasCobrar, CuentasPagar, Auditoria, Radar de Salud, Reportes.
*   **Estándar aplicado:** `bg-slate-800 text-white` + `border-r border-slate-700` + `tracking-widest` en todos los encabezados.

### [2026-03-02] - Modal Cierre Z Rediseñado (Command Center) 🏦
*   **Hito:** El informe de arqueo se convierte en un panel de control financiero de alto impacto visual.
*   **Cambios:**
    *   3 columnas: Operaciones USD (esmeralda), Operaciones BS (índigo), Arqueo Final (semáforo rojo/verde).
    *   Badge de estado automático: "CAJA CUADRADA" vs "DESCUADRE DETECTADO" con tolerancia de $0.10.
    *   Contador de facturas del período y header Slate-900 con nombre del cajero.

### [2026-03-02] - Implementación de "Bandeja de Salida" y Sincronización Asíncrona 🛰️
*   **Hito:** Eliminación de la dependencia crítica de internet durante la facturación.
*   **Cambios:**
    *   **SyncManager:** Servicio para gestionar colas de sincronización asíncronas.
    *   **Bandeja de Salida:** Tabla `sync_queue` para reintentos automáticos cada 20s.
    *   **Monitor en Header:** Indicador visual de registros pendientes por subir a la nube.
    *   **Idempotencia:** Bloqueo de UI (Loading) para evitar facturas duplicadas.

### [2026-03-02] - Fase 3: Auditoría Blindada (Seguridad Extrema en Nube) 🔐☁️
*   **Hito:** Registro inmutable de acciones críticas sincronizado en tiempo real con la nube.
*   **Cambios:**
    *   **Logs Blindados:** Al cambiar un precio, ajustar stock o anular venta, el log se sube a la Nube (Supabase) automáticamente desde la Cola de Sincronización.
    *   **Script de Inicialización Supabase (V3.0):** Auditoría completa de tablas maestras en Supabase.
        *   `articulos`: Inventario centralizado con sincronización reactiva.
        *   `facturas`: Respaldo inmutable de notas con detalles en JSONB.
        *   `pedidos_web`: Bandeja de recepción de órdenes de clientes online.
        *   `auditoria`: Registro de fraude y trazabilidad total de operaciones críticas.
    *   **RLS (Seguridad):** Desactivación temporal de RLS para facilitar la conexión directa desde los terminales de venta.
    *   **Trazabilidad de Autorización:** Se registra quién autorizó cada acción sensible con clave de Admin.
    *   **Monitor de Seguridad:** Mejora visual en "Auditoría" para detectar cambios de precio y ajustes técnicos de inventario.
    *   **Transaccionalidad ACID:** Refuerzo de operaciones atómicas en ventas y almacén para evitar inconsistencias.

### [2026-03-01] - Escudo de Errores (ErrorBoundary) y Radar Visual 🛡️
*   **Hito:** Robustez ante fallos de código y visibilidad en tiempo real.
*   **Cambios:**
    *   **Escudo:** Interfaz de recuperación ante fallos críticos (evita pantallas blancas).
    *   **Radar Pulse:** Animación verde en reportes ante nuevas ventas remotas (Supabase Realtime).
    *   **Unificación:** Mezcla de datos Dexie (locales) y Supabase (nube) en una sola vista de ventas.

---

## 🏗️ Fase: Consolidación Financiera y Gestión (Febrero 2026)

### [Febrero 2026] - Reporte de Resultados (P&L) y Categorización 📊
*   **Hito:** Visibilidad total de la rentabilidad del negocio.
*   **Cambios:**
    *   **P&L Engine:** Cálculo de Utilidad Bruta y Neta basado en ventas netas y costo de mercancía.
    *   **Egresos Categorizados:** Clasificación de gastos en alquiler, nómina, servicios, etc., para alimentar el balance financiero.
    *   **Costos Ponderados:** Sistema de cálculo automático de costo promedio al recibir nueva mercancía.

### [Febrero 2026] - Módulos Core ERP (Caja, Clientes y Comisiones) 🏦
*   **Hito:** Estructura administrativa completa.
*   **Cambios:**
    *   **Gestión de Turnos:** Apertura y cierre de caja con auditoría de arqueo (Z).
    *   **Módulo de Clientes:** Base de datos centralizada de RIF/Nombre.
    *   **Comisiones:** Sistema automático de cálculo de incentivos para vendedores por venta procesada.

### [Febrero 2026] - Movilidad y Conectividad (PWA & Bluetooth) 📱🖨️
*   **Hito:** Experiencia de app nativa y soporte físico.
*   **Cambios:**
    *   **PWA:** Transformación de la web en Aplicación Web Progresiva para instalación y carga offline.
    *   **BT Printing:** Integración con impresoras térmicas Bluetooth para impresión de tickets de 58mm/80mm.
    *   **Smart Sidebar:** Lanzamiento de la barra lateral con Tasa BCV y convertidores rápidos.

---

## 🛠️ Fase: Arquitectura y Cimientos (Enero 2026)

### [Enero 2026] - Integración Híbrida Dexie-Supabase 🛰️
*   **Hito:** Definición del modelo "Offline-First".
*   **Cambios:**
    *   Base de datos local IndexedDB para velocidad y trabajo sin internet.
    *   Conector de Supabase como respaldo maestro de seguridad en la nube.
    *   Loggers de auditoría iniciales en operaciones de factura.

---
*Documento mantenido y actualizado por el asistente Antigravity.*
