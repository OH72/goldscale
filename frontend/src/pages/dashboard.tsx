import { useMemo, useState } from 'react'
import { useFilterStore } from '@/stores/filter-store'
import {
  useDashboard,
  useExpensesByCategory,
  useIncomeVsExpenses,
  useExpenseTrend,
} from '@/api/use-dashboard'
import { useAccounts } from '@/api/use-accounts'
import { useCategories } from '@/api/use-categories'
import { useTags } from '@/api/use-tags'
import { useExchangeRateHistory } from '@/api/use-exchange-rates'
import { useDebtSummary } from '@/api/use-debt-records'
import { useSettings } from '@/api/use-settings'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronsUpDown, RotateCcw, Search } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  ComposedChart,
  ReferenceLine,
} from 'recharts'
import { useTheme } from 'next-themes'
import { formatCurrency, fromSubunits } from '@/lib/currency'

const CHART_COLORS_LIGHT = [
  '#3b82f6', '#ef4444', '#22c55e', '#f97316', '#8b5cf6',
  '#06b6d4', '#ec4899', '#eab308', '#14b8a6', '#6366f1',
]

const CHART_COLORS_DARK = [
  '#5590cc', '#d06860', '#4aaa6e', '#d09848', '#8a74c0',
  '#3aacb4', '#c47488', '#bab040', '#3aac90', '#7478c0',
]

function compactNumber(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return `${v}`
}

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--card)',
  borderColor: 'var(--border)',
  color: 'var(--card-foreground)',
  borderRadius: 8,
}

