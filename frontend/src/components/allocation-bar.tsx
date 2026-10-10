import { formatCurrency } from '@/lib/currency'

export interface AllocationItem {
  id: string
  name: string
  value: number
  color: string
}

/** One stacked bar showing how a total splits between items, with a legend beneath. */
export function AllocationBar({ items, currency }: { items: AllocationItem[]; currency: string }) {
  const total = items.reduce((sum, i) => sum + i.value, 0)
  if (total <= 0) return null

  return (
    <div>
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-[2px]">
        {items.map((item) => (
          <div
            key={item.id}
            className="h-full first:rounded-l-[2px] last:rounded-r-[2px]"
            style={{ width: `${(item.value / total) * 100}%`, backgroundColor: item.color }}
            title={`${item.name}: ${formatCurrency(item.value, currency)}`}
          />
        ))}
      </div>
      <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-baseline gap-2 text-sm">
            <span className="size-2 shrink-0 translate-y-[-1px] rounded-[2px]" style={{ backgroundColor: item.color }} />
            <span className="min-w-0 truncate">{item.name}</span>
            <span className="leader" />
            <span className="num text-xs text-muted-foreground">{((item.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
