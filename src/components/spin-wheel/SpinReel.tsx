import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { cubicBezier } from 'motion'
import type { Participant } from '@/types/participant'
import type { PendingSpin } from '@/stores/draw.store'
import { randomInt } from '@/lib/random'
import { playSpinStart, playTick } from '@/lib/sound'
import { cn, formatNumber } from '@/lib/utils'

/**
 * Vertical "slot machine" reel. Names scroll through a window and the reel decelerates onto
 * the winner. Unlike the wheel it works for any roster size because only a handful of rows
 * around the current position are ever rendered.
 */

const VISIBLE = 5 // rows visible in the window (odd so one row sits in the middle)
const HALF = Math.floor(VISIBLE / 2)
const OVERSCAN = 1 // extra rows above/below so the strip never shows a gap mid-scroll
const TICK_GAP_MS = 45

// accelerate -> fast roll -> long gradual slowdown (same feel as the wheel)
const easeSpin = cubicBezier(0.18, 0.02, 0.06, 1)

interface Row {
  label: string
  sub?: string
  participantId?: string
  placeholder?: boolean
}

export interface SpinReelProps {
  roster: Participant[]
  pending: PendingSpin | null
  durationSec: number
  soundEnabled: boolean
  disabled?: boolean
  frozen?: boolean
  presentation?: boolean
  onSpinRequest: () => void
  onFinish: () => void
  className?: string
}

const mod = (a: number, n: number) => ((a % n) + n) % n

function buildRows(roster: Participant[]): Row[] {
  if (roster.length === 0) return Array.from({ length: VISIBLE }, () => ({ label: '—', placeholder: true }))
  return roster.map((p) => ({
    label: p.name,
    sub: [p.employeeId, p.department].filter(Boolean).join(' · '),
    participantId: p.id,
  }))
}

