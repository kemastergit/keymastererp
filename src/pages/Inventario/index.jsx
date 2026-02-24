import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD } from '../../utils/format'
import { logAction } from '../../utils/audit'
import Modal from '../../components/UI/Modal'
import Confirm from '../../components/UI/Confirm'

const empty = { codigo: '', referencia: '', descripcion: '', marca: '', departamento: '', sub_depto: '', proveedor: '', unidad: 'UNI', ubicacion: '', stock: 0, precio: 0, costo: 0 }

export default function Inventario() {
  const toast = useStore(s => s.toast)
  const [searchParams, setSearchParams] = useSearchParams()
  const filterParam = searchParams.get('filter')

  const [busq, setBusq] = useState('')
  const [filter, setFilter] = useState(filterParam || 'all')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [delId, setDelId] = useState(null)
  const [ajuste, setAjuste] = useState(null) // { art, qty, motivo }

  const articulos = useLiveQuery(
    async () => {
      let query = db.articulos.orderBy('descripcion')

      if (filter === 'agotados') {
        query = query.filter(a => (a.stock ?? 0) <= 0)
      }

      if (busq.trim()) {
        const b = busq.toLowerCase()
        query = query.filter(a =>
          a.codigo?.toLowerCase().includes(b) ||
          a.descripcion?.toLowerCase().includes(b) ||
          a.marca?.toLowerCase().includes(b) ||
          a.departamento?.toLowerCase().includes(b) ||
          a.sub_depto?.toLowerCase().includes(b)
        )
      }
      return await query.toArray()
    },
    [busq, filter], []
  )

  const toggleFilter = (f) => {
    const newVal = filter === f ? 'all' : f
    setFilter(newVal)
    if (newVal === 'all') {
      searchParams.delete('filter')
    } else {
      searchParams.set('filter', newVal)
    }
    setSearchParams(searchParams)
  }

  const openNew = () => { setForm(empty); setEditing(null); setShowModal(true) }
  const openEdit = (a) => { setForm({ ...a }); setEditing(a.id); setShowModal(true) }

  const save = async () => {
    if (!form.codigo.trim() || !form.descripcion.trim()) {
      toast('Código y descripción son requeridos', 'warn'); return
    }
    const currentUser = useStore.getState().currentUser
    if (editing) {
      await db.articulos.update(editing, { ...form, precio: parseFloat(form.precio) || 0, stock: parseInt(form.stock) || 0 })
      logAction(currentUser, 'PRODUCTO_ACTUALIZADO', { codigo: form.codigo, descripcion: form.descripcion })
      toast('Producto actualizado')
    } else {
      await db.articulos.add({ ...form, precio: parseFloat(form.precio) || 0, stock: parseInt(form.stock) || 0 })
      logAction(currentUser, 'PRODUCTO_CREADO', { codigo: form.codigo, descripcion: form.descripcion })
      toast('Producto agregado')
    }
    setShowModal(false)
  }

  const del = async () => {
    const art = await db.articulos.get(delId)
    const currentUser = useStore.getState().currentUser
    await db.articulos.delete(delId)
    logAction(currentUser, 'PRODUCTO_ELIMINADO', { codigo: art?.codigo, descripcion: art?.descripcion })
    toast('Producto eliminado', 'warn')
    setDelId(null)
  }

  const saveAjuste = async () => {
    if (!ajuste) return
    const qty = parseInt(ajuste.qty) || 0
    if (qty === 0) { toast('Cantidad no puede ser 0', 'warn'); return }
    const art = await db.articulos.get(ajuste.id)
    const newStock = Math.max(0, (art.stock || 0) + qty)
    const currentUser = useStore.getState().currentUser

    await db.articulos.update(ajuste.id, { stock: newStock })
    logAction(currentUser, 'AJUSTE_STOCK_MANUAL', {
      codigo: art.codigo,
      motivo: ajuste.motivo,
      antes: art.stock,
      ajuste: qty,
      despues: newStock
    })

    toast(`Stock ajustado: ${art.stock} → ${newStock}`)
    setAjuste(null)
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const val = (v) => v && v.trim() !== '' ? v : <span className="text-slate-200">—</span>

  return (
    <div className="h-full flex flex-col min-h-0 pb-6 relative">
      <div className="panel p-0 flex flex-col min-h-0 flex-1 relative">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <div className="panel-title mb-0 uppercase tracking-tighter">Maestro de Inventario</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{articulos.length} productos registrados</p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`btn !py-2 !px-4 text-[10px] font-bold uppercase transition-all flex items-center gap-2 
              ${filter === 'agotados' ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-titilar' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              onClick={() => toggleFilter('agotados')}>
              <span className="material-icons-round text-sm">{filter === 'agotados' ? 'filter_list_off' : 'block'}</span>
              <span>{filter === 'agotados' ? 'Mostrar Todo' : 'Ver Agotados'}</span>
            </button>
            <button className="btn btn-r shadow-lg font-bold" onClick={openNew}>
              <span className="material-icons-round text-base">add_box</span>
              <span>Nuevo Artículo</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-3 bg-white border-b border-slate-50 shrink-0">
          <div className="field !m-0">
            <input className="inp !py-2.5 !px-5 !bg-slate-50 !rounded-full text-sm"
              placeholder="🔍 Buscar por código, descripción o marca..."
              value={busq} onChange={e => setBusq(e.target.value)} />
          </div>
        </div>

        {/* ─── MOBILE: Card View ─── */}
        <div className="block md:hidden divide-y divide-slate-100 flex-1 min-h-0 overflow-y-auto custom-scroll">
          {articulos.map(a => (
            <div key={a.id} className="p-4 hover:bg-slate-50/80 transition-colors active:bg-slate-100" onClick={() => openEdit(a)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-slate-950 text-white font-mono font-bold px-2 py-0.5 rounded text-[10px] shrink-0">{a.codigo}</span>
                    <span className={`badge ${(a.stock ?? 0) === 0 ? 'badge-r animate-titilar' : (a.stock ?? 0) <= 3 ? 'badge-y' : 'badge-g'} font-mono font-bold !text-[10px]`}>
                      Stock: {a.stock ?? 0}
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 text-sm leading-tight truncate">{a.descripcion}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {a.marca && <span className="text-[10px] font-bold text-slate-400 uppercase">{a.marca}</span>}
                    {a.departamento && <span className="text-[10px] text-slate-300 uppercase">• {a.departamento}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-base font-black text-slate-800">{fmtUSD(a.precio)}</div>
                  <div className="font-mono text-[10px] text-slate-400">Costo: {fmtUSD(a.costo)}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-3 justify-end">
                <button className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-all flex items-center justify-center"
                  onClick={(e) => { e.stopPropagation(); setAjuste({ ...a, qty: 0, motivo: '' }) }} title="Ajuste de Stock">
                  <span className="material-icons-round text-base">exposure</span>
                </button>
                <button className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center"
                  onClick={(e) => { e.stopPropagation(); openEdit(a) }} title="Editar">
                  <span className="material-icons-round text-base">edit</span>
                </button>
                <button className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                  onClick={(e) => { e.stopPropagation(); setDelId(a.id) }} title="Eliminar">
                  <span className="material-icons-round text-base">delete</span>
                </button>
              </div>
            </div>
          ))}
          {articulos.length === 0 && (
            <div className="text-center text-slate-400 py-16 tracking-widest text-[10px] font-bold uppercase opacity-50 italic">No se encontraron productos</div>
          )}
        </div>

        {/* ─── DESKTOP: Table View ─── */}
        <div className="hidden md:block flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="sticky-col !bg-slate-50">Código</th>
                <th className="sticky-col-2 !bg-slate-50 min-w-[200px]">Descripción</th>
                <th>Marca</th>
                <th>Ref.</th>
                <th>Depto.</th>
                <th>Sub-Depto.</th>
                <th>Stock</th>
                <th className="text-right">Costo ($)</th>
                <th className="text-right">Precio ($)</th>
                <th className="text-right pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {articulos.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/80 transition-colors cursor-pointer" onClick={() => openEdit(a)}>
                  <td className="sticky-col !bg-white">
                    <div className="bg-slate-950 text-white font-mono font-bold px-2 py-1.5 rounded-md shadow-inner text-[11px] border border-slate-800 inline-block min-w-[100px] text-center">
                      {a.codigo}
                    </div>
                  </td>
                  <td className="font-bold text-slate-700 sticky-col-2 !bg-white whitespace-normal leading-tight">{a.descripcion}</td>
                  <td className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">{val(a.marca)}</td>
                  <td className="text-[10px] text-slate-400 font-mono">{val(a.referencia)}</td>
                  <td className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{val(a.departamento)}</td>
                  <td className="text-[10px] text-slate-400 truncate max-w-[80px]">{val(a.sub_depto)}</td>
                  <td>
                    <span className={`badge ${(a.stock ?? 0) === 0 ? 'badge-r animate-titilar' : (a.stock ?? 0) <= 3 ? 'badge-y' : 'badge-g'} !px-3 font-mono font-bold`}>
                      {a.stock ?? 0}
                    </span>
                  </td>
                  <td className="font-mono text-slate-400 text-right text-xs">{fmtUSD(a.costo)}</td>
                  <td className="font-mono text-slate-800 text-right font-black">{fmtUSD(a.precio)}</td>
                  <td className="text-right pr-4 whitespace-nowrap">
                    <div className="flex gap-1 justify-end">
                      <button className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-all flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); setAjuste({ ...a, qty: 0, motivo: '' }) }} title="Ajuste de Stock">
                        <span className="material-icons-round text-base">exposure</span>
                      </button>
                      <button className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); openEdit(a) }} title="Editar">
                        <span className="material-icons-round text-base">edit</span>
                      </button>
                      <button className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); setDelId(a.id) }} title="Eliminar">
                        <span className="material-icons-round text-base">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {articulos.length === 0 && (
                <tr><td colSpan={10} className="text-center text-slate-400 py-16 tracking-widest text-[10px] font-bold uppercase opacity-50 italic">No se encontraron productos en el inventario</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal CRUD */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'Editar Producto' : 'Registrar Nuevo Producto'} wide>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="field">
              <label>Código del Producto *</label>
              <input className="inp font-mono !py-2.5" value={form.codigo} onChange={e => f('codigo', e.target.value)} placeholder="Ej. 75912345678" />
            </div>
            <div className="field">
              <label>Marca / Fabricante</label>
              <input className="inp !py-2.5" value={form.marca} onChange={e => f('marca', e.target.value)} placeholder="Ej. Toyota, Bosch..." />
            </div>
            <div className="field col-span-1 sm:col-span-2">
              <label>Descripción Completa *</label>
              <input className="inp !py-2.5" value={form.descripcion} onChange={e => f('descripcion', e.target.value)} placeholder="Nombre detallado del artículo" />
            </div>
            <div className="field">
              <label>Departamento</label>
              <input className="inp !py-2.5" value={form.departamento} onChange={e => f('departamento', e.target.value)} placeholder="Ej. Repuestos, Lubricantes" />
            </div>
            <div className="field">
              <label>Ubicación en Almacén</label>
              <input className="inp !py-2.5" value={form.ubicacion} onChange={e => f('ubicacion', e.target.value)} placeholder="Ej. Pasillo A, Estante 4" />
            </div>
            <div className="field">
              <label>Referencia de Fábrica</label>
              <input className="inp !py-2.5" value={form.referencia} onChange={e => f('referencia', e.target.value)} placeholder="N° de parte original" />
            </div>
            <div className="field">
              <label>Sub-Categoría</label>
              <input className="inp !py-2.5" value={form.sub_depto} onChange={e => f('sub_depto', e.target.value)} />
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Valores y Existencia</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="field">
                <label>Stock Inicial</label>
                <input className="inp font-mono !py-2 italic" type="number" value={form.stock} onChange={e => f('stock', e.target.value)} inputMode="numeric" />
              </div>
              <div className="field">
                <label>Unidad</label>
                <input className="inp !py-2" value={form.unidad} onChange={e => f('unidad', e.target.value)} placeholder="UNI, MTS, KG..." />
              </div>
              <div className="field">
                <label>Costo ($)</label>
                <input className="inp font-mono !py-2" type="number" value={form.costo} onChange={e => f('costo', e.target.value)} step="0.01" inputMode="decimal" />
              </div>
              <div className="field">
                <label>P. Venta ($)</label>
                <input className="inp font-mono !py-2 font-bold !text-primary" type="number" value={form.precio} onChange={e => f('precio', e.target.value)} step="0.01" inputMode="decimal" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn btn-gr flex-1 justify-center" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-g flex-1 justify-center font-bold" onClick={save}>
              <span className="material-icons-round text-base">save</span>
              <span>Guardar Producto</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal ajuste stock */}
      <Modal open={!!ajuste} onClose={() => setAjuste(null)} title="Ajuste Manual de Stock">
        {ajuste && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-slate-800 font-bold text-sm leading-tight">{ajuste.descripcion}</p>
                <p className="text-primary font-mono text-[10px] font-bold">{ajuste.codigo}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Stock Actual</p>
                <div className={`badge ${ajuste.stock <= 3 ? 'badge-r' : 'badge-g'} font-mono font-black`}>{ajuste.stock}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="field">
                <label>Cantidad a Ajustar</label>
                <input className="inp font-mono !py-3 !text-lg text-center" type="number" value={ajuste.qty}
                  onChange={e => setAjuste(p => ({ ...p, qty: e.target.value }))}
                  placeholder="ej: +5 o -2" inputMode="numeric" />
                <p className="text-[9px] text-slate-400 font-bold text-center mt-2 uppercase">Use signo menos (-) para restar stock</p>
              </div>
              <div className="field">
                <label>Motivo del Ajuste</label>
                <input className="inp !py-3" value={ajuste.motivo || ''}
                  onChange={e => setAjuste(p => ({ ...p, motivo: e.target.value }))}
                  placeholder="Ej. Compra, Merma, Conteo..." />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn btn-gr flex-1 justify-center" onClick={() => setAjuste(null)}>Cancelar</button>
              <button className="btn btn-y flex-1 justify-center font-bold" onClick={saveAjuste}>
                <span className="material-icons-round text-base">published_with_changes</span>
                <span>Aplicar Cambios</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={del}
        msg="¿Está seguro de eliminar este producto del inventario? Esta acción no se puede deshacer." danger />
    </div>
  )
}
