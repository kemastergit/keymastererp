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
        // Fallback para contextos sin HTTPS (crypto.randomUUID no disponible por IP)
        const uid = (typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10))
        const logEntry = {
            id: uid,
            fecha: new Date(),
            usuario_id: user.id,
            usuario_nombre: user.nombre,
            rol: user.rol,
            accion,
            table_name,
            record_id,
            old_value: old_value ? JSON.stringify(old_value) : null,
            new_value: new_value ? JSON.stringify(new_value) : null,
            ip_address: 'LOCAL_CLIENT',
            user_agent: navigator.userAgent,
            metadata: JSON.stringify(rest)
        }

        // 1. Guardar Local (Dexie)
        await db.auditoria.add(logEntry)

        // 2. Encolar para la Nube (Bandeja de Salida - Seguridad Blindada)
        // Acciones críticas que DEBEN ir a la nube para evitar borrado local malintencionado
        const accionesCriticas = [
            'VENTA_PROCESADA',
            'ANULACION',
            'CAMBIO_PRECIO',
            'AJUSTE_INVENTARIO',
            'LOGIN_FAIL',
            'PRODUCTO_CREADO',
            'PRODUCTO_DESACTIVADO',
            'BACKUP_EXPORTADO',
            'AUTORIZACION_ADMIN'
        ]

        if (accionesCriticas.includes(accion)) {
            const { addToSyncQueue } = await import('./syncManager')
            await addToSyncQueue('auditoria', 'INSERT', logEntry)
        }

    } catch (err) {
        console.error('Error logging audit action:', err)
    }
}