export function SpinReel({
  roster,
  pending,
  durationSec,
  soundEnabled,
  disabled,
  frozen,
  presentation,
  onSpinRequest,
  onFinish,
  className,
}: SpinReelProps) {
  const [rows, setRows] = useState<Row[]>(() => buildRows(roster))
  /** Integer row index currently at the centre of the window */
  const [base, setBase] = useState(0)
  const [hits, setHits] = useState<number[]>([])
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [spinning, setSpinning] = useState(false)

  const stripRef = useRef<HTMLDivElement>(null)
  const leftPtrRef = useRef<HTMLDivElement>(null)
  const rightPtrRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0) // continuous position in rows
  const baseRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const rowH = presentation ? 96 : 72

  const rosterKey = useMemo(() => roster.map((p) => p.id).join(','), [roster])

  const applyPos = useCallback(
    (pos: number) => {
      posRef.current = pos
      const b = Math.floor(pos)
      const frac = pos - b
      if (b !== baseRef.current) {
        baseRef.current = b
        // Commit the new rows synchronously so the row swap and the strip offset land in the
        // same frame; otherwise the old rows are shown at the new offset for one frame (flicker).
        flushSync(() => setBase(b))
      }
      if (stripRef.current) {
        // The strip starts OVERSCAN rows above the first visible row
        stripRef.current.style.transform = `translate3d(0, ${-(OVERSCAN + frac) * rowH}px, 0)`
      }
    },
    [rowH],
  )

  // Keep the strip aligned if the row height changes (e.g. entering presentation mode)
  useEffect(() => applyPos(posRef.current), [applyPos])

  // Sync rows with the roster (only while idle)
  useEffect(() => {
    if (spinning || frozen || pending) return
    setRows(buildRows(roster))
    setHits([])
    // Reset position without flushSync (we're inside an effect); the strip offset follows via state
    posRef.current = 0
    baseRef.current = 0
    setBase(0)
    if (stripRef.current) stripRef.current.style.transform = `translate3d(0, ${-OVERSCAN * rowH}px, 0)`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey, frozen])

  const nudgePointers = useCallback((strength: number) => {
    for (const [el, dir] of [
      [leftPtrRef.current, 1],
      [rightPtrRef.current, -1],
    ] as const) {
      if (!el) continue
      el.style.transition = 'none'
      el.style.transform = `translateX(${dir * 5 * strength}px)`
      requestAnimationFrame(() => {
        el.style.transition = 'transform 120ms ease-out'
        el.style.transform = 'translateX(0)'
      })
    }
  }, [])

  useEffect(() => {
    if (!pending) return
    const rs = buildRows(roster)
    const targets = pending.winners.map((w) => rs.findIndex((r) => r.participantId === w.participantId))
    if (targets.length === 0 || targets.some((t) => t === -1)) {
      onFinishRef.current()
      return
    }
    const n = rs.length
    const total = targets.length
    setRows(rs)
    setHits([])
    setSpinning(true)
    setProgress(total > 1 ? { current: 1, total } : null)

    const fullDuration = Math.max(2, durationSec) * 1000
    let cancelled = false

    const rollTo = (targetIdx: number, duration: number, travelRows: number, done: () => void) => {
      const from = posRef.current
      // Travel a fixed distance, then add whatever remainder lands exactly on the target row
      const afterTravel = from + travelRows
      const delta = mod(targetIdx - mod(Math.round(afterTravel), n), n)
      const to = Math.round(afterTravel) + delta

      if (soundRef.current) playSpinStart()

      const start = performance.now()
      let lastRow = Math.floor(from)
      let lastPos = from
      let lastTime = start
      let lastTick = 0

      const frame = (now: number) => {
        if (cancelled) return
        const t = Math.min(1, (now - start) / duration)
        const pos = from + (to - from) * easeSpin(t)
        applyPos(pos)

        const row = Math.floor(pos)
        if (row !== lastRow) {
          if (now - lastTick >= TICK_GAP_MS) {
            const dt = Math.max(1, now - lastTime)
            const velocity = Math.abs(pos - lastPos) / dt // rows per ms
            const strength = Math.min(1, velocity / 0.12)
            if (soundRef.current) playTick(0.35 + 0.65 * strength)
            nudgePointers(0.4 + 0.6 * strength)
            lastTick = now
          }
          lastRow = row
          lastPos = pos
          lastTime = now
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(frame)
        } else {
          rafRef.current = null
          applyPos(to)
          done()
        }
      }
      rafRef.current = requestAnimationFrame(frame)
    }

    const runStep = (i: number) => {
      if (cancelled) return
      setProgress(total > 1 ? { current: i + 1, total } : null)
      const first = i === 0
      const duration = first ? fullDuration : Math.max(1600, fullDuration * 0.45)
      // Roughly 26 rows/s of travel for the first roll, less for follow-ups; always at least a few rows
      const travel = first ? Math.max(40, Math.round((duration / 1000) * 26)) + randomInt(20) : Math.max(16, Math.round((duration / 1000) * 12)) + randomInt(8)
      rollTo(targets[i], duration, travel, () => {
        setHits((h) => [...h, targets[i]])
        if (i + 1 < total) {
          timerRef.current = window.setTimeout(() => runStep(i + 1), 900)
        } else {
          setSpinning(false)
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null
            setProgress(null)
            onFinishRef.current()
          }, 650)
        }
      })
    }
    runStep(0)

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (timerRef.current) window.clearTimeout(timerRef.current)
      rafRef.current = null
      timerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.spinId])

  const n = rows.length
  const canClick = !disabled && !spinning && !pending && !frozen
  const lastHit = hits.length > 0 ? hits[hits.length - 1] : -1

  // Rows rendered in the strip: OVERSCAN above the window, VISIBLE inside, OVERSCAN below
  const strip: { key: number; idx: number; offset: number }[] = []
  for (let k = -HALF - OVERSCAN; k <= HALF + OVERSCAN; k++) strip.push({ key: k, idx: mod(base + k, n), offset: k })

  return (
    <div className={cn('relative w-full select-none', className)}>
      <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-3 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/10 md:p-4">
        {/* Glow border */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 rounded-3xl bg-[conic-gradient(from_0deg,#93aede,#4267b2,#bccdec,#6a8ccd,#93aede)] opacity-40 blur-md',
            spinning && 'animate-pulse-slow',
          )}
        />
        <div className="pointer-events-none absolute inset-[3px] rounded-[21px] bg-ink-950" />

        <div className="relative">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-300">
            <span>{formatNumber(roster.length)} peserta</span>
            <span className={cn(spinning ? 'text-yellow-300' : 'text-ink-400')}>{spinning ? 'Mengacak…' : canClick ? 'Siap' : ''}</span>
          </div>

          {/* Window */}
          <div
            onClick={canClick ? onSpinRequest : undefined}
            className={cn('relative overflow-hidden rounded-2xl bg-[#0b1020] ring-1 ring-white/10', canClick && 'cursor-pointer')}
            style={{ height: VISIBLE * rowH }}
            title={canClick ? 'Klik untuk spin' : undefined}
          >
            {/* Row lines */}
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{ backgroundImage: 'linear-gradient(to bottom, transparent calc(100% - 1px), rgba(255,255,255,0.08) 0)', backgroundSize: `100% ${rowH}px` }}
            />

            <div ref={stripRef} className="absolute inset-x-0 top-0 will-change-transform" style={{ transform: `translate3d(0, ${-OVERSCAN * rowH}px, 0)` }}>
              {strip.map(({ key, idx, offset }) => {
                const row = rows[idx]
                const landed = !spinning && offset === 0 && lastHit === idx
                return (
                  <div
                    key={key}
                    className={cn(
                      'flex flex-col items-center justify-center px-14 text-center md:px-20',
                      landed ? 'text-yellow-300' : row.placeholder ? 'text-ink-600' : 'text-white',
                    )}
                    style={{ height: rowH }}
                  >
                    <span
                      className={cn(
                        'w-full truncate font-display font-black uppercase leading-tight tracking-wide',
                        presentation ? 'text-3xl md:text-4xl' : 'text-xl md:text-3xl',
                        landed && 'drop-shadow-[0_0_12px_rgba(253,224,71,0.6)]',
                      )}
                    >
                      {row.label}
                    </span>
                    {row.sub && <span className={cn('mt-0.5 w-full truncate font-mono text-ink-400', presentation ? 'text-sm' : 'text-[11px] md:text-xs')}>{row.sub}</span>}
                  </div>
                )
              })}
            </div>

            {/* Fades above / below the centre row */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-[#0b1020] via-[#0b1020]/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-[#0b1020] via-[#0b1020]/70 to-transparent" />

            {/* Centre frame */}
            <div
              className={cn(
                'pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-xl border-2 transition-colors',
                spinning ? 'border-white/40' : 'border-yellow-300/90 shadow-[0_0_30px_rgba(253,224,71,0.35),inset_0_0_30px_rgba(253,224,71,0.08)]',
              )}
              style={{ height: rowH }}
            />

            {/* Side pointers */}
            <div className="pointer-events-none absolute left-2 top-1/2 flex -translate-y-1/2 items-center">
              <div ref={leftPtrRef} className="flex">
                <svg viewBox="0 0 24 32" className="h-8 w-6 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
                  <path d="M2 2 L22 16 L2 30 Z" fill="#ef4444" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
              <div ref={rightPtrRef} className="flex">
                <svg viewBox="0 0 24 32" className="h-8 w-6 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
                  <path d="M22 2 L2 16 L22 30 Z" fill="#ef4444" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Landed winners (multi-winner spins) */}
          {hits.length > 1 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {hits.map((idx, i) => (
                <span key={`${idx}-${i}`} className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-bold text-ink-950 shadow">
                  {i + 1}. {rows[idx]?.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Multi-winner progress */}
      {progress && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full border border-yellow-300/60 bg-ink-950/85 px-4 py-1.5 text-sm font-bold text-yellow-300 shadow-lg backdrop-blur">
          Pemenang {progress.current} dari {progress.total}
        </div>
      )}
    </div>
  )
}
