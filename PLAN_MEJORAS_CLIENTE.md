# Plan de Implementación de Mejoras (Requerimientos del Cliente)

Este documento es una orden estricta de ejecución paso a paso para mejorar la experiencia del ERP (automatización, búsqueda de productos y ventas a crédito/kachea), priorizando no romper módulos existentes y avanzando por fases aseguradas.

---

## FASE 1 — BÚSQUEDA (Sin tocar lógica de ventas)

**PASO 1A — Stock visible en sugerencias:**
* Archivo: componente buscador de productos.
* Agregar columna `Stock` y `Marca` en la lista de resultados.
* Solo UI, no modificar BD.

**PASO 1B — Navegación con teclado:**
* Mismo archivo del buscador.
* Agregar evento `onKeyDown` con flechas arriba/abajo para moverse por la lista de sugeridos.
* Tecla `Enter` para seleccionar el producto.
* Solo eventos de teclado.

**PASO 1C — Búsqueda multivariable:**
* Instalar librería: `npm install fuse.js`
* Reemplazar el `filter` JS actual por Fuse.js configurado para buscar en: `descripcion` + `marca` + `referencia`.
* Solo alterar el buscador, nada más.

> ⚠️ **RESTRICCIÓN FASE 1:**
> * No tocar `Facturacion/index.jsx`
> * No tocar `syncManager.js`
> * No tocar Supabase
> * Solo limitar cambios al componente de búsqueda.

---

## FASE 2 — INVENTARIO VISUAL (Sin tocar ventas)

**PASO 2A — Acciones rápidas inline:**
* Archivo: `Inventario/index.jsx` (o vista principal de inventario).
* Agregar botones rápidos de **Editar** y **Ajustar Stock** directamente en la fila de cada producto de la tabla.
* Mostrar opción solo si el usuario es `Admin`.
* Sin crear modales nuevos, reutilizar los preexistentes pasándoles la data por prop/estado.

> ⚠️ **RESTRICCIÓN FASE 2:**
> * No crear módulos nuevos.
> * Usar los modales exactos que ya existen.
> * Solo el rol Admin tiene visibilidad de esos botones rápidos.

---

## FASE 3 — ETIQUETAS AUTOMÁTICAS

**PASO 3A — Verificar impresión actual:**
* Levantar diagnóstico: ¿Cómo funciona hoy la impresión? ¿Es Bluetooth, impresora térmica normal ESC/POS, o diálogo de Windows?
* *Nota para el sistema/agente:* Responder esto antes de tocar el código de etiquetas.

**PASO 3B — Trigger post-factura compra:**
* En el submódulo de entrada de inventario/factura de compra: cuando se acepta y guarda exitosamente la factura, disparar función de impresión automática de N etiquetas, donde N = suma de la cantidad de productos ingresados (o de los mapeados).

> ⚠️ **RESTRICCIÓN FASE 3:**
> * Completamente bloqueado: No tocar esto hasta que Fase 1 y Fase 2 estén fusionadas, probadas y funcionando en producción/piloto.

---

## FASE 4 — CRÉDITO CON CUOTAS (Kachea-like)

**PASO 4A — Diseño primero:**
* Elaborar un mockup visual o borrador del diseño del calendario de cuotas (antes de escribir la lógica).
* El cliente debe aprobar el diseño y flujo de pantalla.

**PASO 4B — Módulo de cuotas:**
* En el checkout de facturación, al seleccionar "Pago a Crédito":
  * Pedir Monto Inicial (Abono).
  * Calcular automáticamente e insertar las N cuotas restantes.
  * Conectar e inyectar esta data con el módulo de Cuentas por Cobrar (CxC) ya existente.

**PASO 4C — Alertas de vencimiento:**
* Notificación proactiva (Toast/Alert) al hacer login al sistema o abrir el dashboard, indicando si existen cuotas/pagos vencidos ese día.

> ⚠️ **RESTRICCIÓN FASE 4:**
> * Por su alta complejidad y riesgo (impacta dinero y cartera de clientes), no iniciar hasta que Fases 1, 2 y 3 estén 100% completas y el cliente las haya validado iterativamente.
