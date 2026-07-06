import { useEffect, useState } from 'react'
import { formatCurrentDateTime, getCurrentTimeZoneLabel, getUserTimeZone } from '../utils/datetime'

export default function UserTimeClock({
  className = '',
  compact = false,
  light = false,
  minimal = false,
  showTimeZone = true,
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
  const hours = String(currentTime.getHours()).padStart(2, '0')
  const minutes = String(currentTime.getMinutes()).padStart(2, '0')
  const seconds = String(currentTime.getSeconds()).padStart(2, '0')
  const showSeparator = currentTime.getSeconds() % 2 === 0

  if (compact) {
    if (minimal) {
      return (
        <div
          aria-label={`Bây giờ là ${hours}:${minutes}:${seconds}`}
          className={`inline-flex w-auto items-center rounded-xl border px-3 py-2 shadow-sm ${toneClassName} ${className}`.trim()}
        >
          <p className="font-digital-clock flex items-center text-sm font-semibold leading-none tracking-[0.04em]">
            <span>{hours}</span>
            <span className={`inline-block px-0.5 transition-opacity duration-150 ${showSeparator ? 'opacity-100' : 'opacity-25'}`}>:</span>
            <span>{minutes}</span>
            <span className={`inline-block px-0.5 transition-opacity duration-150 ${showSeparator ? 'opacity-100' : 'opacity-25'}`}>:</span>
            <span>{seconds}</span>
          </p>
        </div>
      )
    }

    return (
      <div className={`rounded-xl border px-3 py-2 text-right shadow-sm ${toneClassName} ${className}`.trim()}>
        <p className="font-digital-clock text-sm font-semibold">{formatCurrentDateTime(currentTime)}</p>
        {showTimeZone && <p className="text-[11px] opacity-80">{timeZoneLabel}</p>}
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border px-3.5 py-2.5 shadow-sm ${toneClassName} ${className}`.trim()}>
      <p className="font-digital-clock text-sm font-semibold">{formatCurrentDateTime(currentTime)}</p>
      {showTimeZone && <p className="mt-1 text-xs opacity-80">{timeZoneLabel}</p>}
    </div>
  )
}
