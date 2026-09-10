import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cubicBezier } from 'motion'
import type { Participant } from '@/types/participant'
import { MAX_WHEEL, type PendingSpin } from '@/stores/draw.store'
import { randomFloat, randomInt } from '@/lib/random'
import { playSpinStart, playTick } from '@/lib/sound'
import { cn, truncate } from '@/lib/utils'

const MAX_SEGMENTS = MAX_WHEEL
const SIZE = 600
const CX = SIZE / 2
const CY = SIZE / 2
const R = SIZE / 2 - 14
const HUB_R = 52

const PALETTE = [
  '#4267b2',
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#06b6d4',
  '#e11d48',
  '#0ea5e9',
  '#d946ef',
  '#65a30d',
  '#f43f5e',
]

// accelerate -> fast spin -> long gradual slowdown
const easeSpin = cubicBezier(0.18, 0.02, 0.06, 1)

interface Segment {
  label: string
  sub?: string
  participantId?: string
  placeholder?: boolean
}

export interface SpinWheelProps {
  /** Participants shown on the wheel, in order. The winner is always one of these. */
  roster: Participant[]
  pending: PendingSpin | null
  durationSec: number
  soundEnabled: boolean
  disabled?: boolean
  /** Freeze labels (e.g. while the reveal overlay is open) */
  frozen?: boolean
  onSpinRequest: () => void
  onFinish: () => void
  className?: string
}

function polar(angleDeg: number, r: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
}

