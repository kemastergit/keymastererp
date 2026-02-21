import { create } from 'zustand'
import { getConfig, setConfig } from '../db/db'

const useStore = create((set, get) => ({
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

  addToCart: (art, qty = 1) => {
    const cart = get().cart
    const idx = cart.findIndex(i => i.id === art.id)
    if (idx >= 0) {
      const updated = [...cart]
      updated[idx] = { ...updated[idx], qty: updated[idx].qty + qty }
      set({ cart: updated })
    } else {
      set({ cart: [...cart, { ...art, qty }] })
    }
  },
  removeFromCart: (id) => set(s => ({ cart: s.cart.filter(i => i.id !== id) })),
  updateQty: (id, qty) => {
    if (qty <= 0) { get().removeFromCart(id); return }
    set(s => ({ cart: s.cart.map(i => i.id === id ? { ...i, qty } : i) }))
  },
  clearCart: () => set({ cart: [], clienteFact: '', tipoPago: 'CONTADO', vencFact: '' }),
  setTipoPago: (t) => set({ tipoPago: t }),
  setClienteFact: (v) => set({ clienteFact: v }),
  setVencFact: (v) => set({ vencFact: v }),

  cartTotal: () => {
    return get().cart.reduce((s, i) => s + (i.precio * i.qty), 0)
  },

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
}))

export default useStore
