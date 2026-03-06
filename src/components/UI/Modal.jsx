export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[5000] flex items-end md:items-center justify-center p-0 md:p-6">
      {/* Overlay - full screen and captures all clicks outside content */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className={`relative bg-white border border-slate-100 w-full overflow-hidden
        ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}
        md:rounded-2xl shadow-2xl z-[5001] max-h-full flex flex-col animate-in zoom-in-95 slide-in-from-bottom-10 md:slide-in-from-bottom-0 duration-200`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-b border-slate-100 select-none">
            <h2 className="font-['Inter'] font-bold text-sm text-[var(--teal)] uppercase tracking-wider">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
              <span className="material-icons-round text-[18px]">close</span>
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto custom-scroll">{children}</div>
      </div>
    </div>
  )
}
