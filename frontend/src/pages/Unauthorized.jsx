import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

function Unauthorized() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-fptOrangeDark">
          <ShieldAlert size={24} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">403 Unauthorized</h1>
        <p className="mt-2 text-sm text-slate-600">
          Bạn không có quyền truy cập vào tài nguyên này. Vui lòng quay lại trang phù hợp với vai trò của bạn.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            to="/mobile/home"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Về Mobile
          </Link>
          <Link
            to="/admin/dashboard"
            className="rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
          >
            Về Admin
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Unauthorized
