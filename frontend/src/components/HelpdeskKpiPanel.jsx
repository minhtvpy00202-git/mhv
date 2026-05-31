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

function formatScore(score) {
  const safeScore = Number.isFinite(score) ? score : 0
  return `${safeScore.toFixed(1)}/100`
}

function formatSatisfaction(score) {
  const safeScore = Number(score) || 0
  if (safeScore <= 0) return '-'
  return `${safeScore.toFixed(1)}/5`
}

function getGradeTone(grade) {
  switch (grade) {
    case 'Xuất sắc':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
    case 'Tốt':
      return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300'
    case 'Khá':
      return 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300'
    case 'Trung bình':
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
    default:
      return 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
  }
}

function HelpdeskKpiPanel({
  title,
  subtitle,
  loading = false,
  summary,
  tableTitle = 'Bảng xếp hạng kỹ thuật viên',
  emptyText = 'Chưa có dữ liệu kỹ thuật viên.',
}) {
  const isAdminScope = summary?.scope === 'ADMIN'

  const cards = isAdminScope
    ? [
        {
          label: 'SLA đúng hạn',
          value: formatPercentage(summary?.onTimeSlaRate ?? 0),
          meta: `${summary?.onTimeResolvedTicketCount ?? 0} / ${summary?.resolvedTicketCount ?? 0} ticket`,
          tone: 'emerald',
        },
        {
          label: 'Quá hạn SLA',
          value: formatPercentage(summary?.overdueSlaRate ?? 0),
          meta: `${summary?.overdueTicketCount ?? 0} / ${summary?.activeTicketCount ?? 0} ticket đang mở`,
          tone: 'rose',
        },
        {
          label: 'Tài sản hoạt động tốt',
          value: formatPercentage(summary?.healthyAssetRate ?? 0),
          meta: `${summary?.healthyAssetCount ?? 0} / ${summary?.totalAssetCount ?? 0} tài sản`,
          tone: 'blue',
        },
        {
          label: 'Tỷ lệ tái lỗi',
          value: formatPercentage(summary?.repeatIncidentRate ?? 0),
          meta: `${summary?.repeatIncidentCount ?? 0} / ${summary?.resolvedTicketCount ?? 0} ticket`,
          tone: 'violet',
        },
        {
          label: 'Vật tư dưới ngưỡng',
          value: formatPercentage(summary?.lowStockConsumableRate ?? 0),
          meta: `${summary?.lowStockConsumableCount ?? 0} / ${summary?.totalConsumableCount ?? 0} mặt hàng`,
          tone: 'amber',
        },
        {
          label: 'Kiểm kê đúng hạn',
          value: formatPercentage(summary?.onTimeAuditRate ?? 0),
          meta: summary?.auditDueDateSampleCount
            ? `${summary?.onTimeAuditCount ?? 0} / ${summary?.auditDueDateSampleCount ?? 0} phiên có hạn kiểm kê`
            : 'Chưa có phiên kiểm kê nào đủ dữ liệu hạn',
          tone: 'sky',
        },
      ]
    : [
        {
          label: 'Tiếp nhận nhanh',
          value: formatPercentage(summary?.fastResponseRate ?? 0),
          meta: `${summary?.fastResponseCount ?? 0} / ${summary?.fastResponseSampleCount ?? 0} ticket đủ dữ liệu`,
          tone: 'sky',
        },
        {
          label: 'Hoàn tất đúng hạn',
          value: formatPercentage(summary?.onTimeResolutionRate ?? 0),
          meta: `${summary?.onTimeResolvedTicketCount ?? 0} / ${summary?.resolvedTicketCount ?? 0} ticket`,
          tone: 'emerald',
        },
        {
          label: 'Xử lý trung bình',
          value: formatResolutionMinutes(summary?.averageResolutionMinutes ?? 0),
          meta: `Đang phụ trách ${summary?.inProgressTicketCount ?? 0} ticket`,
          tone: 'blue',
        },
        {
          label: 'Tỷ lệ tái lỗi',
          value: formatPercentage(summary?.repeatIncidentRate ?? 0),
          meta: `${summary?.repeatIncidentCount ?? 0} / ${summary?.resolvedTicketCount ?? 0} ticket`,
          tone: 'rose',
        },
        {
          label: 'Thành công lần đầu',
          value: formatPercentage(summary?.firstTimeFixRate ?? 0),
          meta: `${summary?.firstTimeFixCount ?? 0} / ${summary?.resolvedTicketCount ?? 0} ticket`,
          tone: 'violet',
        },
        {
          label: 'Hài lòng người dùng',
          value: formatSatisfaction(summary?.averageSatisfactionScore ?? 0),
          meta: `${summary?.satisfactionSampleCount ?? 0} ticket đã được chấm điểm`,
          tone: 'blue',
        },
        {
          label: 'Xếp loại',
          value: summary?.performanceGrade || '-',
          meta: `Điểm tổng: ${formatScore(summary?.performanceScore ?? 0)}`,
          tone: 'amber',
          className: getGradeTone(summary?.performanceGrade),
        },
      ]

  const toneClasses = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    blue: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
    rose: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
    violet: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300',
    sky: 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300',
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-7 w-20 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
          <div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map((card) => (
              <div key={card.label} className={`rounded-xl border p-4 ${card.className || toneClasses[card.tone]}`}>
                <p className="text-xs font-medium opacity-80">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold">{card.value}</p>
                <p className="mt-1 text-xs opacity-80">{card.meta}</p>
              </div>
            ))}
          </div>

            <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{tableTitle}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-2 text-left">Kỹ thuật viên</th>
                    <th className="px-4 py-2 text-left">Tổng được giao</th>
                    <th className="px-4 py-2 text-left">Tiếp nhận nhanh</th>
                    <th className="px-4 py-2 text-left">Đúng hạn</th>
                    <th className="px-4 py-2 text-left">Xử lý TB</th>
                    <th className="px-4 py-2 text-left">Tái lỗi</th>
                    <th className="px-4 py-2 text-left">Lần đầu</th>
                    <th className="px-4 py-2 text-left">Hài lòng</th>
                    <th className="px-4 py-2 text-left">Xếp loại</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.ticketsByTechnician || []).map((item) => (
                    <tr key={item.technicianId || item.technicianUsername} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{item.technicianName || item.technicianUsername}</p>
                        {item.technicianUsername && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">{item.technicianUsername}</p>
                        )}
                      </td>
                      <td className="px-4 py-2">{item.assignedTicketCount}</td>
                      <td className="px-4 py-2">{formatPercentage(item.fastResponseRate)}</td>
                      <td className="px-4 py-2">{formatPercentage(item.onTimeResolutionRate)}</td>
                      <td className="px-4 py-2">{formatResolutionMinutes(item.averageResolutionMinutes)}</td>
                      <td className="px-4 py-2">{formatPercentage(item.repeatIncidentRate)}</td>
                      <td className="px-4 py-2">{formatPercentage(item.firstTimeFixRate)}</td>
                      <td className="px-4 py-2">{formatSatisfaction(item.averageSatisfactionScore)}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getGradeTone(item.performanceGrade)}`}>
                          {item.performanceGrade || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!summary?.ticketsByTechnician || summary.ticketsByTechnician.length === 0) && (
                    <tr>
                      <td colSpan={9} className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
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
