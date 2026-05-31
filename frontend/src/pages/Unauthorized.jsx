import { IconShield as ShieldAlert } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTechSupportHomePath } from '../utils/navigation'

function Unauthorized() {
  const { user } = useAuth()
  const homePath = user?.role === 'Admin'
    ? '/admin/dashboard'
    : user?.role === 'ConsumableManager'
      ? '/supply/consumables'
    : user?.role === 'TechSupport'
      ? getTechSupportHomePath()
      : '/mobile/home'

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow dark:bg-slate-900">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-fptOrangeDark">
          <ShieldAlert size={24} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">403 Unauthorized</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Bạn không có quyền truy cập vào tài nguyên này. Vui lòng quay lại trang phù hợp với vai trò của bạn.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            to={homePath}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Về trang chính
          </Link>
          <Link
            to="/"
            className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
          >
            Tự động điều hướng
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Unauthorized
