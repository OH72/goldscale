import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, ChevronsUpDown, X, Plus, Trash2, Link } from 'lucide-react'
import { useAccounts } from '@/api/use-accounts'
import { useCategories } from '@/api/use-categories'
import { useTags } from '@/api/use-tags'
import { useDebtRecords } from '@/api/use-debt-records'
import { usePeople } from '@/api/use-people'
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
} from '@/api/use-transactions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { toSubunits, fromSubunits, formatCurrency } from '@/lib/currency'
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

interface DebtLinkRow {
  debtRecordId: string
  amount: string
}

interface NewDebtRow {
  personId: string
  amount: string
}

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
  const { data: people } = usePeople()
  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction()
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [tagSearch, setTagSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [pendingEditValues, setPendingEditValues] = useState<FormValues | null>(null)

  // Debt linking state (create mode only)
  type DebtLinkMode = 'none' | 'existing' | 'new'
  const [debtLinkMode, setDebtLinkMode] = useState<DebtLinkMode>('none')
  const [debtLinkRows, setDebtLinkRows] = useState<DebtLinkRow[]>([])
  const [newDebtRows, setNewDebtRows] = useState<NewDebtRow[]>([])
  const [debtSearch, setDebtSearch] = useState('')
  // Editable link amounts for edit mode (debtRecordId -> display amount string)
  const [editLinkAmounts, setEditLinkAmounts] = useState<Record<string, string>>({})

  // Fetch open debts/loans for linking (UC1)
  const debtTypeForLink = txnType === 'EXPENSE' ? 'DEBT' : 'LOAN'
  const { data: openDebtRecords } = useDebtRecords(
    debtLinkMode === 'existing' ? { type: debtTypeForLink, status: 'OPEN' } : undefined,
  )

  const { data: recentTxns } = useTransactions({ page: 0, size: 100 })

  const filteredCategories = categories?.filter((c) =>
    txnType === 'INCOME'
      ? c.type === 'INCOME' || c.type === 'BOTH'
      : c.type === 'EXPENSE' || c.type === 'BOTH',
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

  // Filter debt records that are not already selected
  const availableDebtRecords = useMemo(() => {
    if (!openDebtRecords) return []
    const selectedIds = new Set(debtLinkRows.map((r) => r.debtRecordId))
    const q = debtSearch.toLowerCase()
    return openDebtRecords.filter(
      (r) =>
        !selectedIds.has(r.id) &&
        (q === '' ||
          r.personName.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          formatCurrency(r.remainingAmount, r.currency).includes(q)),
    )
  }, [openDebtRecords, debtLinkRows, debtSearch])

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
      // Initialize editable link amounts from existing debt links
      if (editTransaction.debtLinks?.length) {
        const amounts: Record<string, string> = {}
        for (const link of editTransaction.debtLinks) {
          amounts[link.debtRecordId] = String(fromSubunits(link.amount))
        }
        setEditLinkAmounts(amounts)
      } else {
        setEditLinkAmounts({})
      }
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
      setDebtLinkMode('none')
      setDebtLinkRows([])
      setNewDebtRows([])
      setDebtSearch('')
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
    // If editing a linked transaction, ask for confirmation first
    if (isEdit && editTransaction?.debtLinks?.length && !pendingEditValues) {
      setPendingEditValues(values)
      return
    }

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
            debtLinkAmounts: editTransaction.debtLinks?.length
              ? Object.fromEntries(
                  editTransaction.debtLinks.map((link) => [
                    link.debtRecordId,
                    toSubunits(Number(editLinkAmounts[link.debtRecordId] || fromSubunits(link.amount))),
                  ]),
                )
              : null,
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
      const debtLinks =
        debtLinkMode === 'existing' && debtLinkRows.length > 0
          ? debtLinkRows
              .filter((r) => r.debtRecordId && Number(r.amount) > 0)
              .map((r) => ({
                debtRecordId: r.debtRecordId,
                amount: toSubunits(Number(r.amount)),
              }))
          : undefined

      const newDebts =
        debtLinkMode === 'new' && newDebtRows.length > 0
          ? newDebtRows
              .filter((r) => r.personId)
              .map((r) => ({
                personId: r.personId,
                amount: r.amount ? toSubunits(Number(r.amount)) : undefined,
              }))
          : undefined

      createMutation.mutate(
        {
          type: txnType as 'INCOME' | 'EXPENSE',
          accountId: values.accountId,
          amount: toSubunits(values.amount),
          categoryId: values.categoryId!,
          date: toISODate(values.date),
          description: values.description ?? null,
          tagIds,
          debtLinks: debtLinks?.length ? debtLinks : undefined,
          newDebts: newDebts?.length ? newDebts : undefined,
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
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isInitialBalance
              ? 'Edit Initial Balance'
              : isEdit
                ? 'Edit Transaction'
                : 'New Transaction'}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-1">
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
            className="space-y-4 mt-4"
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

            {/* Show existing debt links when editing */}
            {isEdit && editTransaction?.debtLinks && editTransaction.debtLinks.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Linked Debts / Loans
                  </Label>
                  <div className="space-y-2">
                    {editTransaction.debtLinks.map((link) => (
                      <div
                        key={link.debtRecordId}
                        className="rounded-md border p-2 space-y-1.5"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <Link className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span className="font-medium">{link.personName}</span>
                          <Badge variant="outline" className="text-xs">
                            {link.debtType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs shrink-0">Amount:</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-7 text-sm"
                            value={editLinkAmounts[link.debtRecordId] ?? String(fromSubunits(link.amount))}
                            onChange={(e) =>
                              setEditLinkAmounts((prev) => ({
                                ...prev,
                                [link.debtRecordId]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Debt/Loan Linking (create mode, INCOME/EXPENSE only) */}
            {!isEdit && !isInitialBalance && txnType !== 'TRANSFER' && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Link to Debt / Loan
                  </Label>
                  <Tabs
                    value={debtLinkMode}
                    onValueChange={(v) => {
                      setDebtLinkMode(v as DebtLinkMode)
                      setDebtLinkRows([])
                      setNewDebtRows([])
                      setDebtSearch('')
                    }}
                  >
                    <TabsList className="w-full">
                      <TabsTrigger value="none" className="flex-1">None</TabsTrigger>
                      <TabsTrigger value="existing" className="flex-1">
                        Link existing
                      </TabsTrigger>
                      <TabsTrigger value="new" className="flex-1">Create new</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* UC1: Link to existing debt/loan records */}
                  {debtLinkMode === 'existing' && (
                    <div className="space-y-3">
                      {debtLinkRows.map((row, idx) => {
                        const record = openDebtRecords?.find((r) => r.id === row.debtRecordId)
                        return (
                          <div key={idx} className="flex items-start gap-2 rounded-md border p-2">
                            <div className="flex-1 space-y-1.5">
                              {record && (
                                <p className="text-sm font-medium">
                                  {record.personName} — {formatCurrency(record.remainingAmount, record.currency)} remaining
                                  {record.description && (
                                    <span className="text-xs text-muted-foreground ml-1">({record.description})</span>
                                  )}
                                </p>
                              )}
                              <div className="flex items-center gap-2">
                                <Label className="text-xs shrink-0">Amount:</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-7 text-sm"
                                  placeholder={record ? String(fromSubunits(record.remainingAmount)) : '0'}
                                  value={row.amount}
                                  onChange={(e) => {
                                    const next = [...debtLinkRows]
                                    next[idx] = { ...next[idx], amount: e.target.value }
                                    setDebtLinkRows(next)
                                  }}
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-destructive"
                              onClick={() => setDebtLinkRows((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )
                      })}

                      {/* Add debt link */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="w-full">
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add {txnType === 'EXPENSE' ? 'debt' : 'loan'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                          <div className="p-2 border-b">
                            <Input
                              placeholder="Search by person or description..."
                              value={debtSearch}
                              onChange={(e) => setDebtSearch(e.target.value)}
                              className="h-8"
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto p-1">
                            {availableDebtRecords.length === 0 ? (
                              <p className="py-3 text-center text-sm text-muted-foreground">
                                No open {txnType === 'EXPENSE' ? 'debts' : 'loans'} found
                              </p>
                            ) : (
                              availableDebtRecords.map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                                  onClick={() => {
                                    setDebtLinkRows((prev) => [
                                      ...prev,
                                      { debtRecordId: r.id, amount: String(fromSubunits(r.remainingAmount)) },
                                    ])
                                    setDebtSearch('')
                                  }}
                                >
                                  <span className="font-medium">{r.personName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatCurrency(r.remainingAmount, r.currency)} remaining
                                    {r.description && ` — ${r.description}`}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* UC2/UC3: Create new debt/loan records */}
                  {debtLinkMode === 'new' && (
                    <div className="space-y-3">
                      {newDebtRows.map((row, idx) => {
                        const person = people?.find((p) => p.id === row.personId)
                        return (
                          <div key={idx} className="flex items-start gap-2 rounded-md border p-2">
                            <div className="flex-1 space-y-1.5">
                              <Select
                                value={row.personId}
                                onValueChange={(v) => {
                                  const next = [...newDebtRows]
                                  next[idx] = { ...next[idx], personId: v }
                                  setNewDebtRows(next)
                                }}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select person">
                                    {(v: string) => people?.find((p) => p.id === v)?.name ?? 'Select person'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {people?.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs shrink-0">Amount:</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-7 text-sm"
                                  placeholder="Full transaction amount"
                                  value={row.amount}
                                  onChange={(e) => {
                                    const next = [...newDebtRows]
                                    next[idx] = { ...next[idx], amount: e.target.value }
                                    setNewDebtRows(next)
                                  }}
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-destructive"
                              onClick={() => setNewDebtRows((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )
                      })}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setNewDebtRows((prev) => [...prev, { personId: '', amount: '' }])}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add person
                      </Button>

                      <p className="text-xs text-muted-foreground">
                        {txnType === 'INCOME'
                          ? 'Will create DEBT record(s) (you owe them)'
                          : 'Will create LOAN record(s) (they owe you)'}
                        . Leave amount empty to use the full transaction amount.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending
                ? 'Saving...'
                : isEdit
                  ? 'Save'
                  : 'Create'}
            </Button>
          </form>
        </div>

        {/* Edit-cascade confirmation for linked transactions */}
        <ConfirmDialog
          open={!!pendingEditValues}
          onOpenChange={(open) => { if (!open) setPendingEditValues(null) }}
          title="Update Linked Transaction"
          description="This transaction is linked to debt/loan record(s). Saving will also update the linked payment(s). Continue?"
          confirmLabel="Save"
          confirmVariant="default"
          loading={updateMutation.isPending}
          onConfirm={() => {
            if (pendingEditValues) {
              const v = pendingEditValues
              setPendingEditValues(null)
              handleSubmit(v)
            }
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
