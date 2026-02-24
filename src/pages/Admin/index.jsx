import { useState } from 'react'
import { db, setConfig } from '../../db/db'
import useStore from '../../store/useStore'
import { signData, verifyData } from '../../utils/security'
import { logAction } from '../../utils/audit'

export default function Admin() {
  const toast = useStore(s => s.toast)
  const [newClave, setNewClave] = useState('')
  const [confirm2, setConfirm2] = useState(false)

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
    a.download = `kemaster_backup_${new Date().toISOString().split('T')[0]}.json`
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
          toast('❌ El archivo no tiene el formato de KEMASTER', 'error')
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
    <div className="panel">
      <div className="panel-title">{title}</div>
      {children}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-4 h-full overflow-y-auto custom-scroll pr-2 pb-10">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
        <span className="material-icons-round text-amber-500 text-2xl">security</span>
        <div>
          <p className="font-black text-amber-800 uppercase text-[10px] tracking-widest">Panel de Control Maestro</p>
          <p className="text-sm font-medium text-amber-700">Área restringida. Todas las acciones aquí afectan la integridad de los datos.</p>
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

      <Card title="📊 Carga Masiva de Artículos">
        <p className="text-xs text-slate-500 mb-4 font-medium">
          Importa una lista completa de inventario desde archivos <strong>Excel (.xlsx, .xls)</strong>, <strong>CSV</strong> o <strong>JSON</strong>.
          Asegúrate de que las columnas tengan nombres como: <em>codigo, descripcion, precio, stock, costo, marca, depto</em>.
        </p>
        <div className="flex gap-3 flex-wrap">
          <input
            type="file"
            id="bulk-import"
            className="hidden"
            accept=".xlsx,.xls,.csv,.json"
            onChange={async (e) => {
              const file = e.target.files[0]
              if (!file) return

              const reader = new FileReader()
              reader.onload = async (evt) => {
                try {
                  let articles = []
                  const ext = file.name.split('.').pop().toLowerCase()

                  if (ext === 'json') {
                    articles = JSON.parse(evt.target.result)
                  } else if (ext === 'csv') {
                    const text = evt.target.result
                    const lines = text.split('\n')
                    const headers = lines[0].split(',')
                    articles = lines.slice(1).map(line => {
                      const values = line.split(',')
                      const obj = {}
                      headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim())
                      return obj
                    })
                  } else {
                    // Excel
                    const { read, utils } = await import('xlsx')
                    const data = new Uint8Array(evt.target.result)
                    const workbook = read(data, { type: 'array' })
                    const sheetName = workbook.SheetNames[0]
                    articles = utils.sheet_to_json(workbook.Sheets[sheetName])
                  }

                  if (!Array.isArray(articles)) throw new Error('Formato inválido')

                  // Clean and format items
                  const formatted = articles.map(a => ({
                    codigo: String(a.codigo || a.cod || a.id || ''),
                    referencia: String(a.referencia || a.ref || ''),
                    descripcion: String(a.descripcion || a.nombre || a.desc || ''),
                    marca: String(a.marca || ''),
                    departamento: String(a.departamento || a.depto || ''),
                    sub_depto: String(a.sub_depto || ''),
                    proveedor: String(a.proveedor || ''),
                    unidad: String(a.unidad || 'UNI'),
                    stock: parseFloat(a.stock || a.existencia || 0) || 0,
                    precio: parseFloat(a.precio || a.venta || 0) || 0,
                    costo: parseFloat(a.costo || 0) || 0,
                    ubicacion: String(a.ubicacion || '')
                  })).filter(a => a.codigo && a.descripcion)

                  const currentUser = useStore.getState().currentUser
                  // Logica Anti-Duplicados: Obtener todos los artículos actuales para comparar
                  const existingItems = await db.articulos.toArray()
                  const codeMap = new Map(existingItems.map(item => [item.codigo, item.id]))

                  const finalItems = formatted.map(item => {
                    if (codeMap.has(item.codigo)) {
                      return { ...item, id: codeMap.get(item.codigo) }
                    }
                    return item
                  })

                  await db.articulos.bulkPut(finalItems)
                  const updates = finalItems.filter(i => i.id).length
                  const news = finalItems.length - updates

                  logAction(currentUser, 'IMPORTACION_MASIVA', { nuevos: news, actualizados: updates })
                  toast(`✅ ¡Carga Exitosa! ${news} nuevos y ${updates} actualizados.`)
                  e.target.value = '' // Clear input
                } catch (err) {
                  toast('❌ Error al procesar el archivo. Revisa el formato.', 'error')
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
          <button className="btn btn-r shadow-md w-full sm:w-auto" onClick={() => document.getElementById('bulk-import').click()}>
            <span className="material-icons-round text-base">file_upload</span>
            <span>Subir Excel / CSV / JSON</span>
          </button>

          <div className="w-full flex justify-center mt-2">
            <a href="#" className="text-[10px] text-blue-500 hover:underline font-bold uppercase tracking-widest flex items-center gap-1"
              onClick={(e) => {
                e.preventDefault()
                const headers = "codigo,referencia,descripcion,marca,departamento,sub_depto,proveedor,unidad,stock,precio,costo,ubicacion"
                const example = "759123456,REF-001,PASTILLAS DE FRENO DELANTERO,TOYOTA,REPUESTOS,FRENOS,PROVEEDOR A,UNI,10,25.50,15.00,PASILLO A-1"
                const csvContent = headers + "\n" + example
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = 'formato_inventario_kemaster.csv'
                a.click()
              }}>
              <span className="material-icons-round text-xs">download_for_offline</span>
              DESCARGAR PLANTILLA EXCEL (CSV)
            </a>
          </div>
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
        <div className="flex items-center gap-3">
          <button
            className={`btn flex-1 justify-center font-black ${confirm2 ? 'btn-r scale-105' : 'btn-gr opacity-60 hover:opacity-100'}`}
            onClick={clearAll}>
            <span className="material-icons-round text-base">{confirm2 ? 'report_problem' : 'delete_forever'}</span>
            <span>{confirm2 ? 'SÍ, BORRAR TODO DEFINITIVAMENTE' : 'LIMPIAR BASE DE DATOS'}</span>
          </button>
          {confirm2 && (
            <button className="btn btn-gr flex-1 justify-center" onClick={() => setConfirm2(false)}>CANCELAR</button>
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
            <span className="text-xs font-bold text-slate-700">KEMASTER / Guaicaipuro</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase">Versión</span>
            <span className="text-xs font-bold text-slate-700">2.4.0 Amber Edition</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase">Motor DB</span>
            <span className="text-xs font-bold text-slate-700">IndexedDB v2.1 (Dexie)</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase">Estado</span>
            <span className="text-xs font-bold text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Operativo (Local Only)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
