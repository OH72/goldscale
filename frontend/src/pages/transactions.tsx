import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTransactions, useDeleteTransaction } from '@/api/use-transactions'
import { useAccounts } from '@/api/use-accounts'
import { useCategories } from '@/api/use-categories'
import { PageHeader } from '@/components/layout/page-header'
import { TransactionBadge } from '@/components/transaction-badge'
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
import { MoreHorizontal, Plus, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, X } from 'lucide-react'
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
  const deleteMutation = useDeleteTransaction()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTxn, setEditTxn] = useState<TransactionResponse | null>(null)
  const [deleteTxn, setDeleteTxn] = useState<TransactionResponse | null>(null)

  const filters: TransactionFilters = {
    accountId: searchParams.get('accountId') ?? undefined,
    type: (searchParams.get('type') as TransactionType) ?? undefined,
    categoryId: searchParams.get('categoryId') ?? undefined,
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
    setSearchParams(next)
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
        <>
          {formatCurrency(txn.amount, currency)}
          <span className="text-muted-foreground">
            {' → '}
            {formatCurrency(txn.targetAmount, targetCurrency)}
            {txn.exchangeRate && txn.exchangeRate !== 1 && (
              <span className="ml-1 text-xs">({txn.exchangeRate.toFixed(4)})</span>
            )}
          </span>
        </>
      )
    }

    const prefix = txn.type === 'INCOME' ? '+' : txn.type === 'EXPENSE' ? '-' : ''
    return `${prefix}${formatCurrency(txn.amount, currency)}`
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
            setFilter('accountId', v === ALL_VALUE ? undefined : v)
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
            {accounts?.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.type ?? ALL_VALUE}
          onValueChange={(v) =>
            setFilter('type', v === ALL_VALUE ? undefined : v)
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
            setFilter('categoryId', v === ALL_VALUE ? undefined : v)
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
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">
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
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="w-44">Account</TableHead>
                <TableHead className="w-32">Category</TableHead>
                <TableHead className="w-48 text-right">
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
                <TableHead>Description</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.content.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>
                    <DateDisplay date={txn.date} />
                  </TableCell>
                  <TableCell>
                    <TransactionBadge type={txn.type} />
                  </TableCell>
                  <TableCell>
                    {txn.accountName}
                    {txn.type === 'TRANSFER' && txn.targetAccountName && (
                      <span className="text-muted-foreground">
                        {' → '}
                        {txn.targetAccountName}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {txn.categoryName ?? '—'}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'overflow-hidden text-right font-medium',
                      txn.type === 'INCOME' && 'text-green-600',
                      txn.type === 'EXPENSE' && 'text-red-600',
                    )}
                  >
                    {renderAmount(txn)}
                  </TableCell>
                  <TableCell className="text-muted-foreground" title={txn.description ?? ''}>
                    <span className="line-clamp-2 text-xs">{txn.description ?? ''}</span>
                  </TableCell>
                  <TableCell>
                    {txn.type !== 'INITIAL_BALANCE' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditTxn(txn)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTxn(txn)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data?.content.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No transactions
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {data.number + 1} of {data.totalPages} ({data.totalElements}{' '}
                total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.number === 0}
                  onClick={() => setPage(data.number - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.number >= data.totalPages - 1}
                  onClick={() => setPage(data.number + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
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