function segmentPath(startDeg: number, endDeg: number): string {
  const s = polar(startDeg, R)
  const e = polar(endDeg, R)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${CX} ${CY} L ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y} Z`
}

function buildSegments(roster: Participant[]): Segment[] {
  if (roster.length === 0) {
    return Array.from({ length: 8 }, () => ({ label: '', placeholder: true }))
  }
  return roster.slice(0, MAX_SEGMENTS).map((p) => ({ label: p.name, sub: p.employeeId, participantId: p.id }))
}

export function SpinWheel({
  roster,
  pending,
  durationSec,
  soundEnabled,
  disabled,
  frozen,
  onSpinRequest,
  onFinish,
  className,
}: SpinWheelProps) {
  const [segments, setSegments] = useState<Segment[]>(() => buildSegments(roster))
  const [highlights, setHighlights] = useState<number[]>([])
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [spinning, setSpinning] = useState(false)

  const wheelRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<HTMLDivElement>(null)
  const rotationRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const finishTimerRef = useRef<number | null>(null)
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const rosterKey = useMemo(() => roster.map((p) => p.id).join(','), [roster])

  // Sync labels with the roster (only while not spinning / not frozen)
  useEffect(() => {
    if (spinning || frozen || pending) return
    setSegments(buildSegments(roster))
    setHighlights([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey, frozen])

  const applyRotation = useCallback((deg: number) => {
    rotationRef.current = deg
    if (wheelRef.current) wheelRef.current.style.transform = `rotate(${deg}deg)`
  }, [])

  const nudgePointer = useCallback((strength: number) => {
    const el = pointerRef.current
    if (!el) return
    el.style.transition = 'none'
    el.style.transform = `rotate(${-14 * strength}deg)`
    requestAnimationFrame(() => {
      el.style.transition = 'transform 120ms ease-out'
      el.style.transform = 'rotate(0deg)'
    })
  }, [])

  // Start animation when a pending spin arrives. With several winners per spin the wheel
  // spins once per winner (first spin full length, the rest shorter) and marks each landed segment.
  useEffect(() => {
    if (!pending) return
    const segs = buildSegments(roster)
    const targets = pending.winners.map((w) => segs.findIndex((seg) => seg.participantId === w.participantId))
    if (targets.length === 0 || targets.some((t) => t === -1)) {
      // Should not happen; still finish to keep state consistent
      onFinishRef.current()
      return
    }
    const n = segs.length
    const total = targets.length
    setSegments(segs)
    setHighlights([])
    setSpinning(true)
    setProgress(total > 1 ? { current: 1, total } : null)

    const segDeg = 360 / n
    const fullDuration = Math.max(2, durationSec) * 1000
    let cancelled = false

    const spinTo = (targetIdx: number, duration: number, extraTurns: number, done: () => void) => {
      // Angle of the target segment's center measured clockwise from top
      const targetCenter = (targetIdx + 0.5) * segDeg
      // Land somewhere inside the segment (avoid the very edges)
      const jitter = (randomFloat() - 0.5) * segDeg * 0.7
      const landing = (360 - (targetCenter + jitter)) % 360

      const from = rotationRef.current
      const fromMod = ((from % 360) + 360) % 360
      const delta = (landing - fromMod + 360) % 360
      const to = from + extraTurns * 360 + delta

      if (soundRef.current) playSpinStart()

      const start = performance.now()
      let lastIdx = -1
      let lastRot = from
      let lastTime = start

      const frame = (now: number) => {
        if (cancelled) return
        const t = Math.min(1, (now - start) / duration)
        const p = easeSpin(t)
        const rot = from + (to - from) * p
        applyRotation(rot)

        // Tick when passing a segment boundary
        const norm = ((rot % 360) + 360) % 360
        const idxUnderPointer = Math.floor(((360 - norm) % 360) / segDeg) % n
        if (idxUnderPointer !== lastIdx) {
          if (lastIdx !== -1) {
            const dt = Math.max(1, now - lastTime)
            const velocity = Math.abs(rot - lastRot) / dt // deg per ms
            const strength = Math.min(1, velocity / 0.9)
            if (soundRef.current) playTick(0.35 + 0.65 * strength)
            nudgePointer(0.4 + 0.6 * strength)
          }
          lastIdx = idxUnderPointer
          lastRot = rot
          lastTime = now
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(frame)
        } else {
          rafRef.current = null
          applyRotation(to)
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
      const turns = first ? 6 + randomInt(4) : 2 + randomInt(2)
      spinTo(targets[i], duration, turns, () => {
        setHighlights((h) => [...h, targets[i]])
        if (i + 1 < total) {
          finishTimerRef.current = window.setTimeout(() => runStep(i + 1), 900)
        } else {
          setSpinning(false)
          // Brief dramatic pause before reveal
          finishTimerRef.current = window.setTimeout(() => {
            finishTimerRef.current = null
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
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current)
      rafRef.current = null
      finishTimerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.spinId])

  const n = segments.length
  const segDeg = 360 / n
  const canClick = !disabled && !spinning && !pending && !frozen

  return (
    <div className={cn('relative aspect-square w-full select-none @container', className)}>
      {/* Outer glow ring */}
      <div
        className={cn(
          'absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#93aede,#4267b2,#bccdec,#6a8ccd,#93aede)] opacity-80 blur-[2px] transition-opacity',
          spinning && 'animate-pulse-slow',
        )}
      />
      <div className="absolute inset-[6px] rounded-full bg-ink-950 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)]" />

      {/* Rim lights */}
      <div className="pointer-events-none absolute inset-[3px] rounded-full">
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * 360
          return (
            <span
              key={i}
              className={cn(
                'absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full',
                spinning ? (i % 2 === 0 ? 'bg-white' : 'bg-brand-300') : 'bg-white/90',
                spinning && 'animate-pulse',
              )}
              style={{
                transform: `translate(-50%,-50%) rotate(${a}deg) translateY(-49cqw)`,
                animationDelay: `${(i % 2) * 150}ms`,
                boxShadow: '0 0 6px 1px rgba(255,255,255,0.7)',
              }}
            />
          )
        })}
      </div>

      {/* Wheel */}
      <div
        ref={wheelRef}
        className="absolute inset-[14px] rounded-full will-change-transform"
        style={{ transform: `rotate(${rotationRef.current}deg)` }}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
          <defs>
            <radialGradient id="wheel-shade" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
            </radialGradient>
            <filter id="text-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.55" />
            </filter>
          </defs>
          {segments.map((seg, i) => {
            const start = i * segDeg
            const end = (i + 1) * segDeg
            const mid = start + segDeg / 2
            const color = seg.placeholder ? (i % 2 === 0 ? '#1f2a4a' : '#26325a') : PALETTE[i % PALETTE.length]
            const hitOrder = highlights.indexOf(i)
            const isHit = hitOrder !== -1
            const baseFont = n <= 4 ? 26 : n <= 8 ? 22 : n <= 12 ? 18 : 15
            const minFont = n <= 8 ? 15 : 12
            const textR = R - 26
            const tp = polar(mid, textR)
            // Radial space available between the rim label start and the hub (leaves room for the winner badge)
            const maxLen = textR - HUB_R - 44
            const CHAR_W = 0.64 // average glyph width relative to font size
            const full = seg.label.toUpperCase()
            // Shrink the font to fit the name without distorting glyphs; truncate only as a last resort
            const needed = full.length * CHAR_W // width in font-size units
            let fontSize = baseFont
            if (needed * fontSize > maxLen) fontSize = Math.max(minFont, maxLen / needed)
            // Only truncate when even the minimum font cannot fit the full name
            const label =
              needed * fontSize > maxLen + 0.5 ? truncate(full, Math.max(6, Math.floor(maxLen / (fontSize * CHAR_W)))) : full
            // Keep text readable: flip labels on the left half so they never render upside-down
            const flip = mid > 180
            const textRotate = flip ? mid + 90 : mid - 90
            const anchor = flip ? 'start' : 'end'
            return (
              <g key={i}>
                {n === 1 ? (
                  <circle cx={CX} cy={CY} r={R} fill={color} />
                ) : (
                  <path
                    d={segmentPath(start, end)}
                    fill={color}
                    stroke="#0b1020"
                    strokeWidth={2}
                    className={cn('transition-opacity duration-300', highlights.length > 0 && !isHit && 'opacity-45')}
                  />
                )}
                {!seg.placeholder && (
                  <text
                    x={tp.x}
                    y={tp.y}
                    fill="#fff"
                    fontSize={fontSize}
                    fontWeight={700}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    filter="url(#text-shadow)"
                    transform={`rotate(${textRotate} ${tp.x} ${tp.y})`}
                    style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.01em' }}
                  >
                    {label}
                  </text>
                )}
                {isHit && (() => {
                  const bp = polar(mid, HUB_R + 26)
                  return (
                    <g transform={`translate(${bp.x} ${bp.y})`}>
                      <circle r={15} fill="#fde047" stroke="#0b1020" strokeWidth={2} />
                      <text
                        fill="#0b1020"
                        fontSize={16}
                        fontWeight={800}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${-rotationRef.current})`}
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {hitOrder + 1}
                      </text>
                    </g>
                  )
                })()}
              </g>
            )
          })}
          <circle cx={CX} cy={CY} r={R} fill="url(#wheel-shade)" pointerEvents="none" />
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#dbe5f6" strokeWidth={4} opacity={0.9} />
        </svg>
      </div>

      {/* Hub / spin button */}
      <button
        type="button"
        onClick={canClick ? onSpinRequest : undefined}
        disabled={!canClick}
        aria-label="Spin"
        className={cn(
          'absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full',
          'bg-[radial-gradient(circle_at_35%_30%,#93aede,#4267b2_55%,#2c457a)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_-4px_10px_rgba(0,0,0,0.25)]',
          'ring-4 ring-ink-950 transition-transform',
          canClick ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default',
        )}
        style={{ width: `${(HUB_R * 2 * 100) / SIZE}%`, height: `${(HUB_R * 2 * 100) / SIZE}%` }}
      >
        <span
          className="font-display font-black tracking-widest"
          style={{ fontSize: 'clamp(10px, 3cqw, 22px)' }}
        >
          {spinning ? '•••' : 'SPIN'}
        </span>
      </button>

      {/* Multi-winner progress */}
      {progress && (
        <div className="pointer-events-none absolute bottom-[4%] left-1/2 z-20 -translate-x-1/2 rounded-full border border-yellow-300/60 bg-ink-950/85 px-4 py-1.5 text-sm font-bold text-yellow-300 shadow-lg backdrop-blur">
          Pemenang {progress.current} dari {progress.total}
        </div>
      )}

      {/* Pointer (fixed) */}
      <div
        ref={pointerRef}
        className="pointer-events-none absolute left-1/2 top-[-2%] z-20 -translate-x-1/2 origin-top"
        style={{ width: '9%' }}
      >
        <svg viewBox="0 0 60 80" className="h-auto w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]">
          <path d="M30 78 L4 22 A26 26 0 1 1 56 22 Z" fill="#fff" />
          <path d="M30 70 L10 24 A20 20 0 1 1 50 24 Z" fill="#ef4444" />
          <circle cx="30" cy="24" r="7" fill="#fff" />
        </svg>
      </div>
    </div>
  )
}
