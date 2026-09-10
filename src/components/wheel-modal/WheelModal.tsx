import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, ListChecks, Search, Shuffle, Square, Trash2, X } from 'lucide-react';
import { EMPTY_WHEEL_FILTER, WHEEL_CAPACITY, selectFilteredPool, selectPool, selectWheelParticipants, useDrawStore } from '@/stores/draw.store';
import type { Participant } from '@/types/participant';
import { pickMany } from '@/lib/random';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Field';
import { cn, formatNumber } from '@/lib/utils';

const PAGE_SIZE = 60;

function uniqueValues(list: Participant[], key: keyof Participant): string[] {
  const set = new Set<string>();
  for (const p of list) {
    const v = p[key];
    if (typeof v === 'string' && v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function WheelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const participants = useDrawStore((s) => s.participants);
  const winners = useDrawStore((s) => s.winners);
  const settings = useDrawStore((s) => s.settings);
  const wheelIds = useDrawStore((s) => s.wheelIds);
  const wheelFilter = useDrawStore((s) => s.wheelFilter);
  const setWheelIds = useDrawStore((s) => s.setWheelIds);
  const toggleWheelId = useDrawStore((s) => s.toggleWheelId);
  const setWheelFilter = useDrawStore((s) => s.setWheelFilter);
  const clearWheel = useDrawStore((s) => s.clearWheel);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const pool = useMemo(() => selectPool({ participants, winners, settings }), [participants, winners, settings]);
  const departments = useMemo(() => uniqueValues(pool, 'department'), [pool]);
  const pins = useMemo(() => uniqueValues(pool, 'pinPoint'), [pool]);

  const roster = useMemo(() => selectWheelParticipants({ participants, winners, settings, wheelIds }), [participants, winners, settings, wheelIds]);
  const rosterIds = useMemo(() => new Set(roster.map((p) => p.id)), [roster]);

  const scoped = useMemo(() => selectFilteredPool({ participants, winners, settings }, wheelFilter), [participants, winners, settings, wheelFilter]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((p) => p.name.toLowerCase().includes(q) || p.employeeId.toLowerCase().includes(q) || (p.position?.toLowerCase().includes(q) ?? false));
  }, [scoped, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => setPage(0), [query, wheelFilter]);

  const hasScope = Boolean(wheelFilter.department || wheelFilter.pinPoint);

  const randomFromFilter = () => {
    if (filtered.length === 0) return;
    setWheelIds(pickMany(filtered, WHEEL_CAPACITY).map((p) => p.id));
  };
  /** Replace the roster with every participant in the current filter, in list order. */
  const addFilteredToWheel = () => {
    if (filtered.length === 0) return;
    setWheelIds(filtered.map((p) => p.id));
  };
  const useReel = settings.stageMode === 'reel' || (settings.stageMode === 'auto' && roster.length > WHEEL_CAPACITY);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title={
        <span className="flex items-center gap-3">
          Pilih Peserta di Roda
          <Badge tone={roster.length > 0 ? 'brand' : 'neutral'}>{formatNumber(roster.length)} dipilih</Badge>
          {roster.length > 0 && <Badge tone="neutral">{useReel ? 'Tampilan reel' : 'Tampilan roda'}</Badge>}
        </span>
      }
      description={`Pemenang hanya diambil dari nama yang ada di roda. Tidak ada batas jumlah: sampai ${WHEEL_CAPACITY} nama ditampilkan sebagai roda, lebih dari itu otomatis memakai tampilan reel. Filter departemen / pin point juga dipakai oleh tombol "Acak Peserta".`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-ink-500 dark:text-ink-300">
            {formatNumber(filtered.length)} peserta eligible {hasScope || query ? 'sesuai filter' : ''} · halaman {page + 1}/{pageCount}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
            <Button variant="primary" onClick={onClose} disabled={roster.length === 0}>
              Selesai
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_320px]">
        {/* Left: picker */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid gap-2 md:grid-cols-[1fr_200px_200px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, ID, posisi…" className="pl-9" autoFocus />
            </div>
            <Select value={wheelFilter.department} onChange={(e) => setWheelFilter({ department: e.target.value })} disabled={departments.length === 0}>
              <option value="">Semua Departemen</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <Select value={wheelFilter.pinPoint} onChange={(e) => setWheelFilter({ pinPoint: e.target.value })} disabled={pins.length === 0}>
              <option value="">Semua Pin Point</option>
              {pins.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <Button
              variant="ghost"
              onClick={() => {
                setQuery('');
                setWheelFilter(EMPTY_WHEEL_FILTER);
              }}
              disabled={!hasScope && !query}
              title="Reset filter"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={randomFromFilter} disabled={filtered.length === 0}>
              <Shuffle className="h-4 w-4" /> Acak {Math.min(WHEEL_CAPACITY, filtered.length)} dari hasil filter
            </Button>
            <Button variant="outline" size="sm" onClick={addFilteredToWheel} disabled={filtered.length === 0} title="Ganti isi roda dengan seluruh hasil filter, urut dari atas">
              <ListChecks className="h-4 w-4" /> Pilih semua ({formatNumber(filtered.length)}) berurutan
            </Button>
          </div>

          <div className="overflow-auto rounded-xl border border-ink-200 dark:border-ink-700">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-ink-50 text-xs text-ink-500 dark:bg-ink-800 dark:text-ink-300">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 font-medium">Employee ID</th>
                  <th className="px-3 py-2 font-medium">Nama</th>
                  <th className="px-3 py-2 font-medium">Departemen</th>
                  <th className="px-3 py-2 font-medium">Pin Point</th>
                  <th className="px-3 py-2 font-medium">Posisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-12 text-center text-ink-400">
                      {pool.length === 0 ? 'Tidak ada peserta eligible.' : 'Tidak ada peserta yang cocok dengan filter.'}
                    </td>
                  </tr>
                )}
                {pageRows.map((p) => {
                  const checked = rosterIds.has(p.id);
                  return (
                    <tr key={p.id} onClick={() => toggleWheelId(p.id)} className={cn('cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/50', checked && 'bg-brand-500/10')}>
                      <td className="px-3 py-2">{checked ? <CheckSquare className="h-4 w-4 text-brand-500" /> : <Square className="h-4 w-4 text-ink-400" />}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.employeeId}</td>
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2">{p.department ?? '—'}</td>
                      <td className="px-3 py-2">{p.pinPoint ?? '—'}</td>
                      <td className="px-3 py-2">{p.position ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: current roster */}
        <aside className="flex flex-col rounded-xl border border-ink-200 p-3 dark:border-ink-700">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Nama di roda</h4>
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={clearWheel} disabled={roster.length === 0}>
              <Trash2 className="h-3.5 w-3.5" /> Kosongkan
            </Button>
          </div>
          {roster.length === 0 ? (
            <p className="py-8 text-center text-xs text-ink-400">Belum ada nama. Pilih dari daftar di kiri atau gunakan Acak.</p>
          ) : (
            <ol className="flex max-h-[60vh] flex-col gap-1.5 overflow-auto pr-1">
              {roster.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg bg-ink-50 px-2 py-1.5 text-sm dark:bg-ink-800/60">
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-ink-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-ink-500 dark:text-ink-400">{[p.employeeId, p.department].filter(Boolean).join(' · ')}</span>
                  </span>
                  <button type="button" onClick={() => toggleWheelId(p.id)} className="text-ink-400 hover:text-red-500" title="Keluarkan dari roda">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </Modal>
  );
}
