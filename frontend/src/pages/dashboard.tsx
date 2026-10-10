import { useMemo } from 'react'
import { Link } from 'react-router-dom'
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
import { Panel, PanelEmpty, PanelStat } from '@/components/panel'
import { ChartTooltip } from '@/components/charts/chart-tooltip'
import { MultiSelectFilter } from '@/components/multi-select-filter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowUpRight, RotateCcw } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisTick, compactNumber, useChartTheme, type ChartTheme } from '@/lib/chart-theme'
import { formatCurrency, formatSigned, fromSubunits, splitAmount } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import type { TransactionResponse } from '@/types/transaction'
import type { AccountResponse } from '@/types/account'

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

const TYPE_OPTIONS = [
  { id: 'INCOME', name: 'Income' },
  { id: 'EXPENSE', name: 'Expense' },
  { id: 'TRANSFER', name: 'Transfer' },
]

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

/** "2026-10" -> "Oct ’26" */
function shortPeriod(period: string): string {
  const [year, month] = period.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[Number(month) - 1] ?? month} ’${year?.slice(2)}`
}

// --- Hero ---

function HeroFigure({ amount, currency }: { amount: number; currency: string }) {
  const { sign, whole, fraction } = splitAmount(amount)
  return (
    <div className="flex flex-wrap items-baseline gap-x-4">
      <span className="font-display text-[clamp(3.5rem,9vw,7.25rem)] leading-[0.85] tracking-[-0.04em]">
        {sign}
        {whole}
        <span className="text-[0.42em] tracking-[-0.01em] text-muted-foreground">{fraction}</span>
      </span>
      <span className="num text-sm tracking-[0.14em] text-gold">{currency}</span>
    </div>
  )
}

interface StatementLineProps {
  label: string
  value: string
  tone?: 'positive' | 'negative'
  strong?: boolean
}

function StatementLine({ label, value, tone, strong }: StatementLineProps) {
  return (
    <div className={cn('flex items-baseline gap-3 py-2', strong ? 'text-base' : 'text-sm')}>
      <span className={cn(strong ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
      <span className="leader" />
      <span
        className={cn(
          'num whitespace-nowrap',
          strong && 'font-medium',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-negative',
        )}
      >
        {value}
      </span>
    </div>
  )
}

// --- Latest entries ---

function LatestEntry({ txn, accounts }: { txn: TransactionResponse; accounts: AccountResponse[] }) {
  const currency = accounts.find((a) => a.id === txn.accountId)?.currency ?? ''
  const signed =
    txn.type === 'INCOME' ? txn.amount : txn.type === 'EXPENSE' ? -txn.amount : 0
  const title =
    txn.description ||
    txn.categoryName ||
    (txn.type === 'TRANSFER' ? `${txn.accountName} → ${txn.targetAccountName}` : 'Untitled')
  const subtitle =
    txn.type === 'TRANSFER'
      ? 'Transfer'
      : [txn.categoryName, txn.accountName].filter(Boolean).join(' · ')

  return (
    <li className="grid grid-cols-[3.25rem_1fr_auto] items-baseline gap-x-3 border-b border-border/70 py-2.5 last:border-0">
      <span className="num text-[11px] text-muted-foreground">{formatDate(txn.date).slice(0, 5)}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span
        className={cn(
          'num text-sm whitespace-nowrap',
          signed > 0 && 'text-positive',
          signed < 0 && 'text-negative',
        )}
      >
        {signed === 0 ? formatCurrency(txn.amount, currency) : formatSigned(signed, currency)}
      </span>
    </li>
  )
}

// --- Filter field ---

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="eyebrow">{label}</div>
      {children}
    </div>
  )
}

function gridProps(theme: ChartTheme) {
  return { vertical: false, stroke: theme.grid, strokeDasharray: '2 4' }
}

export function DashboardPage() {
  const theme = useChartTheme()
  const { data, isLoading, error } = useDashboard()
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: tags = [] } = useTags()
  const { data: settings } = useSettings()
  const { data: debtSummary } = useDebtSummary()
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

  function handlePresetChange(value: string) {
    const p = value as DatePreset
    if (p !== 'custom') {
      const range = getPresetRange(p, initialDate)
      setDashboard({ preset: p, customFrom: range.from, customTo: range.to })
    } else {
      setDashboard({ preset: p })
    }
  }

  // One colour per group, shared by "Where it went" and the trend chart
  const groupColor = useMemo(() => {
    const map = new Map<string, string>()
    expenseData?.forEach((g, i) => {
      if (i < 8) map.set(g.id, theme.palette[i % theme.palette.length] ?? theme.ink)
    })
    return (id: string, fallbackIndex: number) =>
      id === 'other' ? theme.muted : (map.get(id) ?? theme.palette[fallbackIndex % theme.palette.length] ?? theme.ink)
  }, [expenseData, theme])

  // Ranked expenses: top 8 + Other
  const ranked = useMemo(() => {
    if (!expenseData || expenseData.length === 0) return []
    const top = expenseData.slice(0, 8).map((d) => ({ id: d.id, name: d.name, value: d.amount }))
    const rest = expenseData.slice(8)
    if (rest.length > 0) {
      top.push({ id: 'other', name: 'Other', value: rest.reduce((sum, d) => sum + d.amount, 0) })
    }
    return top
  }, [expenseData])
  const rankedTotal = useMemo(() => ranked.reduce((sum, d) => sum + d.value, 0), [ranked])
  const rankedMax = useMemo(() => Math.max(1, ...ranked.map((d) => d.value)), [ranked])

  const { totalIncome, totalExpense } = useMemo(() => {
    const months = incomeVsExpenseData?.months ?? []
    return {
      totalIncome: months.reduce((sum, d) => sum + d.income, 0),
      totalExpense: months.reduce((sum, d) => sum + d.expense, 0),
    }
  }, [incomeVsExpenseData])

  const barData = useMemo(() => {
    if (!incomeVsExpenseData) return []
    return incomeVsExpenseData.months.map((d) => ({
      period: shortPeriod(d.period),
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
        period: shortPeriod(d.period),
        net: cumulative,
        delta: cumulative - prev,
      }
    })
  }, [incomeVsExpenseData])

  // Expense trend: top 6 groups + Other, stacked per month
  const { trendChartData, trendGroupKeys } = useMemo(() => {
    if (!trendData || trendData.length === 0) return { trendChartData: [], trendGroupKeys: [] }

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

    const chartData = trendData.map((month) => {
      const row: Record<string, number | string> = {
        period: shortPeriod(month.period),
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
    const first = rateHistory?.[0]
    if (!rateHistory || !first) return { data: [], currencies: [] as string[], latest: {} as Record<string, number> }
    const currencies = Object.keys(first.rates)
    // Downsample to ~60 points max so tooltip markers align with visible ticks
    const maxPoints = 60
    const step = rateHistory.length > maxPoints ? Math.ceil(rateHistory.length / maxPoints) : 1
    const sampled = rateHistory.filter((_, i) => i % step === 0 || i === rateHistory.length - 1)
    const chartData = sampled.map((entry) => {
      const row: Record<string, number | string> = {
        date: formatDate(entry.date).slice(0, 5),
      }
      for (const [currency, subunits] of Object.entries(entry.rates)) {
        row[currency] = subunits / 100
      }
      return row
    })
    const last = rateHistory[rateHistory.length - 1]
    const latest = Object.fromEntries(
      Object.entries(last?.rates ?? {}).map(([c, v]) => [c, v / 100]),
    )
    return { data: chartData, currencies, latest }
  }, [rateHistory])

  if (isLoading) return <PanelEmpty>Opening the ledger…</PanelEmpty>
  if (error) return <div className="p-6 text-destructive">Failed to load dashboard: {error.message}</div>
  if (!data) return null

  const activeAccounts = accounts.filter((a) => a.active)
  const displayCurrency = data.displayCurrency
  const hasRates = data.totalNetWorth !== 0 || activeAccounts.length === 0
  const showRatesHint = !hasRates && activeAccounts.length > 0

  const debtEntries = Array.isArray(debtSummary?.entries) ? debtSummary.entries : []
  const debtNet = debtEntries.reduce((sum, e) => sum + e.net, 0)
  const saved = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? Math.round((saved / totalIncome) * 100) : null
  const periodLabel = preset === 'custom'
    ? `${formatDate(customFrom)} – ${formatDate(customTo)}`
    : PRESET_LABELS[preset] ?? ''

  const money = (v: number) => formatCurrency(Math.round(v * 100), displayCurrency)

  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* Hero: net worth and the statement beside it */}
      <section className="mb-10 grid gap-x-12 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="eyebrow">Net worth · all active accounts</div>
          <div className="mt-4">
            <HeroFigure amount={data.totalNetWorth} currency={displayCurrency} />
          </div>
          {showRatesHint && (
            <p className="mt-3 text-sm text-muted-foreground">
              Set exchange rates in Settings for multi-currency totals.
            </p>
          )}
          {netTrendData.length > 1 && (
            <div className="mt-6">
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={netTrendData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={theme.gold} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={theme.gold} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Area
                      type="monotone"
                      dataKey="net"
                      stroke={theme.gold}
                      strokeWidth={1.5}
                      fill="url(#spark)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="eyebrow mt-2 flex justify-between">
                <span>{netTrendData[0]?.period}</span>
                <span>Running net, {periodLabel.toLowerCase()}</span>
                <span>{netTrendData[netTrendData.length - 1]?.period}</span>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="border-t-2 border-foreground pt-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl">The statement</h2>
              <span className="eyebrow">{periodLabel}</span>
            </div>
            <div className="mt-2 divide-y divide-border/70">
              <StatementLine
                label="Net worth incl. debts & loans"
                value={formatCurrency(data.totalNetWorth + debtNet, displayCurrency)}
                strong
              />
              <StatementLine
                label="Open debts & loans"
                value={debtEntries.length > 0 ? formatSigned(debtNet, displayCurrency) : '—'}
                tone={debtNet > 0 ? 'positive' : debtNet < 0 ? 'negative' : undefined}
              />
              <StatementLine
                label="Income"
                value={formatCurrency(totalIncome, displayCurrency)}
                tone="positive"
              />
              <StatementLine
                label="Expenses"
                value={formatCurrency(totalExpense, displayCurrency)}
                tone="negative"
              />
              <StatementLine
                label={savingsRate !== null ? `Kept · ${savingsRate}% of income` : 'Kept'}
                value={formatSigned(saved, displayCurrency)}
                tone={saved > 0 ? 'positive' : saved < 0 ? 'negative' : undefined}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Parameters */}
      <section className="mb-8 border-y border-foreground/15 py-4">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
          <Field label="Period">
            <Select value={preset} onValueChange={(v) => v && handlePresetChange(v)}>
              <SelectTrigger className="w-40">
                <SelectValue>{(v: string) => PRESET_LABELS[v as DatePreset] ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRESET_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="From">
            <Input
              type="date"
              className="num w-40"
              value={customFrom}
              onChange={(e) => setDashboard({ customFrom: e.target.value, preset: 'custom' })}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              className="num w-40"
              value={customTo}
              onChange={(e) => setDashboard({ customTo: e.target.value, preset: 'custom' })}
            />
          </Field>
          <Field label="Accounts">
            <MultiSelectFilter
              options={activeAccounts}
              selected={selectedAccountIds}
              onChange={(ids) => setDashboard({ selectedAccountIds: ids })}
              allLabel="All accounts"
            />
          </Field>
          <Field label="Categories">
            <MultiSelectFilter
              options={categories}
              selected={selectedCategoryIds}
              onChange={(ids) => setDashboard({ selectedCategoryIds: ids })}
              allLabel="All categories"
            />
          </Field>
          <Field label="Tags">
            <MultiSelectFilter
              options={tags}
              selected={selectedTagIds}
              onChange={(ids) => setDashboard({ selectedTagIds: ids })}
              allLabel="All tags"
            />
          </Field>
          <Field label="Type">
            <MultiSelectFilter
              options={TYPE_OPTIONS}
              selected={selectedTypes}
              onChange={(ids) => setDashboard({ selectedTypes: ids })}
              allLabel="All types"
              searchable={false}
              keepOrder
              className="w-36"
            />
          </Field>
          <Field label="Group by">
            <div className="flex h-9 items-center rounded-md bg-muted/80 p-[3px] ring-1 ring-border">
              {(['category', 'tag'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setDashboard({ groupBy: g })}
                  className={cn(
                    'h-full rounded-[4px] px-3 text-sm capitalize transition-colors',
                    groupBy === g ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </Field>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetDashboard} className="mb-0.5">
              <RotateCcw className="size-3.5" /> Reset
            </Button>
          )}
        </div>
      </section>

      {/* Figures */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel
          figure="1"
          kicker="Monthly flow"
          title="Income against expenses"
          className="lg:col-span-8"
          bodyClassName="flex flex-col"
          meta={
            <>
              <PanelStat label="In" value={formatCurrency(totalIncome, displayCurrency)} tone="positive" />
              <PanelStat label="Out" value={formatCurrency(totalExpense, displayCurrency)} tone="negative" />
            </>
          }
        >
          {iveLoading ? (
            <PanelEmpty>Loading…</PanelEmpty>
          ) : barData.length === 0 ? (
            <PanelEmpty>No movement in this period</PanelEmpty>
          ) : (
            <div className="min-h-[300px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barGap={3} barCategoryGap="28%">
                <CartesianGrid {...gridProps(theme)} />
                <XAxis dataKey="period" tick={axisTick(theme)} tickLine={false} axisLine={{ stroke: theme.ink, strokeOpacity: 0.5 }} />
                <YAxis tick={axisTick(theme)} tickFormatter={compactNumber} width={48} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: theme.cursor }}
                  content={<ChartTooltip formatValue={money} formatName={(r) => (r.dataKey === 'income' ? 'Income' : 'Expenses')} />}
                />
                <Bar dataKey="income" fill={theme.positive} maxBarSize={28} />
                <Bar dataKey="expense" fill={theme.negative} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel
          figure="2"
          kicker={`By ${groupBy}`}
          title="Where it went"
          className="lg:col-span-4"
        >
          {expenseLoading ? (
            <PanelEmpty>Loading…</PanelEmpty>
          ) : ranked.length === 0 ? (
            <PanelEmpty>No expenses in this period</PanelEmpty>
          ) : (
            <ol className="space-y-3">
              {ranked.map((d, i) => (
                <li key={d.id}>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="num w-5 shrink-0 text-[10.5px] text-muted-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 truncate">{d.name}</span>
                    <span className="leader" />
                    <span className="num whitespace-nowrap">{formatCurrency(d.value, displayCurrency)}</span>
                  </div>
                  <div className="mt-1.5 ml-7 flex items-center gap-2">
                    <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(d.value / rankedMax) * 100}%`, backgroundColor: groupColor(d.id, i) }}
                      />
                    </div>
                    <span className="num w-9 text-right text-[10.5px] text-muted-foreground">
                      {((d.value / rankedTotal) * 100).toFixed(0)}%
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel
          figure="3"
          kicker="Cumulative"
          title="Net position"
          className="lg:col-span-7"
          meta={
            netTrendData.length > 0 && (
              <PanelStat
                label="Now"
                value={money(netTrendData[netTrendData.length - 1]?.net ?? 0)}
              />
            )
          }
        >
          {iveLoading ? (
            <PanelEmpty>Loading…</PanelEmpty>
          ) : netTrendData.length === 0 ? (
            <PanelEmpty>No movement in this period</PanelEmpty>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={netTrendData}>
                <CartesianGrid {...gridProps(theme)} />
                <XAxis dataKey="period" tick={axisTick(theme)} tickLine={false} axisLine={{ stroke: theme.ink, strokeOpacity: 0.5 }} />
                <YAxis tick={axisTick(theme)} tickFormatter={compactNumber} width={48} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: theme.cursor }}
                  content={<ChartTooltip formatValue={money} formatName={(r) => (r.dataKey === 'net' ? 'Net position' : 'Change')} />}
                />
                <ReferenceLine y={0} stroke={theme.ink} strokeOpacity={0.35} />
                <Bar dataKey="delta" maxBarSize={22}>
                  {netTrendData.map((d, i) => (
                    <Cell key={i} fill={d.delta >= 0 ? theme.positive : theme.negative} fillOpacity={0.35} />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke={theme.gold}
                  strokeWidth={2}
                  dot={{ r: 3, fill: theme.gold, strokeWidth: 0 }}
                  activeDot={{ r: 4.5, fill: theme.gold, stroke: theme.ink, strokeWidth: 1 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel
          figure="4"
          kicker={`1 unit in ${displayCurrency}`}
          title="Exchange rates"
          className="lg:col-span-5"
          meta={
            rateChartData.currencies.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {rateChartData.currencies.map((c, i) => (
                  <span key={c} className="num inline-flex items-center gap-1.5 text-xs">
                    <span className="size-2 rounded-[2px]" style={{ backgroundColor: theme.palette[i % theme.palette.length] }} />
                    {c}
                    <span className="text-muted-foreground">{rateChartData.latest[c]?.toFixed(2)}</span>
                  </span>
                ))}
              </div>
            )
          }
        >
          {rateHistoryLoading ? (
            <PanelEmpty>Loading…</PanelEmpty>
          ) : rateChartData.data.length === 0 ? (
            <PanelEmpty>No rate data</PanelEmpty>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={rateChartData.data} margin={{ top: 5, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps(theme)} />
                <XAxis dataKey="date" tick={axisTick(theme)} tickLine={false} axisLine={{ stroke: theme.ink, strokeOpacity: 0.5 }} minTickGap={24} />
                <YAxis tick={axisTick(theme)} width={40} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatValue={(v) => `${v.toFixed(2)} ${displayCurrency}`}
                      formatName={(r) => `1 ${String(r.name)}`}
                    />
                  }
                />
                {rateChartData.currencies.map((currency, i) => (
                  <Line
                    key={currency}
                    type="monotone"
                    dataKey={currency}
                    stroke={theme.palette[i % theme.palette.length]}
                    strokeWidth={1.75}
                    dot={false}
                    name={currency}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel
          figure="5"
          kicker={`Top ${groupBy === 'category' ? 'categories' : 'tags'} per month`}
          title="Expense trend"
          className="lg:col-span-8"
        >
          {trendLoading ? (
            <PanelEmpty>Loading…</PanelEmpty>
          ) : trendChartData.length === 0 ? (
            <PanelEmpty>No expenses in this period</PanelEmpty>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={trendChartData} barCategoryGap="30%">
                  <CartesianGrid {...gridProps(theme)} />
                  <XAxis dataKey="period" tick={axisTick(theme)} tickLine={false} axisLine={{ stroke: theme.ink, strokeOpacity: 0.5 }} />
                  <YAxis tick={axisTick(theme)} tickFormatter={compactNumber} width={48} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: theme.cursor }}
                    content={
                      <ChartTooltip
                        hideZero
                        formatValue={money}
                        formatName={(r) => trendGroupKeys.find((c) => c.id === r.dataKey)?.name ?? String(r.name)}
                      />
                    }
                  />
                  {trendGroupKeys.map((cat, i) => (
                    <Bar
                      key={cat.id}
                      dataKey={cat.id}
                      stackId="expenses"
                      fill={groupColor(cat.id, i)}
                      stroke={theme.isDark ? '#1a1a16' : '#faf7f1'}
                      strokeWidth={1}
                      maxBarSize={44}
                      name={cat.id}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3">
                {trendGroupKeys.map((cat, i) => (
                  <span key={cat.id} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-2 rounded-[2px]" style={{ backgroundColor: groupColor(cat.id, i) }} />
                    {cat.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel
          figure="6"
          kicker="Most recent"
          title="Latest entries"
          className="lg:col-span-4"
          meta={
            <Link
              to="/transactions"
              className="eyebrow inline-flex items-center gap-1 text-foreground hover:text-gold"
            >
              All <ArrowUpRight className="size-3" />
            </Link>
          }
          bodyClassName="pt-1"
        >
          {data.recentTransactions.length === 0 ? (
            <PanelEmpty>Nothing recorded yet</PanelEmpty>
          ) : (
            <ul>
              {data.recentTransactions.map((txn) => (
                <LatestEntry key={txn.id} txn={txn} accounts={accounts} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
