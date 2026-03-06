import { db } from '../db/db'
import { supabase } from '../lib/supabase'

/**
 * Agrega una operación a la cola de sincronización local
 */
export async function addToSyncQueue(table, operation, data) {
  await db.sync_queue.add({
    table,
    operation,
    data,
    status: 'PENDING',
    created_at: new Date()
  })
}

/**
 * Intenta sincronizar los elementos pendientes en la cola
 */
export async function processSyncQueue() {
  if (!supabase) {
    console.warn("🛰️ SyncManager: Supabase no está configurado. Postponiendo...")
    return 0
  }

  const pending = await db.sync_queue.where('status').equals('PENDING').toArray()
  if (pending.length === 0) return 0

  let successCount = 0

  for (const item of pending) {
    try {
      let error = null

      // Control de reintentos (Máximo 3)
      item.intentos = (item.intentos || 0) + 1
      if (item.intentos > 3) {
        console.warn(`🛑 Límite de (3) intentos superado para ${item.table}. Marcado como ERROR.`);
        await db.sync_queue.update(item.id, { status: 'ERROR', intentos: item.intentos })
        continue
      }
      await db.sync_queue.update(item.id, { intentos: item.intentos })

      // Log para depuración
      console.log(`☁️ Intentando sincronizar ${item.table} (${item.operation}) - Intento ${item.intentos}...`)

      if (item.table === 'rpc_venta' && item.operation === 'RPC') {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('procesar_venta_completa', item.data)
        if (rpcError || !rpcResult?.ok) {
          error = rpcError || { message: rpcResult?.error }
        }
      } else if (item.table === 'facturas' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('facturas').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'articulos' && item.operation === 'UPDATE_STOCK') {
        const { error: err } = await supabase.from('articulos')
          .update({ stock: item.data.stock })
          .eq('codigo', item.data.codigo)
        error = err
      } else if ((item.table === 'cuentas_por_cobrar' || item.table === 'ctas_cobrar') && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('cuentas_por_cobrar').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'abonos' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('abonos').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'auditoria' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('auditoria').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if ((item.table === 'cuentas_por_pagar' || item.table === 'ctas_pagar') && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('cuentas_por_pagar').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'compras' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('compras').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'compra_items' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('compra_items').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'cotizaciones' && item.operation === 'INSERT') {
        const payload = { ...item.data, fecha: item.data.fecha instanceof Date ? item.data.fecha.toISOString() : item.data.fecha }
        const { error: err } = await supabase.from('cotizaciones').upsert([payload], { onConflict: 'id' })
        error = err
      } else if (item.table === 'cot_items' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('cot_items').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'ordenes_compra' && item.operation === 'INSERT') {
        const payload = { ...item.data, fecha: item.data.fecha instanceof Date ? item.data.fecha.toISOString() : item.data.fecha }
        const { error: err } = await supabase.from('ordenes_compra').upsert([payload], { onConflict: 'nro' })
        error = err
      } else if (item.table === 'ordenes_compra' && item.operation === 'UPDATE_ESTADO') {
        const { error: err } = await supabase.from('ordenes_compra')
          .update({ estado: item.data.estado })
          .eq('nro', item.data.nro)
        error = err
      } else if (item.table === 'oc_items' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('oc_items').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'devoluciones' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('devoluciones').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'dev_items' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('dev_items').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'caja_chica' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('caja_chica').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'clientes' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('clientes').upsert([item.data], { onConflict: 'rif' })
        error = err
      } else if (item.table === 'proveedores' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('proveedores').upsert([item.data], { onConflict: 'rif' })
        error = err
      } else if (item.table === 'cuotas_credito' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('cuotas_credito').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'cuotas_credito' && item.operation === 'UPDATE_ESTADO') {
        const { error: err } = await supabase.from('cuotas_credito')
          .update({ estado: item.data.estado, fecha_pago: item.data.fecha_pago })
          .eq('venta_id', item.data.venta_id)
          .eq('numero_cuota', item.data.numero_cuota)
        error = err
      } else {
        console.warn(`⚠️ Tabla desconocida en SyncQueue: ${item.table}`)
        await db.sync_queue.delete(item.id)
        continue
      }

      if (!error) {
        await db.sync_queue.delete(item.id)
        successCount++
        console.log(`✅ ${item.table} sincronizado correctamente.`)
      } else {
        console.error(`❌ Error Supabase para ${item.table}:`, error)

        const { getState } = (await import('../store/useStore')).default
        getState().toast(`❌ Error Nube (${item.table}): ${error.message || 'Error desconocido'}`, 'error')

        if (['42P01', '42703', 'PGRST204'].includes(error.code)) {
          console.warn(`⚠️ Error de esquema detectado. Eliminando item conflictivo de la cola: ${item.table}`)
          await db.sync_queue.delete(item.id)
        }
      }
    } catch (e) {
      console.error(`💥 Error fatal sincronizando item ${item.id}:`, e)
    }
  }

  return successCount
}

/**
 * 📥 PULL SYNC: Descarga facturas nuevas de la nube (que no tengamos localmente)
 */
export async function pullRecentInvoices() {
  try {
    // 1. Traer solo las facturas (sin el join fallido)
    const { data: facturas, error } = await supabase
      .from('facturas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    if (!facturas) return 0

    let count = 0
    for (const f of facturas) {
      const existe = await db.ventas.where('nro').equals(f.numero).first()

      if (!existe) {
        // 2. Obtener ítems: primero desde el JSON embebido en la factura (caso RPC/celular),
        //    si no, fallback a consultar la tabla venta_items
        let itSource = []
        if (Array.isArray(f.items) && f.items.length > 0) {
          itSource = f.items
        } else {
          const { data: itNube, error: errIt } = await supabase
            .from('venta_items')
            .select('*')
            .eq('factura_id', f.id)
          if (!errIt && itNube) itSource = itNube
        }

        const localId = await db.ventas.add({
          nro: f.numero,
          fecha: new Date(f.created_at),
          cliente: f.cliente_nombre || f.cliente || 'CLIENTE GENERICO',
          total: f.total_usd,
          tipo_pago: f.tipo_pago || f.metodo_pago || 'CONTADO',
          estado: 'ACTIVA',
          vendedor: f.vendedor,
          usuario_id: f.usuario_id
        })

        if (itSource.length > 0) {
          const items = itSource.map(it => ({
            venta_id: localId,
            articulo_id: it.articulo_id || null,
            codigo: it.codigo,
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario || it.precio || 0,
            total: it.total || (it.cantidad * (it.precio_unitario || it.precio || 0))
          }))
          await db.venta_items.bulkAdd(items)
        }
        count++
      } else {
        // 🔧 AUTO-REPARACIÓN: Si la factura existe, verificar si le faltan items
        const itemsLocales = await db.venta_items.where('venta_id').equals(existe.id).count()
        if (itemsLocales === 0) {
          // No tiene items locales — intentar rescatarlos de Supabase
          let itSource = []
          if (Array.isArray(f.items) && f.items.length > 0) {
            itSource = f.items
          } else {
            const { data: itNube, error: errIt } = await supabase
              .from('venta_items').select('*').eq('factura_id', f.id)
            if (!errIt && itNube) itSource = itNube
          }
          if (itSource.length > 0) {
            const items = itSource.map(it => ({
              venta_id: existe.id,
              articulo_id: it.articulo_id || null,
              codigo: it.codigo,
              descripcion: it.descripcion,
              cantidad: it.cantidad,
              precio_unitario: it.precio_unitario || it.precio || 0,
              total: it.total || (it.cantidad * (it.precio_unitario || it.precio || 0))
            }))
            await db.venta_items.bulkAdd(items)
            count++
          }
        }
        // Reparar datos de cabecera si están incompletos
        if (!existe.cliente || existe.cliente === 'CLIENTE GENERICO' || !existe.tipo_pago) {
          await db.ventas.update(existe.id, {
            cliente: f.cliente_nombre || f.cliente || 'CLIENTE GENERICO',
            tipo_pago: f.tipo_pago || f.metodo_pago || 'CONTADO'
          })
        }
      }
    }
    return count
  } catch (e) {
    console.error("❌ Fallo crítico en PullSync:", e)
    return 0
  }
}

// 🔹 Sincronización inicial de inventario desde Supabase hacia Dexie
export async function syncArticulosFromSupabase() {
  try {
    let allData = []
    let from = 0
    let to = 999
    let finished = false

    console.log("🔄 Iniciando descarga completa de inventario...")

    while (!finished) {
      const { data, error } = await supabase
        .from('articulos')
        .select('id, codigo, referencia, descripcion, marca, departamento, sub_depto, stock, precio, costo, proveedor, unidad, activo, mostrar_en_web')
        .eq('activo', true)
        .range(from, to)

      if (error) throw error

      if (data && data.length > 0) {
        allData = [...allData, ...data]
        if (data.length < 1000) {
          finished = true
        } else {
          from += 1000
          to += 1000
        }
      } else {
        finished = true
      }
    }

    if (allData.length === 0) return

    await db.transaction('rw', db.articulos, async () => {
      await db.articulos.clear()
      await db.articulos.bulkAdd(
        allData.map(a => {
          const { id, ...rest } = a
          return {
            ...rest,
            stock: Number(a.stock) || 0,
            precio: Number(a.precio) || 0,
            costo: Number(a.costo) || 0,
          }
        })
      )
    })

    console.log(`✅ Inventario sincronizado desde Supabase (${allData.length} artículos)`)
  } catch (e) {
    console.error('❌ Error syncArticulosFromSupabase:', e)
  }
}

// 🔹 Suscripción realtime a cambios en articulos (INSERT / UPDATE)
export function subscribeArticulosRealtime() {
  const channel = supabase
    .channel('realtime-articulos')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'articulos' },
      async (payload) => {
        if (payload.eventType === 'DELETE') return
        const art = payload.new
        if (!art?.codigo) return

        const { id, ...rest } = art
        const normalized = {
          ...rest,
          stock: Number(art.stock) || 0,
          precio: Number(art.precio) || 0,
          costo: Number(art.costo) || 0,
        }

        const local = await db.articulos.where('codigo').equals(art.codigo).first()
        if (!local) {
          await db.articulos.add(normalized)
        } else {
          await db.articulos.update(local.id, normalized)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// 🔹 Pull de clientes desde Supabase hacia Dexie (con paginación)
export async function syncClientesFromSupabase() {
  try {
    let allData = []
    let from = 0
    let to = 999
    let finished = false

    while (!finished) {
      const { data, error } = await supabase
        .from('clientes')
        .select('rif, nombre, telefono, direccion, email, limite_credito')
        .range(from, to)

      if (error) throw error
      if (data && data.length > 0) {
        allData = [...allData, ...data]
        if (data.length < 1000) finished = true
        else { from += 1000; to += 1000 }
      } else { finished = true }
    }

    if (allData.length === 0) return

    for (const c of allData) {
      const existe = await db.clientes.filter(l => l.rif === c.rif).first()
      if (existe) {
        await db.clientes.update(existe.id, {
          nombre: c.nombre || existe.nombre,
          telefono: c.telefono || existe.telefono,
          direccion: c.direccion || existe.direccion,
          email: c.email || existe.email,
          limite_credito: c.limite_credito ?? existe.limite_credito ?? 0
        })
      } else {
        await db.clientes.add({
          rif: c.rif, nombre: c.nombre, telefono: c.telefono || '',
          direccion: c.direccion || '', ciudad: '',
          email: c.email || '', limite_credito: c.limite_credito || 0,
          observaciones: ''
        })
      }
    }
    console.log(`✅ Clientes sincronizados desde nube: ${allData.length}`)
  } catch (err) {
    console.error('Error pull clientes:', err)
  }
}


// 🔹 Pull de Órdenes de Compra desde Supabase
export async function syncOrdenesCompraFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('ordenes_compra')
      .select('*, oc_items(*)')
      .order('fecha', { ascending: false })
      .limit(100)

    if (error || !data) return

    for (const oc of data) {
      const items = oc.oc_items || []
      const ocData = { ...oc }
      delete ocData.oc_items

      // Buscar si ya existe localmente por nro
      const local = await db.ordenes_compra.where('nro').equals(oc.nro).first()
      if (!local) {
        const ocId = await db.ordenes_compra.add({
          ...ocData,
          fecha: new Date(ocData.fecha)
        })
        for (const item of items) {
          const itemLocal = await db.oc_items.where('oc_id').equals(ocId).and(i => i.articulo_id === item.articulo_id).first()
          if (!itemLocal) await db.oc_items.add({ ...item, oc_id: ocId, id: undefined })
        }
      } else {
        // Actualizar estado si cambió en la nube
        if (local.estado !== oc.estado) {
          await db.ordenes_compra.update(local.id, { estado: oc.estado })
        }
      }
    }
    console.log('✅ Órdenes de Compra sincronizadas desde Supabase')
  } catch (e) {
    console.warn('syncOrdenesCompra offline:', e.message)
  }
}

// 🔹 Pull de Proveedores desde Supabase (con paginación)
export async function syncProveedoresFromSupabase() {
  try {
    let allData = []
    let from = 0
    let to = 999
    let finished = false

    while (!finished) {
      const { data, error } = await supabase.from('proveedores').select('*').range(from, to)
      if (error) throw error
      if (data && data.length > 0) {
        allData = [...allData, ...data]
        if (data.length < 1000) finished = true
        else { from += 1000; to += 1000 }
      } else { finished = true }
    }

    if (allData.length === 0) return

    const existingProv = await db.proveedores.toArray()
    const rifMap = new Map(existingProv.map(p => [p.rif, p.id]))

    const finalBatch = allData.map(p => {
      if (rifMap.has(p.rif)) return { ...p, id: rifMap.get(p.rif) }
      return { ...p, id: undefined }
    })

    await db.proveedores.bulkPut(finalBatch)
    console.log(`✅ Proveedores sincronizados: ${allData.length}`)
  } catch (e) {
    console.warn('syncProveedores offline:', e.message)
  }
}

// 🔹 Pull de Caja Chica (últimos 100 movimientos)
export async function syncCajaChicaFromSupabase() {
  try {
    const { data, error } = await supabase.from('caja_chica').select('*').order('created_at', { ascending: false }).limit(100)
    if (error || !data) return
    for (const m of data) {
      const existe = await db.caja_chica.get(m.id)
      if (!existe) await db.caja_chica.add({ ...m, fecha: m.fecha })
    }
  } catch (e) { console.warn('syncCajaChica offline') }
}

// 🔹 Pull de Devoluciones desde Supabase
export async function syncDevolucionesFromSupabase() {
  try {
    const { data, error } = await supabase.from('devoluciones').select('*, dev_items(*)').order('fecha', { ascending: false }).limit(50)
    if (error || !data) return
    for (const d of data) {
      const items = d.dev_items || []
      const devData = { ...d }; delete devData.dev_items
      const existe = await db.devoluciones.get(d.id)
      if (!existe) {
        await db.devoluciones.add({ ...devData, fecha: new Date(devData.fecha) })
        for (const it of items) {
          const itExiste = await db.dev_items.get(it.id)
          if (!itExiste) await db.dev_items.add(it)
        }
      }
    }
  } catch (e) { console.warn('syncDevoluciones offline') }
}

// 🔹 Pull de Configuración de Comisiones desde Supabase
export async function syncComisionesFromSupabase() {
  try {
    const { data, error } = await supabase.from('comisiones_config').select('*')
    if (error || !data) return
    for (const c of data) {
      // Intentar vincular por nombre de usuario (nombre -> user_id en nube)
      const user = await db.usuarios.where('nombre').equals(c.user_id).first()
      if (user) {
        const existe = await db.comisiones_config.where('user_id').equals(user.id).first()
        if (!existe) await db.comisiones_config.add({ ...c, user_id: user.id, id: undefined })
        else await db.comisiones_config.update(existe.id, { ...c, user_id: user.id })
      }
    }
    console.log(`✅ Comisiones sincronizadas: ${data.length}`)
  } catch (e) { console.warn('syncComisiones offline') }
}

// 🔹 Inicializador sencillo para usar en el arranque de la app
export async function initInventorySync() {
  await syncArticulosFromSupabase()
  await syncClientesFromSupabase()
  await syncProveedoresFromSupabase()
  await syncOrdenesCompraFromSupabase()
  await syncCajaChicaFromSupabase()
  await syncDevolucionesFromSupabase()
  await syncComisionesFromSupabase()
  subscribeArticulosRealtime()
}
