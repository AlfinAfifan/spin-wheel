import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DrawSettings, Participant, ParticipantDraft, Prize, Winner } from '@/types/participant';
import { pickMany } from '@/lib/random';
import { sessionStorageAdapter, STORAGE_KEY } from '@/lib/storage';
import { uid } from '@/lib/utils';

export type ModalName = 'import' | 'participants' | 'history' | 'settings' | 'wheel' | null;

/** Maximum number of names shown on the wheel (and eligible to win in one spin). */
export const MAX_WHEEL = 16;

export interface WheelFilter {
  department: string;
  pinPoint: string;
}

export const EMPTY_WHEEL_FILTER: WheelFilter = { department: '', pinPoint: '' };

export const DEFAULT_SETTINGS: DrawSettings = {
  eventName: 'Sastro Draw',
  winnersPerSpin: 1,
  allowDuplicateWinner: false,
  spinDurationSec: 8,
  soundEnabled: true,
  confettiEnabled: true,
  theme: 'dark',
  fallbackPrizeName: 'Door Prize',
};

export function defaultPrizes(): Prize[] {
  return [
    { id: uid(), name: 'Door Prize', quantity: 10 },
    { id: uid(), name: 'Second Prize', quantity: 2 },
    { id: uid(), name: 'Grand Prize', quantity: 1 },
  ];
}

export interface PendingSpin {
  spinId: string;
  winners: Winner[];
}

interface DrawState {
  // Persisted
  participants: Participant[];
  winners: Winner[];
  prizes: Prize[];
  currentPrizeId: string | null;
  settings: DrawSettings;
  lastUpdated: string | null;
  /** Participant ids currently placed on the wheel (ordered). Winner is drawn from these only. */
  wheelIds: string[];
  /** Filter scope used by the "Acak" button and the wheel picker */
  wheelFilter: WheelFilter;

  // Transient UI
  activeModal: ModalName;
  isSpinning: boolean;
  pendingSpin: PendingSpin | null;
  revealSpinId: string | null;

  // Actions: participants
  importParticipants: (drafts: ParticipantDraft[], mode: 'replace' | 'append') => { added: number; skipped: number };
  removeParticipant: (id: string) => void;
  restoreParticipant: (id: string) => void;
  setParticipantsRemoved: (ids: string[], removed: boolean) => void;
  clearParticipants: () => void;

  // Actions: wheel roster
  setWheelIds: (ids: string[]) => void;
  toggleWheelId: (id: string) => void;
  setWheelFilter: (f: Partial<WheelFilter>) => void;
  /** Fill the wheel with random eligible participants matching wheelFilter */
  shuffleWheel: () => void;
  clearWheel: () => void;

  // Actions: prizes
  addPrize: (name: string, quantity: number) => void;
  updatePrize: (id: string, patch: Partial<Omit<Prize, 'id'>>) => void;
  deletePrize: (id: string) => void;
  movePrize: (id: string, dir: -1 | 1) => void;
  setCurrentPrize: (id: string | null) => void;

  // Actions: settings
  updateSettings: (patch: Partial<DrawSettings>) => void;

  // Actions: draw
  startSpin: () => PendingSpin | null;
  finishSpin: () => void;
  cancelSpin: () => void;
  closeReveal: () => void;
  undoWinner: (winnerId: string) => void;
  undoSpin: (spinId: string) => void;
  clearWinners: () => void;
  resetSession: () => void;

  // Actions: UI
  openModal: (m: ModalName) => void;
  closeModal: () => void;
}

const touch = () => ({ lastUpdated: new Date().toISOString() });

