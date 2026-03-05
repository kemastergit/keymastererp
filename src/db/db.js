import Dexie from 'dexie'
import { seedArticulos } from './seed_data'

export const db = new Dexie('Guaicaipuro_Retail')

db.version(14).stores({
  articulos: '++id, codigo, referencia, descripcion, marca, departamento, sub_depto, stock, precio, costo, proveedor, unidad',
  clientes: '++id, rif, nombre',
  proveedores: '++id, rif, nombre',
  ventas: '++id, nro, fecha, cliente_id, tipo_pago, estado, usuario_id, turno_id',
  venta_items: '++id, venta_id',
  compras: '++id, nro_factura, fecha, proveedor_id, estado, total_usd',
  compra_items: '++id, compra_id',
  bajas_inventario: '++id, articulo_id, fecha, qty, motivo, usuario_id',
  cotizaciones: '++id, nro, fecha, cliente_id',
  cot_items: '++id, cot_id',
  ordenes_compra: '++id, nro, fecha, proveedor_id, estado',
  oc_items: '++id, oc_id',
  pedidos: '++id, fecha, cliente_nombre, cliente_telefono, total_usd, estado',
  pedido_items: '++id, pedido_id, articulo_id',
  ctas_cobrar: '++id, venta_id, cliente, monto, fecha, estado, vencimiento',
  ctas_pagar: '++id, proveedor, monto, fecha, estado, vencimiento',
  abonos: '++id, cuenta_id, tipo_cuenta, fecha, monto, metodo',
  devoluciones: '++id, venta_id, fecha',
  dev_items: '++id, devolucion_id',
  caja_chica: '++id, fecha, tipo',
  cierre_dia: '++id, fecha',
  sesiones_caja: '++id, fecha_apertura, estado, usuario_id',
  usuarios: '++id, &nombre, pin, rol, activo',
  auditoria: '++id, fecha, usuario_id, accion, table_name, record_id',
  comisiones_config: '++id, user_id, active',
  comisiones_log: '++id, user_id, invoice_id, period_month, period_year, paid',
  sync_queue: '++id, table, operation, status', // Bandeja de Salida
  config: 'clave',
  config_empresa: 'clave'
})

// Seed config por defecto
db.on('ready', async () => {
  // Inicializar Admin si no hay usuarios
  const userCount = await db.usuarios.count()
  if (userCount === 0) {
    await db.usuarios.add({
      nombre: 'ADMINISTRADOR',
      pin: '1234',
      rol: 'ADMIN',
      activo: true,
      fecha_creacion: new Date()
    })
    console.log('✅ Usuario Admin por defecto creado: PIN 1234')
  }

  const tasa = await db.config.get('tasa_bcv')
  if (!tasa) await db.config.put({ clave: 'tasa_bcv', valor: '' })

  const nro = await db.config.get('nro_nota')
  if (!nro) await db.config.put({ clave: 'nro_nota', valor: 1 })

  const nroCot = await db.config.get('nro_cot')
  if (!nroCot) await db.config.put({ clave: 'nro_cot', valor: 1 })

  const nroOc = await db.config.get('nro_oc')
  if (!nroOc) await db.config.put({ clave: 'nro_oc', valor: 1 })

  const clave = await db.config.get('clave_admin')
  if (!clave) await db.config.put({ clave: 'clave_admin', valor: 'admin123' })

  // Inicializar Configuración de Empresa
  const configEmpresa = await db.config_empresa.get('main')
  if (!configEmpresa) {
    await db.config_empresa.put({
      clave: 'main',
      nombre: 'AUTOMOTORES GUAICAIPURO C.A.',
      rif: 'J-12345678-9',
      direccion1: 'Sector Los Lagos, Av. Principal',
      direccion2: 'Los Teques, Edo. Miranda',
      telefonos: '0212-3214455 / 0412-1234567',
      email: 'contacto@guaicaipuro.com',
      mensaje_bienvenida: '¡Bienvenido a Automotores Guaicaipuro!',
      mensaje_pie: '¡Gracias por su compra! Conserve su ticket.',
      aplicar_iva: true,
      porcentaje_iva: 16,
      mostrar_tasa: true,
      auto_imprimir: false,
      copias_ticket: 1,
      moneda_principal: 'USD',
      papel_bt: '58mm',
      aplicar_igtf: false,
      porcentaje_igtf: 3,
      comisiones_habilitadas: false,
      ticker_mostrar_stock: true,
      ticker_mostrar_deudas: true,
      ticker_mostrar_cobranzas: true,
      ticker_mensaje_personalizado: '',
      ticker_velocidad: 40
    })
  }

  // Carga de inventario inicial desde Excel (si está vacío)
  const count = await db.articulos.count()
  if (count === 0) {
    console.log('Poblando inventario inicial con ' + seedArticulos.length + ' productos...')
    await db.articulos.bulkAdd(seedArticulos)
    console.log('¡Inventario cargado con éxito!')
  }

  // Asegurar producto VARIOS
  const varios = await db.articulos.where('codigo').equals('000').first()
  if (!varios) {
    await db.articulos.add({
      codigo: '000',
      descripcion: 'PRODUCTO VARIOS / GENERICO',
      marca: 'VARIOS',
      departamento: 'VENTAS',
      precio: 0,
      stock: 99999,
      unidad: 'UNI'
    })
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
