import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD } from '../../utils/format'
import { logAction } from '../../utils/audit'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/UI/Modal'
import Confirm from '../../components/UI/Confirm'

const empty = {
  codigo: '', referencia: '', descripcion: '', marca: '', departamento: '',
  sub_depto: '', proveedor: '', unidad: 'UNI', ubicacion: '',
  stock: 0, precio: 0, costo: 0,
  activo: true, mostrar_en_web: true
}

export default function Inventario() {
  const toast = useStore(s => s.toast)
  const currentUser = useStore(s => s.currentUser)
  const [searchParams, setSearchParams] = useSearchParams()
  const filterParam = searchParams.get('filter')

  const [busq, setBusq] = useState('')
  const [filter, setFilter] = useState(filterParam || 'all')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [delId, setDelId] = useState(null)
  const [ajuste, setAjuste] = useState(null) // { art, qty, motivo }
  const [syncing, setSyncing] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [advFilters, setAdvFilters] = useState({
    stockMin: '', stockMax: '', onlyInStock: false,
    brands: [], priceMin: '', priceMax: '',
    letter: '',
    columns: { codigo: true, descripcion: true, marca: true, departamento: true, stock: true, precio: true }
  })

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
          a.referencia?.toLowerCase().includes(b) ||
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
    const processedForm = {
      ...form,
      precio: parseFloat(form.precio) || 0,
      stock: parseInt(form.stock) || 0,
      costo: parseFloat(form.costo) || 0,
      activo: form.activo !== false,
      mostrar_en_web: form.mostrar_en_web !== false
    }

    // 🚨 VALIDACIÓN DE RENTABILIDAD
    if (processedForm.precio < processedForm.costo) {
      const ok = confirm(`⚠️ ALERTA DE PÉRDIDA:\n\nEl precio de venta ($${processedForm.precio}) es MENOR al costo ($${processedForm.costo}).\n\n¿Desea continuar con esta pérdida?`)
      if (!ok) return
    }

    if (editing) {
      const oldArt = await db.articulos.get(editing)
      await db.articulos.update(editing, processedForm)
      let action = 'PRODUCTO_ACTUALIZADO'
      if (oldArt?.precio !== processedForm.precio) action = 'CAMBIO_PRECIO'
      logAction(currentUser, action, {
        table_name: 'articulos', record_id: editing,
        old_value: oldArt, new_value: { ...processedForm, id: editing }
      })
    } else {
      const recordId = await db.articulos.add(processedForm)
      logAction(currentUser, 'PRODUCTO_CREADO', {
        table_name: 'articulos', record_id: recordId,
        new_value: { ...processedForm, id: recordId }
      })
    }

    // 2. Sincronización en Vivo a la NUBE (Supabase)
    try {
      const { error } = await supabase
        .from('articulos')
        .upsert({
          codigo: processedForm.codigo,
          referencia: processedForm.referencia,
          descripcion: processedForm.descripcion,
          marca: processedForm.marca,
          departamento: processedForm.departamento,
          sub_depto: processedForm.sub_depto,
          stock: processedForm.stock,
          precio: processedForm.precio,
          costo: processedForm.costo,
          proveedor: processedForm.proveedor,
          unidad: processedForm.unidad,
          activo: processedForm.activo,
          mostrar_en_web: processedForm.mostrar_en_web
        }, { onConflict: 'codigo' })

      if (error) throw error
      toast(editing ? 'Producto actualizado y sincronizado' : 'Producto agregado a la nube')
    } catch (err) {
      console.error("Error sync:", err)
      toast('⚠️ Guardado local, pero falló sincronización a la nube', 'warn')
    }

    setShowModal(false)
  }

  const del = async () => {
    const art = await db.articulos.get(delId)
    if (!art) return

    const currentUser = useStore.getState().currentUser

    // En lugar de borrar físicamente, desactivamos (Soft Delete)
    // para no romper historial de ventas.
    try {
      await db.articulos.update(delId, { activo: false, mostrar_en_web: false })

      const { error } = await supabase
        .from('articulos')
        .update({ activo: false, mostrar_en_web: false })
        .eq('codigo', art.codigo)

      if (error) throw error

      logAction(currentUser, 'PRODUCTO_DESACTIVADO', {
        table_name: 'articulos',
        record_id: delId,
        old_value: art
      })
      toast('Producto desactivado (No aparecerá en ventas ni catálogo)', 'warn')
    } catch (err) {
      toast('Error al desactivar: ' + err.message, 'error')
    }

    setDelId(null)
  }

  const saveAjuste = async () => {
    if (!ajuste) return
    const qty = parseInt(ajuste.qty) || 0
    if (qty === 0) { toast('Cantidad no puede ser 0', 'warn'); return }
    if (!ajuste.motivo || ajuste.motivo.length < 5) { toast('Justificación obligatoria (mín. 5 letras)', 'error'); return }

    const performAjuste = async () => {
      try {
        const currentUser = useStore.getState().currentUser
        let artSnapshot = null

        await db.transaction('rw', [db.articulos], async () => {
          const art = await db.articulos.get(ajuste.id)
          const newStock = Math.max(0, (art.stock || 0) + qty)
          await db.articulos.update(ajuste.id, { stock: newStock })
          artSnapshot = art
        })

        // La auditoría debe ir FUERA de la transacción para evitar: "Transaction committed too early"
        if (artSnapshot) {
          await logAction(currentUser, 'AJUSTE_INVENTARIO', {
            sku: artSnapshot.codigo,
            descripcion: artSnapshot.descripcion,
            tipo: qty > 0 ? 'SOBRANTE' : 'FALTANTE',
            cant: qty,
            motivo: ajuste.motivo
          })
        }

        toast('✅ Inventario sincronizado y auditado')
        setAjuste(null)
      } catch (err) {
        toast('❌ Error en ajuste: ' + err.message, 'error')
      }
    }

    if (Math.abs(qty) >= 10 || qty < 0) {
      useStore.getState().askAdmin(performAjuste)
    } else {
      performAjuste()
    }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const val = (v) => v && v.trim() !== '' ? v : <span className="text-slate-200">—</span>

  return (
    <div className="flex flex-col min-h-0 pb-2 relative">
      <div className="panel p-0 flex flex-col min-h-0 flex-1 relative overflow-hidden">
        <div className="px-4 py-1.5 border-b border-[var(--border-var)] bg-[var(--surface2)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div>
            <div className="text-sm font-black text-[var(--text-main)] uppercase tracking-tight">MAESTRO DE INVENTARIO Y ALMACÉN</div>
            <p className="text-[11px] text-[var(--text2)] font-black uppercase tracking-widest">{articulos.length} SKU(s) REGISTRADOS</p>
          </div>
          <div className="flex items-center gap-2">

            <button className={`btn btn-sm flex items-center gap-2 cursor-pointer
                ${filter === 'agotados' ? 'bg-[var(--red-var)] text-white border-transparent' : 'bg-[var(--surfaceDark)] text-[var(--text-main)] border-[var(--border-var)] hover:bg-[var(--surface2)]'}`}
              onClick={() => toggleFilter('agotados')}>
              <span className="material-icons-round text-sm">{filter === 'agotados' ? 'filter_list_off' : 'error'}</span>
              <span>{filter === 'agotados' ? 'MOSTRAR TODO' : 'SIN STOCK'}</span>
            </button>
            <button className="btn btn-sm bg-[var(--surfaceDark)] text-[var(--text-main)] border-[var(--border-var)] hover:bg-[var(--surface2)] flex items-center gap-2 cursor-pointer" onClick={() => setShowFilterModal(true)}>
              <span className="material-icons-round text-sm">filter_alt</span>
              <span>FILTROS / REPORTES</span>
            </button>
            <button className="btn btn-sm bg-[var(--teal)] text-white cursor-pointer uppercase text-[10px] tracking-widest" onClick={openNew}>
              <span className="material-icons-round text-sm">add_box</span>
              <span>ALTA DE PRODUCTO</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-1.5 bg-[var(--surface)] border-b border-[var(--border-var)] shrink-0 shadow-inner">
          <div className="field !m-0">
            <input className="inp !py-1.5 !px-4 !bg-[var(--surfaceDark)] text-[13px] font-black uppercase tracking-widest transition-all focus:border-[var(--teal)] shadow-inner"
              placeholder="🔍 BUSCAR POR CÓDIGO, DESCRIPCIÓN, MARCA O CATEGORÍA..."
              value={busq} onChange={e => setBusq(e.target.value.toUpperCase())} />
          </div>
        </div>

        {/* ─── MOBILE: Card View ─── */}
        <div className="block md:hidden divide-y divide-[var(--border-var)] flex-1 min-h-0">
          {articulos.map(a => (
            <div key={a.id} className="p-3 hover:bg-[var(--surfaceDark)] transition-all hover:scale-[1.01] border-b border-[var(--border-var)] bg-white mb-1 rounded-lg shadow-sm cursor-pointer" onClick={() => openEdit(a)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-[var(--text-main)] text-[var(--surface)] font-mono font-black px-3 py-1 rounded-none text-[10px] shrink-0 border border-black/10">#{a.codigo}</span>
                    <span className={`px-2 py-1 font-mono font-black text-[11px] uppercase tracking-widest shadow-sm ${(a.stock ?? 0) === 0 ? 'bg-[var(--red-var)] text-white' : (a.stock ?? 0) <= 3 ? 'bg-[var(--orange-var)] text-white' : 'bg-[var(--green-var)] text-white'}`}>
                      STOCK: {a.stock ?? 0}
                    </span>
                  </div>
                  <p className="font-black text-[var(--text-main)] text-[13px] leading-tight truncate uppercase tracking-tight">{a.descripcion}</p>
                  <div className="flex items-center gap-4 mt-2">
                    {a.marca && <span className="text-[9px] font-black text-[var(--text2)] uppercase tracking-widest bg-[var(--surface2)] px-2 py-0.5 border border-black/5">{a.marca}</span>}
                    {a.departamento && <span className="text-[9px] text-[var(--text2)] font-black uppercase tracking-widest opacity-60">• {a.departamento}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-lg font-black text-[var(--teal)]">{fmtUSD(a.precio)}</div>
                  <div className="font-mono text-[9px] text-[var(--text2)] font-black italic opacity-60">COSTO: {fmtUSD(a.costo)}</div>
                </div>
              </div>
              <div className="flex gap-3 mt-4 justify-end">
                {currentUser?.rol === 'ADMIN' && (
                  <>
                    <button className="w-10 h-10 rounded-none bg-[var(--surfaceDark)] text-[var(--text-main)] hover:bg-[var(--teal)] hover:text-white transition-none flex items-center justify-center cursor-pointer shadow-[var(--win-shadow)] border border-black/5"
                      onClick={(e) => { e.stopPropagation(); setAjuste({ ...a, qty: 0, motivo: '' }) }} title="Ajuste de Stock">
                      <span className="material-icons-round text-base">exposure</span>
                    </button>
                    <button className="w-10 h-10 rounded-none bg-[var(--surfaceDark)] text-[var(--text-main)] hover:bg-[var(--orange-var)] hover:text-white transition-none flex items-center justify-center cursor-pointer shadow-[var(--win-shadow)] border border-black/5"
                      onClick={(e) => { e.stopPropagation(); openEdit(a) }} title="Editar">
                      <span className="material-icons-round text-base">edit</span>
                    </button>
                    <button className="w-10 h-10 rounded-none bg-[var(--surfaceDark)] text-[var(--text-main)] hover:bg-[var(--red-var)] hover:text-white transition-none flex items-center justify-center cursor-pointer shadow-[var(--win-shadow)] border border-black/5"
                      onClick={(e) => { e.stopPropagation(); setDelId(a.id) }} title="Eliminar">
                      <span className="material-icons-round text-base">delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {articulos.length === 0 && (
            <div className="text-center text-[var(--text2)] py-24 tracking-widest text-[11px] font-black uppercase opacity-40 italic border-t-2 border-dashed border-[var(--border-var)] m-6">No se localizaron registros</div>
          )}
        </div>

        {/* ─── DESKTOP: Table View ─── */}
        <div className="hidden md:block flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-900 text-white">
                <th className="px-3 py-1 text-[9px] font-black uppercase tracking-widest border-r border-slate-700">Cód Articulo</th>
                <th className="px-3 py-1 text-[9px] font-black uppercase tracking-widest border-r border-slate-700 min-w-[280px]">Descripción Detallada</th>
                <th className="px-3 py-1 text-[9px] font-black uppercase tracking-widest border-r border-slate-700">Marca</th>
                <th className="px-3 py-1 text-[9px] font-black uppercase tracking-widest border-r border-slate-700">Categoría</th>
                <th className="px-3 py-1 text-center text-[9px] font-black uppercase tracking-widest border-r border-slate-700">Stock</th>
                <th className="px-3 py-1 text-right text-[9px] font-black uppercase tracking-widest border-r border-slate-700">Costo $</th>
                <th className="px-3 py-1 text-right text-[9px] font-black uppercase tracking-widest border-r border-slate-700">Precio $</th>
                <th className="px-3 py-1 text-right text-[9px] font-black uppercase tracking-widest">Gestionar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {articulos.map(a => (
                <tr key={a.id} className="hover:bg-[var(--teal)]/5 cursor-pointer group" onClick={() => openEdit(a)}>
                  <td className="py-0.5 px-3 sticky-col !bg-[var(--surface)] border-b border-black/5">
                    <div className="font-mono text-[var(--teal)] font-black text-[11px] uppercase tracking-tighter">
                      #{a.codigo}
                    </div>
                  </td>
                  <td className="py-0.5 px-3 sticky-col-2 !bg-[var(--surface)] border-b border-black/5">
                      <div className="font-black text-[var(--text-main)] whitespace-normal leading-tight uppercase text-[11px]">{a.descripcion}</div>
                      {a.referencia && (
                        <div className="text-[9px] font-black text-[var(--text2)] opacity-60 tracking-widest uppercase truncate max-w-[250px]">
                          REF: {a.referencia}
                        </div>
                      )}
                  </td>
                  <td className="py-0.5 px-3 text-[10px] font-black text-[var(--text2)] uppercase tracking-widest">{val(a.marca)}</td>
                  <td className="py-0.5 px-3 text-[10px] text-[var(--text2)] font-black uppercase tracking-widest opacity-60">{val(a.departamento)}</td>
                  <td className="py-0.5 px-3 text-center">
                    <span className={`px-2 py-0.5 font-mono font-black text-[10px] ${(a.stock ?? 0) === 0 ? 'bg-[var(--red-var)]/10 text-[var(--red-var)] border border-[var(--red-var)]/20' : (a.stock ?? 0) <= 3 ? 'bg-[var(--orange-var)]/10 text-[var(--orange-var)] border border-[var(--orange-var)]/20' : 'bg-[var(--green-var)]/10 text-[var(--green-var)] border border-[var(--green-var)]/20'}`}>
                      {a.stock ?? 0}
                    </span>
                  </td>
                  <td className="py-0.5 px-3 font-mono text-[var(--text2)] text-right text-[11px] font-black italic">{fmtUSD(a.costo)}</td>
                  <td className="py-0.5 px-3 font-mono text-[var(--teal)] text-right font-black text-xs">{fmtUSD(a.precio)}</td>
                  <td className="py-0.5 px-3 text-right whitespace-nowrap">
                    {currentUser?.rol === 'ADMIN' && (
                      <div className="flex gap-1.5 justify-end">
                        <button className="w-7 h-7 rounded bg-[var(--surfaceDark)] text-[var(--text-main)] hover:bg-[var(--teal)] hover:text-white transition-none flex items-center justify-center cursor-pointer border border-black/5"
                          onClick={(e) => { e.stopPropagation(); setAjuste({ ...a, qty: 0, motivo: '' }) }} title="Ajuste de Stock">
                          <span className="material-icons-round text-sm">exposure</span>
                        </button>
                        <button className="w-7 h-7 rounded bg-[var(--surfaceDark)] text-[var(--text-main)] hover:bg-[var(--orange-var)] hover:text-white transition-none flex items-center justify-center cursor-pointer border border-black/5"
                          onClick={(e) => { e.stopPropagation(); openEdit(a) }} title="Editar">
                          <span className="material-icons-round text-sm">edit</span>
                        </button>
                        <button className="w-7 h-7 rounded bg-[var(--surfaceDark)] text-[var(--text-main)] hover:bg-[var(--red-var)] hover:text-white transition-none flex items-center justify-center cursor-pointer border border-black/5"
                          onClick={(e) => { e.stopPropagation(); setDelId(a.id) }} title="Eliminar">
                          <span className="material-icons-round text-sm">delete</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {articulos.length === 0 && (
                <tr><td colSpan={10} className="text-center text-[var(--text2)] py-24 tracking-widest text-[11px] font-black uppercase opacity-40 italic border-t-2 border-dashed border-[var(--border-var)]">No se localizaron SKUs en los registros de almacén</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal CRUD */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'ACTUALIZAR FICHA TÉCNICA' : 'REGISTRO DE NUEVO PRODUCTO'} wide>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="field">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">CÓDIGO DE ARTÍCULO (SKU) *</label>
              <input className="inp font-mono !py-4 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black uppercase" value={form.codigo} onChange={e => f('codigo', e.target.value.toUpperCase())} placeholder="EJ. 75912345678" />
            </div>
            <div className="field">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">MARCA / FABRICANTE</label>
              <input className="inp !py-4 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black uppercase" value={form.marca} onChange={e => f('marca', e.target.value.toUpperCase())} placeholder="EJ. TOYOTA, BOSCH, DENSO..." />
            </div>
            <div className="field col-span-1 sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">DESCRIPCIÓN DEL PRODUCTO *</label>
              <input className="inp !py-4 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black uppercase" value={form.descripcion} onChange={e => f('descripcion', e.target.value.toUpperCase())} placeholder="NOMBRE DETALLADO SEGÚN CATÁLOGO" />
            </div>
            <div className="field">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">DEPARTAMENTO / CATEGORÍA</label>
              <input className="inp !py-4 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black uppercase" value={form.departamento} onChange={e => f('departamento', e.target.value.toUpperCase())} placeholder="EJ. REPUESTOS, ACCESORIOS..." />
            </div>
            <div className="field">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">UBICACIÓN FÍSICA (ALMACÉN)</label>
              <input className="inp !py-4 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black uppercase" value={form.ubicacion} onChange={e => f('ubicacion', e.target.value.toUpperCase())} placeholder="EJ. PASILLO A, ESTANTE 12-B" />
            </div>
            <div className="field">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">REFERENCIA ORIGINAL</label>
              <input className="inp !py-4 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black uppercase" value={form.referencia} onChange={e => f('referencia', e.target.value.toUpperCase())} placeholder="N° DE PARTE DEL FABRICANTE" />
            </div>
            <div className="field">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">SUB-CATEGORÍA / GRUPO</label>
              <input className="inp !py-4 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black uppercase" value={form.sub_depto} onChange={e => f('sub_depto', e.target.value.toUpperCase())} />
            </div>

            <div className="field flex items-center gap-6 bg-[var(--surfaceDark)] p-4 border border-[var(--border-var)] col-span-1 sm:col-span-2 shadow-inner">
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => f('activo', !form.activo)}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${form.activo ? 'bg-[var(--green-var)] text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-[var(--red-var)] text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]'}`}>
                  <span className="material-icons-round text-xl">
                    {form.activo ? 'check_circle' : 'cancel'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest block leading-none">ESTADO GLOBAL</span>
                  <span className={`text-[9px] font-bold uppercase ${form.activo ? 'text-[var(--green-var)]' : 'text-[var(--red-var)]'}`}>
                    {form.activo ? 'PRODUCTO VIVO' : 'TOTALMENTE DESACTIVADO'}
                  </span>
                </div>
              </div>

              <div className="w-px h-10 bg-[var(--border-var)] opacity-50"></div>

              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => f('mostrar_en_web', !form.mostrar_en_web)}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${form.mostrar_en_web ? 'bg-[var(--teal)] text-white shadow-[0_0_15px_rgba(13,148,136,0.3)]' : 'bg-slate-700 text-slate-400'}`}>
                  <span className="material-icons-round text-xl">
                    {form.mostrar_en_web ? 'visibility' : 'visibility_off'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest block leading-none">PÚBLICO WEB</span>
                  <span className={`text-[9px] font-bold uppercase ${form.mostrar_en_web ? 'text-[var(--teal)]' : 'text-slate-500'}`}>
                    {form.mostrar_en_web ? 'VISIBLE EN CATÁLOGO' : 'SOLO VENTA EN TIENDA'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--surfaceDark)] p-6 rounded-none border-2 border-[var(--border-var)] shadow-inner">
            <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest mb-5 opacity-60">Control Financiero y Existencias</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              <div className="field">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">STOCK INICIAL</label>
                <input className="inp font-mono !py-3 rounded-none focus:border-[var(--teal)] transition-none italic font-black text-center shadow-inner" type="number" value={form.stock} onChange={e => f('stock', e.target.value)} inputMode="numeric" />
              </div>
              <div className="field">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">UNID. MEDIDA</label>
                <input className="inp !py-3 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black uppercase text-center" value={form.unidad} onChange={e => f('unidad', e.target.value.toUpperCase())} placeholder="UNI, MTS..." />
              </div>
              <div className="field">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">COSTO NETO ($)</label>
                <input className="inp font-mono !py-3 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black text-center" type="number" value={form.costo} onChange={e => f('costo', e.target.value)} step="0.01" inputMode="decimal" />
              </div>
              <div className="field">
                <label className={`text-[10px] font-black uppercase tracking-widest ${parseFloat(form.precio) < parseFloat(form.costo) ? 'text-[var(--red-var)]' : 'text-[var(--teal)]'}`}>
                  PRECIO VENTA ($)
                  {parseFloat(form.precio) < parseFloat(form.costo) && <span className="ml-1">⚠️ PÉRDIDA</span>}
                </label>
                <input className={`inp font-mono !py-3 rounded-none transition-none shadow-inner font-black text-center text-lg ${parseFloat(form.precio) < parseFloat(form.costo) ? 'border-[var(--red-var)] text-[var(--red-var)] bg-[var(--red-var)]/5' : 'border-[var(--teal)] text-[var(--teal)] focus:bg-[var(--teal)]/5'}`}
                  type="number" value={form.precio} onChange={e => f('precio', e.target.value)} step="0.01" inputMode="decimal" />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-[var(--border-var)]">
            <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] flex-1 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer" onClick={() => setShowModal(false)}>CANCELAR CARGA</button>
            <button className="btn bg-[var(--teal)] text-white flex-2 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest" onClick={save}>
              <span className="material-icons-round text-base">save_as</span>
              <span>PROCESAR Y ALMACENAR</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal ajuste stock */}
      <Modal open={!!ajuste} onClose={() => setAjuste(null)} title="RE-CONTEO Y AJUSTE TÉCNICO DE EXISTENCIAS">
        {ajuste && (
          <div className="space-y-6">
            <div className="bg-[var(--surfaceDark)] p-5 border-2 border-[var(--border-var)] flex items-center justify-between shadow-inner rounded-none">
              <div className="flex-1 pr-6 border-r border-[var(--border-var)]">
                <p className="text-[var(--text-main)] font-black uppercase text-sm leading-tight mb-1">{ajuste.descripcion}</p>
                <p className="text-[var(--teal)] font-mono text-[11px] font-black uppercase tracking-widest">#{ajuste.codigo}</p>
              </div>
              <div className="text-right pl-6">
                <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest mb-1">EXISTENCIA EN SISTEMA</p>
                <div className={`px-4 py-2 font-mono font-black text-xl shadow-inner ${ajuste.stock <= 3 ? 'bg-[var(--red-var)]/10 text-[var(--red-var)] border border-[var(--red-var)]/20' : 'bg-[var(--green-var)]/10 text-[var(--green-var)] border border-[var(--green-var)]/20'}`}>
                  {ajuste.stock}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="field">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">DIFERENCIA A APLICAR (+ /-)</label>
                <input className="inp font-mono !py-4 !text-2xl text-center rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black" type="number" value={ajuste.qty}
                  onChange={e => setAjuste(p => ({ ...p, qty: e.target.value }))}
                  placeholder="0" inputMode="numeric" />
                <p className="text-[9px] text-[var(--text2)] font-black text-center mt-2 uppercase opacity-60">USE (-) PARA DISMINUIR CANTIDADES</p>
              </div>
              <div className="field">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">JUSTIFICACIÓN DEL AJUSTE</label>
                <input className="inp !py-4 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black uppercase" value={ajuste.motivo || ''}
                  onChange={e => setAjuste(p => ({ ...p, motivo: e.target.value.toUpperCase() }))}
                  placeholder="CONTEO FÍSICO, ERROR DESCRIPCIÓN..." />
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-[var(--border-var)]">
              <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] flex-1 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer" onClick={() => setAjuste(null)}>ABORTAR</button>
              <button className="btn bg-[var(--orange-var)] text-white flex-2 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest" onClick={saveAjuste}>
                <span className="material-icons-round text-base">published_with_changes</span>
                <span>SINCRONIZAR STOCK</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={del}
        msg="¿Está seguro de eliminar este producto del inventario? Esta acción no se puede deshacer." danger />

      {/* MODAL DE FILTROS AVANZADOS Y REPORTES */}
      <Modal open={showFilterModal} onClose={() => setShowFilterModal(false)} title="REPORTE DE ALMACÉN" wide={false}>
        <div className="space-y-4 max-w-sm mx-auto">
          
          <div className="bg-[var(--surfaceDark)] p-4 border border-[var(--border-var)] shadow-inner space-y-4">
            
            {/* SECCIÓN STOCK - VERTICAL Y MÁS PEQUEÑO */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--teal)] mb-2 flex items-center gap-2">
                <span className="material-icons-round text-xs">inventory_2</span> EXISTENCIAS
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[8px] font-black uppercase opacity-60 block mb-1">MIN</label>
                  <input type="number" className="inp !py-1.5 text-center font-mono text-xs" value={advFilters.stockMin} onChange={e => setAdvFilters(p => ({ ...p, stockMin: e.target.value }))} placeholder="0" />
                </div>
                <div className="flex-1">
                  <label className="text-[8px] font-black uppercase opacity-60 block mb-1">MAX</label>
                  <input type="number" className="inp !py-1.5 text-center font-mono text-xs" value={advFilters.stockMax} onChange={e => setAdvFilters(p => ({ ...p, stockMax: e.target.value }))} placeholder="999" />
                </div>
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                <input type="checkbox" className="w-3 h-3 accent-[var(--teal)]" checked={advFilters.onlyInStock} onChange={e => setAdvFilters(p => ({ ...p, onlyInStock: e.target.checked }))} />
                <span className="text-[9px] font-black uppercase tracking-tighter opacity-70 group-hover:opacity-100">SOLO CON STOCK</span>
              </label>
            </div>

            <div className="h-px bg-[var(--border-var)] opacity-30"></div>

            {/* SECCIÓN PRECIOS - VERTICAL */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--teal)] mb-2 flex items-center gap-2">
                <span className="material-icons-round text-xs">monetization_on</span> RANGO PRECIOS ($)
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input type="number" className="inp !py-1.5 text-center font-mono text-xs" value={advFilters.priceMin} onChange={e => setAdvFilters(p => ({ ...p, priceMin: e.target.value }))} placeholder="MIN $" />
                </div>
                <div className="flex-1">
                  <input type="number" className="inp !py-1.5 text-center font-mono text-xs" value={advFilters.priceMax} onChange={e => setAdvFilters(p => ({ ...p, priceMax: e.target.value }))} placeholder="MAX $" />
                </div>
              </div>
            </div>

            <div className="h-px bg-[var(--border-var)] opacity-30"></div>

            {/* SECCIÓN ALFABETO - DESPLEGABLE */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--teal)] mb-2 flex items-center gap-2">
                <span className="material-icons-round text-xs">sort_by_alpha</span> FILTRAR POR INICIAL
              </p>
              <select 
                className="inp !py-1.5 font-black text-xs uppercase cursor-pointer"
                value={advFilters.letter} 
                onChange={e => setAdvFilters(p => ({ ...p, letter: e.target.value }))}
              >
                <option value="">TODAS LAS LETRAS (A-Z)</option>
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map(l => (
                  <option key={l} value={l}>INICIAL: {l}</option>
                ))}
              </select>
            </div>

            <div className="h-px bg-[var(--border-var)] opacity-30"></div>

            {/* COLUMNAS - MÁS COMPACTO */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text2)] mb-2 opacity-60">COLUMNAS EN REPORTE</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {Object.keys(advFilters.columns).map(col => (
                  <label key={col} className="flex items-center gap-1.5 cursor-pointer group">
                    <input type="checkbox" className="w-2.5 h-2.5 accent-[var(--teal)]" 
                      checked={advFilters.columns[col]} 
                      onChange={e => setAdvFilters(p => ({ ...p, columns: { ...p.columns, [col]: e.target.checked } }))} 
                    />
                    <span className="text-[8px] font-black uppercase tracking-tighter opacity-70 group-hover:opacity-100">{col}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-var)]">
            <button className="btn bg-[var(--teal)] text-white justify-center py-3 font-black uppercase text-[10px] transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest w-full" onClick={async () => {
              // Lógica de generación de reporte
              const all = await db.articulos.orderBy('descripcion').toArray()
              const filtered = all.filter(a => {
                const s = a.stock || 0
                const p = a.precio || 0
                const d = a.descripcion?.toUpperCase() || ''
                
                if (advFilters.onlyInStock && s <= 0) return false
                if (advFilters.stockMin !== '' && s < parseInt(advFilters.stockMin)) return false
                if (advFilters.stockMax !== '' && s > parseInt(advFilters.stockMax)) return false
                if (advFilters.priceMin !== '' && p < parseFloat(advFilters.priceMin)) return false
                if (advFilters.priceMax !== '' && p > parseFloat(advFilters.priceMax)) return false
                if (advFilters.letter !== '' && !d.startsWith(advFilters.letter)) return false
                return true
              })

              if (filtered.length === 0) {
                toast('No hay productos que coincidan', 'warn')
                return
              }

              const win = window.open('', '_blank')
              const rows = filtered.map(a => `
                <tr style="border-bottom: 1px solid #eee; font-size: 10px;">
                  ${advFilters.columns.codigo ? `<td style="padding: 4px;">${a.codigo}</td>` : ''}
                  ${advFilters.columns.descripcion ? `<td style="padding: 4px; font-weight: bold;">${a.descripcion}</td>` : ''}
                  ${advFilters.columns.marca ? `<td style="padding: 4px;">${a.marca || '-'}</td>` : ''}
                  ${advFilters.columns.departamento ? `<td style="padding: 4px;">${a.departamento || '-'}</td>` : ''}
                  ${advFilters.columns.stock ? `<td style="padding: 4px; text-align: center;">${a.stock}</td>` : ''}
                  ${advFilters.columns.precio ? `<td style="padding: 4px; text-align: right;">$${fmtUSD(a.precio)}</td>` : ''}
                </tr>
              `).join('')

              win.document.write(`
                <html>
                  <head>
                    <title>INVENTARIO - ${new Date().toLocaleDateString()}</title>
                    <style>
                      body { font-family: Inter, sans-serif; padding: 20px; color: #1e293b; }
                      header { border-bottom: 3px solid #14b8a6; padding-bottom: 10px; margin-bottom: 20px; }
                      table { width: 100%; border-collapse: collapse; }
                      th { background: #f8fafc; text-align: left; font-size: 9px; text-transform: uppercase; padding: 8px; border-bottom: 2px solid #e2e8f0; }
                      .footer { margin-top: 30px; font-size: 8px; text-align: center; opacity: 0.5; text-transform: uppercase; }
                    </style>
                  </head>
                  <body>
                    <header>
                      <h1 style="margin: 0; font-size: 18px;">KEYMASTER ERP - INVENTARIO</h1>
                      <div style="font-size: 9px; opacity: 0.7;">REPORTE GENERADO EL ${new Date().toLocaleString()}</div>
                      <div style="font-size: 9px; margin-top: 5px;">FILTROS: ${filtered.length} SKUS ENCONTRADOS</div>
                    </header>
                    <table>
                      <thead>
                        <tr>
                          ${advFilters.columns.codigo ? '<th>CÓDIGO</th>' : ''}
                          ${advFilters.columns.descripcion ? '<th>DESCRIPCIÓN</th>' : ''}
                          ${advFilters.columns.marca ? '<th>MARCA</th>' : ''}
                          ${advFilters.columns.departamento ? '<th>CATEGORÍA</th>' : ''}
                          ${advFilters.columns.stock ? '<th style="text-align: center;">STOCK</th>' : ''}
                          ${advFilters.columns.precio ? '<th style="text-align: right;">PRECIO</th>' : ''}
                        </tr>
                      </thead>
                      <tbody>${rows}</tbody>
                    </table>
                    <div class="footer">Este documento es una consulta de inventario para fines de auditoría interna.</div>
                  </body>
                </html>
              `)
              win.document.close()
              win.print()
              setShowFilterModal(false)
            }}>
              <span className="material-icons-round text-base">print</span>
              <span>GENERAR REPORTE</span>
            </button>
            <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] justify-center py-2 font-black uppercase text-[9px] transition-none cursor-pointer" onClick={() => {
              setAdvFilters({
                stockMin: '', stockMax: '', onlyInStock: false,
                brands: [], priceMin: '', priceMax: '', letter: '',
                columns: { codigo: true, descripcion: true, marca: true, departamento: true, stock: true, precio: true }
              })
            }}>RESETEAR FILTROS</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
