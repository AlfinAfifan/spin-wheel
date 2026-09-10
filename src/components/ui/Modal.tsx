import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Extra content on the right side of the header */
  headerActions?: ReactNode
}

const sizeClass = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-[min(96vw,1400px)]',
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', headerActions }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Lock body scroll while open; release focus when closing so global shortcuts work immediately
  useEffect(() => {
    if (!open) {
      const active = document.activeElement
      if (active instanceof HTMLElement && panelRef.current?.contains(active)) active.blur()
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cn(
              'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-ink-900 dark:ring-1 dark:ring-ink-700',
              sizeClass[size],
            )}
          >
            {(title || headerActions) && (
              <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
                <div className="min-w-0">
                  {title && <h2 className="text-lg font-semibold leading-tight">{title}</h2>}
                  {description && <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">{description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {headerActions}
                  <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && (
              <div className="border-t border-ink-100 px-5 py-3 dark:border-ink-800">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
