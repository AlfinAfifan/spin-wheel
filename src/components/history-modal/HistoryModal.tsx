import { useMemo, useState } from 'react'
import { Download, RotateCcw, Search, Trash2, Trophy } from 'lucide-react'
import { useDrawStore } from '@/stores/draw.store'
import type { Winner } from '@/types/participant'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { exportWinners } from '@/lib/excel'
import { formatDateTime, formatNumber } from '@/lib/utils'

export function HistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const winners = useDrawStore((s) => s.winners)
  const prizes = useDrawStore((s) => s.prizes)
  const settings = useDrawStore((s) => s.settings)
  const undoWinner = useDrawStore((s) => s.undoWinner)
  const clearWinners = useDrawStore((s) => s.clearWinners)

  const [query, setQuery] = useState('')
  const [prizeFilter, setPrizeFilter] = useState('')
  const [undoTarget, setUndoTarget] = useState<Winner | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const prizeNames = useMemo(() => {
    const set = new Set<string>(prizes.map((p) => p.name))
    winners.forEach((w) => set.add(w.prizeName))
    return Array.from(set)
  }, [prizes, winners])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return winners
      .map((w, i) => ({ w, no: i + 1 }))
      .filter(({ w }) => {
        if (prizeFilter && w.prizeName !== prizeFilter) return false
        if (!q) return true
        return (
          w.name.toLowerCase().includes(q) ||
          w.employeeId.toLowerCase().includes(q) ||
          (w.department?.toLowerCase().includes(q) ?? false) ||
          w.prizeName.toLowerCase().includes(q)
        )
      })
  }, [winners, query, prizeFilter])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-3">
          Winner History <Badge tone="brand">{formatNumber(winners.length)} pemenang</Badge>
        </span>
      }
      description="Seluruh hasil undian pada session ini. Undo mengembalikan peserta ke pool."
      headerActions={
        <>
          <Button variant="primary" size="sm" onClick={() => exportWinners(winners, settings.eventName)} disabled={winners.length === 0}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => setConfirmClear(true)} disabled={winners.length === 0}>
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, ID, departemen, prize…" className="pl-9" autoFocus />
          </div>
          <Select value={prizeFilter} onChange={(e) => setPrizeFilter(e.target.value)}>
            <option value="">Semua Prize</option>
            {prizeNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>

        {/* Per-prize summary */}
        {prizes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {prizes.map((p) => {
              const used = winners.filter((w) => w.prizeId === p.id).length
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPrizeFilter(prizeFilter === p.name ? '' : p.name)}
                  className="flex items-center gap-2 rounded-full border border-ink-200 px-3 py-1 text-xs hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-800"
                >
                  <Trophy className="h-3 w-3 text-brand-500" />
                  {p.name}
                  <span className="font-semibold tabular-nums">
                    {used}/{p.quantity}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="overflow-auto rounded-xl border border-ink-200 dark:border-ink-700">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-ink-50 text-xs text-ink-500 dark:bg-ink-800 dark:text-ink-300">
              <tr>
                <th className="w-12 px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Nama</th>
                <th className="px-3 py-2 font-medium">Employee ID</th>
                <th className="px-3 py-2 font-medium">Departemen</th>
                <th className="px-3 py-2 font-medium">Prize</th>
                <th className="px-3 py-2 font-medium">Waktu</th>
                <th className="px-3 py-2 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-ink-400">
                    {winners.length === 0 ? 'Belum ada pemenang pada session ini.' : 'Tidak ada pemenang yang cocok.'}
                  </td>
                </tr>
              )}
              {rows.map(({ w, no }) => (
                <tr key={w.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50">
                  <td className="px-3 py-2 tabular-nums text-ink-400">{no}</td>
                  <td className="px-3 py-2 font-semibold">
                    {w.name}
                    {w.position && <span className="block text-xs font-normal text-ink-500 dark:text-ink-400">{w.position}</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{w.employeeId}</td>
                  <td className="px-3 py-2">{w.department ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Badge tone="brand">{w.prizeName}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-ink-500 dark:text-ink-300">{formatDateTime(w.drawnAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setUndoTarget(w)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Undo
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={undoTarget !== null}
        title="Undo pemenang?"
        description={
          undoTarget && (
            <>
              <strong>{undoTarget.name}</strong> ({undoTarget.employeeId}) akan dihapus dari history dan dikembalikan ke pool peserta.
              Kuota prize <strong>{undoTarget.prizeName}</strong> akan bertambah satu.
            </>
          )
        }
        confirmLabel="Ya, undo"
        destructive
        onConfirm={() => {
          if (undoTarget) undoWinner(undoTarget.id)
          setUndoTarget(null)
        }}
        onCancel={() => setUndoTarget(null)}
      />
      <ConfirmDialog
        open={confirmClear}
        title="Hapus semua history pemenang?"
        description="Semua pemenang akan dikembalikan ke pool. Peserta dan pengaturan hadiah tetap tersimpan. Export ke Excel terlebih dahulu bila diperlukan."
        confirmLabel="Ya, hapus history"
        destructive
        onConfirm={() => {
          clearWinners()
          setConfirmClear(false)
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </Modal>
  )
}
