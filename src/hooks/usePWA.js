import { useState, useEffect } from 'react'

export function usePWA() {
    const [installPrompt, setInstallPrompt] = useState(null)
    const [isInstalled, setIsInstalled] = useState(false)

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault()
            setInstallPrompt(e)
        }

        window.addEventListener('beforeinstallprompt', handler)

        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            setIsInstalled(true)
        }

        const appInstalledHandler = () => {
            setIsInstalled(true)
            setInstallPrompt(null)
        }
        window.addEventListener('appinstalled', appInstalledHandler)

        return () => {
            window.removeEventListener('beforeinstallprompt', handler)
            window.removeEventListener('appinstalled', appInstalledHandler)
        }
    }, [])

    const install = async () => {
        if (!installPrompt) return false

        installPrompt.prompt()
        const { outcome } = await installPrompt.userChoice

        if (outcome === 'accepted') {
            setInstallPrompt(null)
            return true
        }
        return false
    }

    return { canInstall: !!installPrompt, isInstalled, install }
}
