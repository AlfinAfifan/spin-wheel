import * as XLSX from 'xlsx'
import type {
  ImportIssue,
  ParsedImport,
  ParticipantDraft,
  Winner,
} from '@/types/participant'
import { normalizeHeader } from './utils'

export const TEMPLATE_HEADERS = [
  'Nomor Induk Karyawan',
  'Nama',
  'Pin Point',
  'Departemen',
  'Posisi terakhir',
  'Contract Type',
] as const

export const REQUIRED_FIELDS: Array<keyof ParticipantDraft> = ['employeeId', 'name']

/** Header aliases (normalized: lowercase, alphanumerics only). */
const HEADER_ALIASES: Record<keyof Omit<ParticipantDraft, 'sourceRow'>, string[]> = {
  employeeId: [
    'nomorindukkaryawan',
    'noindukkaryawan',
    'nomorinduk',
    'noinduk',
    'nik',
    'employeeid',
    'employeeno',
    'employeenumber',
    'empid',
    'idkaryawan',
    'id',
  ],
  name: ['nama', 'name', 'namakaryawan', 'employeename', 'fullname', 'namalengkap'],
  pinPoint: ['pinpoint', 'pin', 'lokasi', 'location', 'site', 'area'],
  department: ['departemen', 'department', 'dept', 'divisi', 'division', 'bagian'],
  position: ['posisiterakhir', 'posisi', 'position', 'jabatan', 'title', 'jobtitle', 'role'],
  contractType: ['contracttype', 'tipekontrak', 'jeniskontrak', 'kontrak', 'contract', 'statuskaryawan', 'employmentstatus'],
}

export const FIELD_LABELS: Record<keyof Omit<ParticipantDraft, 'sourceRow'>, string> = {
  employeeId: 'Nomor Induk Karyawan',
  name: 'Nama',
  pinPoint: 'Pin Point',
  department: 'Departemen',
  position: 'Posisi terakhir',
  contractType: 'Contract Type',
}

export class ExcelImportError extends Error {
  readonly details?: string[]
  constructor(message: string, details?: string[]) {
    super(message)
    this.name = 'ExcelImportError'
    this.details = details
  }
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') {
    // Avoid scientific notation for long numeric ids
    return Number.isInteger(v) ? String(v) : String(v)
  }
  if (v instanceof Date) return v.toISOString()
  return String(v).trim()
}

function detectMapping(headers: string[]): Partial<Record<keyof ParticipantDraft, string>> {
  const mapping: Partial<Record<keyof ParticipantDraft, string>> = {}
  const normalized = headers.map((h) => normalizeHeader(h))
  const taken = new Set<number>()

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<
    [keyof Omit<ParticipantDraft, 'sourceRow'>, string[]]
  >) {
    // exact alias match first
    let idx = normalized.findIndex((n, i) => !taken.has(i) && aliases.includes(n))
    // then "contains" match for longer, more specific aliases (skip very short ones like "id")
    if (idx === -1) {
      idx = normalized.findIndex(
        (n, i) => !taken.has(i) && aliases.some((a) => a.length >= 4 && n.includes(a)),
      )
    }
    if (idx !== -1) {
      mapping[field] = headers[idx]
      taken.add(idx)
    }
  }
  return mapping
}

/**
 * Parse an Excel file entirely in the browser.
 * Throws ExcelImportError for invalid files / missing required headers.
 */
