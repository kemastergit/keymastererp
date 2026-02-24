# 📋 INSTRUCCIONES DE SESIÓN — KEMASTER POS
## Protocolo de trabajo para esta conversación
> Leer COMPLETO antes de escribir cualquier línea de código

---

## 🔴 ANTES DE EMPEZAR — LEE ESTO

Trabajamos en un sistema React + Vite llamado **KEMASTER POS v2.4.0**
para **Automotores Guaicaipuro C.A.**

Hemos recibido tu auditoría del sistema y la valoramos.
Sin embargo, necesitamos que sigas un protocolo estricto
antes de proponer o ejecutar cualquier cambio.

---

## ✅ RECONOCEMOS LO QUE YA FUNCIONA

Confirmamos que los siguientes módulos están operativos
y NO deben ser tocados bajo ninguna circunstancia:

```
✅ Gestión de Estantes / Ubicación de productos
✅ Cálculo de IGTF 3% (motor en useStore.js)
✅ Utilidad Bruta en Dashboard (KPI base)
✅ Branding KEMASTER completo
✅ Sistema de Roles y PIN (Fases 1-4)
✅ Apertura y Cierre de Caja X/Z (Fase 3)
✅ Impresión térmica básica (Fase 5)
✅ Navegación y layout de 3 columnas en Ventas
```

---

## ⚠️ PROTOCOLO OBLIGATORIO ANTES DE CUALQUIER CAMBIO

### REGLA #1 — PROHIBIDO REESCRIBIR
```
❌ NO reescribas archivos completos
❌ NO refactorices código que ya funciona
❌ NO cambies nombres de funciones existentes
❌ NO muevas archivos de lugar
❌ NO cambies la estructura de carpetas
❌ NO cambies el diseño visual (colores, fuentes, layout)
```

### REGLA #2 — CIRUGÍA, NO TRASPLANTE
```
✅ Modifica SOLO las funciones específicas que se te indiquen
✅ Agrega código NUEVO sin borrar el existente
✅ Extiende la DB con campos nuevos, no reemplaces los actuales
✅ Muestra exactamente qué líneas cambias y por qué
✅ Si tienes dudas sobre tocar algo → PREGUNTA primero
```

### REGLA #3 — MOSTRAR ANTES DE EJECUTAR
```
Antes de modificar cualquier archivo debes mostrar:

  ARCHIVO: src/pages/Ventas/index.jsx
  FUNCIÓN: procesarNota()
  CAMBIO:  Agregar validación de IGTF visible en ticket
  LÍNEAS:  245-267 (solo estas líneas cambian)
  IMPACTO: Solo afecta el modal de confirmación de venta

Si el cambio afecta más de 1 archivo → describir TODOS
Si el cambio afecta lógica de caja → requiere aprobación explícita
```

### REGLA #4 — CONTEXTO DE NEGOCIO VENEZOLANO
```
Este sistema opera en Venezuela con estas reglas fijas:

Monedas:      USD (base) + VES (calculado con tasa BCV)
Tasa BCV:     Se actualiza manualmente cada día
              Solo Admin/Supervisor pueden cambiarla
IGTF 3%:      Aplica en USD físico, Zelle, divisas extranjeras
              NO aplica en Pago Móvil, Punto de Venta, VES
IVA 16%:      Toggle configurable por venta
Pagos:        Pueden ser mixtos (varios métodos en una venta)

NO adaptes la lógica a otros países o contextos.
```

---

## 📋 PENDIENTES APROBADOS PARA ESTA SESIÓN

Trabaja ÚNICAMENTE en lo que se te indique de esta lista.
No implementes otros módulos aunque los veas incompletos.

### PENDIENTE #1 — IGTF VISIBLE EN TICKET (ALTA PRIORIDAD)
```
Estado actual:  El IGTF se calcula en useStore.js ✅
                Pero NO aparece desglosado en el ticket impreso

Tarea:
  → Mostrar línea de IGTF en el ticket térmico
  → Formato: "IGTF (3%):    $ X.XX"
  → Solo aparece si el pago fue en USD/Zelle/divisas
  → Si el pago fue en VES/PagoMóvil → no mostrar la línea

Archivos probables a modificar:
  → src/components/Ticket/TicketTermico.jsx
  → Solo la sección de totales del ticket
```

### PENDIENTE #2 — ANULACIÓN DE NOTA (ALTA PRIORIDAD)
```
Estado actual:  No existe botón de anular

Tarea:
  → Agregar botón "🚫 ANULAR" en el historial de notas
  → Solo visible para Supervisor y Admin (ya tenemos RBAC)
  → Al anular:
      1. Pedir motivo obligatorio (modal)
      2. Requiere PIN del supervisor/admin
      3. Devolver stock al almacén principal
      4. Si era crédito → cancelar cuenta por cobrar
      5. Cambiar estado nota a ANULADA (no borrar)
      6. Restar del total de ventas del día actual
      7. Registrar en auditoría: quién, cuándo, motivo

Regla crítica:
  Las notas ANULADAS no se borran del historial
  Quedan con estado ANULADA visible en rojo
  
Archivos probables:
  → src/pages/Reportes/index.jsx (botón en tabla)
  → src/store/useStore.js (función anularNota)
  → src/db/db.js (si necesita campo estado en notas)
```

