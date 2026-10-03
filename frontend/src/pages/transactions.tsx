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
import { MoreHorizontal, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import type { TransactionResponse, TransactionFilters } from '@/types/transaction'
import type { TransactionType } from '@/types/common'

const ALL_VALUE = '__all__'

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
    page: Number(searchParams.get('page') ?? 0),
    size: 20,
  }

  const { data, isLoading } = useTransactions(filters)

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

  function getAmountDisplay(txn: TransactionResponse): string {
    const account = accounts?.find((a) => a.id === txn.accountId)
    const currency = account?.currency ?? 'UAH'

    if (txn.type === 'TRANSFER') {
      const targetAccount = accounts?.find((a) => a.id === txn.targetAccountId)
      const targetCurrency = targetAccount?.currency ?? currency
      if (currency !== targetCurrency && txn.targetAmount) {
        return `${formatCurrency(txn.amount, currency)} → ${formatCurrency(txn.targetAmount, targetCurrency)}`
      }
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
            <SelectValue placeholder="All accounts" />
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
            <SelectValue placeholder="All types" />
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
            <SelectValue placeholder="All categories" />
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
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
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
                      'text-right font-medium',
                      txn.type === 'INCOME' && 'text-green-600',
                      txn.type === 'EXPENSE' && 'text-red-600',
                    )}
                  >
                    {getAmountDisplay(txn)}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {txn.description ?? ''}
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

