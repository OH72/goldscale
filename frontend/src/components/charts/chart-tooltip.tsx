interface TooltipRow {
  name?: string | number
  value?: number | string | (number | string)[]
  color?: string
  dataKey?: string | number
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipRow[]
  label?: string | number
  /** Format one row's value for display */
  formatValue: (value: number, row: TooltipRow) => string
  /** Optional display name per row (e.g. resolve an id to a category name) */
  formatName?: (row: TooltipRow) => string
  /** Hide rows whose value is zero */
  hideZero?: boolean
}

/** Editorial tooltip: mono label, swatch, name and a right-aligned figure. */
export function ChartTooltip({ active, payload, label, formatValue, formatName, hideZero }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((r) => !(hideZero && Number(r.value) === 0))
  if (rows.length === 0) return null

  return (
    <div className="min-w-44 rounded-md bg-popover px-3 py-2.5 text-popover-foreground shadow-paper ring-1 ring-foreground/15">
      {label !== undefined && label !== '' && (
        <div className="eyebrow mb-1.5 border-b border-border pb-1.5">{label}</div>
      )}
      <div className="space-y-1">
        {rows.map((row, i) => (
          <div key={`${row.dataKey ?? i}`} className="flex items-center gap-2 text-xs">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: row.color }} />
            <span className="truncate text-muted-foreground">
              {formatName ? formatName(row) : row.name}
            </span>
            <span className="num ml-auto pl-4 text-foreground">
              {formatValue(Number(row.value), row)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
