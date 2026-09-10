export interface Participant {
  /** Internal unique id (uuid) */
  id: string
  employeeId: string
  name: string
  pinPoint?: string
  department?: string
  position?: string
  contractType?: string
  /** Manually removed from the pool by operator */
  removed: boolean
  /** Original row number in the imported Excel (1-based, header excluded) */
  sourceRow?: number
}

export type ParticipantStatus = 'eligible' | 'winner' | 'removed'

export interface Winner {
  id: string
  participantId: string
  employeeId: string
  name: string
  department?: string
  position?: string
  pinPoint?: string
  prizeId: string | null
  prizeName: string
  drawnAt: string // ISO
  /** Groups winners drawn in the same spin */
  spinId: string
}

export interface Prize {
  id: string
  name: string
  quantity: number
}

export interface DrawSettings {
  eventName: string
  winnersPerSpin: number
  allowDuplicateWinner: boolean
  spinDurationSec: number
  soundEnabled: boolean
  confettiEnabled: boolean
  theme: 'dark' | 'light'
  /** Free-text prize name used when no prize list is configured */
  fallbackPrizeName: string
  /** Draw display: auto = wheel for small rosters, reel for large ones */
  stageMode: StageMode
}

export type StageMode = 'auto' | 'wheel' | 'reel'

export type ImportIssueType =
  | 'missing_id'
  | 'missing_name'
  | 'duplicate'
  | 'empty_row'

export interface ImportIssue {
  row: number
  type: ImportIssueType
  message: string
  employeeId?: string
  name?: string
}

export interface ParsedImport {
  fileName: string
  sheetName: string
  headers: string[]
  /** Which canonical fields were mapped from which header */
  mapping: Partial<Record<keyof ParticipantDraft, string>>
  rows: ParticipantDraft[]
  issues: ImportIssue[]
  totalRows: number
}

export interface ParticipantDraft {
  employeeId: string
  name: string
  pinPoint?: string
  department?: string
  position?: string
  contractType?: string
  sourceRow: number
}
