import { useState } from 'react'
import { ChevronsUpDown, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface TagMultiSelectProps {
  tags: { id: string; name: string }[] | undefined
  value: string[]
  onChange: (ids: string[]) => void
}

export function TagMultiSelect({ tags, value, onChange }: TagMultiSelectProps) {
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()
  const filtered = (tags ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((t) => t.name.toLowerCase().includes(q))

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
          variant="outline"
          type="button"
          className="h-auto min-h-9 w-full justify-between font-normal"
        />
        }
      >
          {value.length === 0 ? (
            <span className="text-muted-foreground">None</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {value.map((id) => {
                const tag = tags?.find((t) => t.id === id)
                return tag ? (
                  <Badge key={id} variant="secondary" className="text-xs">
                    {tag.name}
                    <span
                      role="button"
                      aria-label={`Remove ${tag.name}`}
                      className="ml-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        onChange(value.filter((t) => t !== id))
                      }}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                ) : null
              })}
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
      <PopoverContent
        className="w-(--anchor-width) p-0"
        initialFocus={false}
      >
        <div className="border-b p-2">
          <Input
            placeholder="Search tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              No tags found
            </p>
          ) : (
            filtered.map((tag) => (
              <label
                key={tag.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={value.includes(tag.id)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...value, tag.id]
                        : value.filter((t) => t !== tag.id),
                    )
                  }
                />
                {tag.name}
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
