import { useMemo } from 'react';
import { FileSpreadsheet, History, Maximize, Minimize, Moon, Settings, Sun, Trophy, Users, Volume2, VolumeX } from 'lucide-react';
import { selectPool, useDrawStore } from '@/stores/draw.store';
import { Button } from '@/components/ui/Button';
import { cn, formatNumber } from '@/lib/utils';

interface HeaderProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function Header({ isFullscreen, onToggleFullscreen }: HeaderProps) {
  const participants = useDrawStore((s) => s.participants);
  const winners = useDrawStore((s) => s.winners);
  const settings = useDrawStore((s) => s.settings);
  const isSpinning = useDrawStore((s) => s.isSpinning);
  const openModal = useDrawStore((s) => s.openModal);
  const updateSettings = useDrawStore((s) => s.updateSettings);

  const eligible = useMemo(() => selectPool({ participants, winners, settings }).length, [participants, winners, settings]);

  return (
    <header className="z-40 flex items-center justify-between gap-3 border-b border-ink-200/60 bg-white/70 px-4 py-2.5 backdrop-blur dark:border-ink-800 dark:bg-ink-950/60">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm shadow-brand-500/40 sm:flex">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-bold leading-tight md:text-lg">{settings.eventName || 'Sastro Draw'}</h1>
          <p className="hidden truncate text-xs text-ink-500 sm:block dark:text-ink-400">Spin Wheel Sastro Draw</p>
        </div>
      </div>

      <div className="hidden items-center gap-1 md:flex">
        <StatPill icon={<Users className="h-3.5 w-3.5" />} label="Participants" value={participants.length} onClick={() => openModal('participants')} disabled={isSpinning} />
        <StatPill icon={<span className="h-2 w-2 rounded-full bg-emerald-500" />} label="Eligible" value={eligible} onClick={() => openModal('participants')} disabled={isSpinning} tone="success" />
        <StatPill icon={<Trophy className="h-3.5 w-3.5" />} label="Winners" value={winners.length} onClick={() => openModal('history')} disabled={isSpinning} tone="brand" />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="primary" size="sm" onClick={() => openModal('import')} disabled={isSpinning} className="max-md:hidden">
          <FileSpreadsheet className="h-4 w-4" />
          Import Excel
        </Button>
        <Button variant="primary" size="icon" onClick={() => openModal('import')} disabled={isSpinning} className="h-9 w-9 md:hidden" aria-label="Import Excel">
          <FileSpreadsheet className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => openModal('participants')} disabled={isSpinning} aria-label="Peserta" title="Peserta (P)">
          <Users className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => openModal('history')} disabled={isSpinning} aria-label="History" title="History (H)">
          <History className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => openModal('settings')} disabled={isSpinning} aria-label="Settings" title="Settings (S)">
          <Settings className="h-5 w-5" />
        </Button>
        <span className="mx-1 hidden h-6 w-px bg-ink-200 sm:block dark:bg-ink-800" />
        <Button variant="ghost" size="icon" onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })} aria-label={settings.soundEnabled ? 'Matikan suara' : 'Nyalakan suara'} title="Sound" className="max-sm:hidden">
          {settings.soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-ink-400" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })} aria-label="Ganti tema" title="Tema" className="max-sm:hidden">
          {settings.theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button variant="outline" size="sm" onClick={onToggleFullscreen} title="Fullscreen (F)">
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          <span className="hidden lg:inline">Fullscreen</span>
        </Button>
      </div>
    </header>
  );
}

function StatPill({ icon, label, value, onClick, disabled, tone = 'neutral' }: { icon: React.ReactNode; label: string; value: number; onClick: () => void; disabled?: boolean; tone?: 'neutral' | 'success' | 'brand' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-60', 'border-ink-200 bg-white hover:bg-ink-100 dark:border-ink-800 dark:bg-ink-900 dark:hover:bg-ink-800')}
    >
      <span className={cn('flex items-center', tone === 'success' && 'text-emerald-500', tone === 'brand' && 'text-brand-500', tone === 'neutral' && 'text-ink-500 dark:text-ink-300')}>{icon}</span>
      <span className="text-ink-500 dark:text-ink-300">{label}</span>
      <span className="font-bold tabular-nums">{formatNumber(value)}</span>
    </button>
  );
}
