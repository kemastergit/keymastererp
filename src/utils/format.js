export const fmtUSD = (n) =>
  '$ ' + (parseFloat(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const fmtBS = (n, tasa) => {
  const amount = tasa !== undefined ? (parseFloat(n) || 0) * (parseFloat(tasa) || 0) : (parseFloat(n) || 0)
  return 'Bs ' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export const fmtDate = (d) => {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const today = () => new Date().toISOString().split('T')[0]

export const isVencido = (fecha) => {
  if (!fecha) return false
  return new Date(fecha) < new Date()
}
