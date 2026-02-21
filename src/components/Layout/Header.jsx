import { useEffect } from 'react'
import useStore from '../../store/useStore'

export default function Header() {
  const { tasa, setTasa, loadTasa } = useStore()

  useEffect(() => { loadTasa() }, [])

  return (
    <header className="sticky top-0 z-[200] flex items-center justify-between px-3 h-14
      bg-gradient-to-r from-negro via-red-950/30 to-negro border-b-2 border-rojo
      shadow-[0_4px_20px_rgba(220,38,38,0.25)]">

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-9 h-9 flex-shrink-0 bg-rojo flex items-center justify-center text-lg
          [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]">
          🔧
        </div>
        <div className="min-w-0">
          <h1 className="font-bebas text-[clamp(0.95rem,3.5vw,1.4rem)] tracking-[2px] text-white
            whitespace-nowrap overflow-hidden text-ellipsis leading-none">
            AUTOMOTORES GUAICAIPURO
          </h1>
          <span className="hidden sm:block font-mono2 text-[0.55rem] text-rojo-bright tracking-[1.5px]">
            SISTEMA DE GESTIÓN v1.0 — REACT
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 bg-red-900/20 border border-rojo-dark
        rounded px-2 py-1 flex-shrink-0">
        <label className="hidden sm:block font-mono2 text-[0.6rem] text-muted whitespace-nowrap">
          TASA BCV Bs/$
        </label>
        <input
          type="number"
          value={tasa || ''}
          onChange={e => setTasa(e.target.value)}
          placeholder="0.00"
          step="0.01"
          inputMode="decimal"
          className="bg-transparent border-none text-rojo-bright font-bebas text-lg
            w-[70px] text-center outline-none placeholder-muted"
        />
      </div>
    </header>
  )
}
