import { useEffect } from 'react'
import { isTypingTarget } from '@/lib/utils'

export interface ShortcutHandlers {
  onSpin?: () => void
  onEscape?: () => void
  onFullscreen?: () => void
  onParticipants?: () => void
  onHistory?: () => void
  onSettings?: () => void
  onImport?: () => void
  onWheel?: () => void
}

/**
 * Global keyboard shortcuts:
 *  Space / Enter = Spin, Esc = close, F = fullscreen,
 *  P = participants, H = history, S = settings, I = import, W = wheel picker
 */
export function useKeyboardShortcuts(h: ShortcutHandlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const typing = isTypingTarget(e.target)

      if (e.key === 'Escape') {
        h.onEscape?.()
        return
      }
      if (typing) return

      switch (e.key) {
        case ' ':
        case 'Enter':
          if (e.repeat) return
          e.preventDefault()
          h.onSpin?.()
          break
        case 'f':
        case 'F':
          e.preventDefault()
          h.onFullscreen?.()
          break
        case 'p':
        case 'P':
          e.preventDefault()
          h.onParticipants?.()
          break
        case 'h':
        case 'H':
          e.preventDefault()
          h.onHistory?.()
          break
        case 's':
        case 'S':
          e.preventDefault()
          h.onSettings?.()
          break
        case 'i':
        case 'I':
          e.preventDefault()
          h.onImport?.()
          break
        case 'w':
        case 'W':
          e.preventDefault()
          h.onWheel?.()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [h])
}
