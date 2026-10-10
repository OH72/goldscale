import { useMemo, useState } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl, Dimensions } from 'react-native'
import { useFilterStore } from '@/stores/filter-store'
import { useDashboard, useExpensesByCategory, useIncomeVsExpenses, useExpenseTrend } from '@/api/use-dashboard'
import { useAccounts } from '@/api/use-accounts'
import { useCategories } from '@/api/use-categories'
import { useTags } from '@/api/use-tags'
import { useExchangeRateHistory } from '@/api/use-exchange-rates'
import { useDebtSummary } from '@/api/use-debt-records'
import { useSettings } from '@/api/use-settings'
import { formatCurrency, fromSubunits } from '@/lib/currency'
import { PickerModal, MultiPickerModal } from '@/components/picker-modal'
import { useQueryClient } from '@tanstack/react-query'
import Svg, { Circle, Rect, Line as SvgLine, Text as SvgText } from 'react-native-svg'

const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f97316', '#8b5cf6',
  '#06b6d4', '#ec4899', '#eab308', '#14b8a6', '#6366f1',
]

type DatePreset = 'this-month' | 'last-month' | 'last-3' | 'last-6' | 'this-year' | 'all-time'

const PRESET_LABELS: Record<DatePreset, string> = {
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'last-3': 'Last 3 Months',
  'last-6': 'Last 6 Months',
  'this-year': 'This Year',
  'all-time': 'All Time',
}

function getPresetRange(preset: DatePreset, initialDate = '2022-01-01') {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (preset) {
    case 'this-month':
      return { from: new Date(y, m, 1).toISOString().slice(0, 10), to: new Date(y, m + 1, 0).toISOString().slice(0, 10) }
    case 'last-month':
      return { from: new Date(y, m - 1, 1).toISOString().slice(0, 10), to: new Date(y, m, 0).toISOString().slice(0, 10) }
    case 'last-3':
      return { from: new Date(y, m - 2, 1).toISOString().slice(0, 10), to: new Date(y, m + 1, 0).toISOString().slice(0, 10) }
    case 'last-6':
      return { from: new Date(y, m - 5, 1).toISOString().slice(0, 10), to: new Date(y, m + 1, 0).toISOString().slice(0, 10) }
    case 'this-year':
      return { from: `${y}-01-01`, to: new Date(y, m + 1, 0).toISOString().slice(0, 10) }
    case 'all-time':
      return { from: initialDate, to: new Date(y, m + 1, 0).toISOString().slice(0, 10) }
    default:
      return { from: new Date(y, m, 1).toISOString().slice(0, 10), to: new Date(y, m + 1, 0).toISOString().slice(0, 10) }
  }
}

function DonutChart({ data, colors, size = 200 }: { data: { name: string; value: number }[]; colors: string[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return null

  const cx = size / 2
  const cy = size / 2
  const outerR = size / 2 - 10
  const innerR = outerR * 0.58

  let startAngle = -90
  const arcs = data.map((d, i) => {
    const angle = (d.value / total) * 360
    const endAngle = startAngle + angle
    const largeArc = angle > 180 ? 1 : 0
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = cx + outerR * Math.cos(startRad)
    const y1 = cy + outerR * Math.sin(startRad)
    const x2 = cx + outerR * Math.cos(endRad)
    const y2 = cy + outerR * Math.sin(endRad)
    const x3 = cx + innerR * Math.cos(endRad)
    const y3 = cy + innerR * Math.sin(endRad)
    const x4 = cx + innerR * Math.cos(startRad)
    const y4 = cy + innerR * Math.sin(startRad)

    const path = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`
    startAngle = endAngle

    return (
      <Circle key={i} r={0} fill="none">
        {/* We use a path element instead */}
      </Circle>
    )
  })

  // Actually render with paths
  startAngle = -90
  return (
    <Svg width={size} height={size}>
      {data.map((d, i) => {
        const angle = (d.value / total) * 360
        const gap = data.length > 1 ? 1 : 0
        const effectiveAngle = Math.max(angle - gap, 0.1)
        const endAngle = startAngle + effectiveAngle
        const largeArc = effectiveAngle > 180 ? 1 : 0
        const startRad = (startAngle * Math.PI) / 180
        const endRad = (endAngle * Math.PI) / 180

        const x1 = cx + outerR * Math.cos(startRad)
        const y1 = cy + outerR * Math.sin(startRad)
        const x2 = cx + outerR * Math.cos(endRad)
        const y2 = cy + outerR * Math.sin(endRad)
        const x3 = cx + innerR * Math.cos(endRad)
        const y3 = cy + innerR * Math.sin(endRad)
        const x4 = cx + innerR * Math.cos(startRad)
        const y4 = cy + innerR * Math.sin(startRad)

        const pathData = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`
        startAngle += angle

        return (
          <SvgLine
            key={`arc-${i}`}
            x1={0} y1={0} x2={0} y2={0}
            stroke="none"
          >
          </SvgLine>
        )
      })}
      {/* Simplified: draw colored circles as segments */}
      {(() => {
        let angle = -90
        return data.map((d, i) => {
          const sweep = (d.value / total) * 360
          const midRad = ((angle + sweep / 2) * Math.PI) / 180
          const r = (outerR + innerR) / 2
          const px = cx + r * Math.cos(midRad)
          const py = cy + r * Math.sin(midRad)
          const circumference = 2 * Math.PI * r
          const dashLength = (sweep / 360) * circumference
          const gapLength = circumference - dashLength
          const rotation = angle

          angle += sweep

          return (
            <Circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth={outerR - innerR}
              strokeDasharray={`${dashLength} ${gapLength}`}
              strokeDashoffset={0}
              transform={`rotate(${rotation} ${cx} ${cy})`}
            />
          )
        })
      })()}
    </Svg>
  )
}

