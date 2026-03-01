import useStore from '../../store/useStore'

export default function Toast() {
  const toasts = useStore(s => s.toasts)
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[600] flex flex-col items-center gap-1.5 max-w-[calc(100vw-16px)] pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`
          px-4 py-2 text-[11px] font-bold uppercase tracking-widest shadow-[var(--shadow2)] min-w-[300px] text-center
          animate-slide-in text-white pointer-events-auto
          ${t.type === 'error' ? 'bg-[var(--red-var)]' : t.type === 'warn' ? 'bg-[var(--orange-var)]' : 'bg-[var(--teal)]'}
        `}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}
