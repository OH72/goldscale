import type { TransactionType } from './common'

// From backend preview response
export interface ImportRow {
  index: number
  type: TransactionType // 'INCOME' | 'EXPENSE'
  amount: number // subunits
  date: string // ISO date
  description: string | null
  categoryHint: string | null
  sourceRef: string | null
}

export interface ImportPreviewResponse {
  rows: ImportRow[]
  bankName: string
  detectedCurrency: string
}

// Local UI state — extends ImportRow with user edits
export interface ImportRowState {
  index: number
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  amount: number // subunits — always subunits in state!
  date: string
  description: string
  categoryId?: string
  categoryAutoSelected: boolean
  sourceRef: string | null
  targetAccountId?: string
  targetAmount?: number // subunits
}

// Sent to backend on confirm
export interface ConfirmRow {
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  amount: number
  date: string
  description: string | null
  categoryId: string | null
  sourceRef: string | null
  targetAccountId?: string | null
  targetAmount?: number | null
}

export interface ImportConfirmRequest {
  accountId: string
  rows: ConfirmRow[]
}

export interface ImportConfirmResponse {
  imported: number
  skipped: number
}
