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

  const { getSyncStatus, setSyncStatus } = (await import('../store/useStore')).default.getState()

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
        const { error: err } = await supabase.from('facturas').upsert([item.data], { onConflict: 'numero' })
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
      } else if ((item.table === 'cuentas_por_pagar' || item.table === 'ctas_pagar') && item.operation === 'DELETE') {
        const { error: err } = await supabase.from('cuentas_por_pagar')
          .delete()
          .match({ nro_factura: item.data.nro_factura, proveedor_id: item.data.proveedor_id })
        error = err
      } else if (item.table === 'compras' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('compras').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'compras' && item.operation === 'DELETE') {
        const { error: err } = await supabase.from('compras').delete().eq('id', item.data.id)
        error = err
      } else if (item.table === 'compra_items' && item.operation === 'INSERT') {
        const { error: err } = await supabase.from('compra_items').upsert([item.data], { onConflict: 'id' })
        error = err
      } else if (item.table === 'compra_items' && item.operation === 'DELETE') {
        const { error: err } = await supabase.from('compra_items').delete().eq('compra_id', item.data.compra_id)
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
      } else if (item.table === 'comisiones_config' && item.operation === 'UPSERT') {
        const payload = {
          user_id: item.data.user_id,
          tipo: item.data.tipo || item.data.commission_type,
          porcentaje: item.data.porcentaje ?? item.data.percentage,
          active: item.data.active
        }
        const { error: err } = await supabase.from('comisiones_config').upsert([payload], { onConflict: 'user_id' })
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

        if (['42P01', '42703', 'PGRST204', '23505'].includes(error.code)) {
          console.warn(`⚠️ Error conocido o duplicado detectado (${error.code}). Eliminando item de la cola: ${item.table}`)
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
export async function syncArticulosFromSupabase(isInitial = false) {
  const { setSyncStatus, toast } = (await import('../store/useStore')).default.getState()

  try {
    let allData = []
    let from = 0
    let to = 999
    let finished = false
    let totalCount = 0

    console.log("🔄 Iniciando descarga completa de inventario...")

    while (!finished) {
      setSyncStatus({
        message: 'Descargando Inventario',
        submessage: 'Obteniendo catálogo completo desde la nube...',
        progress: allData.length,
        total: totalCount > 0 ? totalCount : allData.length + 1000,
        isInitialSync: isInitial
      })

      const { data, error, count } = await supabase
        .from('articulos')
        .select('id, codigo, referencia, descripcion, marca, departamento, sub_depto, stock, precio, costo, proveedor, unidad, activo, mostrar_en_web', { count: 'exact' })
        .eq('activo', true)
        .range(from, to)

      if (error) throw error
      if (count !== null) totalCount = count

      if (data && data.length > 0) {
        allData = [...allData, ...data]
        if (data.length < 1000) finished = true
        else { from += 1000; to += 1000 }
      } else { finished = true }
    }

    if (allData.length === 0) {
      setSyncStatus(null)
      return
    }

    setSyncStatus({
      message: 'Guardando Datos',
      submessage: `Procesando ${allData.length} productos en base de datos local...`,
      progress: allData.length,
      total: allData.length,
      isInitialSync: isInitial
    })

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

    setSyncStatus({
      message: 'Sincronización Exitosa',
      submessage: `✅ ${allData.length} productos actualizados desde la nube.`,
      progress: allData.length,
      total: allData.length,
      isInitialSync: isInitial
    })

    await new Promise(r => setTimeout(r, 1500))
    console.log(`✅ Inventario sincronizado desde Supabase (${allData.length} artículos)`)
  } catch (e) {
    console.error('❌ Error syncArticulosFromSupabase:', e)
    toast(`❌ Error al sincronizar inventario: ${e.message}`, 'error')
  } finally {
    setSyncStatus(null)
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
  const { setSyncStatus } = (await import('../store/useStore')).default.getState()
  try {
    let allData = []
    let from = 0
    let to = 999
    let finished = false

    setSyncStatus({ message: 'Sincronizando Clientes', submessage: 'Actualizando directorio...', progress: 0, total: 100 })

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

    if (allData.length === 0) {
      setSyncStatus(null)
      return
    }

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
  } finally {
    setSyncStatus(null)
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
  const { setSyncStatus } = (await import('../store/useStore')).default.getState()
  try {
    let allData = []
    let from = 0
    let to = 999
    let finished = false

    setSyncStatus({ message: 'Sincronizando Proveedores', submessage: 'Trayendo datos de la nube...', progress: 0, total: 100 })

    while (!finished) {
      const { data, error } = await supabase.from('proveedores').select('*').range(from, to)
      if (error) throw error
      if (data && data.length > 0) {
        allData = [...allData, ...data]
        if (data.length < 1000) finished = true
        else { from += 1000; to += 1000 }
      } else { finished = true }
    }

    if (allData.length === 0) {
      setSyncStatus(null)
      return
    }

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
  } finally {
    setSyncStatus(null)
  }
}

// 🔹 Pull de Caja Chica (últimos 100 movimientos)
export async function syncCajaChicaFromSupabase() {
  try {
    const { data, error } = await supabase.from('caja_chica').select('*').order('created_at', { ascending: false }).limit(100)
    if (error || !data) return
    for (const m of data) {
      if (!m.id) continue
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
      if (!d.id) continue
      const items = d.dev_items || []
      const devData = { ...d }; delete devData.dev_items
      const existe = await db.devoluciones.get(d.id)
      if (!existe) {
        await db.devoluciones.add({ ...devData, fecha: new Date(devData.fecha) })
        for (const it of items) {
          if (!it.id) continue
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
        const localData = {
          user_id: user.id,
          commission_type: c.tipo || c.commission_type || 'SALES_PCT',
          percentage: c.porcentaje ?? c.percentage ?? 0,
          active: c.active ?? true
        }
        const existe = await db.comisiones_config.where('user_id').equals(user.id).first()
        if (!existe) await db.comisiones_config.add({ ...localData, id: undefined })
        else await db.comisiones_config.update(existe.id, localData)
      }
    }
    console.log(`✅ Comisiones sincronizadas: ${data.length}`)
  } catch (e) { console.warn('syncComisiones offline') }
}

// 🔹 Pull de Compras y Compra_Items desde Supabase
export async function syncComprasFromSupabase() {
  console.log('🛒 [syncCompras] Iniciando descarga de compras desde Supabase...')
  try {
    // 1. Descargar compras
    const { data: compras, error: errC } = await supabase
      .from('compras')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (errC) {
      console.error('🛒 [syncCompras] ERROR al consultar Supabase:', errC)
      throw errC
    }
    console.log('🛒 [syncCompras] Respuesta Supabase — compras:', compras?.length ?? 'null/undefined')
    if (!compras || compras.length === 0) {
      console.log('🛒 [syncCompras] No hay compras en Supabase. Abortando.')
      return
    }

    // Dexie usa ++id auto-incremental — NO podemos hacer bulkPut con el id de Supabase
    // Estrategia: insertar solo si no existe (comparando nro_factura + proveedor_id)
    const compraIdMap = {} // supabase_id → dexie local id

    for (const c of compras) {
      const existe = await db.compras
        .where('nro_factura').equals(c.nro_factura)
        .and(r => String(r.proveedor_id) === String(c.proveedor_id))
        .first()

      if (existe) {
        compraIdMap[c.id] = existe.id
      } else {
        const { id: supabaseId, ...rest } = c
        const nuevoId = await db.compras.add({
          ...rest,
          supabase_id: supabaseId,
          fecha: c.fecha || c.created_at,
          total_usd: Number(c.total_usd) || 0,
          tasa: Number(c.tasa) || 0
        })
        compraIdMap[supabaseId] = nuevoId
      }
    }

    // 2. Descargar compra_items y asociarlos al id local correcto
    const supabaseIds = compras.map(c => c.id)
    const { data: items, error: errI } = await supabase
      .from('compra_items')
      .select('*')
      .in('compra_id', supabaseIds)

    if (errI) throw errI

    if (items && items.length > 0) {
      for (const item of items) {
        const localCompraId = compraIdMap[item.compra_id]
        if (!localCompraId) continue

        const existeItem = await db.compra_items
          .where('compra_id').equals(localCompraId)
          .and(r => r.articulo_id === item.articulo_id)
          .first()

        if (!existeItem) {
          const { id: _sid, compra_id: _cid, ...itemRest } = item
          await db.compra_items.add({
            ...itemRest,
            compra_id: localCompraId,
            qty: Number(item.qty) || 0,
            costo_unit: Number(item.costo_unit) || 0,
            costo_anterior: Number(item.costo_anterior) || 0
          })
        }
      }
    }

    console.log(`✅ Compras sincronizadas desde Supabase: ${compras.length} facturas, ${items?.length || 0} ítems`)
  } catch (e) {
    console.warn('syncCompras offline:', e.message)
  }
}

// 🔹 Pull de Cuentas por Cobrar (últimos 30 días) desde Supabase
export async function syncCtasCobrarFromSupabase() {
  console.log('💳 [syncCtasCobrar] Iniciando descarga (últimos 30 días)...')
  try {
    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() - 30)
    const fechaISO = fechaLimite.toISOString()

    const { data: ctas, error } = await supabase
      .from('cuentas_por_cobrar')
      .select('*')
      .gte('fecha_emision', fechaISO)
      .order('fecha_emision', { ascending: false })

    if (error) {
      console.error('💳 [syncCtasCobrar] ERROR Supabase:', error)
      throw error
    }

    if (!ctas || ctas.length === 0) {
      console.log('💳 [syncCtasCobrar] Sin registros recientes.')
      return
    }

    let insertados = 0
    for (const c of ctas) {
      // Verificar existencia por factura_id (como venta_id en dexie) + cliente
      const existe = await db.ctas_cobrar
        .where('venta_id').equals(c.factura_id || '')
        .and(r => r.cliente === c.cliente)
        .first()

      if (!existe) {
        const { id: supabaseId, ...rest } = c
        await db.ctas_cobrar.add({
          ...rest,
          supabase_id: supabaseId,
          venta_id: c.factura_id, // Mapeo especial
          fecha: c.fecha_emision, // Mapeo especial
          monto: Number(c.monto) || 0,
        })
        insertados++
      }
    }

    console.log(`✅ Cuentas por Cobrar: ${ctas.length} traídas, ${insertados} nuevas locales.`)
  } catch (e) {
    console.warn('syncCtasCobrar offline:', e.message)
  }
}

// 🔹 Pull de Abonos (últimos 30 días) desde Supabase
export async function syncAbonosFromSupabase() {
  console.log('💸 [syncAbonos] Iniciando descarga (últimos 30 días)...')
  try {
    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() - 30)
    const fechaISO = fechaLimite.toISOString()

    const { data: abonos, error } = await supabase
      .from('abonos')
      .select('*')
      .gte('fecha', fechaISO)
      .order('fecha', { ascending: false })

    if (error) {
      console.error('💸 [syncAbonos] ERROR Supabase:', error)
      throw error
    }

    if (!abonos || abonos.length === 0) {
      console.log('💸 [syncAbonos] Sin registros recientes.')
      return
    }

    let insertados = 0
    for (const a of abonos) {
      // Verificar existencia por cuenta_id + fecha + monto
      const existe = await db.abonos
        .where('cuenta_id').equals(a.cuenta_id || '')
        .and(r => r.fecha === a.fecha && Number(r.monto) === Number(a.monto))
        .first()

      if (!existe) {
        const { id: supabaseId, ...rest } = a
        await db.abonos.add({
          ...rest,
          supabase_id: supabaseId,
          monto: Number(a.monto) || 0,
        })
        insertados++
      }
    }

    console.log(`✅ Abonos: ${abonos.length} traídos, ${insertados} nuevos locales.`)
  } catch (e) {
    console.warn('syncAbonos offline:', e.message)
  }
}

// 🔹 Pull de Cuentas por Pagar (últimos 30 días) desde Supabase [Admin Only]
export async function syncCtasPagarFromSupabase() {
  console.log('🧾 [syncCtasPagar] Iniciando descarga (últimos 30 días)...')
  try {
    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() - 30)
    const fechaISO = fechaLimite.toISOString()

    const { data: ctas, error } = await supabase
      .from('cuentas_por_pagar')
      .select('*')
      .gte('fecha', fechaISO)
      .order('fecha', { ascending: false })

    if (error) {
      console.error('🧾 [syncCtasPagar] ERROR Supabase:', error)
      throw error
    }

    if (!ctas || ctas.length === 0) {
      console.log('🧾 [syncCtasPagar] Sin registros recientes.')
      return
    }

    let insertados = 0
    for (const c of ctas) {
      // Verificar existencia local por nro_factura + proveedor_id
      const existe = await db.ctas_pagar
        .where('nro_factura').equals(c.nro_factura || '')
        .and(r => String(r.proveedor_id) === String(c.proveedor_id))
        .first()

      if (!existe) {
        const { id: supabaseId, ...rest } = c
        await db.ctas_pagar.add({
          ...rest,
          supabase_id: supabaseId,
          monto: Number(c.monto) || 0,
        })
        insertados++
      }
    }

    console.log(`✅ Cuentas por Pagar: ${ctas.length} traídas, ${insertados} nuevas locales.`)
  } catch (e) {
    console.warn('syncCtasPagar offline:', e.message)
  }
}

// 🔹 Inicializador sencillo para usar en el arranque de la app
export async function initInventorySync() {
  const { toast } = (await import('../store/useStore')).default.getState()

  await syncArticulosFromSupabase(true)
  await syncClientesFromSupabase()
  await syncProveedoresFromSupabase()
  await syncOrdenesCompraFromSupabase()
  await syncCajaChicaFromSupabase()
  await syncDevolucionesFromSupabase()
  await syncComisionesFromSupabase()
  await syncComprasFromSupabase()

  toast('🚀 SINCRONIZACIÓN INICIAL COMPLETADA', 'success')
  subscribeArticulosRealtime()

  // Sincronizaciones en Segundo Plano (No bloqueantes)
  setTimeout(async () => {
    console.log('⏱️ [Background Sync] Iniciando sincronización de 2do plano...')
    await syncCtasCobrarFromSupabase()
    await syncAbonosFromSupabase()
    await syncCtasPagarFromSupabase()
    // Aquí agregaremos cuotas crédito
  }, 3000)
}
