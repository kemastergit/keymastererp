import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { db, getConfig, setConfig } from '../db/db'
import { supabase } from '../lib/supabase'

const useStore = create(
  persist(
    (set, get) => ({
      // Usuario / Sesión
      currentUser: JSON.parse(localStorage.getItem('user_session')) || null,
      login: (user) => {
        localStorage.setItem('user_session', JSON.stringify(user))
        set({ currentUser: user })
      },
      logout: () => {
        localStorage.removeItem('user_session')
        set({ currentUser: null, activeSession: null })
        window.location.assign('/login')
      },

      // Caja / Sesión
      activeSession: null,
      loadSession: async () => {
        const user = get().currentUser
        if (!user) return

        const session = await db.sesiones_caja
          .where('estado').equals('ABIERTA')
          .and(s => s.usuario_id === user.id)
          .first()

        set({ activeSession: session || null })
      },
      // Tasa BCV (Global Realtime)
      tasa: 0,
      setTasa: async (val) => {
        const n = parseFloat(val) || 0
        set({ tasa: n })
        await setConfig('tasa_bcv', n) // Guardado local (respaldo offline)

        try {
          // Sincronización global con la Nube
          await supabase
            .from('config_global')
            .upsert({ clave: 'tasa_bcv', valor: { monto: n }, ultima_actualizacion: new Date() })
        } catch (e) {
          console.error("Error al sincronizar tasa en la nube:", e);
        }
      },
      loadTasa: async () => {
        // 1. CARGA INSTANTÁNEA (DEXIE)
        const local = await getConfig('tasa_bcv')
        const nLocal = parseFloat(local) || 0
        if (nLocal > 0) {
          set({ tasa: nLocal })
        }

        // 2. ACTUALIZACIÓN EN SEGUNDO PLANO (SUPABASE)
        try {
          const { data, error } = await supabase
            .from('config_global')
            .select('valor')
            .eq('clave', 'tasa_bcv')
            .single()

          if (!error && data?.valor?.monto) {
            const nMonto = parseFloat(data.valor.monto)
            if (nMonto !== nLocal) {
              set({ tasa: nMonto })
              await setConfig('tasa_bcv', nMonto)
            }
          }
        } catch (e) {
          console.warn("⚠️ No se pudo actualizar la tasa desde la nube, usando local.")
        }
      },
      // Bluetooth Printer State
      btStatus: 'DISCONNECTED',
      setBtStatus: (status) => set({ btStatus: status }),

      // Toast notifications
      toasts: [],
      toast: (msg, type = 'ok') => {
        const id = Date.now()
        set(s => ({ toasts: [...s.toasts, { id, msg, type }] }))
        const duration = type === 'error' ? 10000 : 3000
        setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), duration)
      },

      // Admin modal
      adminCb: null,
      askAdmin: (cb) => set({ adminCb: cb }),
      clearAdmin: () => set({ adminCb: null }),

      // Carrito de facturación
      cart: [],
      tipoPago: 'CONTADO',
      clienteFact: '',
      vencFact: '',
      payments: [], // { metodo, monto, moneda }
      ivaEnabled: false,

      addToCart: (art, qty = 1) => {
        const cart = get().cart
        const idx = cart.findIndex(i => i.id === art.id)
        const currentQtyInCart = idx >= 0 ? cart[idx].qty : 0
        const available = (art.stock || 0) - currentQtyInCart

        if (available <= 0) {
          get().toast(`❌ Sin stock disponible para ${art.descripcion}`, 'error')
          return
        }

        const qtyToAdd = Math.min(qty, available)

        if (idx >= 0) {
          const updated = [...cart]
          updated[idx] = { ...updated[idx], qty: updated[idx].qty + qtyToAdd }
          set({ cart: updated })
        } else {
          set({ cart: [...cart, { ...art, qty: qtyToAdd }] })
        }
      },
      removeFromCart: (id) => set(s => ({ cart: s.cart.filter(i => i.id !== id) })),
      updateQty: (id, qty) => {
        if (qty <= 0) { get().removeFromCart(id); return }
        const cart = get().cart
        const item = cart.find(i => i.id === id)
        if (item && qty > item.stock) {
          get().toast(`⚠️ Cantidad máxima en stock: ${item.stock}`, 'warn')
          set(s => ({ cart: s.cart.map(i => i.id === id ? { ...i, qty: item.stock } : i) }))
          return
        }
        set(s => ({ cart: s.cart.map(i => i.id === id ? { ...i, qty } : i) }))
      },
      updateItem: (id, data) => {
        set(s => ({
          cart: s.cart.map(item => item.id === id ? { ...item, ...data } : item)
        }))
      },
      clearCart: () => set({ cart: [], clienteFact: '', tipoPago: 'CONTADO', vencFact: '', payments: [], ivaEnabled: false }),
      setTipoPago: (t) => set({ tipoPago: t }),
      setClienteFact: (v) => set({ clienteFact: v }),
      setVencFact: (v) => set({ vencFact: v }),
      setIvaEnabled: (v) => set({ ivaEnabled: v }),

      addPayment: (metodo, monto, tasa, montoBS) => {
        set(s => ({
          payments: [...s.payments, {
            id: Date.now(),
            metodo,
            monto,
            tasa,
            montoBS: montoBS || (monto * tasa)
          }]
        }))
      },
      removePayment: (id) => set(s => ({ payments: s.payments.filter(p => p.id !== id) })),

      cartSubtotal: () => get().cart.reduce((s, i) => s + (i.precio * i.qty), 0),
      cartIva: () => get().ivaEnabled ? get().cartSubtotal() * (get().configEmpresa?.porcentaje_iva / 100 || 0.16) : 0,
      cartIgtf: () => {
        const config = get().configEmpresa
        if (!config?.aplicar_igtf) return 0
        const divisaPayments = get().payments.filter(p => ['EFECTIVO_USD', 'ZELLE', 'OTRO'].includes(p.metodo))
        const sumDivisa = divisaPayments.reduce((s, p) => s + p.monto, 0)
        return sumDivisa * (config.porcentaje_igtf / 100 || 0.03)
      },
      cartTotal: () => get().cartSubtotal() + get().cartIva() + get().cartIgtf(),
      paymentsTotal: () => get().payments.reduce((s, p) => s + p.monto, 0),

      // Carrito cotización
      cartCot: [],
      clienteCot: '',
      addToCotCart: (art, qty = 1) => {
        const cart = get().cartCot
        const idx = cart.findIndex(i => i.id === art.id)
        if (idx >= 0) {
          const updated = [...cart]
          updated[idx] = { ...updated[idx], qty: updated[idx].qty + qty }
          set({ cartCot: updated })
        } else {
          set({ cartCot: [...cart, { ...art, qty }] })
        }
      },
      removeFromCotCart: (id) => set(s => ({ cartCot: s.cartCot.filter(i => i.id !== id) })),
      updateCotQty: (id, qty) => {
        if (qty <= 0) { get().removeFromCotCart(id); return }
        set(s => ({ cartCot: s.cartCot.map(i => i.id === id ? { ...i, qty } : i) }))
      },
      clearCotCart: () => set({ cartCot: [], clienteCot: '' }),
      setClienteCot: (v) => set({ clienteCot: v }),
      cotTotal: () => get().cartCot.reduce((s, i) => s + (i.precio * i.qty), 0),

      // Configuración Empresa
      configEmpresa: null,
      loadConfigEmpresa: async () => {
        const config = await db.config_empresa.get('main')
        if (config) set({ configEmpresa: config })
      },
      updateConfigEmpresa: async (newConfig) => {
        await db.config_empresa.update('main', newConfig)
        set({ configEmpresa: { ...get().configEmpresa, ...newConfig } })
        get().toast('✅ Configuración actualizada', 'ok')
      },

      anularVenta: async (ventaId, motivo, supervisor) => {
        try {
          await db.transaction('rw', [
            db.ventas, db.venta_items, db.articulos,
            db.ctas_cobrar, db.abonos, db.auditoria
          ], async () => {
            const venta = await db.ventas.get(ventaId)
            if (!venta) throw new Error('Venta no encontrada')
            if (venta.estado === 'ANULADA') throw new Error('La venta ya está anulada')

            const items = await db.venta_items.where('venta_id').equals(ventaId).toArray()
            for (const item of items) {
              const art = await db.articulos.get(item.articulo_id)
              if (art) {
                await db.articulos.update(art.id, {
                  stock: (art.stock || 0) + item.qty
                })
              }
            }

            const cta = await db.ctas_cobrar.where('venta_id').equals(ventaId).first()
            if (cta) {
              await db.ctas_cobrar.update(cta.id, { estado: 'ANULADA' })
              // Anular también abonos de esa cuenta
              const abonosCta = await db.abonos.where('cuenta_id').equals(cta.id).and(a => a.tipo_cuenta === 'COBRAR').toArray()
              for (const a of abonosCta) {
                await db.abonos.update(a.id, { estado: 'ANULADA' })
              }
            }

            // Anular abonos directos de la venta (CONTADO)
            const abonosVenta = await db.abonos.where('cuenta_id').equals(ventaId).and(a => a.tipo_cuenta === 'VENTA').toArray()
            for (const a of abonosVenta) {
              await db.abonos.update(a.id, { estado: 'ANULADA' })
            }

            const updatedVenta = {
              estado: 'ANULADA',
              anulado_por: supervisor.nombre,
              motivo_anulacion: motivo,
              fecha_anulacion: new Date()
            }
            await db.ventas.update(ventaId, updatedVenta)

            const { logAction } = await import('../utils/audit')
            await logAction(supervisor, 'ANULACION', {
              table_name: 'ventas',
              record_id: ventaId,
              old_value: venta,
              new_value: { ...venta, ...updatedVenta },
              motivo
            })
          })
          get().toast(`🚫 Venta anulada exitosamente`, 'ok')
          return true
        } catch (err) {
          get().toast(`❌ Error en anulación: ${err.message}`, 'error')
          console.error(err)
          return false
        }
      },

      // Help modal
      showHelp: false,
      setShowHelp: (v) => set({ showHelp: v }),

      // UI Mobile
      hideNav: false,
      setHideNav: (v) => set({ hideNav: v }),

      // SINCRONIZACIÓN Y COLA
      pendingSyncCount: 0,
      setPendingSyncCount: (v) => set({ pendingSyncCount: v }),

      // GESTIÓN DE NOTIFICACIONES GLOBAL
      unreadOrders: 0,
      incrementUnread: () => set(s => ({ unreadOrders: s.unreadOrders + 1 })),
      clearUnread: () => set({ unreadOrders: 0 }),

      // PEDIDOS WEB (INTEGRACIÓN CATÁLOGO LOCAL / CLOUD)
      pedidosWeb: [],
      loadingPedidos: false,
      fetchPedidosWeb: async () => {
        set({ loadingPedidos: true })
        try {
          // 1. Leer pedidos locales (Dexie)
          const pedidosLocales = await db.pedidos
            .where('estado').equals('PENDIENTE')
            .reverse()
            .toArray()

          const localFull = await Promise.all(pedidosLocales.map(async (p) => {
            const items = await db.pedido_items.where('pedido_id').equals(p.id).toArray()
            const itemsDetallados = await Promise.all(items.map(async (it) => {
              const art = await db.articulos.get(it.articulo_id)
              return { ...it, descripcion: art ? art.descripcion : 'Articulo no encontrado', codigo: art ? art.codigo : '' }
            }))
            return { ...p, cliente: p.cliente_nombre, telefono: p.cliente_telefono, items: itemsDetallados, total: p.total_usd, origen: 'LOCAL' }
          }))

          // 2. Leer pedidos de la Nube (Supabase)
          const { data: cloudResults, error } = await supabase
            .from('pedidos_web')
            .select('*')
            .eq('estado', 'PENDIENTE')
            .order('created_at', { ascending: false })

          const cloudFull = await Promise.all((cloudResults || []).map(async p => {
            const itemsWithStock = await Promise.all((p.items || []).map(async it => {
              const art = await db.articulos.where('codigo').equals(it.codigo || '').first()
              return {
                ...it,
                qty: it.cantidad,
                precio: it.precio_unitario,
                descripcion: it.descripcion,
                articulo_id: it.articulo_id,
                stock: art?.stock || 0
              }
            }))
            return {
              ...p,
              cliente: p.cliente_nombre,
              telefono: p.cliente_telefono,
              items: itemsWithStock,
              total: p.total_usd,
              origen: 'CLOUD',
              fecha: p.created_at
            }
          }))

          // Unificar y ordenar por fecha (Nuevos arriba)
          const final = [...localFull, ...cloudFull].sort((a, b) => new Date(b.fecha || b.created_at) - new Date(a.fecha || a.created_at))

          set({ pedidosWeb: final })
        } catch (e) {
          console.error('Error cargando pedidos híbridos:', e)
        } finally {
          set({ loadingPedidos: false })
        }
      },
      procesarPedidoWeb: async (pedidoId) => {
        const pedido = get().pedidosWeb.find(p => p.id === pedidoId);
        if (!pedido) return;

        // Limpiar carrito actual e importar el del pedido
        get().clearCart();

        // Importar productos
        for (const item of pedido.items) {
          const art = await db.articulos.get(item.articulo_id);
          if (art) {
            get().addToCart(art, item.qty);
          }
        }

        // Cargar cliente
        if (pedido.cliente) set({ clienteFact: pedido.cliente });

        // Marcar como PROCESADO en la DB local
        await db.pedidos.update(pedidoId, { estado: 'PROCESADO' })

        get().toast(`📦 Pedido #${pedidoId} importado con éxito`, 'ok');
        set(s => ({ pedidosWeb: s.pedidosWeb.filter(p => p.id !== pedidoId) }));
      }
    }),
    {
      name: 'kemaster_retail_storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cart: state.cart,
        payments: state.payments,
        clienteFact: state.clienteFact,
        tipoPago: state.tipoPago,
        ivaEnabled: state.ivaEnabled,
        vencFact: state.vencFact,
      }),
    }
  )
)

export default useStore
