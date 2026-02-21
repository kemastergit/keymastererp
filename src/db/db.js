import Dexie from 'dexie'
import { seedArticulos } from './seed_data'

export const db = new Dexie('Guaicaipuro_Retail')

db.version(4).stores({
  articulos: '++id, codigo, referencia, descripcion, marca, departamento, sub_depto, stock, precio, costo, proveedor, unidad',
  clientes: '++id, rif, nombre',
  proveedores: '++id, rif, nombre',
  ventas: '++id, nro, fecha, cliente_id, tipo_pago, estado',
  venta_items: '++id, venta_id',
  cotizaciones: '++id, nro, fecha, cliente_id',
  cot_items: '++id, cot_id',
  ctas_cobrar: '++id, venta_id, cliente_id, estado, vencimiento',
  ctas_pagar: '++id, proveedor_id, estado, vencimiento',
  devoluciones: '++id, venta_id, fecha',
  dev_items: '++id, devolucion_id',
  caja_chica: '++id, fecha, tipo',
  cierre_dia: '++id, fecha',
  config: 'clave',
})

// Seed config por defecto
db.on('ready', async () => {
  const tasa = await db.config.get('tasa_bcv')
  if (!tasa) await db.config.put({ clave: 'tasa_bcv', valor: '' })

  const nro = await db.config.get('nro_nota')
  if (!nro) await db.config.put({ clave: 'nro_nota', valor: 1 })

  const nroCot = await db.config.get('nro_cot')
  if (!nroCot) await db.config.put({ clave: 'nro_cot', valor: 1 })

  const clave = await db.config.get('clave_admin')
  if (!clave) await db.config.put({ clave: 'clave_admin', valor: 'admin123' })

  // Carga de inventario inicial desde Excel (si está vacío)
  const count = await db.articulos.count()
  if (count === 0) {
    console.log('Poblando inventario inicial con ' + seedArticulos.length + ' productos...')
    await db.articulos.bulkAdd(seedArticulos)
    console.log('¡Inventario cargado con éxito!')
  }
})

// Helpers
export async function getConfig(clave) {
  const r = await db.config.get(clave)
  return r?.valor ?? null
}

export async function setConfig(clave, valor) {
  await db.config.put({ clave, valor })
}

export async function nextNro(clave) {
  const r = await db.config.get(clave)
  const current = r?.valor ?? 1
  await db.config.put({ clave, valor: current + 1 })
  return String(current).padStart(6, '0')
}
