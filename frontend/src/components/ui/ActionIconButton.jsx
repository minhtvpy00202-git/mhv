const variantClassMap = {
  default: 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  primary: 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-500/10',
  success: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-500/10',
  warning: 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/40 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-500/10',
  danger: 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10',
  info: 'border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-500/40 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-sky-500/10',
  violet: 'border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-500/40 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-violet-500/10',
}

function ActionIconButton({
  icon: Icon,
  label,
  variant = 'default',
  className = '',
  type = 'button',
  ...props
}) {
  const variantClass = variantClassMap[variant] || variantClassMap.default

  return (
    <button
      type={type}
      aria-label={label}
      className={`group relative inline-flex h-8 w-8 items-center justify-center rounded-md border bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 ${variantClass} ${className}`.trim()}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {label ? (
        <span className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-75 group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-slate-100 dark:text-slate-900">
          {label}
        </span>
      ) : null}
      <span className="sr-only">{label}</span>
    </button>
  )
}

export default ActionIconButton
