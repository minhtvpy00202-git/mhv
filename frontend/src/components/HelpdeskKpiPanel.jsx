function formatPercentage(value) {
  const safeValue = Number.isFinite(value) ? value : 0
  return `${safeValue.toFixed(1)}%`
}

function formatResolutionMinutes(minutes) {
  const safeMinutes = Number(minutes) || 0
  if (safeMinutes <= 0) return '-'
  if (safeMinutes < 60) return `${safeMinutes} phút`

  const hours = Math.floor(safeMinutes / 60)
  const remainMinutes = safeMinutes % 60
  if (remainMinutes === 0) {
    return `${hours} giờ`
  }
  return `${hours} giờ ${remainMinutes} phút`
}

function HelpdeskKpiPanel({
  title,
  subtitle,
  loading = false,
  summary,
  newTicketLabel = 'Tổng ticket mới',
  tableTitle = 'Số ticket theo kỹ thuật viên',
  emptyText = 'Chưa có dữ liệu kỹ thuật viên.',
}) {
  const cards = [
    { label: newTicketLabel, value: summary?.newTicketCount ?? 0, tone: 'amber' },
    { label: 'Tổng ticket đã xử lý', value: summary?.resolvedTicketCount ?? 0, tone: 'emerald' },
    { label: 'Tổng ticket đang xử lý', value: summary?.inProgressTicketCount ?? 0, tone: 'blue' },
    { label: 'Tỷ lệ quá hạn SLA', value: formatPercentage(summary?.overdueSlaRate ?? 0), tone: 'rose' },
    { label: 'Thời gian xử lý trung bình', value: formatResolutionMinutes(summary?.averageResolutionMinutes ?? 0), tone: 'violet' },
    { label: 'Phản hồi đầu tiên TB', value: formatResolutionMinutes(summary?.averageFirstResponseMinutes ?? 0), tone: 'sky' },
  ]

  const toneClasses = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
    sky: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="mt-3 h-7 w-20 rounded bg-slate-200" />
              </div>
            ))}
          </div>
          <div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-6">
            {cards.map((card) => (
              <div key={card.label} className={`rounded-xl border p-4 ${toneClasses[card.tone]}`}>
                <p className="text-xs font-medium opacity-80">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold">{card.value}</p>
              </div>
            ))}
          </div>

          
          <div className="mt-4 rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-700">{tableTitle}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Kỹ thuật viên</th>
                    <th className="px-4 py-2 text-left">Tổng được giao</th>
                    <th className="px-4 py-2 text-left">Đang xử lý</th>
                    <th className="px-4 py-2 text-left">Đã xử lý</th>
                    <th className="px-4 py-2 text-left">Quá hạn</th>
                    <th className="px-4 py-2 text-left">Phản hồi đầu tiên TB</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.ticketsByTechnician || []).map((item) => (
                    <tr key={item.technicianId || item.technicianUsername} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <p className="font-medium text-slate-800">{item.technicianName || item.technicianUsername}</p>
                        {item.technicianUsername && (
                          <p className="text-xs text-slate-500">{item.technicianUsername}</p>
                        )}
                      </td>
                      <td className="px-4 py-2">{item.assignedTicketCount}</td>
                      <td className="px-4 py-2">{item.inProgressTicketCount}</td>
                      <td className="px-4 py-2">{item.resolvedTicketCount}</td>
                      <td className="px-4 py-2">{item.overdueTicketCount}</td>
                      <td className="px-4 py-2">{formatResolutionMinutes(item.averageFirstResponseMinutes)}</td>
                    </tr>
                  ))}
                  {(!summary?.ticketsByTechnician || summary.ticketsByTechnician.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-center text-slate-500">
                        {emptyText}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default HelpdeskKpiPanel