export const useDrawStore = create<DrawState>()(
  persist(
    (set, get) => ({
      participants: [],
      winners: [],
      prizes: defaultPrizes(),
      currentPrizeId: null,
      settings: DEFAULT_SETTINGS,
      lastUpdated: null,
      wheelIds: [],
      wheelFilter: EMPTY_WHEEL_FILTER,

      activeModal: null,
      isSpinning: false,
      pendingSpin: null,
      revealSpinId: null,

      importParticipants: (drafts, mode) => {
        const state = get();
        const toParticipant = (d: ParticipantDraft): Participant => ({
          id: uid(),
          employeeId: d.employeeId,
          name: d.name,
          pinPoint: d.pinPoint,
          department: d.department,
          position: d.position,
          contractType: d.contractType,
          removed: false,
          sourceRow: d.sourceRow,
        });

        if (mode === 'replace') {
          const participants = drafts.map(toParticipant);
          set({ participants, winners: [], revealSpinId: null, pendingSpin: null, wheelIds: [], wheelFilter: EMPTY_WHEEL_FILTER, ...touch() });
          get().shuffleWheel();
          return { added: participants.length, skipped: 0 };
        }

        const existing = new Set(state.participants.map((p) => p.employeeId.toLowerCase()));
        const added: Participant[] = [];
        let skipped = 0;
        for (const d of drafts) {
          const key = d.employeeId.toLowerCase();
          if (existing.has(key)) {
            skipped++;
            continue;
          }
          existing.add(key);
          added.push(toParticipant(d));
        }
        set({ participants: [...state.participants, ...added], ...touch() });
        if (selectWheelParticipants(get()).length === 0) get().shuffleWheel();
        return { added: added.length, skipped };
      },

      removeParticipant: (id) => get().setParticipantsRemoved([id], true),
      restoreParticipant: (id) => get().setParticipantsRemoved([id], false),
      setParticipantsRemoved: (ids, removed) => {
        const idSet = new Set(ids);
        set((s) => ({
          participants: s.participants.map((p) => (idSet.has(p.id) ? { ...p, removed } : p)),
          ...touch(),
        }));
      },
      clearParticipants: () => set({ participants: [], winners: [], revealSpinId: null, wheelIds: [], ...touch() }),

      setWheelIds: (ids) => set({ wheelIds: Array.from(new Set(ids)).slice(0, MAX_WHEEL), ...touch() }),
      toggleWheelId: (id) =>
        set((s) => {
          if (s.wheelIds.includes(id)) return { wheelIds: s.wheelIds.filter((x) => x !== id), ...touch() };
          if (s.wheelIds.length >= MAX_WHEEL) return {};
          return { wheelIds: [...s.wheelIds, id], ...touch() };
        }),
      setWheelFilter: (f) => set((s) => ({ wheelFilter: { ...s.wheelFilter, ...f }, ...touch() })),
      shuffleWheel: () => {
        const s = get();
        if (s.isSpinning) return;
        const scope = selectFilteredPool(s, s.wheelFilter);
        const source = scope.length > 0 ? scope : selectPool(s);
        set({ wheelIds: pickMany(source, MAX_WHEEL).map((p) => p.id), ...touch() });
      },
      clearWheel: () => set({ wheelIds: [], ...touch() }),

      addPrize: (name, quantity) =>
        set((s) => ({
          prizes: [...s.prizes, { id: uid(), name: name.trim() || 'Prize', quantity: Math.max(1, Math.floor(quantity)) }],
          ...touch(),
        })),
      updatePrize: (id, patch) =>
        set((s) => ({
          prizes: s.prizes.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...patch,
                  quantity: patch.quantity !== undefined ? Math.max(1, Math.floor(patch.quantity)) : p.quantity,
                }
              : p,
          ),
          ...touch(),
        })),
      deletePrize: (id) =>
        set((s) => ({
          prizes: s.prizes.filter((p) => p.id !== id),
          currentPrizeId: s.currentPrizeId === id ? null : s.currentPrizeId,
          ...touch(),
        })),
      movePrize: (id, dir) =>
        set((s) => {
          const i = s.prizes.findIndex((p) => p.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= s.prizes.length) return {};
          const prizes = s.prizes.slice();
          [prizes[i], prizes[j]] = [prizes[j], prizes[i]];
          return { prizes, ...touch() };
        }),
      setCurrentPrize: (id) => set({ currentPrizeId: id, ...touch() }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch }, ...touch() })),

      startSpin: () => {
        const s = get();
        if (s.isSpinning || s.revealSpinId) return null;
        const pool = selectWheelParticipants(s);
        if (pool.length === 0) return null;

        const prize = selectCurrentPrize(s);
        const remaining = prize ? selectPrizeRemaining(s, prize.id) : Infinity;
        if (prize && remaining <= 0) return null;

        const count = Math.max(1, Math.min(s.settings.winnersPerSpin, remaining, pool.length));
        const chosen = pickMany(pool, count);
        const spinId = uid();
        const now = new Date().toISOString();
        const winners: Winner[] = chosen.map((p) => ({
          id: uid(),
          participantId: p.id,
          employeeId: p.employeeId,
          name: p.name,
          department: p.department,
          position: p.position,
          pinPoint: p.pinPoint,
          prizeId: prize?.id ?? null,
          prizeName: prize?.name ?? (s.settings.fallbackPrizeName || 'Prize'),
          drawnAt: now,
          spinId,
        }));
        const pending: PendingSpin = { spinId, winners };
        set({ isSpinning: true, pendingSpin: pending, activeModal: null });
        return pending;
      },

      finishSpin: () => {
        const s = get();
        const pending = s.pendingSpin;
        if (!pending) {
          set({ isSpinning: false });
          return;
        }
        const winners = [...s.winners, ...pending.winners];
        const next: Partial<DrawState> = {
          isSpinning: false,
          pendingSpin: null,
          winners,
          revealSpinId: pending.spinId,
          ...touch(),
        };
        // Auto-advance to next prize when the current one is exhausted
        const prize = selectCurrentPrize({ ...s, winners });
        if (prize && selectPrizeRemaining({ ...s, winners }, prize.id) <= 0) {
          const nextPrize = s.prizes.find((p) => selectPrizeRemaining({ ...s, winners }, p.id) > 0);
          next.currentPrizeId = nextPrize?.id ?? prize.id;
        }
        set(next);
      },

      cancelSpin: () => set({ isSpinning: false, pendingSpin: null }),
      closeReveal: () => set({ revealSpinId: null }),

      undoWinner: (winnerId) =>
        set((s) => {
          const winners = s.winners.filter((w) => w.id !== winnerId);
          const stillRevealing = s.revealSpinId && winners.some((w) => w.spinId === s.revealSpinId);
          return { winners, revealSpinId: stillRevealing ? s.revealSpinId : null, ...touch() };
        }),
      undoSpin: (spinId) =>
        set((s) => ({
          winners: s.winners.filter((w) => w.spinId !== spinId),
          revealSpinId: s.revealSpinId === spinId ? null : s.revealSpinId,
          ...touch(),
        })),
      clearWinners: () => set({ winners: [], revealSpinId: null, currentPrizeId: null, ...touch() }),
      resetSession: () =>
        set({
          participants: [],
          winners: [],
          wheelIds: [],
          wheelFilter: EMPTY_WHEEL_FILTER,
          prizes: defaultPrizes(),
          currentPrizeId: null,
          revealSpinId: null,
          pendingSpin: null,
          isSpinning: false,
          activeModal: null,
          ...touch(),
        }),

      openModal: (m) => {
        if (get().isSpinning) return;
        set({ activeModal: m });
      },
      closeModal: () => set({ activeModal: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: sessionStorageAdapter,
      version: 1,
      partialize: (s) => ({
        participants: s.participants,
        winners: s.winners,
        prizes: s.prizes,
        currentPrizeId: s.currentPrizeId,
        settings: s.settings,
        lastUpdated: s.lastUpdated,
        wheelIds: s.wheelIds,
        wheelFilter: s.wheelFilter,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DrawState>;
        return {
          ...current,
          ...p,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
          prizes: Array.isArray(p.prizes) ? p.prizes : current.prizes,
          wheelIds: Array.isArray(p.wheelIds) ? p.wheelIds : [],
          wheelFilter: { ...EMPTY_WHEEL_FILTER, ...(p.wheelFilter ?? {}) },
        };
      },
    },
  ),
);

