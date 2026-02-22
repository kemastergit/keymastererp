import useStore from '../../store/useStore'

export default function Toast() {
  const toasts = useStore(s => s.toasts)
  return (
    <div className="fixed top-16 right-2 z-[600] flex flex-col gap-1.5 max-w-[calc(100vw-16px)]">
      {toasts.map(t => (
        <div key={t.id} className={`
          px-4 py-2.5 rounded-md text-sm font-raj font-semibold tracking-wide shadow-lg
          border-l-4 bg-white animate-slide-in
          ${t.type === 'error' ? 'border-rojo' : t.type === 'warn' ? 'border-amber-500' : 'border-green-500'}
        `}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}
