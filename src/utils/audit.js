import { db } from '../db/db'

export async function logAction(user, accion, metadata = {}) {
    if (!user) return

    const {
        table_name = null,
        record_id = null,
        old_value = null,
        new_value = null,
        ...rest
    } = metadata

    try {
        await db.auditoria.add({
            fecha: new Date(),
            usuario_id: user.id,
            usuario_nombre: user.nombre,
            rol: user.rol,
            accion, // CREATE | UPDATE | DELETE | APPLY | CANCEL | LOGIN | LOGIN_FAIL | PRICE_CHANGE | ROLE_CHANGE
            table_name,
            record_id,
            old_value: old_value ? JSON.stringify(old_value) : null,
            new_value: new_value ? JSON.stringify(new_value) : null,
            ip_address: 'LOCAL_CLIENT', // En PWA/Client no tenemos IP real fácilmente sin servicio externo
            user_agent: navigator.userAgent,
            metadata: JSON.stringify(rest)
        })
    } catch (err) {
        console.error('Error logging audit action:', err)
    }
}
