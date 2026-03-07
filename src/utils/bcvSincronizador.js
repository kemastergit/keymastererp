import useStore from '../store/useStore'

/**
 * Función para obtener la tasa oficial del BCV desde un API público
 * y actualizarla en el sistema (Dexie + Supabase)
 */
export async function syncOfficialBcvRate() {
    const { tasaOficial, setTasaOficial, currentUser } = useStore.getState()

    // Solo los administradores o cajeros "empujan" el cambio a la nube
    // para evitar que 20 terminales hagan el mismo fetch al tiempo
    const canUpdateCloud = currentUser?.rol === 'ADMIN' || currentUser?.rol === 'CAJERO'

    try {
        console.log("🏛️ Consultando Tasa BCV Oficial...")

        // Usamos ve.dolarapi.com/v1/dolares/oficial que es el endpoint correcto
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial')

        if (!response.ok) throw new Error('Error al conectar con DolarAPI')

        const data = await response.json()
        const nuevaTasa = parseFloat(data.promedio) || parseFloat(data.monto) || parseFloat(data.valor)

        if (nuevaTasa && nuevaTasa !== tasaOficial) {
            console.log(`✅ Nueva Tasa BCV detectada: Bs ${nuevaTasa}`)

            if (canUpdateCloud) {
                await setTasaOficial(nuevaTasa)
            } else {
                // Si es vendedor, solo la actualiza localmente en su store
                useStore.setState({ tasaOficial: nuevaTasa })
            }
        }
    } catch (error) {
        console.error("❌ Fallo al obtener tasa BCV automática:", error.message)
    }
}
