import Modal from './Modal'

export default function Confirm({ open, onClose, onConfirm, msg, danger }) {
  return (
    <Modal open={open} onClose={onClose} title="CONFIRMAR">
      <p className="text-sm mb-4 text-white/80">{msg}</p>
      <div className="flex gap-2">
        <button className="btn btn-gr flex-1" onClick={onClose}>Cancelar</button>
        <button className={`btn flex-1 ${danger ? 'btn-r' : 'btn-g'}`} onClick={() => { onConfirm(); onClose() }}>
          Confirmar
        </button>
      </div>
    </Modal>
  )
}