function NetWorthCard({
  totalNetWorth,
  displayCurrency,
  showRatesHint,
}: {
  totalNetWorth: number
  displayCurrency: string
  showRatesHint: boolean
}) {
  const { data: debtSummary } = useDebtSummary()
  const debtEntries = Array.isArray(debtSummary?.entries)
    ? debtSummary.entries
    : []
  const debtNet = debtEntries.reduce((sum, e) => sum + e.net, 0)
  const hasDebts = debtEntries.length > 0

  return (
    <Card className="mb-6">
      <CardContent className="grid gap-6 pt-6 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Total Net Worth
          </p>
          <p className="text-3xl font-bold">
            {formatCurrency(totalNetWorth, displayCurrency)}
          </p>
          {showRatesHint && (
            <p className="mt-1 text-xs text-muted-foreground">
              Set exchange rates in Settings for multi-currency totals
            </p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Net Worth incl. Debts &amp; Loans
          </p>
          <p className="text-3xl font-bold">
            {formatCurrency(totalNetWorth + debtNet, displayCurrency)}
          </p>
          {hasDebts && (
            <p
              className={cn(
                'mt-1 text-xs',
                debtNet > 0
                  ? 'text-green-600 dark:text-green-400'
                  : debtNet < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground',
              )}
            >
              {debtNet > 0 ? '+' : ''}
              {formatCurrency(debtNet, displayCurrency)} from open debts &amp; loans
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

type DatePreset = 'this-month' | 'last-month' | 'last-3' | 'last-6' | 'this-year' | 'all-time' | 'custom'

const PRESET_LABELS: Record<DatePreset, string> = {
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'last-3': 'Last 3 Months',
  'last-6': 'Last 6 Months',
  'this-year': 'This Year',
  'all-time': 'All Time',
  'custom': 'Custom Range',
}

function getPresetRange(preset: DatePreset, initialDate = '2022-01-01'): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (preset) {
    case 'this-month':
      return {
        from: new Date(y, m, 1).toISOString().slice(0, 10),
        to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
      }
    case 'last-month':
      return {
        from: new Date(y, m - 1, 1).toISOString().slice(0, 10),
        to: new Date(y, m, 0).toISOString().slice(0, 10),
      }
    case 'last-3': {
      return {
        from: new Date(y, m - 2, 1).toISOString().slice(0, 10),
        to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
      }
    }
    case 'last-6': {
      return {
        from: new Date(y, m - 5, 1).toISOString().slice(0, 10),
        to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
      }
    }
    case 'this-year':
      return {
        from: `${y}-01-01`,
        to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
      }
    case 'all-time':
      return {
        from: initialDate,
        to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
      }
    default:
      return {
        from: new Date(y, m, 1).toISOString().slice(0, 10),
        to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
      }
  }
}

export function DashboardPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const chartColors = isDark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT
  const cursorFill = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const { data, isLoading, error } = useDashboard()
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: tags = [] } = useTags()
  const { data: settings } = useSettings()
  const initialDate = settings?.initialDate ?? '2022-01-01'

  const {
    preset: storePreset, customFrom: storedFrom, customTo: storedTo,
    selectedAccountIds, selectedCategoryIds, selectedTagIds, selectedTypes, groupBy,
  } = useFilterStore((s) => s.dashboard)
  const setDashboard = useFilterStore((s) => s.setDashboard)
  const resetDashboard = useFilterStore((s) => s.resetDashboard)
  const hasActiveFilters = storePreset !== 'last-6' || storedFrom !== '' || storedTo !== '' ||
    selectedAccountIds.length > 0 || selectedCategoryIds.length > 0 ||
    selectedTagIds.length > 0 || selectedTypes.length > 0 || groupBy !== 'category'
  const preset = storePreset as DatePreset
  const defaultRange = useMemo(() => getPresetRange(preset, initialDate), [preset, initialDate])
  const customFrom = storedFrom || defaultRange.from
  const customTo = storedTo || defaultRange.to
  const [accountSearch, setAccountSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [tagSearch, setTagSearch] = useState('')

  const dateRange = useMemo(() => ({
    from: customFrom,
    to: customTo,
  }), [customFrom, customTo])

  const chartFilters = useMemo(() => ({
    from: dateRange.from,
    to: dateRange.to,
    accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
    categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    types: selectedTypes.length > 0 ? selectedTypes : undefined,
    groupBy,
  }), [dateRange, selectedAccountIds, selectedCategoryIds, selectedTagIds, selectedTypes, groupBy])

  const { data: expenseData, isLoading: expenseLoading } = useExpensesByCategory(chartFilters)
  const { data: incomeVsExpenseData, isLoading: iveLoading } = useIncomeVsExpenses(chartFilters)
  const { data: trendData, isLoading: trendLoading } = useExpenseTrend(chartFilters)
  const { data: rateHistory, isLoading: rateHistoryLoading } = useExchangeRateHistory(dateRange)

  function handlePresetChange(value: string | null) {
    if (!value) return
    const p = value as DatePreset
    if (p !== 'custom') {
      const range = getPresetRange(p, initialDate)
      setDashboard({ preset: p, customFrom: range.from, customTo: range.to })
    } else {
      setDashboard({ preset: p })
    }
  }

  // Donut data: top 8 + Other
  const donutData = useMemo(() => {
    if (!expenseData || expenseData.length === 0) return []
    const top = expenseData.slice(0, 8)
    const rest = expenseData.slice(8)
    const result = top.map((d) => ({
      name: d.name,
      value: d.amount,
    }))
    if (rest.length > 0) {
      result.push({
        name: 'Other',
        value: rest.reduce((sum, d) => sum + d.amount, 0),
      })
    }
    return result
  }, [expenseData])

  const donutTotal = useMemo(() => donutData.reduce((sum, d) => sum + d.value, 0), [donutData])

  const totalIncome = useMemo(() => {
    if (!incomeVsExpenseData) return 0
    return incomeVsExpenseData.months.reduce((sum, d) => sum + d.income, 0)
  }, [incomeVsExpenseData])

  // Income vs Expense bar data
  const barData = useMemo(() => {
    if (!incomeVsExpenseData) return []
    return incomeVsExpenseData.months.map((d) => ({
      period: d.period.slice(2).replace('-', '/'), // "2026-10" -> "26/10"
      income: fromSubunits(d.income),
      expense: fromSubunits(d.expense),
    }))
  }, [incomeVsExpenseData])

  // Net trend: cumulative net starting from priorNet, bars for month-over-month delta
  const netTrendData = useMemo(() => {
    if (!incomeVsExpenseData || incomeVsExpenseData.months.length === 0) return []
    let cumulative = fromSubunits(incomeVsExpenseData.priorNet)
    return incomeVsExpenseData.months.map((d) => {
      const monthNet = fromSubunits(d.net)
      const prev = cumulative
      cumulative += monthNet
      return {
        period: d.period.slice(2).replace('-', '/'),
        net: cumulative,
        delta: cumulative - prev,
      }
    })
  }, [incomeVsExpenseData])

  // Expense trend: top 6 categories + Other, stacked per month
  const { trendChartData, trendGroupKeys } = useMemo(() => {
    if (!trendData || trendData.length === 0) return { trendChartData: [], trendGroupKeys: [] }

    // Find top 6 groups by total across all months
    const totalByGroup = new Map<string, { name: string; total: number }>()
    for (const month of trendData) {
      for (const g of month.groups) {
        const existing = totalByGroup.get(g.id)
        if (existing) {
          existing.total += g.amount
        } else {
          totalByGroup.set(g.id, { name: g.name, total: g.amount })
        }
      }
    }
    const sorted = [...totalByGroup.entries()]
      .sort((a, b) => b[1].total - a[1].total)
    const topIds = new Set(sorted.slice(0, 6).map(([id]) => id))
    const groupKeys = sorted.slice(0, 6).map(([id, { name }]) => ({ id, name }))
    const hasOther = sorted.length > 6

    // Build chart data
    const chartData = trendData.map((month) => {
      const row: Record<string, number | string> = {
        period: month.period.slice(2).replace('-', '/'),
      }
      for (const { id } of groupKeys) {
        row[id] = 0
      }
      if (hasOther) row['other'] = 0

      for (const g of month.groups) {
        if (topIds.has(g.id)) {
          row[g.id] = fromSubunits(g.amount)
        } else if (hasOther) {
          row['other'] = (row['other'] as number) + fromSubunits(g.amount)
        }
      }
      return row
    })

    const keys = [...groupKeys.map((c) => ({ id: c.id, name: c.name }))]
    if (hasOther) keys.push({ id: 'other', name: 'Other' })

    return { trendChartData: chartData, trendGroupKeys: keys }
  }, [trendData])

  const rateChartData = useMemo(() => {
    if (!rateHistory || rateHistory.length === 0) return { data: [], currencies: [] }
    const currencies = Object.keys(rateHistory[0]!.rates)
    // Downsample to ~60 points max so tooltip markers align with visible ticks
    const maxPoints = 60
    const step = rateHistory.length > maxPoints ? Math.ceil(rateHistory.length / maxPoints) : 1
    const sampled = rateHistory.filter((_, i) => i % step === 0 || i === rateHistory.length - 1)
    const chartData = sampled.map((entry) => {
      const row: Record<string, number | string> = {
        date: entry.date.slice(5),
      }
      for (const [currency, subunits] of Object.entries(entry.rates)) {
        row[currency] = subunits / 100
      }
      return row
    })
    return { data: chartData, currencies }
  }, [rateHistory])

  if (isLoading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6 text-destructive">Failed to load dashboard: {error.message}</div>
  if (!data) return null

  const activeAccounts = accounts.filter((a) => a.active)
  const displayCurrency = data.displayCurrency
  const hasRates = data.totalNetWorth !== 0 || activeAccounts.length === 0

  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* Net Worth */}
      <NetWorthCard
        totalNetWorth={data.totalNetWorth}
        displayCurrency={displayCurrency}
        showRatesHint={!hasRates && activeAccounts.length > 0}
      />

      {/* Filter Panel */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Period</Label>
            <Select value={preset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-40">
                <SelectValue>{(v: string) => PRESET_LABELS[v as DatePreset] ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRESET_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              className="w-38"
              value={customFrom}
              onChange={(e) => {
                setDashboard({ customFrom: e.target.value, preset: 'custom' })
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              className="w-38"
              value={customTo}
              onChange={(e) => {
                setDashboard({ customTo: e.target.value, preset: 'custom' })
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Accounts</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-44 justify-between font-normal">
                  {selectedAccountIds.length === 0
                    ? 'All accounts'
                    : `${selectedAccountIds.length} selected`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="h-8 pl-7 text-sm"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {activeAccounts
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .filter((a) => a.name.toLowerCase().includes(accountSearch.toLowerCase()))
                    .map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedAccountIds.includes(a.id)}
                        onCheckedChange={(checked) => {
                          setDashboard({
                            selectedAccountIds: checked
                              ? [...selectedAccountIds, a.id]
                              : selectedAccountIds.filter((id) => id !== a.id),
                          })
                        }}
                      />
                      <span className="inline-flex items-center gap-1.5">
                        {a.color && (
                          <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                        )}
                        {a.name}
                      </span>
                    </label>
                  ))}
                </div>
                {selectedAccountIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setDashboard({ selectedAccountIds: [] })}
                  >
                    Clear
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Categories</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-44 justify-between font-normal">
                  {selectedCategoryIds.length === 0
                    ? 'All categories'
                    : `${selectedCategoryIds.length} selected`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="h-8 pl-7 text-sm"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                  />
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {categories
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .filter((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                    .map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedCategoryIds.includes(c.id)}
                        onCheckedChange={(checked) => {
                          setDashboard({
                            selectedCategoryIds: checked
                              ? [...selectedCategoryIds, c.id]
                              : selectedCategoryIds.filter((id) => id !== c.id),
                          })
                        }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                {selectedCategoryIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setDashboard({ selectedCategoryIds: [] })}
                  >
                    Clear
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tags</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-44 justify-between font-normal">
                  {selectedTagIds.length === 0
                    ? 'All tags'
                    : `${selectedTagIds.length} selected`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="h-8 pl-7 text-sm"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {tags
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                    .map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedTagIds.includes(t.id)}
                        onCheckedChange={(checked) => {
                          setDashboard({
                            selectedTagIds: checked
                              ? [...selectedTagIds, t.id]
                              : selectedTagIds.filter((id) => id !== t.id),
                          })
                        }}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
                {selectedTagIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setDashboard({ selectedTagIds: [] })}
                  >
                    Clear
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-44 justify-between font-normal">
                  {selectedTypes.length === 0
                    ? 'All types'
                    : `${selectedTypes.length} selected`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="space-y-1">
                  {(['INCOME', 'EXPENSE', 'TRANSFER'] as const).map((t) => (
                    <label
                      key={t}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedTypes.includes(t)}
                        onCheckedChange={(checked) => {
                          setDashboard({
                            selectedTypes: checked
                              ? [...selectedTypes, t]
                              : selectedTypes.filter((v) => v !== t),
                          })
                        }}
                      />
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </label>
                  ))}
                </div>
                {selectedTypes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setDashboard({ selectedTypes: [] })}
                  >
                    Clear
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Group by</Label>
            <div className="flex gap-1 rounded-md border p-0.5 h-9 items-center">
              <Button
                variant={groupBy === 'category' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setDashboard({ groupBy: 'category' })}
              >
                Category
              </Button>
              <Button
                variant={groupBy === 'tag' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setDashboard({ groupBy: 'tag' })}
              >
                Tag
              </Button>
            </div>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetDashboard} className="self-end">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Expenses by Category Donut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Expenses by {groupBy === 'category' ? 'Category' : 'Tag'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
            ) : donutData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No expenses in this period</p>
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={chartColors[i % chartColors.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value, displayCurrency),
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-6 text-sm">
                  <p>
                    <span className="text-muted-foreground">Expense: </span>
                    <span className="font-semibold" style={{ color: '#ef4444' }}>{formatCurrency(donutTotal, displayCurrency)}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Income: </span>
                    <span className="font-semibold" style={{ color: '#22c55e' }}>{formatCurrency(totalIncome, displayCurrency)}</span>
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                  {donutData.map((d, i) => (
                    <span key={d.name} className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: chartColors[i % chartColors.length] }}
                      />
                      {d.name} ({((d.value / donutTotal) * 100).toFixed(0)}%)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income vs Expenses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {iveLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
            ) : barData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No data in this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={compactNumber} width={55} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: cursorFill }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(Math.round(value * 100), displayCurrency),
                      name.charAt(0).toUpperCase() + name.slice(1),
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="income" fill="#22c55e" name="Income" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Net Trend */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Net Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {iveLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
          ) : netTrendData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No data in this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={netTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="period" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={compactNumber} width={55} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: cursorFill }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(Math.round(value * 100), displayCurrency),
                    name === 'net' ? 'Net' : 'Change',
                  ]}
                />
                <Legend formatter={(v: string) => (v === 'net' ? 'Net' : 'Change')} />
                <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />
                <Bar
                  dataKey="delta"
                  name="delta"
                  radius={[2, 2, 0, 0]}
                  fill="#8b5cf6"
                  opacity={0.6}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="net"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Exchange Rates */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            Exchange Rates (1 unit → {displayCurrency})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rateHistoryLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
          ) : rateChartData.data.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No rate data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={rateChartData.data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => [
                    `${(value as number).toFixed(2)} ${displayCurrency}`,
                    `1 ${name}`,
                  ]}
                />
                <Legend formatter={(value: string) => `1 ${value}`} />
                <ReferenceLine y={1} stroke="#888" strokeDasharray="3 3" label={{ value: `1 ${displayCurrency}`, position: 'right', fontSize: 11, fill: '#888' }} />
                {rateChartData.currencies.map((currency, i) => (
                  <Line
                    key={currency}
                    type="monotone"
                    dataKey={currency}
                    stroke={chartColors[i % chartColors.length]}
                    strokeWidth={2}
                    dot={false}
                    name={currency}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Expense Trend */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            Expense Trend by {groupBy === 'category' ? 'Category' : 'Tag'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
          ) : trendChartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No expenses in this period</p>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={compactNumber} width={55} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: cursorFill }}
                    formatter={(value: number, name: string) => {
                      const cat = trendGroupKeys.find((c) => c.id === name)
                      return [
                        formatCurrency(Math.round(value as number * 100), displayCurrency),
                        cat?.name ?? name,
                      ]
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const cat = trendGroupKeys.find((c) => c.id === value)
                      return cat?.name ?? value
                    }}
                  />
                  {trendGroupKeys.map((cat, i) => (
                    <Bar
                      key={cat.id}
                      dataKey={cat.id}
                      stackId="expenses"
                      fill={chartColors[i % chartColors.length]}
                      name={cat.id}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
