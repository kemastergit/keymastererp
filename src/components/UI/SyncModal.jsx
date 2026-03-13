import { useState } from 'react'
import Modal from './Modal'
import { db } from '../../db/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { processSyncQueue, updateSyncCounts } from '../../utils/syncManager'
import useStore from '../../store/useStore'

export default function SyncModal({ open, onClose }) {
  const { toast } = useStore()
  const [loading, setLoading] = useState(false)
  
  const pendientes = useLiveQuery(() => 
    db.sync_queue.filter(i => i.status === 'PENDING').reverse().toArray()
  , [])
  
  const errores = useLiveQuery(() => 
    db.sync_queue.filter(i => i.status === 'ERROR').reverse().toArray()
  , [])

  const handleRetryAll = async () => {
    setLoading(true)
    // Reiniciar intentos de los que están en error
    if (errores?.length > 0) {
      await Promise.all(errores.map(e => db.sync_queue.update(e.id, { status: 'PENDING', intentos: 0 })))
    }
    await processSyncQueue()
    await updateSyncCounts()
    setLoading(false)
    toast('Reintento de sincronización finalizado')
  }

  const handleRetryItem = async (id) => {
    setLoading(true)
    await db.sync_queue.update(id, { status: 'PENDING', intentos: 0 })
    await processSyncQueue()
    await updateSyncCounts()
    setLoading(false)
  }

  const handleDeleteItem = async (id) => {
    if (confirm('⚠️ ATENCIÓN: Si eliminas este registro, no subirá a la nube e ignorará el error. ¿Proceder?')) {
      await db.sync_queue.delete(id)
      await updateSyncCounts()
      toast('Registro descartado')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="ESTADO DE SINCRONIZACIÓN" width="max-w-4xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-[var(--surfaceDark)] border border-[var(--border-var)]">
          <div className="flex flex-col">
            <h2 className="text-lg font-black text-[var(--text-main)] uppercase">Administrador de Cola Cloud</h2>
            <p className="text-[10px] text-[var(--text2)] font-bold uppercase tracking-widest mt-1">Supervisa las transacciones que van a Supabase</p>
          </div>
          <button 
            className="btn bg-[var(--teal)] hover:bg-[var(--tealDark)] text-white font-black"
            onClick={handleRetryAll}
            disabled={loading || (pendientes?.length === 0 && errores?.length === 0)}
          >
            {loading ? 'Sincronizando...' : 'FORZAR SINCRONIZACIÓN'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ERRORES */}
          <div className="panel border-t-4 border-red-500">
            <h3 className="text-xs font-black uppercase text-red-500 tracking-widest flex items-center gap-2 mb-4">
              <span className="material-icons-round">error</span>
              Errores de Sincronización ({errores?.length || 0})
            </h3>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {errores?.length === 0 && (
                <div className="text-center p-6 text-[var(--text2)] text-[10px] font-bold uppercase tracking-widest">
                  No hay errores de sincronización
                </div>
              )}
              {errores?.map(e => (
                <div key={e.id} className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-red-400 block">{e.table}</span>
                      <span className="font-mono font-bold text-[var(--text-main)]">{e.operation}</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="text-blue-500 hover:text-blue-400" onClick={() => handleRetryItem(e.id)} title="Reintentar">
                        <span className="material-icons-round text-sm">refresh</span>
                      </button>
                      <button className="text-red-500 hover:text-red-400" onClick={() => handleDeleteItem(e.id)} title="Descartar y Eliminar">
                        <span className="material-icons-round text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                  <details className="mt-2 text-[10px] text-[var(--text2)] font-mono bg-black/20 p-2 rounded cursor-pointer">
                    <summary className="font-bold text-red-400">Ver Datos Técnicos</summary>
                    <pre className="mt-2 overflow-x-auto p-1 leading-tight text-[10px]">
                      {JSON.stringify(e.data, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </div>

          {/* PENDIENTES */}
          <div className="panel border-t-4 border-amber-500">
            <h3 className="text-xs font-black uppercase text-amber-500 tracking-widest flex items-center gap-2 mb-4">
              <span className="material-icons-round">cloud_upload</span>
              Pendientes en Cola ({pendientes?.length || 0})
            </h3>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {pendientes?.length === 0 && (
                <div className="text-center p-6 text-[var(--text2)] text-[10px] font-bold uppercase tracking-widest">
                  La cola está completamente vacía
                </div>
              )}
              {pendientes?.map(p => (
                <div key={p.id} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-md text-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 block">{p.table}</span>
                      <span className="font-mono font-bold text-[var(--text-main)]">{p.operation}</span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 animate-pulse">Intentos: {p.intentos || 0}</span>
                  </div>
                  <details className="mt-2 text-[10px] text-[var(--text2)] font-mono bg-[var(--surfaceDark)] p-2 rounded cursor-pointer">
                    <summary className="font-bold text-amber-500 opacity-80 hover:opacity-100">Ver Datos</summary>
                    <pre className="mt-2 overflow-x-auto p-1 leading-tight text-[10px]">
                      {JSON.stringify(p.data, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