function BarChartSimple({ data, keys, colors, width }: {
  data: { label: string; values: number[] }[]
  keys: string[]
  colors: string[]
  width: number
}) {
  if (data.length === 0) return null
  const maxValue = Math.max(...data.flatMap((d) => d.values), 1)
  const chartHeight = 200
  const barAreaWidth = width - 40
  const groupWidth = barAreaWidth / data.length
  const barWidth = Math.min(groupWidth / (keys.length + 1), 30)

  return (
    <Svg width={width} height={chartHeight + 30}>
      {data.map((d, di) => (
        d.values.map((v, vi) => {
          const barH = (v / maxValue) * chartHeight
          const x = 30 + di * groupWidth + vi * (barWidth + 2) + (groupWidth - keys.length * (barWidth + 2)) / 2
          return (
            <Rect
              key={`${di}-${vi}`}
              x={x}
              y={chartHeight - barH}
              width={barWidth}
              height={barH}
              fill={colors[vi % colors.length]}
              rx={2}
            />
          )
        })
      ))}
      {data.map((d, di) => (
        <SvgText
          key={`label-${di}`}
          x={30 + di * groupWidth + groupWidth / 2}
          y={chartHeight + 15}
          fontSize={9}
          fill="#94a3b8"
          textAnchor="middle"
        >
          {d.label}
        </SvgText>
      ))}
    </Svg>
  )
}

