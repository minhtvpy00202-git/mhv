import { useEffect, useState } from 'react'
import { formatCurrentDateTime, getCurrentTimeZoneLabel, getUserTimeZone } from '../utils/datetime'

export default function UserTimeClock({
  className = '',
  compact = false,
  light = false,
}) {
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const timeZoneLabel = `${getCurrentTimeZoneLabel(currentTime)} • ${getUserTimeZone()}`
  const toneClassName = light
    ? 'border-white/20 bg-white/10 text-white'
    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100'

  if (compact) {
    return (
      <div className={`rounded-xl border px-3 py-2 text-right shadow-sm ${toneClassName} ${className}`.trim()}>
        <p className="text-sm font-semibold tabular-nums">{formatCurrentDateTime(currentTime)}</p>
        <p className="text-[11px] opacity-80">{timeZoneLabel}</p>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border px-3.5 py-2.5 shadow-sm ${toneClassName} ${className}`.trim()}>
      <p className="text-sm font-semibold tabular-nums">{formatCurrentDateTime(currentTime)}</p>
      <p className="mt-1 text-xs opacity-80">{timeZoneLabel}</p>
    </div>
  )
}
