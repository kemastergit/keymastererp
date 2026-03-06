# Mejoras Futuras y Roadmap de Keymaster ERP

Este documento sirve como registro y bitácora de ideas, funcionalidades y mejoras visuales que se desean implementar en el sistema a futuro. No son tareas inmediatas, sino un "Backlog" de visión a largo plazo para escalar el sistema.

---

## 1. Módulo de Tesorería y Cuentas Bancarias (Estilo FINA)
**Objetivo:** Separar el dinero de la caja general en múltiples "Bolsillos" o "Cuentas" físicas y digitales.
*   **Creación de múltiples cuentas:** (Ej. Caja Fuerte, Efectivo BS, Efectivo USD, Zelle, Banesco, Pago Móvil).
*   **Cobro dirigido al facturar:** Al registrar un pago en el Panel de Pago, el sistema debe exigir seleccionar a qué cuenta exacta está ingresando el dinero.
*   **Movimientos internos:** Permitir transferir saldos entre cuentas (ej. "Depositar Efectivo BS al Banco", o "Sacar de Caja Fuerte a Caja Local").
*   **Panel de Control Visual:** Tarjetas (cards) modernas y limpias mostrando el saldo en vivo de cada cuenta con sus respectivas insignias de moneda (USD/VES).

## 2. Renovación de UX/UI (Micro-interacciones y Diseño Moderno)
**Objetivo:** Modernizar la interfaz para que se sienta más "premium", interactiva y responsiva.
*   **Hover Effects y Feedbacks visuales:** Expandir los efectos de selección vistos en pruebas piloto (como el sombreado fucsia brillante, transiciones suaves y cambio de colores de texto al pasar el cursor) a TODAS las tablas de la aplicación.
*   **Rediseño de vistas de listas:** Evaluar si en algunos módulos (como selección de usuarios o catálogo en facturación) es mejor reemplazar las tablas tradicionales por grillas de "Tarjetas" (Cards) con esquinas más redondeadas y sombras pálidas.

## 3. Integración de Módulos Externos y Funciones Avanzadas (Inspiración FINA)
Basado en el análisis de flujos de trabajo de sistemas retail competitivos, se planea incorporar las siguientes dinámicas al flujo actual de Keymaster:

*   **Alertas Preventivas Inteligentes (Dashboard):** 
    *   Métricas avanzadas: Mostrar directamente "Ticket Promedio de compra" y "Órdenes Diarias".
    *   Notificaciones con 5 días de anticipación para Cuentas por Pagar/Cobrar próximas a vencer.
    *   Avisos proactivos de inventario bajo ("Stock Crítico").

*   **Gestión de Inventario Multicapa:**
    *   Múltiples "Ubicaciones" o "Sucursales" con transferencias internas de mercancía.
    *   Vínculo directo en el origen de mercancía: Si entra a crédito, que automáticamente genere la "Cuenta por Pagar" al proveedor.
    *   Compatibilidad nativa y rápida con lectores de código de barras.

*   **Configuración Avanzada de Finanzas (Bancos):**
    *   **Comisiones Bancarias Automáticas:** Configurar porcentajes de comisión por ingreso/egreso (Puntos de venta, Zelle, etc.) para que la conciliación diaria sea exacta.

*   **Facturación y Punto de Venta (POS):**
    *   Selector de "Canal de Venta" (Ej. Mayor, Detal, Taller) en el POS que ajuste las listas de precios de forma automática.
    *   **Vuelto Multimoneda Automático:** Si el cliente paga la factura de $100 con un billete de $100 y uno de $20, permitir registrar que el vuelto se entregó en Bolívares mediante Pago Móvil, calculándolo automáticamente sin usar calculadora externa.
    *   Control detallado para encender o apagar IVA/IGTF y añadir Cargos por Delivery o comisiones al vendedor.

*   **Reportes Financieros Profundos:**
    *   Gráficas comparativas de Ingresos vs Costos para visualizar la rentabilidad neta real y utilidad bruta.
    *   Cierre de caja y auditoría filtrable al milímetro (por fecha, usuario, y hora exacta/minutos).
    *   Registro separado e independiente de "Gastos Fijos" (alquiler, nómina) y "Gastos Variables".

*   **Módulo de Marketing y CRM:**
    *   Historial de comportamiento del cliente para ver sus productos favoritos y frecuencia de visita.
    *   Módulo para filtrar clientes y enviar promociones/ofertas directamente por SMS o WhatsApp integrados.