export default function DashboardScreen() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useDashboard()
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: tags = [] } = useTags()
  const { data: settings } = useSettings()
  const { data: debtSummary } = useDebtSummary()
  const initialDate = settings?.initialDate ?? '2022-01-01'

  const { preset: storePreset, selectedAccountIds, selectedCategoryIds, selectedTagIds, selectedTypes, groupBy } = useFilterStore((s) => s.dashboard)
  const setDashboard = useFilterStore((s) => s.setDashboard)
  const resetDashboard = useFilterStore((s) => s.resetDashboard)

  const [presetPickerOpen, setPresetPickerOpen] = useState(false)
  const [accountPickerOpen, setAccountPickerOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const preset = storePreset as DatePreset
  const defaultRange = useMemo(() => getPresetRange(preset, initialDate), [preset, initialDate])
  const chartFilters = useMemo(() => ({
    from: defaultRange.from,
    to: defaultRange.to,
    accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
    categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    types: selectedTypes.length > 0 ? selectedTypes : undefined,
    groupBy,
  }), [defaultRange, selectedAccountIds, selectedCategoryIds, selectedTagIds, selectedTypes, groupBy])

  const { data: expenseData } = useExpensesByCategory(chartFilters)
  const { data: incomeVsExpenseData } = useIncomeVsExpenses(chartFilters)

  const screenWidth = Dimensions.get('window').width - 32

  // Donut data
  const donutData = useMemo(() => {
    if (!expenseData || expenseData.length === 0) return []
    const top = expenseData.slice(0, 8)
    const rest = expenseData.slice(8)
    const result = top.map((d) => ({ name: d.name, value: d.amount }))
    if (rest.length > 0) {
      result.push({ name: 'Other', value: rest.reduce((sum, d) => sum + d.amount, 0) })
    }
    return result
  }, [expenseData])

  const donutTotal = useMemo(() => donutData.reduce((sum, d) => sum + d.value, 0), [donutData])
  const totalIncome = useMemo(() => incomeVsExpenseData?.months.reduce((sum, d) => sum + d.income, 0) ?? 0, [incomeVsExpenseData])

  // Bar data
  const barData = useMemo(() => {
    if (!incomeVsExpenseData) return []
    return incomeVsExpenseData.months.map((d) => ({
      label: d.period.slice(5),
      values: [fromSubunits(d.income), fromSubunits(d.expense)],
    }))
  }, [incomeVsExpenseData])

  const debtEntries = Array.isArray(debtSummary?.entries) ? debtSummary.entries : []
  const debtNet = debtEntries.reduce((sum, e) => sum + e.net, 0)

  async function handleRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  const hasActiveFilters = storePreset !== 'last-6' || selectedAccountIds.length > 0 ||
    selectedCategoryIds.length > 0 || selectedTagIds.length > 0 || selectedTypes.length > 0 || groupBy !== 'category'

  if (isLoading) {
    return <View className="flex-1 items-center justify-center bg-background"><Text className="text-muted-foreground">Loading...</Text></View>
  }

  if (error || !data) {
    return <View className="flex-1 items-center justify-center bg-background"><Text className="text-destructive">{error?.message ?? 'Failed to load'}</Text></View>
  }

  const displayCurrency = data.displayCurrency

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 pb-8"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {/* Net Worth Card */}
      <View className="bg-card rounded-xl p-4 mb-4 border border-border">
        <Text className="text-sm text-muted-foreground mb-1">Total Net Worth</Text>
        <Text className="text-2xl font-bold text-foreground">{formatCurrency(data.totalNetWorth, displayCurrency)}</Text>

        {debtEntries.length > 0 && (
          <View className="mt-3">
            <Text className="text-sm text-muted-foreground mb-1">Incl. Debts & Loans</Text>
            <Text className="text-xl font-bold text-foreground">{formatCurrency(data.totalNetWorth + debtNet, displayCurrency)}</Text>
            <Text className={`text-xs mt-0.5 ${debtNet > 0 ? 'text-green-600' : debtNet < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {debtNet > 0 ? '+' : ''}{formatCurrency(debtNet, displayCurrency)} from debts & loans
            </Text>
          </View>
        )}
      </View>

      {/* Filter Row */}
      <View className="flex-row flex-wrap gap-2 mb-4">
        <Pressable onPress={() => setPresetPickerOpen(true)} className="bg-card border border-border rounded-lg px-3 py-2">
          <Text className="text-sm text-foreground">{PRESET_LABELS[preset] ?? preset}</Text>
        </Pressable>
        <Pressable onPress={() => setAccountPickerOpen(true)} className="bg-card border border-border rounded-lg px-3 py-2">
          <Text className="text-sm text-foreground">
            {selectedAccountIds.length === 0 ? 'Accounts' : `${selectedAccountIds.length} acct`}
          </Text>
        </Pressable>
        <Pressable onPress={() => setCategoryPickerOpen(true)} className="bg-card border border-border rounded-lg px-3 py-2">
          <Text className="text-sm text-foreground">
            {selectedCategoryIds.length === 0 ? 'Categories' : `${selectedCategoryIds.length} cat`}
          </Text>
        </Pressable>
        <Pressable onPress={() => setTagPickerOpen(true)} className="bg-card border border-border rounded-lg px-3 py-2">
          <Text className="text-sm text-foreground">
            {selectedTagIds.length === 0 ? 'Tags' : `${selectedTagIds.length} tags`}
          </Text>
        </Pressable>
        <View className="flex-row bg-card border border-border rounded-lg overflow-hidden">
          <Pressable
            onPress={() => setDashboard({ groupBy: 'category' })}
            className={`px-3 py-2 ${groupBy === 'category' ? 'bg-primary' : ''}`}
          >
            <Text className={`text-xs ${groupBy === 'category' ? 'text-white' : 'text-foreground'}`}>Cat</Text>
          </Pressable>
          <Pressable
            onPress={() => setDashboard({ groupBy: 'tag' })}
            className={`px-3 py-2 ${groupBy === 'tag' ? 'bg-primary' : ''}`}
          >
            <Text className={`text-xs ${groupBy === 'tag' ? 'text-white' : 'text-foreground'}`}>Tag</Text>
          </Pressable>
        </View>
        {hasActiveFilters && (
          <Pressable onPress={resetDashboard} className="bg-muted rounded-lg px-3 py-2">
            <Text className="text-sm text-muted-foreground">Reset</Text>
          </Pressable>
        )}
      </View>

      {/* Expenses Donut */}
      <View className="bg-card rounded-xl p-4 mb-4 border border-border">
        <Text className="text-base font-semibold text-foreground mb-3">
          Expenses by {groupBy === 'category' ? 'Category' : 'Tag'}
        </Text>
        {donutData.length === 0 ? (
          <Text className="text-center text-muted-foreground py-8">No expenses in this period</Text>
        ) : (
          <View className="items-center">
            <DonutChart data={donutData} colors={CHART_COLORS} />
            <View className="flex-row gap-4 mt-3">
              <Text className="text-sm">
                <Text className="text-muted-foreground">Expense: </Text>
                <Text className="font-semibold" style={{ color: '#ef4444' }}>{formatCurrency(donutTotal, displayCurrency)}</Text>
              </Text>
              <Text className="text-sm">
                <Text className="text-muted-foreground">Income: </Text>
                <Text className="font-semibold" style={{ color: '#22c55e' }}>{formatCurrency(totalIncome, displayCurrency)}</Text>
              </Text>
            </View>
            <View className="flex-row flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {donutData.map((d, i) => (
                <View key={d.name} className="flex-row items-center gap-1">
                  <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <Text className="text-xs text-foreground">{d.name} ({donutTotal > 0 ? Math.round((d.value / donutTotal) * 100) : 0}%)</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Income vs Expenses Bar */}
      <View className="bg-card rounded-xl p-4 mb-4 border border-border">
        <Text className="text-base font-semibold text-foreground mb-3">Income vs Expenses</Text>
        {barData.length === 0 ? (
          <Text className="text-center text-muted-foreground py-8">No data in this period</Text>
        ) : (
          <View className="items-center">
            <BarChartSimple
              data={barData}
              keys={['income', 'expense']}
              colors={['#22c55e', '#ef4444']}
              width={screenWidth}
            />
            <View className="flex-row gap-4 mt-2">
              <View className="flex-row items-center gap-1">
                <View className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }} />
                <Text className="text-xs text-foreground">Income</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <View className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
                <Text className="text-xs text-foreground">Expense</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Picker Modals */}
      <PickerModal
        visible={presetPickerOpen}
        onClose={() => setPresetPickerOpen(false)}
        title="Period"
        items={Object.entries(PRESET_LABELS).map(([k, v]) => ({ id: k, label: v }))}
        selectedId={preset}
        onSelect={(id) => {
          const range = getPresetRange(id as DatePreset, initialDate)
          setDashboard({ preset: id, customFrom: range.from, customTo: range.to })
        }}
        searchable={false}
      />

      <MultiPickerModal
        visible={accountPickerOpen}
        onClose={() => setAccountPickerOpen(false)}
        title="Accounts"
        items={accounts.filter((a) => a.active).sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ id: a.id, label: a.name }))}
        selectedIds={selectedAccountIds}
        onToggle={(id) => setDashboard({
          selectedAccountIds: selectedAccountIds.includes(id)
            ? selectedAccountIds.filter((i) => i !== id)
            : [...selectedAccountIds, id],
        })}
      />

      <MultiPickerModal
        visible={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        title="Categories"
        items={categories.sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, label: c.name }))}
        selectedIds={selectedCategoryIds}
        onToggle={(id) => setDashboard({
          selectedCategoryIds: selectedCategoryIds.includes(id)
            ? selectedCategoryIds.filter((i) => i !== id)
            : [...selectedCategoryIds, id],
        })}
      />

      <MultiPickerModal
        visible={tagPickerOpen}
        onClose={() => setTagPickerOpen(false)}
        title="Tags"
        items={tags.sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ id: t.id, label: t.name }))}
        selectedIds={selectedTagIds}
        onToggle={(id) => setDashboard({
          selectedTagIds: selectedTagIds.includes(id)
            ? selectedTagIds.filter((i) => i !== id)
            : [...selectedTagIds, id],
        })}
      />
    </ScrollView>
  )
}
