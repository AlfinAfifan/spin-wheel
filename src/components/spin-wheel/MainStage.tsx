import { useMemo } from 'react';
import { Gift, ListChecks, PartyPopper, Play, Shuffle, Trophy, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { WHEEL_CAPACITY, selectCurrentPrize, selectPool, selectPrizeRemaining, selectSessionCompleted, selectWheelParticipants, useDrawStore } from '@/stores/draw.store';
import { SpinWheel } from './SpinWheel';
import { SpinReel } from './SpinReel';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { cn, formatNumber } from '@/lib/utils';
import { unlockAudio } from '@/lib/sound';

interface MainStageProps {
  presentation: boolean;
}

export function MainStage({ presentation }: MainStageProps) {
  const participants = useDrawStore((s) => s.participants);
  const winners = useDrawStore((s) => s.winners);
  const prizes = useDrawStore((s) => s.prizes);
  const currentPrizeId = useDrawStore((s) => s.currentPrizeId);
  const settings = useDrawStore((s) => s.settings);
  const isSpinning = useDrawStore((s) => s.isSpinning);
  const pendingSpin = useDrawStore((s) => s.pendingSpin);
  const revealSpinId = useDrawStore((s) => s.revealSpinId);
  const startSpin = useDrawStore((s) => s.startSpin);
  const finishSpin = useDrawStore((s) => s.finishSpin);
  const openModal = useDrawStore((s) => s.openModal);
  const setCurrentPrize = useDrawStore((s) => s.setCurrentPrize);
  const wheelIds = useDrawStore((s) => s.wheelIds);
  const wheelFilter = useDrawStore((s) => s.wheelFilter);
  const shuffleWheel = useDrawStore((s) => s.shuffleWheel);

  const pool = useMemo(() => selectPool({ participants, winners, settings }), [participants, winners, settings]);
  const roster = useMemo(() => selectWheelParticipants({ participants, winners, settings, wheelIds }), [participants, winners, settings, wheelIds]);
  const scopeLabel = [wheelFilter.department, wheelFilter.pinPoint].filter(Boolean).join(' · ');
  const prize = useMemo(() => selectCurrentPrize({ winners, prizes, currentPrizeId }), [winners, prizes, currentPrizeId]);
  const prizeRemaining = prize ? selectPrizeRemaining({ winners, prizes }, prize.id) : null;
  const completed = selectSessionCompleted({ winners, prizes });

  const noParticipants = participants.length === 0;
  const noEligible = !noParticipants && pool.length === 0;
  const wheelEmpty = !noParticipants && !noEligible && roster.length === 0;
  const prizeExhausted = prize !== null && prizeRemaining !== null && prizeRemaining <= 0;
  const canSpin = !isSpinning && !revealSpinId && roster.length > 0 && !prizeExhausted;
  const wheelLocked = isSpinning || Boolean(revealSpinId);
  const useReel = settings.stageMode === 'reel' || (settings.stageMode === 'auto' && roster.length > WHEEL_CAPACITY);

  const handleSpin = () => {
    if (!canSpin) return;
    unlockAudio();
    startSpin();
  };

  const winnersThisPrize = prize ? winners.filter((w) => w.prizeId === prize.id).length : winners.length;

  return (
    <div className="m-auto flex w-full flex-col items-center justify-center gap-3 px-4 py-3 md:gap-5">
      {/* Prize title */}
      <div className="flex flex-col items-center text-center">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-brand-500 dark:text-brand-300">
          <Gift className="h-4 w-4" />
          Current Prize
        </div>
        <motion.h2
          key={prize?.id ?? 'fallback'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('font-display font-black leading-none tracking-tight text-shine-prize', presentation ? 'text-4xl md:text-6xl' : 'text-3xl md:text-5xl')}
        >
          {prize?.name ?? settings.fallbackPrizeName ?? 'Sastro Draw'}
        </motion.h2>
        {prize && prizeRemaining !== null && (
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
            {winnersThisPrize} / {prize.quantity} pemenang · <span className={cn('font-semibold', prizeRemaining > 0 ? 'text-emerald-500' : 'text-ink-400')}>{prizeRemaining} tersisa</span>
          </p>
        )}
        {prizes.length > 1 && !presentation && (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {prizes.map((p) => {
              const rem = selectPrizeRemaining({ winners, prizes }, p.id);
              const active = prize?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isSpinning}
                  onClick={() => setCurrentPrize(p.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                    active ? 'border-brand-500 bg-brand-500/15 text-brand-600 dark:text-brand-300' : 'border-ink-200 text-ink-500 hover:border-ink-300 dark:border-ink-700 dark:text-ink-300 dark:hover:border-ink-500',
                    rem === 0 && !active && 'line-through opacity-60',
                  )}
                >
                  {p.name} <span className="opacity-70">({rem})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Wheel */}
      <div
        className={cn(
          'relative w-full',
          useReel
            ? presentation
              ? 'max-w-4xl'
              : 'max-w-3xl'
            : presentation
              ? 'max-w-[max(300px,min(calc(100vh-330px),92vw))]'
              : 'max-w-[max(280px,min(calc(100vh-400px),86vw))] md:max-w-[max(280px,min(calc(100vh-400px),60vw))]',
        )}
      >
        {useReel ? (
          <SpinReel roster={roster} pending={pendingSpin} durationSec={settings.spinDurationSec} soundEnabled={settings.soundEnabled} disabled={!canSpin} frozen={Boolean(revealSpinId)} onSpinRequest={handleSpin} onFinish={finishSpin} presentation={presentation} />
        ) : (
          <SpinWheel roster={roster} pending={pendingSpin} durationSec={settings.spinDurationSec} soundEnabled={settings.soundEnabled} disabled={!canSpin} frozen={Boolean(revealSpinId)} onSpinRequest={handleSpin} onFinish={finishSpin} />
        )}

        {/* Overlays for empty / blocked states */}
        {(noParticipants || noEligible || completed || wheelEmpty) && !isSpinning && (
          <div className={cn('absolute inset-0 z-30 flex items-center justify-center bg-ink-950/70 p-6 backdrop-blur-[2px]', useReel ? 'rounded-3xl' : 'rounded-full')}>
            <div className="max-w-xs text-center text-white">
              {noParticipants && (
                <>
                  <Users className="mx-auto mb-3 h-10 w-10 text-brand-300" />
                  <h3 className="text-lg font-bold">Belum ada peserta</h3>
                  <p className="mt-1 text-sm text-ink-200">Import file Excel berisi daftar peserta untuk memulai undian.</p>
                  <Button variant="primary" className="mt-4" onClick={() => openModal('import')}>
                    Import Excel
                  </Button>
                </>
              )}
              {completed && !noParticipants && (
                <>
                  <PartyPopper className="mx-auto mb-3 h-10 w-10 text-brand-300" />
                  <h3 className="text-lg font-bold">Semua hadiah sudah diundi 🎉</h3>
                  <p className="mt-1 text-sm text-ink-200">Session selesai. Lihat history atau tambah hadiah di Settings.</p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button variant="primary" onClick={() => openModal('history')}>
                      Lihat Pemenang
                    </Button>
                    <Button variant="outline" className="border-white/30 text-white hover:bg-white/10" onClick={() => openModal('settings')}>
                      Settings
                    </Button>
                  </div>
                </>
              )}
              {noEligible && !completed && (
                <>
                  <Trophy className="mx-auto mb-3 h-10 w-10 text-brand-300" />
                  <h3 className="text-lg font-bold">Tidak ada peserta eligible</h3>
                  <p className="mt-1 text-sm text-ink-200">Semua peserta sudah menang atau dihapus dari pool.</p>
                  <Button variant="primary" className="mt-4" onClick={() => openModal('participants')}>
                    Buka Daftar Peserta
                  </Button>
                </>
              )}
              {wheelEmpty && !completed && (
                <>
                  <Shuffle className="mx-auto mb-3 h-10 w-10 text-brand-300" />
                  <h3 className="text-lg font-bold">Roda masih kosong</h3>
                  <p className="mt-1 text-sm text-ink-200">Isi roda dengan peserta acak atau pilih peserta secara manual.</p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button variant="primary" onClick={shuffleWheel}>
                      <Shuffle className="h-4 w-4" /> Acak Peserta
                    </Button>
                    <Button variant="outline" className="border-white/30 text-white hover:bg-white/10" onClick={() => openModal('wheel')}>
                      <ListChecks className="h-4 w-4" /> Pilih Manual
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Wheel roster controls */}
      {participants.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm text-ink-500 dark:text-ink-300">
            <span className="font-bold text-ink-900 dark:text-white">{formatNumber(roster.length)}</span> nama di {useReel ? 'reel' : 'roda'}
            {scopeLabel && <span className="text-ink-400"> · {scopeLabel}</span>}
            <span className="text-ink-400">
              {' '}
              · {formatNumber(pool.length)} eligible dari {formatNumber(participants.length)}
            </span>
          </span>
          <Button variant="outline" size="sm" onClick={shuffleWheel} disabled={wheelLocked || pool.length === 0} title="Isi roda dengan peserta acak">
            <Shuffle className="h-4 w-4" /> Acak 16 Peserta
          </Button>
          <Button variant="outline" size="sm" onClick={() => openModal('wheel')} disabled={wheelLocked} title="Pilih peserta yang masuk roda (W)">
            <ListChecks className="h-4 w-4" /> Pilih Peserta
          </Button>
        </div>
      )}

      {/* Spin button */}
      <div className="flex flex-col items-center gap-3">
        <Button variant="primary" size="lg" onClick={handleSpin} disabled={!canSpin} className={cn('h-14 min-w-56 text-lg tracking-wide shadow-lg shadow-brand-500/40', isSpinning && 'animate-pulse')}>
          {isSpinning ? (
            <>
              <span className="inline-block h-2.5 w-2.5 animate-ping rounded-full bg-white" />
              SPINNING…
            </>
          ) : (
            <>
              <Play className="h-5 w-5 fill-current" />
              SPIN
              {settings.winnersPerSpin > 1 && prizeRemaining !== 0 && <span className="ml-1 rounded bg-white/20 px-1.5 text-xs">×{Math.min(settings.winnersPerSpin, prizeRemaining ?? settings.winnersPerSpin, roster.length || 1)}</span>}
            </>
          )}
        </Button>
        {!presentation && (
          <p className="flex items-center gap-1.5 text-xs text-ink-400 max-sm:hidden">
            <Kbd>Space</Kbd> spin <span className="mx-1">·</span> <Kbd>F</Kbd> fullscreen <span className="mx-1">·</span> <Kbd>H</Kbd> history <span className="mx-1">·</span> <Kbd>P</Kbd> peserta <span className="mx-1">·</span> <Kbd>W</Kbd>{' '}
            roda
          </p>
        )}
      </div>
    </div>
  );
}
