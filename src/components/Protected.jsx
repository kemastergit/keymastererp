import { Navigate } from 'react-router-dom'
import useStore from '../store/useStore'

export default function Protected({ children }) {
    const currentUser = useStore(s => s.currentUser)
    if (!currentUser) return <Navigate to="/login" replace />
    return children
}
