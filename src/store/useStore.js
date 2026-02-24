import { create } from 'zustand'
import { db, getConfig, setConfig } from '../db/db'

const useStore = create((set, get) => ({
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
  // Tasa BCV
  tasa: 0,
  setTasa: async (val) => {
    const n = parseFloat(val) || 0
    set({ tasa: n })
    await setConfig('tasa_bcv', n)
  },
  loadTasa: async () => {
    const v = await getConfig('tasa_bcv')
    set({ tasa: parseFloat(v) || 0 })
  },
  // Bluetooth Printer State
  btStatus: 'DISCONNECTED',
  setBtStatus: (status) => set({ btStatus: status }),

  // Toast notifications
  toasts: [],
  toast: (msg, type = 'ok') => {
    const id = Date.now()
    set(s => ({ toasts: [...s.toasts, { id, msg, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3000)
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

  addPayment: (metodo, monto) => {
    set(s => ({ payments: [...s.payments, { id: Date.now(), metodo, monto }] }))
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

        await db.ventas.update(ventaId, {
          estado: 'ANULADA',
          anulado_por: supervisor.nombre,
          motivo_anulacion: motivo,
          fecha_anulacion: new Date()
        })

        await db.auditoria.add({
          fecha: new Date(),
          usuario_id: supervisor.id,
          accion: 'ANULACION_VENTA',
          detalles: `Venta #${venta.nro} anulada. Motivo: ${motivo}`
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
}))

export default useStore
