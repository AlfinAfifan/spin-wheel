import type { ReactNode } from 'react'

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-ink-300 bg-ink-100 px-1.5 font-mono text-[10px] font-semibold text-ink-700 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200">
      {children}
    </kbd>
  )
}
