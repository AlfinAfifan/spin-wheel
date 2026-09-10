import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, UploadCloud, XCircle } from 'lucide-react'
import { useDrawStore } from '@/stores/draw.store'
import {
  applyDuplicatePolicy,
  downloadTemplate,
  ExcelImportError,
  FIELD_LABELS,
  parseExcelFile,
  TEMPLATE_HEADERS,
  type DuplicatePolicy,
} from '@/lib/excel'
import type { ImportIssue, ParsedImport } from '@/types/participant'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn, formatNumber } from '@/lib/utils'

type Step = 'pick' | 'parsing' | 'review' | 'done'

const ISSUE_LABEL: Record<ImportIssue['type'], { label: string; tone: 'warning' | 'danger' | 'info' }> = {
  duplicate: { label: 'Duplikat', tone: 'warning' },
  missing_id: { label: 'ID kosong', tone: 'danger' },
  missing_name: { label: 'Nama kosong', tone: 'danger' },
  empty_row: { label: 'Baris kosong', tone: 'info' },
}

export function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const participants = useDrawStore((s) => s.participants)
  const winners = useDrawStore((s) => s.winners)
  const importParticipants = useDrawStore((s) => s.importParticipants)

  const [step, setStep] = useState<Step>('pick')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null)
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [policy, setPolicy] = useState<DuplicatePolicy>('keep_first')
  const [mode, setMode] = useState<'replace' | 'append'>('replace')
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [issueFilter, setIssueFilter] = useState<ImportIssue['type'] | 'all'>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep('pick')
    setError(null)
    setParsed(null)
    setResult(null)
    setPolicy('keep_first')
    setMode(participants.length > 0 ? 'append' : 'replace')
    setIssueFilter('all')
    if (inputRef.current) inputRef.current.value = ''
  }, [participants.length])

  const handleClose = () => {
    onClose()
    // reset after animation
    setTimeout(reset, 200)
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setStep('parsing')
    try {
      const p = await parseExcelFile(file)
      setParsed(p)
      setMode(participants.length > 0 ? 'append' : 'replace')
      setStep('review')
    } catch (e) {
      if (e instanceof ExcelImportError) setError({ message: e.message, details: e.details })
      else setError({ message: 'Terjadi kesalahan saat membaca file.' })
      setStep('pick')
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void handleFile(e.dataTransfer.files?.[0])
  }

  const finalRows = useMemo(() => (parsed ? applyDuplicatePolicy(parsed.rows, policy) : []), [parsed, policy])
  const counts = useMemo(() => {
    const c = { duplicate: 0, missing_id: 0, missing_name: 0, empty_row: 0 }
    parsed?.issues.forEach((i) => c[i.type]++)
    return c
  }, [parsed])
  const filteredIssues = useMemo(
    () => (parsed ? parsed.issues.filter((i) => issueFilter === 'all' || i.type === issueFilter) : []),
    [parsed, issueFilter],
  )

  const doImport = () => {
    if (!parsed) return
    const r = importParticipants(finalRows, mode)
    setResult(r)
    setStep('done')
  }

  const handleImportClick = () => {
    if (mode === 'replace' && (participants.length > 0 || winners.length > 0)) {
      setConfirmReplace(true)
      return
    }
    doImport()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title="Import Peserta dari Excel"
      description="File diproses langsung di browser, tidak diunggah ke server."
      headerActions={
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4" /> Template
        </Button>
      }
      footer={
        step === 'review' ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-600 dark:text-ink-300">
              <span className="font-semibold text-ink-900 dark:text-white">{formatNumber(finalRows.length)}</span> peserta akan diimport
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>
                Pilih file lain
              </Button>
              <Button variant="primary" onClick={handleImportClick} disabled={finalRows.length === 0}>
                <UploadCloud className="h-4 w-4" />
                Import {mode === 'replace' ? '& ganti data' : '& tambahkan'}
              </Button>
            </div>
          </div>
        ) : step === 'done' ? (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Import lagi
            </Button>
            <Button variant="primary" onClick={handleClose}>
              Selesai
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="p-5">
        {(step === 'pick' || step === 'parsing') && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
                dragOver
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-ink-300 hover:border-brand-400 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800/50',
              )}
            >
              {step === 'parsing' ? (
                <>
                  <Loader2 className="mb-3 h-10 w-10 animate-spin text-brand-500" />
                  <p className="font-medium">Membaca file…</p>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mb-3 h-10 w-10 text-brand-500" />
                  <p className="font-medium">Drag & drop file Excel di sini</p>
                  <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">atau klik untuk memilih file (.xlsx / .xls)</p>
                  <Button variant="primary" size="sm" className="mt-4" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}>
                    Choose File
                  </Button>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <div className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">{error.message}</p>
                    {error.details && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs opacity-90">
                        {error.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-ink-50 p-4 text-sm dark:bg-ink-800/60">
              <p className="font-medium">Format kolom</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TEMPLATE_HEADERS.map((h, i) => (
                  <Badge key={h} tone={i < 2 ? 'brand' : 'neutral'}>
                    {h}
                    {i < 2 && <span className="opacity-70">*</span>}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                * kolom wajib. Nama header fleksibel (mis. “NIK”, “Employee ID”, “Name” juga dikenali). Baris duplikat berdasarkan
                Nomor Induk Karyawan akan dideteksi.
              </p>
            </div>
          </div>
        )}

        {step === 'review' && parsed && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryCard label="Baris terbaca" value={parsed.totalRows} />
              <SummaryCard label="Valid" value={parsed.rows.length - counts.duplicate} tone="success" />
              <SummaryCard label="Duplikat" value={counts.duplicate} tone={counts.duplicate ? 'warning' : 'neutral'} />
              <SummaryCard
                label="Bermasalah"
                value={counts.missing_id + counts.missing_name + counts.empty_row}
                tone={counts.missing_id + counts.missing_name ? 'danger' : 'neutral'}
              />
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800/60 dark:text-ink-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="truncate">
                <span className="font-medium">{parsed.fileName}</span> · sheet “{parsed.sheetName}” · kolom:{' '}
                {(Object.keys(parsed.mapping) as Array<keyof typeof FIELD_LABELS>)
                  .map((k) => FIELD_LABELS[k])
                  .join(', ')}
              </span>
            </div>

            {/* Options */}
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="rounded-xl border border-ink-200 p-3 dark:border-ink-700">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Duplikat</legend>
                <RadioRow
                  checked={policy === 'keep_first'}
                  onChange={() => setPolicy('keep_first')}
                  label="Hapus duplikat, simpan record pertama"
                  hint="Direkomendasikan"
                />
                <RadioRow
                  checked={policy === 'keep_all'}
                  onChange={() => setPolicy('keep_all')}
                  label="Tetap import semua baris"
                  hint="Peserta yang sama bisa muncul lebih dari sekali"
                />
              </fieldset>
              <fieldset className="rounded-xl border border-ink-200 p-3 dark:border-ink-700">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Mode import</legend>
                <RadioRow
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  label="Ganti semua data"
                  hint={participants.length > 0 ? `Menghapus ${formatNumber(participants.length)} peserta & ${formatNumber(winners.length)} pemenang saat ini` : 'Mulai session baru'}
                />
                <RadioRow
                  checked={mode === 'append'}
                  onChange={() => setMode('append')}
                  label="Tambahkan ke data yang ada"
                  hint="ID yang sudah ada akan dilewati"
                  disabled={participants.length === 0}
                />
              </fieldset>
            </div>

            {/* Issues */}
            {parsed.issues.length > 0 && (
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Review issue ({parsed.issues.length})
                  </h4>
                  <div className="ml-auto flex flex-wrap gap-1">
                    <FilterChip active={issueFilter === 'all'} onClick={() => setIssueFilter('all')}>
                      Semua
                    </FilterChip>
                    {(Object.keys(counts) as Array<ImportIssue['type']>)
                      .filter((k) => counts[k] > 0)
                      .map((k) => (
                        <FilterChip key={k} active={issueFilter === k} onClick={() => setIssueFilter(k)}>
                          {ISSUE_LABEL[k].label} ({counts[k]})
                        </FilterChip>
                      ))}
                  </div>
                </div>
                <div className="max-h-56 overflow-auto rounded-xl border border-ink-200 dark:border-ink-700">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-ink-50 text-ink-500 dark:bg-ink-800">
                      <tr>
                        <th className="px-3 py-2 font-medium">Baris</th>
                        <th className="px-3 py-2 font-medium">Issue</th>
                        <th className="px-3 py-2 font-medium">ID</th>
                        <th className="px-3 py-2 font-medium">Nama</th>
                        <th className="px-3 py-2 font-medium">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                      {filteredIssues.slice(0, 300).map((iss, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 tabular-nums">{iss.row}</td>
                          <td className="px-3 py-1.5">
                            <Badge tone={ISSUE_LABEL[iss.type].tone}>{ISSUE_LABEL[iss.type].label}</Badge>
                          </td>
                          <td className="px-3 py-1.5 font-mono">{iss.employeeId ?? '—'}</td>
                          <td className="px-3 py-1.5">{iss.name ?? '—'}</td>
                          <td className="px-3 py-1.5 text-ink-500">{iss.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredIssues.length > 300 && (
                    <p className="px-3 py-2 text-center text-xs text-ink-400">…dan {filteredIssues.length - 300} lainnya</p>
                  )}
                </div>
              </div>
            )}

            {/* Preview */}
            <div>
              <h4 className="mb-2 text-sm font-semibold">Preview data ({formatNumber(finalRows.length)})</h4>
              <div className="max-h-56 overflow-auto rounded-xl border border-ink-200 dark:border-ink-700">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-ink-50 text-ink-500 dark:bg-ink-800">
                    <tr>
                      <th className="px-3 py-2 font-medium">ID</th>
                      <th className="px-3 py-2 font-medium">Nama</th>
                      <th className="px-3 py-2 font-medium">Departemen</th>
                      <th className="px-3 py-2 font-medium">Posisi</th>
                      <th className="px-3 py-2 font-medium">Pin Point</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {finalRows.slice(0, 50).map((r) => (
                      <tr key={r.sourceRow}>
                        <td className="px-3 py-1.5 font-mono">{r.employeeId}</td>
                        <td className="px-3 py-1.5 font-medium">{r.name}</td>
                        <td className="px-3 py-1.5">{r.department ?? '—'}</td>
                        <td className="px-3 py-1.5">{r.position ?? '—'}</td>
                        <td className="px-3 py-1.5">{r.pinPoint ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {finalRows.length > 50 && (
                  <p className="px-3 py-2 text-center text-xs text-ink-400">…menampilkan 50 dari {formatNumber(finalRows.length)}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold">Import berhasil</h3>
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
              <span className="font-semibold text-ink-900 dark:text-white">{formatNumber(result.added)}</span> peserta ditambahkan
              {result.skipped > 0 && (
                <>
                  , <span className="font-semibold">{formatNumber(result.skipped)}</span> dilewati karena ID sudah ada
                </>
              )}
              .
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmReplace}
        title="Ganti semua data peserta?"
        description={
          <>
            {formatNumber(participants.length)} peserta dan {formatNumber(winners.length)} pemenang pada session ini akan dihapus dan
            diganti dengan data baru. Export history terlebih dahulu jika masih dibutuhkan.
          </>
        }
        confirmLabel="Ya, ganti data"
        destructive
        onConfirm={() => {
          setConfirmReplace(false)
          doImport()
        }}
        onCancel={() => setConfirmReplace(false)}
      />
    </Modal>
  )
}

function SummaryCard({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneClass = {
    neutral: 'text-ink-900 dark:text-white',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-red-600 dark:text-red-400',
  }[tone]
  return (
    <div className="rounded-xl border border-ink-200 p-3 dark:border-ink-700">
      <p className="text-xs text-ink-500 dark:text-ink-400">{label}</p>
      <p className={cn('mt-0.5 text-2xl font-bold tabular-nums', toneClass)}>{formatNumber(value)}</p>
    </div>
  )
}

function RadioRow({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: () => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2 py-1.5', disabled && 'cursor-not-allowed opacity-50')}>
      <input type="radio" checked={checked} onChange={onChange} disabled={disabled} className="mt-1 accent-brand-500" />
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-ink-500 dark:text-ink-400">{hint}</span>}
      </span>
    </label>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2 py-0.5 text-xs transition-colors',
        active ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'border-ink-200 text-ink-500 hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-800',
      )}
    >
      {children}
    </button>
  )
}
