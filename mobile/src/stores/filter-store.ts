import { create } from 'zustand'
import type { CategoryType, Currency } from '@/types/common'
import type { DebtType, DebtStatus } from '@/types/debt'

interface CategoriesFilters {
  typeFilter: 'ALL' | CategoryType
  search: string
}

interface AccountsFilters {
  currencyFilter: Currency | ''
  sortField: 'name' | 'balance' | 'converted' | null
  sortDir: 'asc' | 'desc'
}

interface DebtsFilters {
  personId: string
  type: 'ALL' | DebtType
  status: 'ALL' | DebtStatus
  search: string
}

interface DashboardFilters {
  preset: string
  customFrom: string
  customTo: string
  selectedAccountIds: string[]
  selectedCategoryIds: string[]
  selectedTagIds: string[]
  selectedTypes: string[]
  groupBy: 'category' | 'tag'
}

const CATEGORIES_DEFAULTS: CategoriesFilters = {
  typeFilter: 'ALL',
  search: '',
}

const ACCOUNTS_DEFAULTS: AccountsFilters = {
  currencyFilter: '',
  sortField: 'name',
  sortDir: 'asc',
}

const DEBTS_DEFAULTS: DebtsFilters = {
  personId: '',
  type: 'ALL',
  status: 'ALL',
  search: '',
}

const DASHBOARD_DEFAULTS: DashboardFilters = {
  preset: 'last-6',
  customFrom: '',
  customTo: '',
  selectedAccountIds: [],
  selectedCategoryIds: [],
  selectedTagIds: [],
  selectedTypes: [],
  groupBy: 'category',
}

interface FilterState {
  categories: CategoriesFilters
  accounts: AccountsFilters
  debts: DebtsFilters
  dashboard: DashboardFilters

  setCategories: (patch: Partial<CategoriesFilters>) => void
  setAccounts: (patch: Partial<AccountsFilters>) => void
  setDebts: (patch: Partial<DebtsFilters>) => void
  setDashboard: (patch: Partial<DashboardFilters>) => void
  resetCategories: () => void
  resetAccounts: () => void
  resetDebts: () => void
  resetDashboard: () => void
}

export const useFilterStore = create<FilterState>((set) => ({
  categories: { ...CATEGORIES_DEFAULTS },
  accounts: { ...ACCOUNTS_DEFAULTS },
  debts: { ...DEBTS_DEFAULTS },
  dashboard: { ...DASHBOARD_DEFAULTS },

  setCategories: (patch) =>
    set((s) => ({ categories: { ...s.categories, ...patch } })),
  setAccounts: (patch) =>
    set((s) => ({ accounts: { ...s.accounts, ...patch } })),
  setDebts: (patch) =>
    set((s) => ({ debts: { ...s.debts, ...patch } })),
  setDashboard: (patch) =>
    set((s) => ({ dashboard: { ...s.dashboard, ...patch } })),
  resetCategories: () => set({ categories: { ...CATEGORIES_DEFAULTS } }),
  resetAccounts: () => set({ accounts: { ...ACCOUNTS_DEFAULTS } }),
  resetDebts: () => set({ debts: { ...DEBTS_DEFAULTS } }),
  resetDashboard: () => set({ dashboard: { ...DASHBOARD_DEFAULTS } }),
}))
