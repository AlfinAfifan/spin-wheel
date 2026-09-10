import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, RotateCcw, Search, Trash2, UserMinus, UserPlus, X } from 'lucide-react'
import { selectParticipantStatus, selectPool, useDrawStore } from '@/stores/draw.store'
import type { Participant, ParticipantStatus } from '@/types/participant'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn, formatNumber } from '@/lib/utils'

type SortKey = 'employeeId' | 'name' | 'department' | 'position' | 'pinPoint' | 'status'
const PAGE_SIZE = 50

const STATUS_TONE: Record<ParticipantStatus, 'success' | 'brand' | 'danger'> = {
  eligible: 'success',
  winner: 'brand',
  removed: 'danger',
}
const STATUS_LABEL: Record<ParticipantStatus, string> = {
  eligible: 'Eligible',
  winner: 'Winner',
  removed: 'Removed',
}

function uniqueValues(list: Participant[], key: keyof Participant): string[] {
  const set = new Set<string>()
  for (const p of list) {
    const v = p[key]
    if (typeof v === 'string' && v) set.add(v)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export function ParticipantModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const participants = useDrawStore((s) => s.participants)
  const winners = useDrawStore((s) => s.winners)
  const settings = useDrawStore((s) => s.settings)
  const setParticipantsRemoved = useDrawStore((s) => s.setParticipantsRemoved)
  const clearParticipants = useDrawStore((s) => s.clearParticipants)
  const openModal = useDrawStore((s) => s.openModal)

  const [query, setQuery] = useState('')
  const [dept, setDept] = useState('')
  const [pin, setPin] = useState('')
  const [contract, setContract] = useState('')
  const [status, setStatus] = useState<ParticipantStatus | ''>('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState<null | { removed: boolean; count: number; ids: string[] }>(null)

  const departments = useMemo(() => uniqueValues(participants, 'department'), [participants])
  const pins = useMemo(() => uniqueValues(participants, 'pinPoint'), [participants])
  const contracts = useMemo(() => uniqueValues(participants, 'contractType'), [participants])

  const winnerIds = useMemo(() => new Set(winners.map((w) => w.participantId)), [winners])
  const eligibleCount = useMemo(() => selectPool({ participants, winners, settings }).length, [participants, winners, settings])

  const statusOf = (p: Participant): ParticipantStatus => (p.removed ? 'removed' : winnerIds.has(p.id) ? 'winner' : 'eligible')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = participants.filter((p) => {
      if (dept && p.department !== dept) return false
      if (pin && p.pinPoint !== pin) return false
      if (contract && p.contractType !== contract) return false
      if (status && statusOf(p) !== status) return false
      if (!q) return true
      return (
        p.employeeId.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.department?.toLowerCase().includes(q) ?? false) ||
        (p.pinPoint?.toLowerCase().includes(q) ?? false) ||
        (p.position?.toLowerCase().includes(q) ?? false)
      )
    })
    const dir = sortDir === 'asc' ? 1 : -1
    list = list.slice().sort((a, b) => {
      const av = sortKey === 'status' ? statusOf(a) : (a[sortKey] ?? '')
      const bv = sortKey === 'status' ? statusOf(b) : (b[sortKey] ?? '')
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir
    })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, query, dept, pin, contract, status, sortKey, sortDir, winnerIds])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => setPage(0), [query, dept, pin, contract, status, sortKey, sortDir])
  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1))
  }, [page, pageCount])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const hasFilter = Boolean(query || dept || pin || contract || status)
  const clearFilters = () => {
    setQuery('')
    setDept('')
    setPin('')
    setContract('')
    setStatus('')
  }

  const bulk = (removed: boolean) => {
    const ids = filtered.filter((p) => p.removed !== removed).map((p) => p.id)
    if (ids.length === 0) return
    setConfirmBulk({ removed, count: ids.length, ids })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title={
        <span className="flex items-center gap-3">
          Daftar Peserta
          <Badge tone="neutral">{formatNumber(participants.length)} total</Badge>
          <Badge tone="success">{formatNumber(eligibleCount)} eligible</Badge>
          <Badge tone="brand">{formatNumber(winnerIds.size)} winner</Badge>
        </span>
      }
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={() => openModal('import')}>
            <UserPlus className="h-4 w-4" /> Import
          </Button>
          {participants.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} className="text-red-500 hover:text-red-600">
              <Trash2 className="h-4 w-4" /> Hapus semua
            </Button>
          )}
        </>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-ink-500 dark:text-ink-300">
            Menampilkan {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min(filtered.length, (page + 1) * PAGE_SIZE)} dari{' '}
            {formatNumber(filtered.length)}
            {hasFilter && ` (difilter dari ${formatNumber(participants.length)})`}
          </p>
          <div className="flex items-center gap-2">
            {hasFilter && filtered.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={() => bulk(true)}>
                  <UserMinus className="h-4 w-4" /> Remove hasil filter
                </Button>
                <Button variant="outline" size="sm" onClick={() => bulk(false)}>
                  <RotateCcw className="h-4 w-4" /> Restore hasil filter
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <span className="tabular-nums text-ink-500">
              {page + 1} / {pageCount}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        {/* Filters */}
        <div className="grid gap-2 md:grid-cols-[1fr_repeat(4,minmax(0,160px))_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari ID, nama, departemen, pin point, posisi…"
              className="pl-9"
              autoFocus
            />
          </div>
          <Select value={dept} onChange={(e) => setDept(e.target.value)} disabled={departments.length === 0}>
            <option value="">Semua Departemen</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select value={pin} onChange={(e) => setPin(e.target.value)} disabled={pins.length === 0}>
            <option value="">Semua Pin Point</option>
            {pins.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select value={contract} onChange={(e) => setContract(e.target.value)} disabled={contracts.length === 0}>
            <option value="">Semua Contract</option>
            {contracts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as ParticipantStatus | '')}>
            <option value="">Semua Status</option>
            <option value="eligible">Eligible</option>
            <option value="winner">Winner</option>
            <option value="removed">Removed</option>
          </Select>
          <Button variant="ghost" onClick={clearFilters} disabled={!hasFilter} title="Reset filter">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-auto rounded-xl border border-ink-200 dark:border-ink-700">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-ink-50 text-xs text-ink-500 dark:bg-ink-800 dark:text-ink-300">
              <tr>
                <th className="w-12 px-3 py-2 font-medium">#</th>
                <SortTh label="Employee ID" k="employeeId" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortTh label="Nama" k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortTh label="Departemen" k="department" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortTh label="Posisi" k="position" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortTh label="Pin Point" k="pinPoint" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2 font-medium">Contract</th>
                <SortTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-ink-400">
                    {participants.length === 0 ? (
                      <span>
                        Belum ada peserta.{' '}
                        <button className="text-brand-500 underline" onClick={() => openModal('import')}>
                          Import Excel
                        </button>
                      </span>
                    ) : (
                      'Tidak ada peserta yang cocok dengan filter.'
                    )}
                  </td>
                </tr>
              )}
              {pageRows.map((p, i) => {
                const st = selectParticipantStatus({ winners }, p)
                return (
                  <tr key={p.id} className={cn('hover:bg-ink-50 dark:hover:bg-ink-800/50', p.removed && 'opacity-60')}>
                    <td className="px-3 py-2 tabular-nums text-ink-400">{page * PAGE_SIZE + i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.employeeId}</td>
                    <td className={cn('px-3 py-2 font-medium', p.removed && 'line-through')}>{p.name}</td>
                    <td className="px-3 py-2">{p.department ?? '—'}</td>
                    <td className="px-3 py-2">{p.position ?? '—'}</td>
                    <td className="px-3 py-2">{p.pinPoint ?? '—'}</td>
                    <td className="px-3 py-2">{p.contractType ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Badge tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.removed ? (
                        <Button variant="ghost" size="sm" onClick={() => setParticipantsRemoved([p.id], false)}>
                          <RotateCcw className="h-3.5 w-3.5" /> Restore
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setParticipantsRemoved([p.id], true)}
                          title="Keluarkan dari pool"
                        >
                          <UserMinus className="h-3.5 w-3.5" /> Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Hapus semua peserta?"
        description="Seluruh peserta dan history pemenang pada session ini akan dihapus."
        confirmLabel="Ya, hapus semua"
        destructive
        onConfirm={() => {
          clearParticipants()
          setConfirmClear(false)
        }}
        onCancel={() => setConfirmClear(false)}
      />
      <ConfirmDialog
        open={confirmBulk !== null}
        title={confirmBulk?.removed ? `Remove ${confirmBulk.count} peserta dari pool?` : `Restore ${confirmBulk?.count ?? 0} peserta ke pool?`}
        description="Aksi ini berlaku untuk seluruh hasil filter saat ini, bukan hanya halaman yang ditampilkan."
        confirmLabel="Ya, lanjutkan"
        destructive={confirmBulk?.removed}
        onConfirm={() => {
          if (confirmBulk) setParticipantsRemoved(confirmBulk.ids, confirmBulk.removed)
          setConfirmBulk(null)
        }}
        onCancel={() => setConfirmBulk(null)}
      />
    </Modal>
  )
}

function SortTh({ label, k, sortKey, sortDir, onClick }: { label: string; k: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc'; onClick: (k: SortKey) => void }) {
  const active = sortKey === k
  return (
    <th className="px-3 py-2 font-medium">
      <button type="button" onClick={() => onClick(k)} className={cn('inline-flex items-center gap-1 hover:text-ink-900 dark:hover:text-white', active && 'text-ink-900 dark:text-white')}>
        {label}
        {active ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  )
}
