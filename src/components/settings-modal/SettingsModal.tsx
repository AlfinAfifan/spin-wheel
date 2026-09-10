import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2, Trophy } from 'lucide-react'
import { WHEEL_CAPACITY, selectPrizeRemaining, useDrawStore } from '@/stores/draw.store'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { Input, Label, Select } from '@/components/ui/Field'
import type { StageMode } from '@/types/participant'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useDrawStore((s) => s.settings)
  const prizes = useDrawStore((s) => s.prizes)
  const winners = useDrawStore((s) => s.winners)
  const currentPrizeId = useDrawStore((s) => s.currentPrizeId)
  const updateSettings = useDrawStore((s) => s.updateSettings)
  const addPrize = useDrawStore((s) => s.addPrize)
  const updatePrize = useDrawStore((s) => s.updatePrize)
  const deletePrize = useDrawStore((s) => s.deletePrize)
  const movePrize = useDrawStore((s) => s.movePrize)
  const setCurrentPrize = useDrawStore((s) => s.setCurrentPrize)
  const resetSession = useDrawStore((s) => s.resetSession)

  const [newPrize, setNewPrize] = useState('')
  const [newQty, setNewQty] = useState(1)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDeletePrize, setConfirmDeletePrize] = useState<string | null>(null)

  const handleAddPrize = () => {
    if (!newPrize.trim()) return
    addPrize(newPrize, newQty)
    setNewPrize('')
    setNewQty(1)
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" title="Settings & Prize" description="Pengaturan tersimpan otomatis di browser ini.">
      <div className="grid gap-6 p-5 md:grid-cols-2">
        {/* Draw configuration */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Event</h3>
          <div>
            <Label htmlFor="eventName">Nama Event</Label>
            <Input id="eventName" value={settings.eventName} onChange={(e) => updateSettings({ eventName: e.target.value })} placeholder="Employee Gathering 2026" />
          </div>

          <h3 className="pt-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Draw Configuration</h3>
          <div>
            <Label htmlFor="winnersPerSpin">Jumlah pemenang per spin</Label>
            <Input
              id="winnersPerSpin"
              type="number"
              min={1}
              max={50}
              value={settings.winnersPerSpin}
              onChange={(e) => updateSettings({ winnersPerSpin: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
            />
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Dibatasi oleh sisa kuota prize dan jumlah peserta eligible.</p>
          </div>
          <div>
            <Label htmlFor="spinDuration">Durasi spin: {settings.spinDurationSec} detik</Label>
            <input
              id="spinDuration"
              type="range"
              min={3}
              max={15}
              step={1}
              value={settings.spinDurationSec}
              onChange={(e) => updateSettings({ spinDurationSec: Number(e.target.value) })}
              className="w-full accent-brand-500"
            />
            <div className="flex justify-between text-[10px] text-ink-400">
              <span>3s</span>
              <span>Rekomendasi 6–10s</span>
              <span>15s</span>
            </div>
          </div>
          <div>
            <Label htmlFor="stageMode">Tampilan undian</Label>
            <Select id="stageMode" value={settings.stageMode} onChange={(e) => updateSettings({ stageMode: e.target.value as StageMode })}>
              <option value="auto">Otomatis (roda ≤ {WHEEL_CAPACITY} nama, reel jika lebih)</option>
              <option value="wheel">Selalu roda</option>
              <option value="reel">Selalu reel (gulungan nama)</option>
            </Select>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Reel cocok untuk ratusan nama sekaligus. Roda dengan nama sangat banyak tetap bisa, tapi label disembunyikan.</p>
          </div>
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            <Toggle
              checked={!settings.allowDuplicateWinner}
              onChange={(v) => updateSettings({ allowDuplicateWinner: !v })}
              label="Keluarkan pemenang dari pool"
              description="ON: pemenang tidak bisa terpilih lagi (disarankan). OFF: izinkan pemenang ganda."
            />
            <Toggle checked={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} label="Sound effects" description="Tick saat roda berputar & fanfare pemenang." />
            <Toggle checked={settings.confettiEnabled} onChange={(v) => updateSettings({ confettiEnabled: v })} label="Confetti / celebration" />
            <Toggle checked={settings.theme === 'dark'} onChange={(v) => updateSettings({ theme: v ? 'dark' : 'light' })} label="Dark theme" description="Cocok untuk projector / TV." />
          </div>
        </section>

        {/* Prize management */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Prize Management</h3>
          <p className="text-xs text-ink-500 dark:text-ink-400">
            Urutan dari atas ke bawah adalah urutan undian. Prize berikutnya otomatis aktif setelah kuota habis. Kosongkan daftar untuk mode
            bebas (nama hadiah manual).
          </p>

          <ul className="space-y-2">
            {prizes.map((p, i) => {
              const remaining = selectPrizeRemaining({ winners, prizes }, p.id)
              const used = p.quantity - remaining
              const active = currentPrizeId === p.id
              return (
                <li
                  key={p.id}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border p-2',
                    active ? 'border-brand-500 bg-brand-500/10' : 'border-ink-200 dark:border-ink-700',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setCurrentPrize(p.id)}
                    title="Jadikan prize aktif"
                    className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', active ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}
                  >
                    <Trophy className="h-4 w-4" />
                  </button>
                  <Input value={p.name} onChange={(e) => updatePrize(p.id, { name: e.target.value })} className="h-9 min-w-0 flex-1 basis-0" placeholder="Nama prize" />
                  <Input
                    type="number"
                    min={Math.max(1, used)}
                    value={p.quantity}
                    onChange={(e) => updatePrize(p.id, { quantity: Math.max(used, Number(e.target.value) || 1) })}
                    className="h-9 w-16! shrink-0 px-1 text-center"
                    title="Jumlah"
                  />
                  <span className="shrink-0 text-right text-xs tabular-nums text-ink-500">
                    {used}/{p.quantity}
                  </span>
                  <div className="flex flex-col">
                    <button type="button" onClick={() => movePrize(p.id, -1)} disabled={i === 0} className="text-ink-400 hover:text-ink-900 disabled:opacity-30 dark:hover:text-white">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => movePrize(p.id, 1)} disabled={i === prizes.length - 1} className="text-ink-400 hover:text-ink-900 disabled:opacity-30 dark:hover:text-white">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => (used > 0 ? setConfirmDeletePrize(p.id) : deletePrize(p.id))} title="Hapus prize">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              )
            })}
          </ul>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddPrize()
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1">
              <Label htmlFor="newPrize">Prize baru</Label>
              <Input id="newPrize" value={newPrize} onChange={(e) => setNewPrize(e.target.value)} placeholder="mis. Sepeda Listrik" />
            </div>
            <div className="w-20">
              <Label htmlFor="newQty">Jumlah</Label>
              <Input id="newQty" type="number" min={1} value={newQty} onChange={(e) => setNewQty(Math.max(1, Number(e.target.value) || 1))} className="text-center" />
            </div>
            <Button type="submit" variant="secondary" disabled={!newPrize.trim()}>
              <Plus className="h-4 w-4" /> Tambah
            </Button>
          </form>

          {prizes.length === 0 && (
            <div>
              <Label htmlFor="fallbackPrize">Nama hadiah (mode bebas)</Label>
              <Input id="fallbackPrize" value={settings.fallbackPrizeName} onChange={(e) => updateSettings({ fallbackPrizeName: e.target.value })} placeholder="Door Prize" />
            </div>
          )}

          <div className="rounded-xl border border-red-200 p-3 dark:border-red-500/30">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">Danger zone</p>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Reset menghapus peserta, pemenang, dan mengembalikan prize ke default. Pengaturan lain tetap.</p>
            <Button variant="danger" size="sm" className="mt-2" onClick={() => setConfirmReset(true)}>
              Reset Session
            </Button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset seluruh session?"
        description="Peserta, pemenang, dan daftar prize akan dihapus. Tindakan ini tidak dapat dibatalkan. Export history terlebih dahulu bila diperlukan."
        confirmLabel="Ya, reset semua"
        destructive
        onConfirm={() => {
          resetSession()
          setConfirmReset(false)
          onClose()
        }}
        onCancel={() => setConfirmReset(false)}
      />
      <ConfirmDialog
        open={confirmDeletePrize !== null}
        title="Hapus prize ini?"
        description="Prize ini sudah memiliki pemenang. Pemenang tetap tersimpan di history, tetapi prize tidak lagi muncul di daftar."
        confirmLabel="Ya, hapus"
        destructive
        onConfirm={() => {
          if (confirmDeletePrize) deletePrize(confirmDeletePrize)
          setConfirmDeletePrize(null)
        }}
        onCancel={() => setConfirmDeletePrize(null)}
      />
    </Modal>
  )
}
