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
  cartIva: () => get().ivaEnabled ? get().cartSubtotal() * 0.16 : 0,
  cartTotal: () => get().cartSubtotal() + get().cartIva(),
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
}))

export default useStore
