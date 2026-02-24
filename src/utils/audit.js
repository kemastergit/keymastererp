import { db } from '../db/db'

export async function logAction(user, accion, metadata = {}) {
    if (!user) return

    try {
        await db.auditoria.add({
            fecha: new Date(),
            usuario_id: user.id,
            usuario_nombre: user.nombre,
            rol: user.rol,
            accion,
            metadata: JSON.stringify(metadata)
        })
    } catch (err) {
        console.error('Error logging audit action:', err)
    }
}
