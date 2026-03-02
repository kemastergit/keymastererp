import { createBrowserRouter, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Facturacion from './pages/Facturacion'
import Cotizaciones from './pages/Cotizaciones'
import Inventario from './pages/Inventario'
import Clientes from './pages/Clientes'
import Proveedores from './pages/Proveedores'
import CuentasCobrar from './pages/CuentasCobrar'
import CuentasPagar from './pages/CuentasPagar'
import Devoluciones from './pages/Devoluciones'
import Caja from './pages/Caja'
import CajaChica from './pages/CajaChica'
import CierreDia from './pages/CierreDia'
import Reportes from './pages/Reportes'
import Admin from './pages/Admin'
import Dashboard from './pages/Dashboard'
import Planes from './pages/Planes'
import Usuarios from './pages/Usuarios'
import Auditoria from './pages/Auditoria'
import Login from './pages/Login'
import Protected from './components/Protected'
import Config from './pages/Config'
import Etiquetas from './pages/Etiquetas'
import Ayuda from './pages/Ayuda'
import Compras from './pages/Compras'
import ComprasHistorial from './pages/Compras/Historial'
import Comisiones from './pages/Comisiones'
import Radar from './pages/Radar'
import Catalogo from './pages/Catalogo'
import PedidosWeb from './pages/PedidosWeb'
import ErrorBoundary from './components/UI/ErrorBoundary'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
    errorElement: <ErrorBoundary />
  },
  {
    path: '/catalogo',
    element: <Catalogo />,
    errorElement: <ErrorBoundary />
  },
  {
    path: '/',
    element: <Protected><Layout /></Protected>,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'facturacion', element: <Facturacion /> },
      { path: 'cotizaciones', element: <Cotizaciones /> },
      { path: 'compras', element: <Compras /> },
      { path: 'compras-historial', element: <ComprasHistorial /> },
      { path: 'inventario', element: <Inventario /> },
      { path: 'clientes', element: <Clientes /> },
      { path: 'proveedores', element: <Proveedores /> },
      { path: 'cobrar', element: <CuentasCobrar /> },
      { path: 'pagar', element: <CuentasPagar /> },
      { path: 'devoluciones', element: <Devoluciones /> },
      { path: 'caja', element: <Caja /> },
      { path: 'caja-chica', element: <CajaChica /> },
      { path: 'cierre', element: <CierreDia /> },
      { path: 'reportes', element: <Reportes /> },
      { path: 'usuarios', element: <Usuarios /> },
      { path: 'auditoria', element: <Auditoria /> },
      { path: 'admin', element: <Admin /> },
      { path: 'planes', element: <Planes /> },
      { path: 'config', element: <Config /> },
      { path: 'etiquetas', element: <Etiquetas /> },
      { path: 'radar', element: <Radar /> },
      { path: 'ayuda', element: <Ayuda /> },
      { path: 'comisiones', element: <Comisiones /> },
      { path: 'pedidos-web', element: <PedidosWeb /> },
    ]
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
])
