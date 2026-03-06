import { useState } from 'react'
import { db, setConfig } from '../../db/db'
import useStore from '../../store/useStore'
import { signData, verifyData } from '../../utils/security'
import { logAction } from '../../utils/audit'

export default function Admin() {
  const toast = useStore(s => s.toast)
  const [newClave, setNewClave] = useState('')
  const [confirm2, setConfirm2] = useState(false)
  const [importType, setImportType] = useState('articulos') // 'articulos' | 'proveedores' | 'clientes'

  const exportDB = async () => {
    const rawData = {
      articulos: await db.articulos.toArray(),
      clientes: await db.clientes.toArray(),
      proveedores: await db.proveedores.toArray(),
      ventas: await db.ventas.toArray(),
      venta_items: await db.venta_items.toArray(),
      cotizaciones: await db.cotizaciones.toArray(),
      cot_items: await db.cot_items.toArray(),
      ctas_cobrar: await db.ctas_cobrar.toArray(),
      ctas_pagar: await db.ctas_pagar.toArray(),
      devoluciones: await db.devoluciones.toArray(),
      caja_chica: await db.caja_chica.toArray(),
      cierre_dia: await db.cierre_dia.toArray(),
      usuarios: await db.usuarios.toArray(),
      exported_at: new Date().toISOString(),
    }

    const signature = await signData(rawData)
    const finalBackup = { data: rawData, signature }

    const blob = new Blob([JSON.stringify(finalBackup, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    const currentUser = useStore.getState().currentUser

    a.href = URL.createObjectURL(blob)
    a.download = `keymaster_backup_${new Date().toISOString().split('T')[0]}.json`
    a.click()

    logAction(currentUser, 'BACKUP_EXPORTADO', { total_articulos: rawData.articulos.length })
    toast('✅ Backup firmado y exportado correctamente')
  }

  const importDB = () => {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = '.json'
    inp.onchange = async e => {
      try {
        const text = await e.target.files[0].text()
        const package_ = JSON.parse(text)

        // Validar Firma Digital
        if (!package_.signature || !package_.data) {
          toast('❌ El archivo no tiene el formato de KEYMASTER', 'error')
          return
        }

        const isValid = await verifyData(package_.data, package_.signature)
        if (!isValid) {
          toast('🚫 ALERTA: La firma digital no coincide. El archivo fue modificado manualmente o es de otra versión.', 'error')
          const currentUser = useStore.getState().currentUser
          logAction(currentUser, 'INTENTO_IMPORTACION_FALLIDO', { motivo: 'FIRMA_INVALIDA' })
          return
        }

        const data = package_.data
        const currentUser = useStore.getState().currentUser

        // Limpiar y restaurar
        await db.transaction('rw',
          [db.articulos, db.clientes, db.proveedores, db.ventas, db.venta_items,
          db.cotizaciones, db.cot_items, db.ctas_cobrar, db.ctas_pagar,
          db.devoluciones, db.caja_chica, db.cierre_dia, db.usuarios],
          async () => {
            await db.articulos.clear(); if (data.articulos) await db.articulos.bulkAdd(data.articulos)
            await db.clientes.clear(); if (data.clientes) await db.clientes.bulkAdd(data.clientes)
            await db.proveedores.clear(); if (data.proveedores) await db.proveedores.bulkAdd(data.proveedores)
            await db.ventas.clear(); if (data.ventas) await db.ventas.bulkAdd(data.ventas)
            await db.venta_items.clear(); if (data.venta_items) await db.venta_items.bulkAdd(data.venta_items)
            await db.cotizaciones.clear(); if (data.cotizaciones) await db.cotizaciones.bulkAdd(data.cotizaciones)
            await db.cot_items.clear(); if (data.cot_items) await db.cot_items.bulkAdd(data.cot_items)
            await db.ctas_cobrar.clear(); if (data.ctas_cobrar) await db.ctas_cobrar.bulkAdd(data.ctas_cobrar)
            await db.ctas_pagar.clear(); if (data.ctas_pagar) await db.ctas_pagar.bulkAdd(data.ctas_pagar)
            await db.devoluciones.clear(); if (data.devoluciones) await db.devoluciones.bulkAdd(data.devoluciones)
            await db.caja_chica.clear(); if (data.caja_chica) await db.caja_chica.bulkAdd(data.caja_chica)
            await db.cierre_dia.clear(); if (data.cierre_dia) await db.cierre_dia.bulkAdd(data.cierre_dia)
            await db.usuarios.clear(); if (data.usuarios) await db.usuarios.bulkAdd(data.usuarios)
          }
        )

        logAction(currentUser, 'BACKUP_RESTAURADO', { total_articulos: data.articulos?.length })
        toast('✅ Backup restaurado correctamente')
        setTimeout(() => location.reload(), 1500)
      } catch (err) {
        toast('❌ Error al importar el backup', 'error')
        console.error(err)
      }
    }
    inp.click()
  }

  const clearInventory = async () => {
    if (!window.confirm('¿ELIMINAR TODO EL INVENTARIO? Esta acción borrará todos los productos pero mantendrá clientes y ventas.')) return
    await db.articulos.clear()
    toast('📦 Inventario vaciado correctamente', 'success')
    setTimeout(() => location.reload(), 1000)
  }

  const clearCloudInventory = async () => {
    if (!window.confirm('🚨 ¡ATENCIÓN! Esto borrará el inventario de la NUBE. Todas las terminales perderán sus productos al sincronizar. ¿Continuar?')) return
    const { error } = await supabase.from('articulos').delete().neq('codigo', '_')
    if (error) {
      toast('❌ Error borrando nube: ' + error.message, 'error')
    } else {
      toast('☁️ Inventario borrado en la Nube', 'success')
      await db.articulos.clear()
      toast('📦 Inventario local también limpiado', 'info')
      setTimeout(() => location.reload(), 1500)
    }
  }

  const clearAll = async () => {
    if (!confirm2) { setConfirm2(true); toast('⚠ Presiona de nuevo para confirmar', 'warn'); return }
    await db.transaction('rw',
      [db.articulos, db.clientes, db.proveedores, db.ventas, db.venta_items,
      db.cotizaciones, db.cot_items, db.ctas_cobrar, db.ctas_pagar,
      db.devoluciones, db.caja_chica, db.cierre_dia],
      async () => {
        await Promise.all([
          db.articulos.clear(), db.clientes.clear(), db.proveedores.clear(),
          db.ventas.clear(), db.venta_items.clear(), db.cotizaciones.clear(),
          db.cot_items.clear(), db.ctas_cobrar.clear(), db.ctas_pagar.clear(),
          db.devoluciones.clear(), db.caja_chica.clear(), db.cierre_dia.clear()
        ])
      }
    )
    toast('Base de datos limpiada', 'warn')
    setConfirm2(false)
    setTimeout(() => location.reload(), 1500)
  }

  const changeClave = async () => {
    if (!newClave || newClave.length < 3) { toast('Mínimo 3 caracteres', 'warn'); return }
    await setConfig('clave_admin', newClave)
    toast('✅ Clave actualizada')
    setNewClave('')
  }

  const Card = ({ title, children }) => (
    <div className="panel !rounded-[2rem] shadow-xl border-slate-100 hover:shadow-2xl transition-all duration-300">
      <div className="panel-title !border-none !pb-4 !mb-2 !text-slate-800 !font-black !tracking-tighter !text-xl uppercase">{title}</div>
      {children}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-4 pr-2 pb-10">
      <div className="bg-amber-100/50 border border-amber-200 rounded-[2rem] px-8 py-6 flex items-center gap-5 shadow-2xl relative overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
        <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/10 shrink-0">
          <span className="material-icons-round text-white text-3xl">admin_panel_settings</span>
        </div>
        <div>
          <p className="font-black text-amber-800 uppercase text-[11px] tracking-[0.2em] mb-1">ACCESO ADMINISTRATIVO RESTRINGIDO</p>
          <p className="text-[13px] font-bold text-amber-900/70 leading-relaxed uppercase tracking-tight">Área crítica. Todas las acciones aquí impactan la integridad global de los datos y la configuración del sistema.</p>
        </div>
      </div>

      <Card title="💾 Respaldo de Seguridad">
        <p className="text-xs text-slate-500 mb-4 font-medium">
          Exporta todos los datos (artículos, ventas, clientes) a un archivo JSON o restaura un backup previo de este sistema.
        </p>
        <div className="flex gap-3 flex-wrap">
          <button className="btn btn-g shadow-md" onClick={exportDB}>
            <span className="material-icons-round text-base">cloud_download</span>
            <span>Descargar Backup</span>
          </button>
          <button className="btn btn-b shadow-md" onClick={importDB}>
            <span className="material-icons-round text-base">cloud_upload</span>
            <span>Subir Backup</span>
          </button>
        </div>
      </Card>

      <Card title="🔐 Seguridad de Acceso">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">Cambiar contraseña de administrador</p>
        <div className="flex gap-2">
          <input className="inp flex-1 font-mono !py-2.5" type="password" value={newClave}
            onChange={e => setNewClave(e.target.value)}
            placeholder="Nueva clave secreta..."
            onKeyDown={e => e.key === 'Enter' && changeClave()} />
          <button className="btn btn-y font-bold" onClick={changeClave}>
            <span className="material-icons-round text-base">vpn_key</span>
            <span>Actualizar</span>
          </button>
        </div>
      </Card>

      <Card title="📊 Carga Masiva (Inventario / Proveedores)">
        <div className="flex gap-4 mb-6 p-2 bg-slate-50 border border-slate-200 rounded-xl">
          <button
            className={`flex-1 py-2 px-4 rounded-lg font-black text-[10px] tracking-widest transition-all ${importType === 'articulos' ? 'bg-indigo-600 text-white shadow-md' : 'bg-transparent text-slate-400'}`}
            onClick={() => setImportType('articulos')}>
            <span className="material-icons-round text-sm mr-2 align-middle">inventory_2</span>
            ARTÍCULOS
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-lg font-black text-[10px] tracking-widest transition-all ${importType === 'proveedores' ? 'bg-indigo-600 text-white shadow-md' : 'bg-transparent text-slate-400'}`}
            onClick={() => setImportType('proveedores')}>
            <span className="material-icons-round text-sm mr-2 align-middle">local_shipping</span>
            PROVEEDORES
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-lg font-black text-[10px] tracking-widest transition-all ${importType === 'clientes' ? 'bg-indigo-600 text-white shadow-md' : 'bg-transparent text-slate-400'}`}
            onClick={() => setImportType('clientes')}>
            <span className="material-icons-round text-sm mr-2 align-middle">people</span>
            CLIENTES
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4 font-medium">
          {importType === 'articulos'
            ? 'Importa inventario. Columnas: codigo, descripcion, precio, stock, costo, marca, depto.'
            : importType === 'proveedores'
              ? 'Importa proveedores. Columnas: rif, nombre, telefono, direccion.'
              : 'Importa clientes. Columnas: rif, nombre, telefono, direccion.'}
        </p>

        <div className="flex gap-3 flex-wrap">
          <input
            type="file"
            id="bulk-import"
            className="hidden"
            accept=".xlsx,.xls,.csv,.json"
            onChange={async (e) => {
              const file = e.target.files[0]
              if (!file) { console.log("❌ No se seleccionó ningún archivo"); return }
              console.log("📂 Archivo seleccionado:", file.name, "Tipo:", importType)

              const reader = new FileReader()
              reader.onload = async (evt) => {
                console.log("📖 Archivo leído con éxito. Procesando data...")
                try {
                  let rawRows = []
                  const ext = file.name.split('.').pop().toLowerCase()

                  if (ext === 'json') {
                    rawRows = JSON.parse(evt.target.result)
                  } else if (ext === 'csv') {
                    const text = evt.target.result
                    const lines = text.split('\n')
                    const headers = lines[0].split(',')
                    rawRows = lines.slice(1).map(line => {
                      const values = line.split(',')
                      const obj = {}
                      headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim())
                      return obj
                    })
                  } else {
                    const { read, utils } = await import('xlsx')
                    const data = new Uint8Array(evt.target.result)
                    const workbook = read(data, { type: 'array' })
                    const sheetName = workbook.SheetNames[0]
                    const sheet = workbook.Sheets[sheetName]

                    // Intentamos leer normal primero
                    rawRows = utils.sheet_to_json(sheet)

                    // Si detectamos que la primera fila es un tÃ­tulo (como el tuyo), saltamos una fila
                    if (rawRows.length > 0 && Object.keys(rawRows[0])[0].toLowerCase().includes('listado')) {
                      console.log("⚠️ Título detectado en Fila 1. Saltando a Fila 2 para buscar encabezados...");
                      rawRows = utils.sheet_to_json(sheet, { range: 1 })
                    }
                  }

                  console.log(`📊 Filas detectadas en el archivo: ${rawRows.length}`)
                  if (!Array.isArray(rawRows) || rawRows.length === 0) {
                    toast('El archivo está vacío o tiene un formato inválido', 'error')
                    return
                  }

                  const currentUser = useStore.getState().currentUser
                  console.log("👤 Usuario procesando:", currentUser?.nombre)
                  if (rawRows.length > 0) {
                    console.log("🔑 Columnas detectadas en el archivo:", Object.keys(rawRows[0]))
                  }

                  if (importType === 'articulos') {
                    // Helpers para limpieza de datos
                    const cleanNum = (val) => {
                      if (typeof val === 'number') return val;
                      if (!val || typeof val !== 'string') return 0;
                      // Eliminar todo lo que no sea nÃºmero, punto o coma
                      const clean = val.replace(/[^0-9.,-]/g, '');
                      // Manejar formato Latino (1.250,50 -> 1250.50)
                      // Si hay coma y punto, asumimos punto es miles. Si solo hay coma, es decimal.
                      if (clean.includes(',') && clean.includes('.')) {
                        return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
                      }
                      return parseFloat(clean.replace(',', '.')) || 0;
                    }

                    const getVal = (row, ...targets) => {
                      const keys = Object.keys(row);
                      // 1. Precise match
                      for (const target of targets) {
                        const normalizedTarget = target.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                        const exactMatch = keys.find(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === normalizedTarget);
                        if (exactMatch) return row[exactMatch];
                      }
                      // 2. Fuzzy match (includes)
                      for (const target of targets) {
                        const normalizedTarget = target.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                        const fuzzyMatch = keys.find(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().includes(normalizedTarget));
                        if (fuzzyMatch) return row[fuzzyMatch];
                      }
                      return null;
                    }

                    const formatted = rawRows.map(a => {
                      const row = {
                        codigo: String(getVal(a, 'Código', 'Codigo', 'Cod', 'Referencia') || '').trim(),
                        referencia: String(getVal(a, 'Ref', 'Parte', 'Referencia') || ''),
                        descripcion: String(getVal(a, 'Descripción', 'Descripcion', 'Nombre', 'Articulo') || '').trim(),
                        marca: String(getVal(a, 'Marca', 'Fabricante') || 'GENERICO').toUpperCase(),
                        departamento: String(getVal(a, 'Departamento', 'Categoria', 'Depto', 'Grupo') || 'GENERAL').toUpperCase(),
                        unidad: String(getVal(a, 'Unidad', 'Medida', 'U.M.') || 'UNI').toUpperCase(),
                        stock: cleanNum(getVal(a, 'Total Existe', 'Total', 'Stock', 'Existencia', 'Cant') || 0),
                        precio: cleanNum(getVal(a, 'Precio Venta', 'Precio 1', 'Precio', 'Venta') || 0),
                        costo: cleanNum(getVal(a, 'Costo Unitario', 'Costo Unit', 'Costo Full', 'Costo') || 0),
                      };
                      return row;
                    }).filter(a => a.codigo && a.descripcion);

                    console.log("📝 Muestra de artículos procesados (primeros 3):", formatted.slice(0, 3));

                    const existingItems = await db.articulos.toArray()
                    // Crear un mapa de normalización (trim, uppercase, quitar el '#' inicial si existe)
                    const normalize = (c) => String(c || '').trim().toUpperCase().replace(/^#/, '')
                    const codeMap = new Map()
                    existingItems.forEach(item => {
                      const norm = normalize(item.codigo)
                      if (norm) codeMap.set(norm, item.id)
                    })

                    let updated = 0
                    let created = 0

                    const finalItems = formatted.map(item => {
                      const norm = normalize(item.codigo)
                      if (codeMap.has(norm)) {
                        updated++
                        return { ...item, id: codeMap.get(norm) }
                      }
                      created++
                      return item
                    })

                    await db.articulos.bulkPut(finalItems)
                    console.log(`📦 Resumen Carga: Actualizados: ${updated}, Nuevos: ${created}`)
                    toast(`✅ Éxito: ${updated} actualizados y ${created} nuevos.`, 'success')

                  } else if (importType === 'proveedores') {
                    // MODO PROVEEDORES
                    let seqCounter = 1
                    const formatted = rawRows.map(p => {
                      // Buscamos el nombre en múltiples variaciones
                      const nombre = String(
                        p['Nombre de Empresa / Proveedor'] ||
                        p['Nombre de Empresa / Proveedor'] ||
                        p['Nombre'] ||
                        p.nombre ||
                        p['NOMBRE'] ||
                        p['PROVEEDOR'] ||
                        p.empresa ||
                        p.proveedor ||
                        p.company ||
                        ''
                      ).trim()

                      let rif = String(p.rif || p.RIF || p['RIF'] || p.Id || p.id || p.ID || '').trim()

                      // LOGICA GENERACIÓN SECUENCIAL PARA RIF VACÍO/CERO
                      if (!rif || rif === '0' || rif === '00000000' || rif === 'undefined' || rif === '') {
                        rif = `GEN-${String(seqCounter++).padStart(7, '0')}`
                      }

                      return {
                        rif: rif,
                        nombre: nombre,
                        telefono: String(p.telefono || p.Telefono || p.tel || p['Teléfono'] || p['Telefono'] || '0'),
                        direccion: String(p.direccion || p.Direccion || p.dir || p['Dirección'] || p['Direccion'] || 'N/A'),
                        estado: 'ACTIVO'
                      }
                    }).filter(p => p.nombre && p.nombre !== '' && p.nombre !== 'undefined')

                    console.log(`✅ Proveedores formateados: ${formatted.length}`)

                    const existingProv = await db.proveedores.toArray()
                    const rifMap = new Map(existingProv.map(item => [item.rif, item.id]))

                    const finalProv = formatted.map(prov => {
                      if (rifMap.has(prov.rif)) return { ...prov, id: rifMap.get(prov.rif) }
                      return prov
                    })

                    await db.proveedores.bulkPut(finalProv)
                    toast(`✅ ¡Éxito! ${finalProv.length} proveedores procesados.`)

                  } else if (importType === 'clientes') {
                    // MODO CLIENTES
                    const formatted = rawRows.map(c => {
                      const rif = String(c.rif || c.RIF || c.Id || c.id || '').trim()
                      const nombre = String(c.nombre || c['Nombre'] || c.cliente || '').trim()

                      return {
                        rif: rif,
                        nombre: nombre || 'CLIENTE SIN NOMBRE',
                        telefono: String(c.telefono || c.Telefono || c.tel || '0'),
                        direccion: String(c.direccion || c.Direccion || c.dir || 'N/A'),
                        estado: 'ACTIVO'
                      }
                    }).filter(c => c.rif && c.nombre !== 'CLIENTE SIN NOMBRE')

                    const existingClie = await db.clientes.toArray()
                    const rifMap = new Map(existingClie.map(item => [item.rif, item.id]))

                    const finalClie = formatted.map(clie => {
                      if (rifMap.has(clie.rif)) return { ...clie, id: rifMap.get(clie.rif) }
                      return clie
                    })

                    await db.clientes.bulkPut(finalClie)
                    toast(`✅ ¡Éxito! ${finalClie.length} clientes procesados.`)
                  }

                  e.target.value = ''
                } catch (err) {
                  toast('❌ Error al procesar el archivo.', 'error')
                  console.error(err)
                }
              }

              if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                reader.readAsArrayBuffer(file)
              } else {
                reader.readAsText(file)
              }
            }}
          />
          <button className="btn btn-r shadow-md w-full" onClick={() => document.getElementById('bulk-import').click()}>
            <span className="material-icons-round text-base">file_upload</span>
            <span>PROCESAR ARCHIVO ({importType.toUpperCase()})</span>
          </button>
        </div>
      </Card>

      <Card title="🗑 Mantenimiento Crítico">
        <div className="bg-red-50 border border-red-100 p-4 rounded-xl mb-4">
          <p className="text-[10px] text-red-600 font-black uppercase tracking-widest mb-1">Zona de Peligro</p>
          <p className="text-xs text-red-500 font-medium">
            Elimina <strong className="font-black underline">TODOS</strong> los datos del sistema de forma permanente.
            Esta acción limpiará tablas de inventario, ventas y registros contables. No hay marcha atrás.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            className="btn btn-r justify-center font-black py-4 opacity-70 hover:opacity-100"
            onClick={clearInventory}>
            <span className="material-icons-round text-base">delete_sweep</span>
            <span>VACIAR CATÁLOGO LOCAL (SOLO ESTA PC)</span>
          </button>

          <button
            className="btn btn-b justify-center font-black py-4 bg-red-900/20 text-red-500 border-red-900/30 hover:bg-red-900/40"
            onClick={clearCloudInventory}>
            <span className="material-icons-round text-base">cloud_off</span>
            <span>ELIMINAR INVENTARIO DE LA NUBE (GLOBAL)</span>
          </button>

          <p className="text-[9px] text-slate-500 font-bold uppercase text-center mt-1">
            Nota: Si borras local y no borras la Nube, el sistema bajará los datos viejos al reiniciar.
          </p>

          <div className="h-px bg-red-200 my-2"></div>

          <button
            className={`btn justify-center font-black py-4 ${confirm2 ? 'btn-r scale-105' : 'btn-gr opacity-40 hover:opacity-100'}`}
            onClick={clearAll}>
            <span className="material-icons-round text-base">{confirm2 ? 'report_problem' : 'delete_forever'}</span>
            <span>{confirm2 ? 'SÍ, BORRAR TODO EL SISTEMA DEFINITIVAMENTE' : 'LIMPIAR BASE DE DATOS COMPLETA'}</span>
          </button>

          {confirm2 && (
            <button className="btn btn-gr justify-center" onClick={() => setConfirm2(false)}>CANCELAR ACCIÓN</button>
          )}
        </div>
      </Card>

      <div className="panel p-4 bg-slate-100/50 border-dashed border-2 border-slate-200">
        <div className="flex items-center gap-2 mb-3 text-slate-400">
          <span className="material-icons-round text-sm">info</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Información Técnica</span>
        </div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase">Sistema</span>
            <span className="text-xs font-bold text-slate-700">KEYMASTER / Guaicaipuro</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase">Versión</span>
            <span className="text-xs font-bold text-slate-700">2.6.0 Amber Cloud Edition ☁️</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase">Motor DB</span>
            <span className="text-xs font-bold text-slate-700">IndexedDB v2.1 (Dexie)</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase">Estado</span>
            <span className="text-xs font-bold text-cyan-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
              Operativo Híbrido (Local + Cloud Sync)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
