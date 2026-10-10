import { useState } from 'react'
import { ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface FilterOption {
  id: string
  name: string
  color?: string | null
}

interface MultiSelectFilterProps {
  options: FilterOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  /** Shown when nothing is selected, e.g. "All accounts" */
  allLabel: string
  searchable?: boolean
  /** Keep the options in the given order instead of sorting by name */
  keepOrder?: boolean
  className?: string
}

/** Popover with search and checkboxes, used by the dashboard filters. */
export function MultiSelectFilter({
  options,
  selected,
  onChange,
  allLabel,
  searchable = true,
  keepOrder,
  className,
}: MultiSelectFilterProps) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const visible = (keepOrder ? options : options.slice().sort((a, b) => a.name.localeCompare(b.name)))
    .filter((o) => o.name.toLowerCase().includes(q))

  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.name ?? '1 selected')
        : `${selected.length} selected`

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn('w-44 justify-between font-normal', selected.length > 0 && 'border-gold/60', className)}
          />
        }
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-60 gap-0 p-2" initialFocus={false}>
        {searchable && (
          <div className="relative mb-2">
            <Search className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              className="h-8 pl-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {visible.length === 0 && (
            <p className="py-3 text-center text-sm text-muted-foreground">Nothing found</p>
          )}
          {visible.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={selected.includes(o.id)}
                onCheckedChange={(checked) =>
                  onChange(checked ? [...selected, o.id] : selected.filter((id) => id !== o.id))
                }
              />
              {o.color && (
                <span className="size-2.5 shrink-0 rounded-full ring-1 ring-foreground/25" style={{ backgroundColor: o.color }} />
              )}
              <span className="truncate">{o.name}</span>
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onChange([])}>
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
