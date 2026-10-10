import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTransactions, useDeleteTransaction } from '@/api/use-transactions'
import { useAccounts } from '@/api/use-accounts'
import { useCategories } from '@/api/use-categories'
import { useTags } from '@/api/use-tags'
import { PageHeader } from '@/components/layout/page-header'
import { TransactionBadge } from '@/components/transaction-badge'
import { TagChip } from '@/components/tag-chip'
import { DateDisplay } from '@/components/date-display'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { TransactionFormDialog } from './transaction-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Plus, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, ArrowUp, ArrowDown, ArrowUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import type { TransactionResponse, TransactionFilters } from '@/types/transaction'
import type { TransactionType } from '@/types/common'

const ALL_VALUE = '__all__'

const TYPE_LABELS: Record<string, string> = {
  [ALL_VALUE]: 'All types',
  INCOME: 'Income',
  EXPENSE: 'Expense',
  TRANSFER: 'Transfer',
}

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const { data: tags } = useTags()
  const deleteMutation = useDeleteTransaction()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTxn, setEditTxn] = useState<TransactionResponse | null>(null)
  const [deleteTxn, setDeleteTxn] = useState<TransactionResponse | null>(null)

  const filters: TransactionFilters = {
    accountId: searchParams.get('accountId') ?? undefined,
    type: (searchParams.get('type') as TransactionType) ?? undefined,
    categoryId: searchParams.get('categoryId') ?? undefined,
    tagId: searchParams.get('tagId') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    page: Number(searchParams.get('page') ?? 0),
    size: 20,
  }

  const { data, isLoading, error } = useTransactions(filters)

  function setFilter(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    next.delete('page')
    setSearchParams(next)
  }

  function setPage(page: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next, { preventScrollReset: true })
  }

  function getSortState(field: string): 'asc' | 'desc' | null {
    if (!filters.sort) return null
    const [f, dir] = filters.sort.split(',')
    if (f === field) return (dir as 'asc' | 'desc') ?? 'asc'
    return null
  }

  function cycleSort(field: string) {
    const current = getSortState(field)
    if (current === null) {
      setFilter('sort', `${field},desc`)
    } else if (current === 'desc') {
      setFilter('sort', `${field},asc`)
    } else {
      setFilter('sort', undefined)
    }
  }

  function renderAmount(txn: TransactionResponse) {
    const account = accounts?.find((a) => a.id === txn.accountId)
    const currency = account?.currency ?? 'UAH'

    if (txn.type === 'TRANSFER' && txn.targetAmount) {
      const targetAccount = accounts?.find((a) => a.id === txn.targetAccountId)
      const targetCurrency = targetAccount?.currency ?? currency
      return (
        <div>
          <div className="whitespace-nowrap">{formatCurrency(txn.amount, currency)}</div>
          <div className="whitespace-nowrap text-xs text-muted-foreground">
            → {formatCurrency(txn.targetAmount, targetCurrency)}
            {txn.exchangeRate && txn.exchangeRate !== 1 && (
              <span className="ml-1">({txn.exchangeRate.toFixed(4)})</span>
            )}
          </div>
        </div>
      )
    }

    const prefix = txn.type === 'INCOME' ? '+' : txn.type === 'EXPENSE' ? '−' : ''
    return `${prefix}${formatCurrency(txn.amount, currency)}`
  }

  function renderPagination() {
    if (!data || data.totalPages <= 1) return null
    const current = data.number
    const total = data.totalPages

    // Build page numbers: first, last, and a window around current
    const pages: (number | 'ellipsis')[] = []
    const windowSize = 1
    const start = Math.max(1, current - windowSize)
    const end = Math.min(total - 2, current + windowSize)

    pages.push(0)
    if (start > 1) pages.push('ellipsis')
    for (let i = start; i <= end; i++) pages.push(i)
    if (end < total - 2) pages.push('ellipsis')
    if (total > 1) pages.push(total - 1)

    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {current + 1} of {total} ({data.totalElements} total)
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={current === 0} onClick={() => setPage(0)}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={current === 0} onClick={() => setPage(current - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pages.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e${i}`} className="px-1 text-sm text-muted-foreground">…</span>
            ) : (
              <Button
                key={p}
                variant={p === current ? 'default' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(p)}
              >
                {p + 1}
              </Button>
            ),
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={current >= total - 1} onClick={() => setPage(current + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={current >= total - 1} onClick={() => setPage(total - 1)}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Transactions">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Transaction
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={filters.accountId ?? ALL_VALUE}
          onValueChange={(v) =>
            setFilter('accountId', !v || v === ALL_VALUE ? undefined : v)
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue>
              {(v: string) =>
                v === ALL_VALUE
                  ? 'All accounts'
                  : (accounts?.find((a) => a.id === v)?.name ?? v)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All accounts</SelectItem>
            {accounts
              ?.slice()
              .sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1))
              .map((a) => (
              <SelectItem key={a.id} value={a.id} className={!a.active ? 'text-muted-foreground' : ''}>
                <span className="inline-flex items-center gap-2">
                  {a.color && <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />}
                  {a.name}{!a.active ? ' (inactive)' : ''}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.type ?? ALL_VALUE}
          onValueChange={(v) =>
            setFilter('type', !v || v === ALL_VALUE ? undefined : v)
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue>
              {(v: string) => TYPE_LABELS[v] ?? v}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All types</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="TRANSFER">Transfer</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.categoryId ?? ALL_VALUE}
          onValueChange={(v) =>
            setFilter('categoryId', !v || v === ALL_VALUE ? undefined : v)
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue>
              {(v: string) =>
                v === ALL_VALUE
                  ? 'All categories'
                  : (categories?.find((c) => c.id === v)?.name ?? v)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.tagId ?? ALL_VALUE}
          onValueChange={(v) =>
            setFilter('tagId', !v || v === ALL_VALUE ? undefined : v)
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue>
              {(v: string) =>
                v === ALL_VALUE
                  ? 'All tags'
                  : (tags?.find((t) => t.id === v)?.name ?? v)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All tags</SelectItem>
            {tags
              ?.slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-38"
          placeholder="From"
          value={filters.startDate ?? ''}
          onChange={(e) => setFilter('startDate', e.target.value || undefined)}
        />
        <Input
          type="date"
          className="w-38"
          placeholder="To"
          value={filters.endDate ?? ''}
          onChange={(e) => setFilter('endDate', e.target.value || undefined)}
        />
        {(filters.startDate || filters.endDate) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.delete('startDate')
              next.delete('endDate')
              next.delete('page')
              setSearchParams(next)
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {error ? (
        <div className="py-8 text-center text-destructive">Failed to load transactions: {error.message}</div>
      ) : isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : (
        <>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[10%]">
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => cycleSort('date')}
                  >
                    Date
                    {getSortState('date') === 'asc' ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : getSortState('date') === 'desc' ? (
                      <ArrowDown className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-[10%]">Type</TableHead>
                <TableHead className="w-[15%]">Account</TableHead>
                <TableHead className="w-[15%]">Category</TableHead>
                <TableHead className="w-[20%] text-right">
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground ml-auto"
                    onClick={() => cycleSort('amount')}
                  >
                    Amount
                    {getSortState('amount') === 'asc' ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : getSortState('amount') === 'desc' ? (
                      <ArrowDown className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-[10%]">Tags</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.content.map((txn) => (
                <TableRow key={txn.id} className="h-14">
                  <TableCell className="overflow-hidden align-top">
                    <DateDisplay date={txn.date} />
                  </TableCell>
                  <TableCell className="overflow-hidden align-top">
                    <TransactionBadge type={txn.type} />
                  </TableCell>
                  <TableCell className="overflow-hidden align-top">
                    <span className="inline-flex items-center gap-1.5">
                      {(() => { const a = accounts?.find((acc) => acc.id === txn.accountId); return a?.color ? <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} /> : null })()}
                      {txn.accountName}
                    </span>
                    {txn.type === 'TRANSFER' && txn.targetAccountName && (
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5 ml-0">
                        <span className="inline-flex items-center gap-1.5">
                          → {(() => { const a = accounts?.find((acc) => acc.id === txn.targetAccountId); return a?.color ? <><span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} /></> : null })()}
                          {txn.targetAccountName}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="overflow-hidden align-top text-muted-foreground">
                    {txn.categoryName ?? '—'}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'num overflow-hidden align-top text-right',
                      txn.type === 'INCOME' && 'text-positive',
                      txn.type === 'EXPENSE' && 'text-negative',
                    )}
                  >
                    {renderAmount(txn)}
                  </TableCell>
                  <TableCell className="overflow-hidden align-top">
                    <div className="flex flex-wrap gap-1">
                      {txn.tagNames?.map((name) => (
                        <TagChip key={name} name={name} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal text-muted-foreground" title={txn.description ?? ''}>
                    <p className="line-clamp-2 break-words text-xs">{txn.description ?? ''}</p>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" />}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditTxn(txn)}>
                          Edit
                        </DropdownMenuItem>
                        {txn.type !== 'INITIAL_BALANCE' && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTxn(txn)}
                          >
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {data?.content.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    No transactions
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4">{renderPagination()}</div>
        </>
      )}

      {/* Create / Edit Dialog */}
      <TransactionFormDialog
        open={createOpen || !!editTxn}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditTxn(null)
          }
        }}
        editTransaction={editTxn}
        defaultAccountId={filters.accountId}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTxn}
        onOpenChange={(open) => !open && setDeleteTxn(null)}
        title="Delete Transaction"
        description="Delete this transaction? The account balance will be adjusted."
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTxn) {
            deleteMutation.mutate(deleteTxn.id, {
              onSuccess: () => setDeleteTxn(null),
            })
          }
        }}
      />
    </div>
  )
}

