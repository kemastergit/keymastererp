export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[5000] flex items-end md:items-center justify-center p-0 md:p-6">
      {/* Overlay - full screen and captures all clicks outside content */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className={`relative bg-[var(--surface)] border border-[var(--border-var)] w-full
        ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}
        shadow-[var(--win-shadow)] z-[5001] max-h-full overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-10 md:slide-in-from-bottom-0 duration-200`}>
        {title && (
          <div className="flex items-center justify-between px-3 min-h-[32px] bg-[var(--surface2)] border-b border-[var(--border-var)] select-none">
            <h2 className="font-['IBM_Plex_Mono'] font-bold text-[11px] uppercase tracking-wider text-[var(--teal)]">{title}</h2>
            <button onClick={onClose} className="w-[20px] h-[20px] flex items-center justify-center border border-[var(--border-var)] hover:bg-[var(--red-var)] hover:text-white hover:border-[var(--red-var)] transition-colors">
              <span className="text-[10px] pb-px">✕</span>
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
