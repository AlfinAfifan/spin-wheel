import { useCallback, useEffect, useState } from 'react'

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false,
  )

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const enter = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen?.()
    } catch {
      /* browser refused */
    }
  }, [])

  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch {
      /* ignore */
    }
  }, [])

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void exit()
    else void enter()
  }, [enter, exit])

  return { isFullscreen, enter, exit, toggle, supported: typeof document !== 'undefined' && 'requestFullscreen' in document.documentElement }
}
