const variantClassMap = {
  default: 'border-slate-300 text-slate-700 hover:bg-slate-50',
  primary: 'border-blue-300 text-blue-700 hover:bg-blue-50',
  success: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
  warning: 'border-amber-300 text-amber-700 hover:bg-amber-50',
  danger: 'border-red-300 text-red-700 hover:bg-red-50',
  info: 'border-sky-300 text-sky-700 hover:bg-sky-50',
  violet: 'border-violet-300 text-violet-700 hover:bg-violet-50',
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
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${className}`.trim()}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      <span className="sr-only">{label}</span>
    </button>
  )
}

export default ActionIconButton
