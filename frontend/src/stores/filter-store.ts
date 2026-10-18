import { create } from 'zustand'
import type { CategoryType, Currency } from '@/types/common'
import type { DebtType, DebtStatus } from '@/types/debt'

interface CategoriesFilters {
  typeFilter: 'ALL' | CategoryType
  search: string
}

interface TagsFilters {
  search: string
}

interface PeopleFilters {
  search: string
  sortBy: 'NAME' | 'TOTAL_DEBT' | 'TOTAL_LOAN' | 'NET'
  direction: 'ASC' | 'DESC'
}

interface AccountsFilters {
  search: string
  currencyFilter: Currency | ''
  sortField: 'name' | 'balance' | 'converted' | null
  sortDir: 'asc' | 'desc'
}

interface TransactionsFilters {
  accountId: string
  type: string
  categoryId: string
  tagId: string
  startDate: string
  endDate: string
  search: string
  sort: string
  page: number
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

const TAGS_DEFAULTS: TagsFilters = {
  search: '',
}

const PEOPLE_DEFAULTS: PeopleFilters = {
  search: '',
  sortBy: 'NAME',
  direction: 'ASC',
}

const ACCOUNTS_DEFAULTS: AccountsFilters = {
  search: '',
  currencyFilter: '',
  sortField: 'name',
  sortDir: 'asc',
}

const TRANSACTIONS_DEFAULTS: TransactionsFilters = {
  accountId: '',
  type: '',
  categoryId: '',
  tagId: '',
  startDate: '',
  endDate: '',
  search: '',
  sort: '',
  page: 0,
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
  tags: TagsFilters
  people: PeopleFilters
  categories: CategoriesFilters
  accounts: AccountsFilters
  transactions: TransactionsFilters
  debts: DebtsFilters
  dashboard: DashboardFilters

  setTags: (patch: Partial<TagsFilters>) => void
  setPeople: (patch: Partial<PeopleFilters>) => void
  setCategories: (patch: Partial<CategoriesFilters>) => void
  setAccounts: (patch: Partial<AccountsFilters>) => void
  setTransactions: (patch: Partial<TransactionsFilters>) => void
  setDebts: (patch: Partial<DebtsFilters>) => void
  setDashboard: (patch: Partial<DashboardFilters>) => void
  resetTags: () => void
  resetPeople: () => void
  resetCategories: () => void
  resetAccounts: () => void
  resetTransactions: () => void
  resetDebts: () => void
  resetDashboard: () => void
}

export const useFilterStore = create<FilterState>((set) => ({
  tags: { ...TAGS_DEFAULTS },
  people: { ...PEOPLE_DEFAULTS },
  categories: { ...CATEGORIES_DEFAULTS },
  accounts: { ...ACCOUNTS_DEFAULTS },
  transactions: { ...TRANSACTIONS_DEFAULTS },
  debts: { ...DEBTS_DEFAULTS },
  dashboard: { ...DASHBOARD_DEFAULTS },

  setTags: (patch) =>
    set((s) => ({ tags: { ...s.tags, ...patch } })),
  setPeople: (patch) =>
    set((s) => ({ people: { ...s.people, ...patch } })),
  setCategories: (patch) =>
    set((s) => ({ categories: { ...s.categories, ...patch } })),
  setAccounts: (patch) =>
    set((s) => ({ accounts: { ...s.accounts, ...patch } })),
  setTransactions: (patch) =>
    set((s) => ({ transactions: { ...s.transactions, ...patch } })),
  setDebts: (patch) =>
    set((s) => ({ debts: { ...s.debts, ...patch } })),
  setDashboard: (patch) =>
    set((s) => ({ dashboard: { ...s.dashboard, ...patch } })),
  resetTags: () => set({ tags: { ...TAGS_DEFAULTS } }),
  resetPeople: () => set({ people: { ...PEOPLE_DEFAULTS } }),
  resetCategories: () => set({ categories: { ...CATEGORIES_DEFAULTS } }),
  resetAccounts: () => set({ accounts: { ...ACCOUNTS_DEFAULTS } }),
  resetTransactions: () => set({ transactions: { ...TRANSACTIONS_DEFAULTS } }),
  resetDebts: () => set({ debts: { ...DEBTS_DEFAULTS } }),
  resetDashboard: () => set({ dashboard: { ...DASHBOARD_DEFAULTS } }),
}))
