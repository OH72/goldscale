import { useMemo } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MultiSelectFilter } from '@/components/multi-select-filter'
import { ChartTooltip } from '@/components/charts/chart-tooltip'
import { RotateCcw } from 'lucide-react'
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
import { formatCurrency, fromSubunits } from '@/lib/currency'
import { axisTick, compactNumber, useChartTheme, type ChartTheme } from '@/lib/chart-theme'

const TYPE_OPTIONS = [
  { id: 'INCOME', name: 'Income' },
  { id: 'EXPENSE', name: 'Expense' },
  { id: 'TRANSFER', name: 'Transfer' },
]

/** Shared Recharts styling: hairline horizontal grid, mono ticks, quiet legend */
function chartStyle(theme: ChartTheme) {
  return {
    grid: { vertical: false, stroke: theme.grid, strokeDasharray: '2 4' },
    xAxis: { tick: axisTick(theme), tickLine: false, axisLine: { stroke: theme.ink, strokeOpacity: 0.45 } },
    yAxis: { tick: axisTick(theme), tickLine: false, axisLine: false },
    legend: {
      iconType: 'square' as const,
      iconSize: 9,
      wrapperStyle: { fontSize: 12, paddingTop: 8 },
    },
    legendText: (label: string) => <span style={{ color: theme.muted }}>{label}</span>,
  }
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
      <CardContent className="grid gap-6 sm:grid-cols-2 sm:divide-x sm:divide-border">
        <div>
          <p className="eyebrow">
            Total Net Worth
          </p>
          <p className="mt-2 font-display text-5xl leading-none tracking-[-0.02em] sm:text-6xl">
            {formatCurrency(totalNetWorth, displayCurrency)}
          </p>
          {showRatesHint && (
            <p className="mt-1 text-xs text-muted-foreground">
              Set exchange rates in Settings for multi-currency totals
            </p>
          )}
        </div>
        <div className="sm:pl-6">
          <p className="eyebrow">
            Net Worth incl. Debts &amp; Loans
          </p>
          <p className="mt-2 font-display text-5xl leading-none tracking-[-0.02em] text-gold sm:text-6xl">
            {formatCurrency(totalNetWorth + debtNet, displayCurrency)}
          </p>
          {hasDebts && (
            <p
              className={cn(
                'num mt-1 text-xs',
                debtNet > 0
                  ? 'text-positive'
                  : debtNet < 0
                    ? 'text-negative'
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
  const theme = useChartTheme()
  const chartColors = theme.palette
  const cursorFill = theme.cursor
  const cs = chartStyle(theme)
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
    const currencies = Object.keys(rateHistory[0]?.rates ?? {})
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

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading...</div>
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
            <Label>Period</Label>
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
          </div>
          <div className="space-y-1">
            <Label>From</Label>
            <Input
              type="date"
              className="num w-38"
              value={customFrom}
              onChange={(e) => {
                setDashboard({ customFrom: e.target.value, preset: 'custom' })
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input
              type="date"
              className="num w-38"
              value={customTo}
              onChange={(e) => {
                setDashboard({ customTo: e.target.value, preset: 'custom' })
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>Accounts</Label>
            <MultiSelectFilter
              options={activeAccounts}
              selected={selectedAccountIds}
              onChange={(ids) => setDashboard({ selectedAccountIds: ids })}
              allLabel="All accounts"
            />
          </div>
          <div className="space-y-1">
            <Label>Categories</Label>
            <MultiSelectFilter
              options={categories}
              selected={selectedCategoryIds}
              onChange={(ids) => setDashboard({ selectedCategoryIds: ids })}
              allLabel="All categories"
            />
          </div>
          <div className="space-y-1">
            <Label>Tags</Label>
            <MultiSelectFilter
              options={tags}
              selected={selectedTagIds}
              onChange={(ids) => setDashboard({ selectedTagIds: ids })}
              allLabel="All tags"
            />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <MultiSelectFilter
              options={TYPE_OPTIONS}
              selected={selectedTypes}
              onChange={(ids) => setDashboard({ selectedTypes: ids })}
              allLabel="All types"
              searchable={false}
              keepOrder
            />
          </div>
          <div className="space-y-1">
            <Label>Group by</Label>
            <div className="flex h-9 items-center gap-1 rounded-md bg-muted/80 p-0.5 ring-1 ring-border">
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
            <CardTitle>
              Expenses by {groupBy === 'category' ? 'Category' : 'Tag'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseLoading ? (
              <p className="py-12 text-center font-display text-lg text-muted-foreground italic">Loading...</p>
            ) : donutData.length === 0 ? (
              <p className="py-12 text-center font-display text-lg text-muted-foreground italic">No expenses in this period</p>
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
                        <Cell key={i} fill={chartColors[i % chartColors.length]} stroke={theme.isDark ? '#1a1a16' : '#faf7f1'} strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<ChartTooltip formatValue={(v) => formatCurrency(v, displayCurrency)} />}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-6 text-sm">
                  <p>
                    <span className="text-muted-foreground">Expense: </span>
                    <span className="num text-negative">{formatCurrency(donutTotal, displayCurrency)}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Income: </span>
                    <span className="num text-positive">{formatCurrency(totalIncome, displayCurrency)}</span>
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                  {donutData.map((d, i) => (
                    <span key={d.name} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-[2px]"
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
            <CardTitle>Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {iveLoading ? (
              <p className="py-12 text-center font-display text-lg text-muted-foreground italic">Loading...</p>
            ) : barData.length === 0 ? (
              <p className="py-12 text-center font-display text-lg text-muted-foreground italic">No data in this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid {...cs.grid} />
                  <XAxis dataKey="period" {...cs.xAxis} />
                  <YAxis {...cs.yAxis} tickFormatter={compactNumber} width={55} />
                  <Tooltip
                    cursor={{ fill: cursorFill }}
                    content={<ChartTooltip formatValue={(v) => formatCurrency(Math.round(v * 100), displayCurrency)} />}
                  />
                  <Legend {...cs.legend} formatter={cs.legendText} />
                  <Bar dataKey="income" fill={theme.positive} name="Income" />
                  <Bar dataKey="expense" fill={theme.negative} name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Net Trend */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Net Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {iveLoading ? (
            <p className="py-12 text-center font-display text-lg text-muted-foreground italic">Loading...</p>
          ) : netTrendData.length === 0 ? (
            <p className="py-12 text-center font-display text-lg text-muted-foreground italic">No data in this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={netTrendData}>
                <CartesianGrid {...cs.grid} />
                <XAxis dataKey="period" {...cs.xAxis} />
                <YAxis {...cs.yAxis} tickFormatter={compactNumber} width={55} />
                <Tooltip
                  cursor={{ fill: cursorFill }}
                  content={
                    <ChartTooltip
                      formatValue={(v) => formatCurrency(Math.round(v * 100), displayCurrency)}
                      formatName={(r) => (r.dataKey === 'net' ? 'Net' : 'Change')}
                    />
                  }
                />
                <Legend {...cs.legend} formatter={(v: string) => cs.legendText(v === 'net' ? 'Net' : 'Change')} />
                <ReferenceLine y={0} stroke={theme.muted} strokeDasharray="3 3" />
                <Bar
                  dataKey="delta"
                  name="delta"
                  fill={theme.gold}
                  opacity={0.45}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="net"
                  stroke={chartColors[0]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: chartColors[0], strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Exchange Rates */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            Exchange Rates (1 unit → {displayCurrency})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rateHistoryLoading ? (
            <p className="py-12 text-center font-display text-lg text-muted-foreground italic">Loading...</p>
          ) : rateChartData.data.length === 0 ? (
            <p className="py-12 text-center font-display text-lg text-muted-foreground italic">No rate data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={rateChartData.data}>
                <CartesianGrid {...cs.grid} />
                <XAxis dataKey="date" {...cs.xAxis} minTickGap={24} />
                <YAxis {...cs.yAxis} />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatValue={(v) => `${v.toFixed(2)} ${displayCurrency}`}
                      formatName={(r) => `1 ${String(r.name)}`}
                    />
                  }
                />
                <Legend {...cs.legend} formatter={(value: string) => cs.legendText(`1 ${value}`)} />
                <ReferenceLine y={1} stroke={theme.muted} strokeDasharray="3 3" label={{ value: `1 ${displayCurrency}`, position: 'right', ...axisTick(theme) }} />
                {rateChartData.currencies.map((currency, i) => (
                  <Line
                    key={currency}
                    type="monotone"
                    dataKey={currency}
                    stroke={chartColors[i % chartColors.length]}
                    strokeWidth={1.75}
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
          <CardTitle>
            Expense Trend by {groupBy === 'category' ? 'Category' : 'Tag'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <p className="py-12 text-center font-display text-lg text-muted-foreground italic">Loading...</p>
          ) : trendChartData.length === 0 ? (
            <p className="py-12 text-center font-display text-lg text-muted-foreground italic">No expenses in this period</p>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={trendChartData}>
                  <CartesianGrid {...cs.grid} />
                  <XAxis dataKey="period" {...cs.xAxis} />
                  <YAxis {...cs.yAxis} tickFormatter={compactNumber} width={55} />
                  <Tooltip
                    cursor={{ fill: cursorFill }}
                    content={
                      <ChartTooltip
                        hideZero
                        formatValue={(v) => formatCurrency(Math.round(v * 100), displayCurrency)}
                        formatName={(r) => trendGroupKeys.find((c) => c.id === r.dataKey)?.name ?? String(r.name)}
                      />
                    }
                  />
                  <Legend
                    {...cs.legend}
                    formatter={(value: string) => {
                      const cat = trendGroupKeys.find((c) => c.id === value)
                      return cs.legendText(cat?.name ?? value)
                    }}
                  />
                  {trendGroupKeys.map((cat, i) => (
                    <Bar
                      key={cat.id}
                      dataKey={cat.id}
                      stackId="expenses"
                      fill={chartColors[i % chartColors.length]}
                      stroke={theme.isDark ? '#1a1a16' : '#faf7f1'}
                      strokeWidth={1}
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
