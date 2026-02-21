import { useState } from 'react'
import Modal from './Modal'
import useStore from '../../store/useStore'
import { getConfig } from '../../db/db'

export default function AdminModal() {
  const { adminCb, clearAdmin, toast } = useStore()
  const [clave, setClave] = useState('')

  const check = async () => {
    const stored = await getConfig('clave_admin')
    if (clave === (stored || 'admin123')) {
      clearAdmin()
      setClave('')
      adminCb && adminCb()
    } else {
      toast('Clave incorrecta', 'error')
      setClave('')
    }
  }

  return (
    <Modal open={!!adminCb} onClose={() => { clearAdmin(); setClave('') }} title="🔐 ACCESO ADMIN">
      <div className="field">
        <label>Clave de administrador</label>
        <input
          type="password"
          className="inp"
          value={clave}
          onChange={e => setClave(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="••••••••"
          autoFocus
        />
      </div>
      <button className="btn btn-r btn-full mt-2" onClick={check}>INGRESAR</button>
    </Modal>
  )
}
