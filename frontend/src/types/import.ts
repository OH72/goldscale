import type { TransactionType } from './common'

export type BankType =
  | 'MONOBANK'
  | 'MILLENNIUM'
  | 'KREDOBANK_CARD'
  | 'KREDOBANK_ACCOUNT'
  | 'MONEYMANAGER'

export const BANK_TYPE_LABELS: Record<BankType, string> = {
  MONOBANK: 'Monobank',
  MILLENNIUM: 'Millennium',
  KREDOBANK_CARD: 'Kredobank (Card)',
  KREDOBANK_ACCOUNT: 'Kredobank (Account)',
  MONEYMANAGER: 'MoneyManager',
}

// From backend preview response
export interface ImportRow {
  index: number
  type: TransactionType
  amount: number // subunits
  date: string // ISO date
  description: string | null
  categoryHint: string | null
  sourceRef: string | null
  // MoneyManager-specific
  accountName: string | null
  targetAccountName: string | null
  targetAmount: number | null // subunits
  currency: string | null
  targetCurrency: string | null
  tags: string[] | null
}

export interface ImportPreviewResponse {
  rows: ImportRow[]
  bankName: string
  detectedCurrency: string
}

// Local UI state — extends ImportRow with user edits
export interface ImportRowState {
  index: number
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'INITIAL_BALANCE'
  amount: number // subunits — always subunits in state!
  date: string
  description: string
  categoryId?: string
  categoryName?: string
  categoryAutoSelected: boolean
  sourceRef: string | null
  targetAccountId?: string
  targetAmount?: number // subunits
  transferDirection?: 'out' | 'in' // out = from current account, in = to current account
  // MoneyManager-specific
  accountId?: string
  accountName?: string
  targetAccountName?: string
  currency?: string
  targetCurrency?: string
  tags?: string[]
}

// Sent to backend on confirm
export interface ConfirmRow {
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'INITIAL_BALANCE'
  amount: number
  date: string
  description: string | null
  categoryId: string | null
  sourceRef: string | null
  targetAccountId?: string | null
  targetAmount?: number | null
  // MoneyManager-specific
  accountId?: string | null
  accountName?: string | null
  categoryName?: string | null
  targetAccountName?: string | null
  currency?: string | null
  targetCurrency?: string | null
  tags?: string[] | null
}

export interface ImportConfirmRequest {
  accountId: string | null
  bankType: BankType
  rows: ConfirmRow[]
}

export interface ImportConfirmResponse {
  imported: number
  skipped: number
}
