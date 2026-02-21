import { Outlet } from 'react-router-dom'
import Header from './Header'
import NavTop from './NavTop'
import NavBottom from './NavBottom'
import Toast from '../UI/Toast'
import AdminModal from '../UI/AdminModal'

export default function Layout() {
  return (
    <>
      <Header />
      <NavTop />
      <main className="max-w-[1400px] mx-auto px-2.5 py-2.5 pb-20 md:pb-4 md:px-4">
        <Outlet />
      </main>
      <NavBottom />
      <Toast />
      <AdminModal />
    </>
  )
}
