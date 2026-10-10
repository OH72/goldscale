import { useState } from 'react'
import { ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface CategorySelectProps {
  categories: { id: string; name: string }[] | undefined
  value: string
  onChange: (id: string) => void
}

export function CategorySelect({ categories, value, onChange }: CategorySelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = categories?.find((c) => c.id === value)
  const q = search.trim().toLowerCase()
  const filtered = (categories ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((c) => c.name.toLowerCase().includes(q))

  function pick(id: string) {
    onChange(id)
    setSearch('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
          variant="outline"
          type="button"
          className="w-full justify-between font-normal"
        />
        }
      >
          {selected ? (
            selected.name
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
          <span className="ml-2 flex items-center gap-1">
            {selected && (
              <span
                role="button"
                aria-label="Clear category"
                className="rounded p-0.5 hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange('')
                }}
              >
                <X className="h-3.5 w-3.5 opacity-60" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </span>
        </PopoverTrigger>
      <PopoverContent
        className="w-(--anchor-width) p-0"
        initialFocus={false}
      >
        <div className="border-b p-2">
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-48 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              No categories found
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  'flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent',
                  value === c.id && 'bg-accent',
                )}
                onClick={() => pick(c.id)}
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
