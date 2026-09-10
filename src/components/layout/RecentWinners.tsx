import { ChevronRight, Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useDrawStore } from '@/stores/draw.store'
import { cn, formatTime } from '@/lib/utils'

export function RecentWinners({ className }: { className?: string }) {
  const winners = useDrawStore((s) => s.winners)
  const isSpinning = useDrawStore((s) => s.isSpinning)
  const openModal = useDrawStore((s) => s.openModal)
  const recent = winners.slice(-6).reverse()

  return (
    <aside className={cn('flex flex-col rounded-2xl border border-ink-200/70 bg-white/70 p-3 backdrop-blur dark:border-ink-800 dark:bg-ink-900/60', className)}>
      <button
        type="button"
        onClick={() => openModal('history')}
        disabled={isSpinning}
        className="flex items-center justify-between rounded-lg px-1 py-1 text-left hover:bg-ink-100 disabled:opacity-60 dark:hover:bg-ink-800"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Trophy className="h-4 w-4 text-brand-500" />
          Recent Winners
          <span className="rounded-full bg-ink-100 px-1.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">{winners.length}</span>
        </span>
        <ChevronRight className="h-4 w-4 text-ink-400" />
      </button>
      <ul className="mt-2 flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {recent.length === 0 && (
            <li className="px-1 py-6 text-center text-xs text-ink-400">Belum ada pemenang.</li>
          )}
          {recent.map((w, i) => (
            <motion.li
              key={w.id}
              layout
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className={cn(
                'flex items-center gap-3 rounded-xl px-2.5 py-2',
                i === 0 ? 'bg-brand-500/10 ring-1 ring-brand-400/40' : 'bg-ink-50 dark:bg-ink-800/60',
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                {winners.length - i}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{w.name}</p>
                <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                  {w.prizeName} · {w.employeeId}
                </p>
              </div>
              <span className="shrink-0 text-[10px] tabular-nums text-ink-400">{formatTime(w.drawnAt)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </aside>
  )
}
