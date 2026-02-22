# 🗺️ Roadmap de Implementación - Sistema Guaicaipuro

Este documento detalla el plan de ataque ordenado para las mejoras y reparaciones del sistema, considerando las dependencias y efectos en cascada ("telaraña interna").

---

## 🛠️ FASE 1: Estabilidad y Correcciones (Bugs Críticos)
*Prioridad inmediata para generar confianza en el cliente.*

1.  **Control de Stock en Facturación**
    *   **Acción:** Impedir agregar al carrito si `qty > stock`.
    *   **Efecto:** Muestra alerta visual. Si se requiere vender sin stock, solicitar clave de supervisor.
2.  **Costo Unitario en Inventario**
    *   **Acción:** Asegurar que el campo `costo` en `db.js` se use correctamente y se muestre en el modal de edición/tabla.
3.  **Limpieza de Datos (Campos Vacíos)**
    *   **Acción:** Filtro `trim()` y valor por defecto `"—"` en el renderizado de tablas para evitar desorden visual.
4.  **Ajuste de Responsividad**
    *   **Acción:** Implementar `overflow-x-auto` en contenedores de tablas y revisar `min-width` críticos.

---

## 💵 FASE 2: Finanzas y Pagos (Core del Negocio)
*Modifica la estructura de datos básica de las ventas.*

5.  **Pagos Multimoneda**
    *   **Cambio:** La venta ya no tiene un solo `tipo_pago`, sino un array `pagos: [{metodo, monto}]`.
    *   **Métodos:** Efectivo $, Efectivo Bs, Pago Móvil (Banco X), Punto (Banco Y).
6.  **Abonos en Cuentas (Cobrar/Pagar)**
    *   **Cambio:** Nueva tabla `abonos`. Una cuenta puede estar `PENDIENTE`, `PARCIAL` o `PAGADA`.
    *   **Cascada:** Cada abono debe registrarse con su método de pago para el cierre de caja.
7.  **IVA Toggle en Facturación**
    *   **Acción:** Checkbox para aplicar % de IVA al total. Desglose en impresión.
8.  **Tasa del Día Protegida**
    *   **Acción:** Campo bloqueado en Header. Solo editable con clave de supervisor. Persistencia diaria.

---

## 🕒 FASE 3: Gestión de Operaciones (Apertura y Cierre)
*Control de flujo de caja y tiempos.*

9.  **Apertura y Cierre de Día (X / Z)**
    *   **Lógica:** No se puede facturar sin apertura.
    *   **Cierre:** Desglose automático por método de pago. Diferencia entre sistema y físico.
10. **Reporte de Utilidad Real**
    *   **Cálculo:** `Utilidad = (PrecioVenta - Descuento) - CostoUnitario`.
11. **Descuentos y Promociones**
    *   **Niveles:** Por item o global. Descuentos > X% requieren supervisor.

---

## 🔐 FASE 4: Roles y Seguridad
*Escalabilidad y control de personal.*

12. **Módulo de Vendedores**
    *   **Vínculo:** Cada venta debe tener un `vendedor_id`. Estadísticas de rendimiento.
13. **Sistema de Roles (RBAC)**
    *   **Niveles:** Cajero (Ventas/Stock), Supervisor (Precios/Tasas/Anulaciones), Admin (Todo).
14. **Claves de Autorización**
    *   **Trigger:** Eliminar items del carrito, vender en negativo, anular facturas.

---

## 🖨️ FASE 5: Logística e Impresión
*Finalización de la experiencia de usuario.*

15. **Impresión Térmica 7.6cm**
    *   **Optimización:** Formato texto plano (sin tablas HTML pesadas) para mayor rapidez.
16. **Módulo de Etiquetas**
    *   **Generación:** Códigos de barras/QR para productos y etiquetas de despacho para logística.

---

## 🕸️ Lógica de "Telaraña" (Cascadas Críticas)

A continuación, se definen los comportamientos esperados ante acciones complejas:

| Acción | Efecto en Stock | Efecto en Caja (Cierre) | Efecto en Deudas |
| :--- | :--- | :--- | :--- |
| **Anular Factura** | Reingresa al inventario. | Resta del total del día (si fue hoy). | Elimina la Cta. por Cobrar asociada. |
| **Devolución Parcial** | Seleccionable (Inventario o Merma). | Genera Egreso de Caja o Nota de Crédito. | Ajusta el saldo si era a crédito. |
| **Abono Recibido** | N/A | Suma al método de pago específico. | Reduce "Saldo Pendiente" de la cuenta. |
| **Eliminar Item (Venta)** | N/A (aún no salía). | N/A | Recalcula totales/IVA inmediatamente. |

---

## 🚀 Próximos Pasos Sugeridos
1.  **Migración de Schema (Dexie):** Preparar la versión 5 de la DB para soportar `pagos` como array y nuevos campos de `articulos`.
2.  **Auth Context:** Implementar el manejo de usuario activo para validar roles en los botones.
3.  **Supabase (Futuro):** Una vez estabilizado localmente, migrar las tablas a Postgres para multi-dispositivo.