### PENDIENTE #3 — COBROS A CUENTA CORRIENTE EN CIERRE DE CAJA
```
Estado actual:  Los abonos a cuentas por cobrar se guardan
                pero no aparecen en el cierre de caja del día

Tarea:
  → En el Corte X y Corte Z incluir sección:
    "COBRANZAS DEL DÍA"
    - Lista de abonos recibidos hoy
    - Agrupados por método de pago
    - Sumados al total de ingresos del día

Fórmula correcta:
  total_ingresos_dia = ventas_contado + cobros_cartera
  
  Efectivo $ total = ventas_efectivo_usd + cobros_efectivo_usd
  PagoMóvil total  = ventas_pagoMovil  + cobros_pagoMovil

Archivos probables:
  → src/pages/Caja/index.jsx
  → src/store/useStore.js (función calcularResumenCierre)
```

---

## ❌ FUERA DE ALCANCE EN ESTA SESIÓN

Los siguientes módulos NO se tocan hoy.
Si los mencionas, ignóralos hasta nueva instrucción:

```
❌ Libro de Ventas (fiscal) → Fase futura
❌ WhatsApp de estado de cuenta → Fase futura  
❌ Gráficos del Dashboard → Fase futura
❌ Multi-almacén → Fase 6 pendiente
❌ Supabase / sincronización → Fase 7 pendiente
❌ Multi-tenant SaaS → Fase 8 pendiente
❌ Cambios de diseño o colores
❌ Cambios en el sistema de roles (ya funciona)
❌ Cambios en la impresión general (solo agregar IGTF)
```

---

## 🔒 INTEGRIDAD DE DATOS — REGLAS ABSOLUTAS

```
NUNCA se borra un registro, solo se marca inactivo o ANULADO
NUNCA se modifica un cierre Z ya ejecutado
NUNCA se permite stock negativo sin autorización de Supervisor
NUNCA se cambia la tasa BCV sin registrar en auditoría
TODO movimiento de dinero tiene justificación
TODO debe funcionar offline (localStorage primero)
```

---

## 📁 ESTRUCTURA DEL PROYECTO (referencia)

```
src/
├── db/
│   └── db.js                    ← Dexie/IndexedDB esquema
├── store/
│   └── useStore.js              ← Estado global Zustand
├── hooks/
│   ├── usePermiso.js            ← RBAC (NO TOCAR)
│   └── useAutorizacion.js       ← Auth rápida (NO TOCAR)
├── components/
│   ├── Layout/
│   │   ├── Header.jsx           ← (NO TOCAR)
│   │   └── Nav.jsx              ← (NO TOCAR)
│   ├── Ticket/
│   │   └── TicketTermico.jsx    ← MODIFICAR solo sección totales
│   ├── TecladoPin/              ← (NO TOCAR)
│   └── ModalAutorizacion/       ← (NO TOCAR)
├── pages/
│   ├── Login/                   ← (NO TOCAR)
│   ├── Ventas/                  ← (NO TOCAR salvo instrucción)
│   ├── Caja/                    ← MODIFICAR sección cobranzas
│   ├── Reportes/                ← MODIFICAR tabla notas (botón anular)
│   ├── Usuarios/                ← (NO TOCAR)
│   └── Config/                  ← (NO TOCAR)
└── router.jsx                   ← (NO TOCAR)
```

---

## 📐 FORMATO DE RESPUESTA ESPERADO

Cuando vayas a hacer un cambio, usa este formato:

```
📁 ARCHIVO: src/components/Ticket/TicketTermico.jsx
🎯 FUNCIÓN: renderTotales()
📝 CAMBIO: Agregar línea de IGTF condicional
⚠️  IMPACTO: Solo visual en el ticket, no afecta lógica de caja

--- CÓDIGO ANTES ---
[código actual]

--- CÓDIGO DESPUÉS ---
[código con el cambio]

--- EXPLICACIÓN ---
Se agrega una línea condicional que solo muestra el IGTF
si el método de pago incluye divisas extranjeras.
```

---

## ✅ CONFIRMACIÓN ANTES DE COMENZAR

Antes de escribir código, confirma que entendiste:

```
1. ¿Cuál es el pendiente que vamos a atacar primero?
2. ¿Qué archivos vas a modificar?
3. ¿Qué archivos NO vas a tocar?
4. ¿El cambio afecta la lógica de caja o cierre Z?
```

Espera confirmación del desarrollador antes de proceder.

---

*KEMASTER POS — Protocolo de Sesión v1.0*
*Automotores Guaicaipuro C.A. — Venezuela 2026*
*Stack: React + Vite + Tailwind + Dexie + Supabase (futuro)*