export async function parseExcelFile(file: File): Promise<ParsedImport> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['xlsx', 'xls', 'xlsm', 'csv'].includes(ext)) {
    throw new ExcelImportError('Format file tidak didukung. Gunakan file .xlsx atau .xls.')
  }

  let workbook: XLSX.WorkBook
  try {
    const buffer = await file.arrayBuffer()
    workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  } catch {
    throw new ExcelImportError('File tidak dapat dibaca. Pastikan file Excel tidak rusak.')
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new ExcelImportError('File Excel tidak memiliki sheet.')
  const sheet = workbook.Sheets[sheetName]

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  })

  if (matrix.length === 0) {
    throw new ExcelImportError('Sheet pertama kosong.')
  }

  // Find the header row: first row that maps both required fields (search first 10 rows)
  let headerRowIdx = -1
  let headers: string[] = []
  let mapping: Partial<Record<keyof ParticipantDraft, string>> = {}
  for (let i = 0; i < Math.min(10, matrix.length); i++) {
    const candidate = (matrix[i] ?? []).map(cellToString)
    const m = detectMapping(candidate)
    if (m.employeeId && m.name) {
      headerRowIdx = i
      headers = candidate
      mapping = m
      break
    }
  }

  if (headerRowIdx === -1) {
    const firstRow = (matrix[0] ?? []).map(cellToString).filter(Boolean)
    throw new ExcelImportError(
      'Kolom wajib tidak ditemukan. File harus memiliki header "Nomor Induk Karyawan" dan "Nama".',
      [
        `Header terdeteksi: ${firstRow.length ? firstRow.join(', ') : '(kosong)'}`,
        `Header yang dibutuhkan: ${TEMPLATE_HEADERS.slice(0, 2).join(', ')}`,
        `Header opsional: ${TEMPLATE_HEADERS.slice(2).join(', ')}`,
      ],
    )
  }

  const colIndex = (field: keyof ParticipantDraft): number => {
    const h = mapping[field]
    return h ? headers.indexOf(h) : -1
  }
  const idx = {
    employeeId: colIndex('employeeId'),
    name: colIndex('name'),
    pinPoint: colIndex('pinPoint'),
    department: colIndex('department'),
    position: colIndex('position'),
    contractType: colIndex('contractType'),
  }

  const rows: ParticipantDraft[] = []
  const issues: ImportIssue[] = []
  const seen = new Map<string, number>()
  let totalRows = 0

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const raw = matrix[r] ?? []
    const excelRow = r + 1 // 1-based like Excel
    const get = (i: number) => (i >= 0 ? cellToString(raw[i]) : '')

    const allEmpty = raw.every((c) => cellToString(c) === '')
    if (allEmpty) continue
    totalRows++

    const employeeId = get(idx.employeeId)
    const name = get(idx.name)

    if (!employeeId && !name) {
      issues.push({ row: excelRow, type: 'empty_row', message: 'ID dan Nama kosong' })
      continue
    }
    if (!employeeId) {
      issues.push({ row: excelRow, type: 'missing_id', message: 'Nomor Induk Karyawan kosong', name })
      continue
    }
    if (!name) {
      issues.push({ row: excelRow, type: 'missing_name', message: 'Nama kosong', employeeId })
      continue
    }

    const key = employeeId.toLowerCase()
    if (seen.has(key)) {
      issues.push({
        row: excelRow,
        type: 'duplicate',
        message: `Duplikat dari baris ${seen.get(key)}`,
        employeeId,
        name,
      })
      // Still keep it in rows; duplicate policy is applied on import
    } else {
      seen.set(key, excelRow)
    }

    rows.push({
      employeeId,
      name,
      pinPoint: get(idx.pinPoint) || undefined,
      department: get(idx.department) || undefined,
      position: get(idx.position) || undefined,
      contractType: get(idx.contractType) || undefined,
      sourceRow: excelRow,
    })
  }

  return {
    fileName: file.name,
    sheetName,
    headers,
    mapping,
    rows,
    issues,
    totalRows,
  }
}

export type DuplicatePolicy = 'keep_first' | 'keep_all'

/** Apply the duplicate policy to parsed rows. */
export function applyDuplicatePolicy(rows: ParticipantDraft[], policy: DuplicatePolicy): ParticipantDraft[] {
  if (policy === 'keep_all') return rows
  const seen = new Set<string>()
  const out: ParticipantDraft[] = []
  for (const r of rows) {
    const key = r.employeeId.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

/** Download a template workbook with the correct headers and one example row. */
export function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    [...TEMPLATE_HEADERS],
    ['SUMG-0001', 'Contoh Nama Karyawan', 'HQ Jakarta', 'IT', 'Staff', 'Permanent'],
  ])
  ws['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Participants')
  XLSX.writeFile(wb, 'template-peserta-lucky-draw.xlsx')
}

/** Export winners to an Excel file. */
export function exportWinners(winners: Winner[], eventName: string) {
  const data = winners.map((w, i) => ({
    No: i + 1,
    'Nomor Induk Karyawan': w.employeeId,
    Nama: w.name,
    Departemen: w.department ?? '',
    'Posisi terakhir': w.position ?? '',
    'Pin Point': w.pinPoint ?? '',
    Prize: w.prizeName,
    'Waktu Undian': new Date(w.drawnAt).toLocaleString('id-ID'),
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 30 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Winners')
  const safeName = (eventName || 'lucky-draw').replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-')
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  XLSX.writeFile(wb, `winners-${safeName || 'lucky-draw'}-${stamp}.xlsx`)
}
