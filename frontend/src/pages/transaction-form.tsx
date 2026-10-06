import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, ChevronsUpDown, X } from 'lucide-react'
import { useAccounts } from '@/api/use-accounts'
import { useCategories } from '@/api/use-categories'
import { useTags } from '@/api/use-tags'
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
} from '@/api/use-transactions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toSubunits, fromSubunits } from '@/lib/currency'
import { toISODate } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { TransactionResponse } from '@/types/transaction'
import type { TransactionType } from '@/types/common'

const formSchema = z.object({
  amount: z.coerce.number().min(0, 'Amount must be >= 0'),
  targetAmount: z.coerce.number().positive().optional(),
  accountId: z.string().min(1, 'Account is required'),
  targetAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.date(),
})

type FormValues = z.infer<typeof formSchema>

interface TransactionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editTransaction?: TransactionResponse | null
  defaultAccountId?: string
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  editTransaction,
  defaultAccountId,
}: TransactionFormDialogProps) {
  const isEdit = !!editTransaction
  const isInitialBalance = editTransaction?.type === 'INITIAL_BALANCE'
  const [txnType, setTxnType] = useState<TransactionType>(
    editTransaction?.type ?? 'EXPENSE',
  )

  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const { data: tags } = useTags()
  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction()
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [tagSearch, setTagSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')

  const { data: recentTxns } = useTransactions({ page: 0, size: 100 })

  const filteredCategories = categories?.filter((c) =>
    txnType === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE',
  )

  const sortedCategories = useMemo(() => {
    if (!filteredCategories) return { recent: [], rest: [], hasRecent: false }
    const tenDaysAgo = new Date()
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
    const recentCategoryIds = new Set(
      recentTxns?.content
        ?.filter((t) => new Date(t.date) >= tenDaysAgo && t.categoryId)
        .map((t) => t.categoryId!) ?? [],
    )
    const recent = filteredCategories
      .filter((c) => recentCategoryIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name))
    const rest = filteredCategories
      .filter((c) => !recentCategoryIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { recent, rest, hasRecent: recent.length > 0 && rest.length > 0 }
  }, [filteredCategories, recentTxns])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      accountId: '',
      description: '',
      date: new Date(),
    },
  })

  useEffect(() => {
    if (editTransaction && open) {
      setTxnType(editTransaction.type)
      setSelectedTagIds(editTransaction.tagIds ?? [])
      setTagSearch('')
      setCategorySearch('')
      form.reset({
        amount: fromSubunits(editTransaction.amount),
        targetAmount: editTransaction.targetAmount
          ? fromSubunits(editTransaction.targetAmount)
          : undefined,
        accountId: editTransaction.accountId,
        targetAccountId: editTransaction.targetAccountId ?? undefined,
        categoryId: editTransaction.categoryId ?? undefined,
        description: editTransaction.description ?? '',
        date: new Date(editTransaction.date),
      })
    } else if (open && !editTransaction) {
      setSelectedTagIds([])
      setTagSearch('')
      setCategorySearch('')
      const firstActiveId = defaultAccountId ?? accounts?.find((a) => a.active)?.id ?? accounts?.[0]?.id ?? ''
      form.reset({
        amount: 0,
        accountId: firstActiveId,
        description: '',
        date: new Date(),
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTransaction, open, accounts, defaultAccountId])

  function handleSubmit(values: FormValues) {
    const tagIds = selectedTagIds.length > 0 ? selectedTagIds : null

    if (isEdit) {
      updateMutation.mutate(
        {
          id: editTransaction.id,
          data: {
            amount: toSubunits(values.amount),
            categoryId: values.categoryId ?? null,
            date: toISODate(values.date),
            description: values.description ?? null,
            targetAmount:
              txnType === 'TRANSFER' && values.targetAmount
                ? toSubunits(values.targetAmount)
                : null,
            accountId: values.accountId,
            targetAccountId: values.targetAccountId ?? null,
            tagIds,
          },
        },
        { onSuccess: () => onOpenChange(false) },
      )
      return
    }

    if (txnType === 'TRANSFER') {
      const targetAmt = values.targetAmount ?? values.amount
      createMutation.mutate(
        {
          type: 'TRANSFER',
          sourceAccountId: values.accountId,
          targetAccountId: values.targetAccountId!,
          amount: toSubunits(values.amount),
          targetAmount: toSubunits(targetAmt),
          date: toISODate(values.date),
          description: values.description ?? null,
          tagIds,
        },
        { onSuccess: () => onOpenChange(false) },
      )
    } else {
      createMutation.mutate(
        {
          type: txnType as 'INCOME' | 'EXPENSE',
          accountId: values.accountId,
          amount: toSubunits(values.amount),
          categoryId: values.categoryId!,
          date: toISODate(values.date),
          description: values.description ?? null,
          tagIds,
        },
        { onSuccess: () => onOpenChange(false) },
      )
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const selectedAccountCurrency = accounts?.find(
    (a) => a.id === form.watch('accountId'),
  )?.currency
  const targetAccountCurrency = accounts?.find(
    (a) => a.id === form.watch('targetAccountId'),
  )?.currency
  const isCrossCurrency =
    txnType === 'TRANSFER' &&
    selectedAccountCurrency &&
    targetAccountCurrency &&
    selectedAccountCurrency !== targetAccountCurrency

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isInitialBalance
              ? 'Edit Initial Balance'
              : isEdit
                ? 'Edit Transaction'
                : 'New Transaction'}
          </DialogTitle>
        </DialogHeader>

        {!isEdit && !isInitialBalance && (
          <Tabs
            value={txnType}
            onValueChange={(v) => setTxnType(v as TransactionType)}
          >
            <TabsList className="w-full">
              <TabsTrigger value="EXPENSE" className="flex-1">
                Expense
              </TabsTrigger>
              <TabsTrigger value="INCOME" className="flex-1">
                Income
              </TabsTrigger>
              <TabsTrigger value="TRANSFER" className="flex-1">
                Transfer
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
        >
          {/* Account */}
          {!isInitialBalance && (
            <div className="space-y-2">
              <Label>
                {txnType === 'TRANSFER' ? 'Source Account' : 'Account'}
              </Label>
              <Select
                value={form.watch('accountId')}
                onValueChange={(v) => form.setValue('accountId', v)}
              >
                <SelectTrigger aria-invalid={!!form.formState.errors.accountId}>
                  <SelectValue placeholder="Select account">
                    {(v: string) => {
                      const a = accounts?.find((acc) => acc.id === v)
                      return a ? (
                        <span className="inline-flex items-center gap-2">
                          {a.color && <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />}
                          {a.name} ({a.currency})
                        </span>
                      ) : 'Select account'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    ?.slice()
                    .sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1))
                    .map((a) => (
                    <SelectItem key={a.id} value={a.id} className={!a.active ? 'text-muted-foreground' : ''}>
                      <span className="inline-flex items-center gap-2">
                        {a.color && <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />}
                        {a.name} ({a.currency}){!a.active ? ' (inactive)' : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Target Account (transfer only) */}
          {txnType === 'TRANSFER' && !isInitialBalance && (
            <div className="space-y-2">
              <Label>Target Account</Label>
              <Select
                value={form.watch('targetAccountId') ?? ''}
                onValueChange={(v) => form.setValue('targetAccountId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target">
                    {(v: string) => {
                      const a = accounts?.find((acc) => acc.id === v)
                      return a ? (
                        <span className="inline-flex items-center gap-2">
                          {a.color && <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />}
                          {a.name} ({a.currency})
                        </span>
                      ) : 'Select target'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    ?.filter((a) => a.id !== form.watch('accountId'))
                    .sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1))
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id} className={!a.active ? 'text-muted-foreground' : ''}>
                        <span className="inline-flex items-center gap-2">
                          {a.color && <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />}
                          {a.name} ({a.currency}){!a.active ? ' (inactive)' : ''}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label>
              Amount{selectedAccountCurrency ? ` (${selectedAccountCurrency})` : ''}
            </Label>
            <Input
              type="number"
              step="0.01"
              {...form.register('amount')}
              aria-invalid={!!form.formState.errors.amount}
              className={cn(form.formState.errors.amount && 'border-destructive')}
            />
            {form.formState.errors.amount && (
              <p className="text-sm text-destructive">
                {form.formState.errors.amount.message}
              </p>
            )}
          </div>

          {/* Target Amount (cross-currency transfer) */}
          {!isInitialBalance && txnType === 'TRANSFER' && (isCrossCurrency || isEdit) && (
            <div className="space-y-2">
              <Label>
                Target Amount
                {targetAccountCurrency ? ` (${targetAccountCurrency})` : ''}
              </Label>
              <Input
                type="number"
                step="0.01"
                {...form.register('targetAmount')}
              />
            </div>
          )}

          {/* Category (income/expense only) */}
          {!isInitialBalance && txnType !== 'TRANSFER' && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full justify-between font-normal"
                  >
                    {form.watch('categoryId')
                      ? (filteredCategories?.find((c) => c.id === form.watch('categoryId'))?.name ?? 'Select category')
                      : <span className="text-muted-foreground">Select category</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Search categories..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1">
                    {(() => {
                      const q = categorySearch.toLowerCase()
                      const recentFiltered = sortedCategories.recent.filter((c) => c.name.toLowerCase().includes(q))
                      const restFiltered = sortedCategories.rest.filter((c) => c.name.toLowerCase().includes(q))
                      if (recentFiltered.length === 0 && restFiltered.length === 0) {
                        return <p className="py-2 text-center text-sm text-muted-foreground">No categories found</p>
                      }
                      return (
                        <>
                          {recentFiltered.length > 0 && sortedCategories.hasRecent && (
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Recent</div>
                          )}
                          {recentFiltered.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className={cn(
                                'flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer',
                                form.watch('categoryId') === c.id && 'bg-accent',
                              )}
                              onClick={() => {
                                form.setValue('categoryId', c.id)
                                setCategorySearch('')
                              }}
                            >
                              {c.name}
                            </button>
                          ))}
                          {restFiltered.length > 0 && sortedCategories.hasRecent && recentFiltered.length > 0 && (
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Other</div>
                          )}
                          {restFiltered.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className={cn(
                                'flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer',
                                form.watch('categoryId') === c.id && 'bg-accent',
                              )}
                              onClick={() => {
                                form.setValue('categoryId', c.id)
                                setCategorySearch('')
                              }}
                            >
                              {c.name}
                            </button>
                          ))}
                        </>
                      )
                    })()}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !form.watch('date') && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.watch('date')
                    ? format(form.watch('date'), 'dd.MM.yyyy')
                    : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  captionLayout="dropdown"
                  fixedWeeks
                  defaultMonth={form.watch('date')}
                  startMonth={new Date(2020, 0)}
                  endMonth={new Date(2030, 11)}
                  selected={form.watch('date')}
                  onSelect={(d) => d && form.setValue('date', d)}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tags */}
          {!isInitialBalance && tags && tags.length > 0 && (
            <div className="space-y-2">
              <Label>Tags</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full justify-between font-normal"
                  >
                    {selectedTagIds.length === 0 ? (
                      <span className="text-muted-foreground">Select tags</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {selectedTagIds.map((id) => {
                          const tag = tags.find((t) => t.id === id)
                          return tag ? (
                            <Badge key={id} variant="secondary" className="text-xs">
                              {tag.name}
                              <button
                                type="button"
                                className="ml-1"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedTagIds((prev) => prev.filter((t) => t !== id))
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ) : null
                        })}
                      </div>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Search tags..."
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto p-2">
                    {(() => {
                      const filtered = tags
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                      if (filtered.length === 0) {
                        return <p className="py-2 text-center text-sm text-muted-foreground">No tags found</p>
                      }
                      return filtered.map((tag) => (
                        <label
                          key={tag.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedTagIds.includes(tag.id)}
                            onCheckedChange={(checked) => {
                              setSelectedTagIds((prev) =>
                                checked
                                  ? [...prev, tag.id]
                                  : prev.filter((t) => t !== tag.id),
                              )
                            }}
                          />
                          {tag.name}
                        </label>
                      ))
                    })()}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Description */}
          {!isInitialBalance && (
            <div className="space-y-2">
              <Label>Description</Label>
              <Input {...form.register('description')} />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending
              ? 'Saving...'
              : isEdit
                ? 'Save'
                : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
