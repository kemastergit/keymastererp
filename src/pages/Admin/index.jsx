import { useState } from 'react'
import { db, setConfig } from '../../db/db'
import useStore from '../../store/useStore'

export default function Admin() {
  const toast = useStore(s => s.toast)
  const [newClave, setNewClave] = useState('')
  const [confirm2, setConfirm2] = useState(false)

  const exportDB = async () => {
    const data = {
      articulos:    await db.articulos.toArray(),
      clientes:     await db.clientes.toArray(),
      proveedores:  await db.proveedores.toArray(),
      ventas:       await db.ventas.toArray(),
      venta_items:  await db.venta_items.toArray(),
      cotizaciones: await db.cotizaciones.toArray(),
      cot_items:    await db.cot_items.toArray(),
      ctas_cobrar:  await db.ctas_cobrar.toArray(),
      ctas_pagar:   await db.ctas_pagar.toArray(),
      devoluciones: await db.devoluciones.toArray(),
      caja_chica:   await db.caja_chica.toArray(),
      cierre_dia:   await db.cierre_dia.toArray(),
      exported_at:  new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `guaicaipuro_backup_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    toast('✅ Backup exportado correctamente')
  }

  const importDB = () => {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = '.json'
    inp.onchange = async e => {
      try {
        const text = await e.target.files[0].text()
        const data = JSON.parse(text)
        // Limpiar y restaurar
        await db.transaction('rw',
          [db.articulos, db.clientes, db.proveedores, db.ventas, db.venta_items,
           db.cotizaciones, db.cot_items, db.ctas_cobrar, db.ctas_pagar,
           db.devoluciones, db.caja_chica, db.cierre_dia],
          async () => {
            await db.articulos.clear();    if (data.articulos)   await db.articulos.bulkAdd(data.articulos)
            await db.clientes.clear();     if (data.clientes)    await db.clientes.bulkAdd(data.clientes)
            await db.proveedores.clear();  if (data.proveedores) await db.proveedores.bulkAdd(data.proveedores)
            await db.ventas.clear();       if (data.ventas)      await db.ventas.bulkAdd(data.ventas)
            await db.venta_items.clear();  if (data.venta_items) await db.venta_items.bulkAdd(data.venta_items)
            await db.cotizaciones.clear(); if (data.cotizaciones) await db.cotizaciones.bulkAdd(data.cotizaciones)
            await db.cot_items.clear();    if (data.cot_items)   await db.cot_items.bulkAdd(data.cot_items)
            await db.ctas_cobrar.clear();  if (data.ctas_cobrar) await db.ctas_cobrar.bulkAdd(data.ctas_cobrar)
            await db.ctas_pagar.clear();   if (data.ctas_pagar)  await db.ctas_pagar.bulkAdd(data.ctas_pagar)
            await db.devoluciones.clear(); if (data.devoluciones) await db.devoluciones.bulkAdd(data.devoluciones)
            await db.caja_chica.clear();   if (data.caja_chica)  await db.caja_chica.bulkAdd(data.caja_chica)
            await db.cierre_dia.clear();   if (data.cierre_dia)  await db.cierre_dia.bulkAdd(data.cierre_dia)
          }
        )
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
    <div className="max-w-2xl mx-auto">
      <div className="bg-amber-900/20 border border-amber-700 rounded-lg px-4 py-3 mb-4 text-amber-400 text-sm">
        ⚠ Área de administración — Úsala con precaución
      </div>

      <Card title="💾 BACKUP — BASE DE DATOS">
        <p className="text-sm text-muted mb-3">
          Exporta todos los datos a un archivo JSON para respaldo o importa uno previo.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-g" onClick={exportDB}>📥 EXPORTAR BACKUP</button>
          <button className="btn btn-b" onClick={importDB}>📤 IMPORTAR BACKUP</button>
        </div>
      </Card>

      <Card title="🔐 CAMBIAR CLAVE DE ADMINISTRADOR">
        <div className="flex gap-2">
          <input className="inp flex-1" type="password" value={newClave}
            onChange={e => setNewClave(e.target.value)}
            placeholder="Nueva clave (mín. 3 caracteres)"
            onKeyDown={e => e.key === 'Enter' && changeClave()} />
          <button className="btn btn-y" onClick={changeClave}>CAMBIAR</button>
        </div>
      </Card>

      <Card title="🗑 LIMPIAR BASE DE DATOS">
        <p className="text-sm text-muted mb-3">
          Elimina <strong className="text-red-400">TODOS</strong> los datos del sistema.
          Esta acción no se puede deshacer. Haz un backup primero.
        </p>
        <button
          className={`btn ${confirm2 ? 'btn-r' : 'btn-gr'}`}
          onClick={clearAll}>
          {confirm2 ? '⚠ CONFIRMAR — BORRAR TODO' : '🗑 LIMPIAR TODO'}
        </button>
        {confirm2 && (
          <button className="btn btn-gr ml-2" onClick={() => setConfirm2(false)}>Cancelar</button>
        )}
      </Card>

      <Card title="ℹ INFORMACIÓN DEL SISTEMA">
        <div className="text-sm text-muted space-y-1">
          <div><span className="text-white">Sistema:</span> Automotores Guaicaipuro C.A.</div>
          <div><span className="text-white">Versión:</span> 1.0.0 React</div>
          <div><span className="text-white">Base de datos:</span> IndexedDB (Dexie.js)</div>
          <div><span className="text-white">Almacenamiento:</span> Local — 100% offline</div>
        </div>
      </Card>
    </div>
  )
}
