import { createBrowserRouter } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Facturacion from './pages/Facturacion'
import Cotizaciones from './pages/Cotizaciones'
import Inventario from './pages/Inventario'
import Clientes from './pages/Clientes'
import Proveedores from './pages/Proveedores'
import CuentasCobrar from './pages/CuentasCobrar'
import CuentasPagar from './pages/CuentasPagar'
import Devoluciones from './pages/Devoluciones'
import CajaChica from './pages/CajaChica'
import CierreDia from './pages/CierreDia'
import Reportes from './pages/Reportes'
import Admin from './pages/Admin'
import Dashboard from './pages/Dashboard'
import Planes from './pages/Planes'


export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'facturacion', element: <Facturacion /> },

      { path: 'cotizaciones', element: <Cotizaciones /> },
      { path: 'inventario', element: <Inventario /> },
      { path: 'clientes', element: <Clientes /> },
      { path: 'proveedores', element: <Proveedores /> },
      { path: 'cobrar', element: <CuentasCobrar /> },
      { path: 'pagar', element: <CuentasPagar /> },
      { path: 'devoluciones', element: <Devoluciones /> },
      { path: 'caja', element: <CajaChica /> },
      { path: 'cierre', element: <CierreDia /> },
      { path: 'reportes', element: <Reportes /> },
      { path: 'admin', element: <Admin /> },
      { path: 'planes', element: <Planes /> },
    ]
  }
])
