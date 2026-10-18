import { useState } from 'react'
import { useEventLog } from '@/api/use-event-log'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'

const ALL_VALUE = '__all__'

const ENTITY_TYPES = [
  'ACCOUNT',
  'TRANSACTION',
  'CATEGORY',
  'TAG',
  'PERSON',
  'DEBT_RECORD',
  'PAYMENT',
  'SETTINGS',
]

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  OFFSET: 'bg-amber-100 text-amber-800',
  IMPORT: 'bg-purple-100 text-purple-800',
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function EventLogPage() {
  const [entityType, setEntityType] = useState<string>('')
  const [page, setPage] = useState(0)

  const { data, isLoading, error } = useEventLog({
    entityType: entityType || undefined,
    page,
    size: 50,
  })

  return (
    <div>
      <PageHeader title="Event Log" />

      <div className="mb-4 flex items-center gap-2">
        <Select
          value={entityType || ALL_VALUE}
          onValueChange={(v) => {
            setEntityType(v === ALL_VALUE ? '' : v)
            setPage(0)
          }}
        >
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue>
              {(v: string) => (v === ALL_VALUE ? 'All types' : v.replaceAll('_', ' '))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All types</SelectItem>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="py-8 text-center text-destructive">Failed to load event log</div>
      ) : isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Time</TableHead>
                <TableHead className="w-[80px]">Action</TableHead>
                <TableHead className="w-[120px]">Entity</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.content.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(entry.timestamp)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${ACTION_COLORS[entry.action] ?? ''}`}
                    >
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {entry.entityType.replace('_', ' ')}
                  </TableCell>
                  <TableCell className="text-sm">{entry.description}</TableCell>
                </TableRow>
              ))}
              {data?.content.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No events recorded
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {data && data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {data.number + 1} of {data.totalPages} ({data.totalElements} total)
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={data.number === 0} onClick={() => setPage(0)}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={data.number === 0} onClick={() => setPage(data.number - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={data.number >= data.totalPages - 1} onClick={() => setPage(data.number + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={data.number >= data.totalPages - 1} onClick={() => setPage(data.totalPages - 1)}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
