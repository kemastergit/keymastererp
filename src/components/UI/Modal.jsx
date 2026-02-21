export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative bg-g2 border border-borde rounded-t-2xl sm:rounded-xl w-full
        ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}
        shadow-2xl z-10 max-h-[90vh] overflow-y-auto`}>
        <div className="w-10 h-1 bg-borde rounded mx-auto mt-3 mb-3 sm:hidden" />
        {title && (
          <div className="flex items-center justify-between px-4 pb-3 border-b border-borde">
            <h2 className="font-bebas text-xl tracking-widest text-rojo-bright">{title}</h2>
            <button onClick={onClose} className="text-muted hover:text-white text-xl leading-none">✕</button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