/* ---------- Selectors (pure, usable inside and outside components) ---------- */

type Slice = Pick<DrawState, 'participants' | 'winners' | 'prizes' | 'currentPrizeId' | 'settings'>;

export function selectWinnerParticipantIds(s: Pick<DrawState, 'winners'>): Set<string> {
  return new Set(s.winners.map((w) => w.participantId));
}

/** Participants currently eligible to be drawn. */
export function selectPool(s: Pick<Slice, 'participants' | 'winners' | 'settings'>): Participant[] {
  const winnerIds = selectWinnerParticipantIds(s);
  return s.participants.filter((p) => !p.removed && (s.settings.allowDuplicateWinner || !winnerIds.has(p.id)));
}

/** Eligible participants matching the wheel filter scope. */
export function selectFilteredPool(s: Pick<Slice, 'participants' | 'winners' | 'settings'>, f: WheelFilter): Participant[] {
  return selectPool(s).filter((p) => (!f.department || p.department === f.department) && (!f.pinPoint || p.pinPoint === f.pinPoint));
}

/** Participants currently on the wheel, in wheel order, excluding anyone no longer eligible. */
export function selectWheelParticipants(s: Pick<Slice, 'participants' | 'winners' | 'settings'> & { wheelIds: string[] }): Participant[] {
  const pool = new Map(selectPool(s).map((p) => [p.id, p]));
  const out: Participant[] = [];
  for (const id of s.wheelIds) {
    const p = pool.get(id);
    if (p) out.push(p);
  }
  return out;
}

export function selectPrizeRemaining(s: Pick<Slice, 'winners' | 'prizes'>, prizeId: string): number {
  const prize = s.prizes.find((p) => p.id === prizeId);
  if (!prize) return 0;
  const used = s.winners.filter((w) => w.prizeId === prizeId).length;
  return Math.max(0, prize.quantity - used);
}

export function selectCurrentPrize(s: Pick<Slice, 'winners' | 'prizes' | 'currentPrizeId'>): Prize | null {
  if (s.prizes.length === 0) return null;
  const explicit = s.prizes.find((p) => p.id === s.currentPrizeId);
  if (explicit) return explicit;
  return s.prizes.find((p) => selectPrizeRemaining(s, p.id) > 0) ?? s.prizes[s.prizes.length - 1] ?? null;
}

export function selectSessionCompleted(s: Pick<Slice, 'winners' | 'prizes'>): boolean {
  if (s.prizes.length === 0) return false;
  return s.prizes.every((p) => selectPrizeRemaining(s, p.id) <= 0);
}

export function selectParticipantStatus(s: Pick<DrawState, 'winners'>, p: Participant): 'eligible' | 'winner' | 'removed' {
  if (p.removed) return 'removed';
  if (s.winners.some((w) => w.participantId === p.id)) return 'winner';
  return 'eligible';
}
