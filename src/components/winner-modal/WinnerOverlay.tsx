import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import confetti from 'canvas-confetti'
import { ArrowRight, RotateCcw, Trophy } from 'lucide-react'
import { useDrawStore } from '@/stores/draw.store'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { playWin } from '@/lib/sound'
import { cn } from '@/lib/utils'

function fireConfetti(durationMs = 3200) {
  const end = Date.now() + durationMs
  const colors = ['#fde047', '#fb923c', '#f43f5e', '#22d3ee', '#a3e635', '#c084fc', '#ffffff']

  // Initial big burst
  confetti({ particleCount: 160, spread: 100, startVelocity: 55, origin: { y: 0.6 }, colors, zIndex: 80 })

  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, zIndex: 80 })
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, zIndex: 80 })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

// Static sparkle positions (percentages) so they stay stable between renders
const SPARKLES = [
  { x: '8%', y: '18%', size: 6, delay: '0s' },
  { x: '18%', y: '70%', size: 4, delay: '0.6s' },
  { x: '27%', y: '30%', size: 5, delay: '1.2s' },
  { x: '40%', y: '12%', size: 4, delay: '0.3s' },
  { x: '62%', y: '10%', size: 6, delay: '0.9s' },
  { x: '75%', y: '26%', size: 4, delay: '1.5s' },
  { x: '88%', y: '20%', size: 5, delay: '0.4s' },
  { x: '92%', y: '64%', size: 6, delay: '1.1s' },
  { x: '80%', y: '82%', size: 4, delay: '0.2s' },
  { x: '55%', y: '88%', size: 5, delay: '1.4s' },
  { x: '30%', y: '86%', size: 4, delay: '0.8s' },
  { x: '10%', y: '48%', size: 5, delay: '1.7s' },
]

export function WinnerOverlay() {
  const revealSpinId = useDrawStore((s) => s.revealSpinId)
  const winners = useDrawStore((s) => s.winners)
  const settings = useDrawStore((s) => s.settings)
  const closeReveal = useDrawStore((s) => s.closeReveal)
  const undoSpin = useDrawStore((s) => s.undoSpin)
  const [confirmUndo, setConfirmUndo] = useState(false)

  const spinWinners = useMemo(
    () => (revealSpinId ? winners.filter((w) => w.spinId === revealSpinId) : []),
    [revealSpinId, winners],
  )
  const open = Boolean(revealSpinId) && spinWinners.length > 0
  const primary = spinWinners[0]

  useEffect(() => {
    if (!open) return
    if (settings.soundEnabled) playWin()
    if (settings.confettiEnabled) fireConfetti()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealSpinId])

  const handleUndo = () => {
    if (!revealSpinId) return
    undoSpin(revealSpinId)
    setConfirmUndo(false)
  }

  const multi = spinWinners.length > 1

  return (
    <>
      <AnimatePresence>
        {open && primary && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Warm celebratory backdrop */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#3b1d5c_0%,#1a0b2e_45%,#0a0614_100%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_45%,rgba(251,191,36,0.28),transparent_70%),radial-gradient(ellipse_40%_40%_at_10%_90%,rgba(244,63,94,0.25),transparent_70%),radial-gradient(ellipse_40%_40%_at_90%_90%,rgba(34,211,238,0.22),transparent_70%)]" />
            {/* Rotating golden light rays */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[200vmax] w-[200vmax] -translate-x-1/2 -translate-y-1/2 opacity-30 [animation:spin_40s_linear_infinite]">
              <div className="h-full w-full bg-[conic-gradient(from_0deg,transparent_0deg,#fde047_8deg,transparent_16deg,transparent_45deg,#fde047_53deg,transparent_61deg,transparent_90deg,#fde047_98deg,transparent_106deg,transparent_135deg,#fde047_143deg,transparent_151deg,transparent_180deg,#fde047_188deg,transparent_196deg,transparent_225deg,#fde047_233deg,transparent_241deg,transparent_270deg,#fde047_278deg,transparent_286deg,transparent_315deg,#fde047_323deg,transparent_331deg,transparent_360deg)]" />
            </div>
            {/* Sparkles */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {SPARKLES.map((s, i) => (
                <span
                  key={i}
                  className="absolute rounded-full bg-white animate-pulse"
                  style={{ left: s.x, top: s.y, width: s.size, height: s.size, opacity: 0.8, animationDelay: s.delay, boxShadow: '0 0 8px 2px rgba(253,224,71,0.8)' }}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.05 }}
              className="relative flex w-full max-w-5xl flex-col items-center text-center text-white"
            >
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="mb-4 flex items-center gap-3 rounded-full border border-yellow-300/40 bg-yellow-400/10 px-5 py-2 text-base font-bold uppercase tracking-[0.35em] text-yellow-300 md:text-xl"
              >
                <span aria-hidden>🎉</span> Congratulations! <span aria-hidden>🎉</span>
              </motion.div>

              {!multi ? (
                <>
                  <motion.h1
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.25 }}
                    className="text-shine-gold break-words px-2 font-display text-[clamp(2.5rem,9vw,7.5rem)] font-black leading-[1.05] tracking-tight drop-shadow-[0_6px_30px_rgba(251,191,36,0.45)]"
                  >
                    {primary.name}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 text-[clamp(1rem,2.4vw,1.75rem)] font-medium text-amber-50/90"
                  >
                    {[primary.employeeId, primary.position, primary.department].filter(Boolean).join(' • ')}
                  </motion.p>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {spinWinners.map((w, i) => (
                    <motion.div
                      key={w.id}
                      initial={{ opacity: 0, y: 16, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.12, type: 'spring', stiffness: 260, damping: 20 }}
                      className="rounded-2xl border border-yellow-300/40 bg-white/10 px-4 py-5 backdrop-blur"
                    >
                      <div className="text-shine-gold break-words font-display text-[clamp(1.5rem,3.2vw,2.5rem)] font-black leading-tight">
                        {w.name}
                      </div>
                      <div className="mt-1 text-sm text-amber-50/80">
                        {[w.employeeId, w.position, w.department].filter(Boolean).join(' • ')}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className={cn(
                  'mt-8 inline-flex items-center gap-3 rounded-full border-2 border-yellow-300/60 bg-gradient-to-r from-amber-500/25 via-yellow-400/25 to-amber-500/25 px-6 py-3 text-lg font-bold uppercase tracking-widest text-yellow-200 shadow-[0_0_30px_rgba(251,191,36,0.25)] md:text-2xl',
                )}
              >
                <Trophy className="h-6 w-6 text-yellow-300" />
                {primary.prizeName}
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="mt-10 flex flex-wrap items-center justify-center gap-3"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="border-2 border-white/70 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:border-white dark:border-white/70 dark:text-white dark:hover:bg-white/20"
                  onClick={() => setConfirmUndo(true)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Undo Winner
                </Button>
                <Button variant="celebrate" size="lg" onClick={closeReveal} autoFocus className="min-w-52 text-base">
                  Next Spin
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </motion.div>
              <p className="mt-4 text-xs text-amber-100/60">Tekan Space atau Enter untuk lanjut</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmUndo}
        title="Batalkan pemenang ini?"
        description={
          <>
            {spinWinners.map((w) => w.name).join(', ')} akan dikembalikan ke pool peserta dan hasil undian ini dihapus dari
            history.
          </>
        }
        confirmLabel="Ya, batalkan"
        destructive
        onConfirm={handleUndo}
        onCancel={() => setConfirmUndo(false)}
      />
    </>
  )
}
