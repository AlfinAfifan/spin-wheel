import { useCallback, useEffect, useMemo } from 'react';
import { Minimize, Settings, Trophy, Users, Volume2, VolumeX } from 'lucide-react';
import { selectPool, useDrawStore } from '@/stores/draw.store';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Header } from '@/components/layout/Header';
import { RecentWinners } from '@/components/layout/RecentWinners';
import { MainStage } from '@/components/spin-wheel/MainStage';
import { WinnerOverlay } from '@/components/winner-modal/WinnerOverlay';
import { ImportModal } from '@/components/import-excel/ImportModal';
import { ParticipantModal } from '@/components/participant-modal/ParticipantModal';
import { HistoryModal } from '@/components/history-modal/HistoryModal';
import { SettingsModal } from '@/components/settings-modal/SettingsModal';
import { WheelModal } from '@/components/wheel-modal/WheelModal';
import { Kbd } from '@/components/ui/Kbd';
import { unlockAudio } from '@/lib/sound';
import { cn, formatNumber } from '@/lib/utils';

export default function App() {
  const theme = useDrawStore((s) => s.settings.theme);
  const soundEnabled = useDrawStore((s) => s.settings.soundEnabled);
  const activeModal = useDrawStore((s) => s.activeModal);
  const isSpinning = useDrawStore((s) => s.isSpinning);
  const revealSpinId = useDrawStore((s) => s.revealSpinId);
  const participants = useDrawStore((s) => s.participants);
  const winners = useDrawStore((s) => s.winners);
  const settings = useDrawStore((s) => s.settings);
  const openModal = useDrawStore((s) => s.openModal);
  const closeModal = useDrawStore((s) => s.closeModal);
  const closeReveal = useDrawStore((s) => s.closeReveal);
  const startSpin = useDrawStore((s) => s.startSpin);
  const updateSettings = useDrawStore((s) => s.updateSettings);

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const presentation = isFullscreen;

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Document title
  useEffect(() => {
    document.title = `${settings.eventName || 'Sastro Draw'} · Spin Wheel`;
  }, [settings.eventName]);

  const eligible = useMemo(() => selectPool({ participants, winners, settings }).length, [participants, winners, settings]);

  const handleSpinKey = useCallback(() => {
    if (activeModal) return;
    if (revealSpinId) {
      closeReveal();
      return;
    }
    if (isSpinning) return;
    unlockAudio();
    startSpin();
  }, [activeModal, revealSpinId, isSpinning, closeReveal, startSpin]);

  const handleEscape = useCallback(() => {
    if (activeModal) closeModal();
    else if (revealSpinId) closeReveal();
  }, [activeModal, closeModal, revealSpinId, closeReveal]);

  const shortcuts = useMemo(
    () => ({
      onSpin: handleSpinKey,
      onEscape: handleEscape,
      onFullscreen: toggleFullscreen,
      onParticipants: () => (activeModal === 'participants' ? closeModal() : openModal('participants')),
      onHistory: () => (activeModal === 'history' ? closeModal() : openModal('history')),
      onSettings: () => (activeModal === 'settings' ? closeModal() : openModal('settings')),
      onImport: () => (activeModal === 'import' ? closeModal() : openModal('import')),
      onWheel: () => (activeModal === 'wheel' ? closeModal() : openModal('wheel')),
    }),
    [handleSpinKey, handleEscape, toggleFullscreen, activeModal, closeModal, openModal],
  );
  useKeyboardShortcuts(shortcuts);

  // Warn before leaving while spinning
  useEffect(() => {
    if (!isSpinning) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isSpinning]);

  return (
    <div className="stage-bg flex h-full min-h-dvh flex-col overflow-hidden">
      {!presentation && <Header isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />}

      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className={cn('mx-auto grid h-full w-full min-h-0 flex-1 gap-4 p-3 md:p-4', presentation ? 'max-w-none grid-cols-1' : 'max-w-[1500px] lg:grid-cols-[1fr_300px]')}>
          <div className="flex min-h-0 overflow-auto">
            <MainStage presentation={presentation} />
          </div>
          {!presentation && <RecentWinners className="max-lg:hidden self-start lg:sticky lg:top-4" />}
        </div>

        {/* Presentation mode floating bar */}
        {presentation && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4 text-white">
            <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-black/40 px-4 py-2 text-sm backdrop-blur">
              <Trophy className="h-4 w-4 text-brand-300" />
              <span className="font-semibold">{settings.eventName || 'Sastro Draw'}</span>
              <span className="text-ink-300">·</span>
              <span className="flex items-center gap-1 text-ink-200">
                <Users className="h-3.5 w-3.5" /> {formatNumber(eligible)} eligible
              </span>
              <span className="text-ink-300">·</span>
              <span className="text-ink-200">{formatNumber(winners.length)} winners</span>
            </div>
            <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/40 p-1 backdrop-blur">
              <button type="button" onClick={() => updateSettings({ soundEnabled: !soundEnabled })} className="rounded-full p-2 hover:bg-white/10" title="Sound">
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-ink-400" />}
              </button>
              <button type="button" onClick={() => openModal('history')} className="rounded-full p-2 hover:bg-white/10" title="History (H)" disabled={isSpinning}>
                <Trophy className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => openModal('settings')} className="rounded-full p-2 hover:bg-white/10" title="Settings (S)" disabled={isSpinning}>
                <Settings className="h-4 w-4" />
              </button>
              <button type="button" onClick={toggleFullscreen} className="flex items-center gap-2 rounded-full px-3 py-2 text-xs hover:bg-white/10" title="Keluar fullscreen (F)">
                <Minimize className="h-4 w-4" /> <Kbd>F</Kbd> keluar
              </button>
            </div>
          </div>
        )}
      </main>

      <WinnerOverlay />
      <ImportModal open={activeModal === 'import'} onClose={closeModal} />
      <ParticipantModal open={activeModal === 'participants'} onClose={closeModal} />
      <HistoryModal open={activeModal === 'history'} onClose={closeModal} />
      <SettingsModal open={activeModal === 'settings'} onClose={closeModal} />
      <WheelModal open={activeModal === 'wheel'} onClose={closeModal} />
    </div>
  );
}
