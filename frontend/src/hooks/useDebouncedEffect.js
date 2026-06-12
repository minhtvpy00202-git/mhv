import { useEffect, useRef } from 'react'

export default function useDebouncedEffect(effect, deps, delay = 300, skipInitial = false) {
  const latestEffectRef = useRef(effect)
  const isFirstRunRef = useRef(true)

  useEffect(() => {
    latestEffectRef.current = effect
  }, [effect])

  useEffect(() => {
    if (skipInitial && isFirstRunRef.current) {
      isFirstRunRef.current = false
      return undefined
    }

    const timer = window.setTimeout(() => {
      latestEffectRef.current()
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [...deps, delay, skipInitial])
}
