import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useDebtRecords,
  useCreateDebtRecord,
  useUpdateDebtRecord,
  useDeleteDebtRecord,
  useAddPayment,
  useRemovePayment,
  useToggleDebtStatus,
} from '@/api/use-debt-records'
import { usePeople } from '@/api/use-people'
import { useCategories } from '@/api/use-categories'
import { useFilterStore } from '@/stores/filter-store'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, toSubunits, fromSubunits } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import type { Currency } from '@/types/common'
import type {
  DebtRecordResponse,
  DebtType,
  DebtStatus,
  PaymentResponse,
} from '@/types/debt'

const CURRENCIES: Currency[] = ['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'USDT']

const TYPE_LABELS: Record<DebtType, string> = {
  DEBT: 'Debt',
  LOAN: 'Loan',
}

const STATUS_LABELS: Record<DebtStatus, string> = {
  OPEN: 'Open',
  CLOSED: 'Closed',
}

// --- Zod Schemas ---

const createRecordSchema = z.object({
  personId: z.string().min(1, 'Person is required'),
  type: z.enum(['DEBT', 'LOAN']),
  amount: z.coerce.number().positive('Amount must be positive'),
  currency: z.enum(['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'USDT']),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
})

type CreateRecordForm = z.infer<typeof createRecordSchema>

const editRecordSchema = z.object({
  personId: z.string().min(1, 'Person is required'),
  type: z.enum(['DEBT', 'LOAN']),
  amount: z.coerce.number().positive('Amount must be positive'),
  currency: z.enum(['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'USDT']),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
})

type EditRecordForm = z.infer<typeof editRecordSchema>

const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  date: z.string().min(1, 'Date is required'),
  description: z.string().optional(),
})

type PaymentForm = z.infer<typeof paymentSchema>

// --- Payment Row ---

interface PaymentRowProps {
  payment: PaymentResponse
  currency: Currency
  recordId: string
  onRemove: (recordId: string, paymentId: string) => void
  removeLoading: boolean
}

function PaymentRow({ payment, currency, recordId, onRemove, removeLoading }: PaymentRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
      <div className="flex items-center gap-4">
        <span className="font-medium">
          {formatCurrency(payment.amount, currency)}
        </span>
        <span className="text-muted-foreground">{formatDate(payment.date)}</span>
        {payment.description && (
          <span className="text-muted-foreground">{payment.description}</span>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={() => onRemove(recordId, payment.id)}
        disabled={removeLoading}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// --- Record Row ---

interface RecordRowProps {
  record: DebtRecordResponse
  expanded: boolean
  onToggleExpand: () => void
  onEdit: (record: DebtRecordResponse) => void
  onDelete: (record: DebtRecordResponse) => void
  onAddPayment: (record: DebtRecordResponse) => void
  onToggleStatus: (id: string) => void
  onRemovePayment: (recordId: string, paymentId: string) => void
  toggleStatusLoading: boolean
  removePaymentLoading: boolean
}

function RecordRow({
  record,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddPayment,
  onToggleStatus,
  onRemovePayment,
  toggleStatusLoading,
  removePaymentLoading,
}: RecordRowProps) {
  const coveragePercent =
    record.amount > 0
      ? Math.round((record.coveredAmount / record.amount) * 100)
      : 0

  return (
    <div className="rounded-md border">
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3"
        onClick={onToggleExpand}
      >
        <button type="button" className="shrink-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-medium">{record.personName}</span>
          <Badge
            variant="outline"
            className={cn(
              record.type === 'DEBT'
                ? 'border-red-500 text-red-600'
                : 'border-green-500 text-green-600',
            )}
          >
            {TYPE_LABELS[record.type]}
          </Badge>
          <span className="font-medium">
            {formatCurrency(record.amount, record.currency)}
          </span>
          <div className="flex items-center gap-2">
            <Progress value={coveragePercent} className="h-2 w-24" />
            <span className="text-xs text-muted-foreground">
              {formatCurrency(record.coveredAmount, record.currency)} /{' '}
              {formatCurrency(record.amount, record.currency)} ({coveragePercent}%)
            </span>
          </div>
          <Badge
            variant="outline"
            className={cn(
              record.status === 'OPEN'
                ? 'border-amber-500 text-amber-600'
                : 'border-green-500 text-green-600',
            )}
          >
            {STATUS_LABELS[record.status]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {formatDate(record.date)}
          </span>
          {record.categoryName && (
            <Badge variant="secondary">{record.categoryName}</Badge>
          )}
          {record.description && (
            <span className="truncate text-sm text-muted-foreground">
              {record.description}
            </span>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onAddPayment(record)
              }}
            >
              Add Payment
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onEdit(record)
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onToggleStatus(record.id)
              }}
              disabled={toggleStatusLoading}
            >
              {record.status === 'OPEN' ? 'Close' : 'Reopen'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(record)
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && record.payments.length > 0 && (
        <div className="space-y-1 border-t px-4 py-3 pl-11">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Payments ({record.payments.length})
          </p>
          {record.payments.map((payment) => (
            <PaymentRow
              key={payment.id}
              payment={payment}
              currency={record.currency}
              recordId={record.id}
              onRemove={onRemovePayment}
              removeLoading={removePaymentLoading}
            />
          ))}
        </div>
      )}

      {expanded && record.payments.length === 0 && (
        <div className="border-t px-4 py-3 pl-11">
          <p className="text-sm text-muted-foreground">No payments yet</p>
        </div>
      )}
    </div>
  )
}

// --- Main Page ---

export function DebtsPage() {
  const { data: people } = usePeople()
  const { data: categories } = useCategories()
  const { personId, type, status, search } = useFilterStore((s) => s.debts)
  const setDebts = useFilterStore((s) => s.setDebts)
  const resetDebts = useFilterStore((s) => s.resetDebts)

  const serverFilters = useMemo(() => {
    const filters: { personId?: string; type?: DebtType; status?: DebtStatus } = {}
    if (personId) filters.personId = personId
    if (type !== 'ALL') filters.type = type
    if (status !== 'ALL') filters.status = status
    return filters
  }, [personId, type, status])

  const { data: records, isLoading } = useDebtRecords(serverFilters)
  const createMutation = useCreateDebtRecord()
  const updateMutation = useUpdateDebtRecord()
  const deleteMutation = useDeleteDebtRecord()
  const addPaymentMutation = useAddPayment()
  const removePaymentMutation = useRemovePayment()
  const toggleStatusMutation = useToggleDebtStatus()

  const [createOpen, setCreateOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<DebtRecordResponse | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<DebtRecordResponse | null>(null)
  const [paymentRecord, setPaymentRecord] = useState<DebtRecordResponse | null>(null)
  const [removePaymentTarget, setRemovePaymentTarget] = useState<{
    recordId: string
    paymentId: string
  } | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const hasActiveFilters = personId !== '' || type !== 'ALL' || status !== 'ALL' || search !== ''

  const createForm = useForm<CreateRecordForm>({
    resolver: zodResolver(createRecordSchema),
    defaultValues: {
      personId: '',
      type: 'DEBT',
      amount: 0,
      currency: 'UAH',
      categoryId: '',
      description: '',
      date: new Date().toISOString().slice(0, 10),
    },
  })

  const editForm = useForm<EditRecordForm>({
    resolver: zodResolver(editRecordSchema),
  })

  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      description: '',
    },
  })

  // Client-side search filter on top of server-filtered results
  const filteredRecords = useMemo(() => {
    if (!records) return []
    if (!search) return records
    const q = search.toLowerCase()
    return records.filter(
      (r) => r.description?.toLowerCase().includes(q),
    )
  }, [records, search])

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleCreate(data: CreateRecordForm) {
    createMutation.mutate(
      {
        personId: data.personId,
        type: data.type,
        amount: toSubunits(data.amount),
        currency: data.currency,
        categoryId: data.categoryId || null,
        description: data.description || null,
        date: data.date,
      },
      {
        onSuccess: () => {
          setCreateOpen(false)
          createForm.reset()
        },
      },
    )
  }

  function handleEdit(data: EditRecordForm) {
    if (!editRecord) return
    updateMutation.mutate(
      {
        id: editRecord.id,
        data: {
          personId: data.personId,
          type: data.type,
          amount: toSubunits(data.amount),
          currency: data.currency,
          categoryId: data.categoryId || null,
          description: data.description || null,
          date: data.date,
        },
      },
      {
        onSuccess: () => setEditRecord(null),
      },
    )
  }

  function openEdit(record: DebtRecordResponse) {
    editForm.reset({
      personId: record.personId,
      type: record.type,
      amount: fromSubunits(record.amount),
      currency: record.currency,
      categoryId: record.categoryId ?? '',
      description: record.description ?? '',
      date: record.date,
    })
    setEditRecord(record)
  }

  function handleAddPayment(data: PaymentForm) {
    if (!paymentRecord) return
    addPaymentMutation.mutate(
      {
        recordId: paymentRecord.id,
        data: {
          amount: toSubunits(data.amount),
          date: data.date,
          description: data.description || null,
        },
      },
      {
        onSuccess: () => {
          setPaymentRecord(null)
          paymentForm.reset()
        },
      },
    )
  }

  function openAddPayment(record: DebtRecordResponse) {
    paymentForm.reset({
      amount: fromSubunits(record.remainingAmount),
      date: new Date().toISOString().slice(0, 10),
      description: '',
    })
    setPaymentRecord(record)
  }

  function handleRemovePayment(recordId: string, paymentId: string) {
    setRemovePaymentTarget({ recordId, paymentId })
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Debts & Loans">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Record
        </Button>
      </PageHeader>

      {/* Filter Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={personId || 'ALL'}
          onValueChange={(v) => setDebts({ personId: v === 'ALL' ? '' : v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All people">
              {(v: string) => v === 'ALL' ? 'All people' : people?.find((p) => p.id === v)?.name ?? v}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All people</SelectItem>
            {people
              ?.slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Tabs
          value={type}
          onValueChange={(v) => setDebts({ type: v as 'ALL' | DebtType })}
        >
          <TabsList>
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="DEBT">Debts</TabsTrigger>
            <TabsTrigger value="LOAN">Loans</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs
          value={status}
          onValueChange={(v) => setDebts({ status: v as 'ALL' | DebtStatus })}
        >
          <TabsList>
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="OPEN">Open</TabsTrigger>
            <TabsTrigger value="CLOSED">Closed</TabsTrigger>
          </TabsList>
        </Tabs>

        <Input
          placeholder="Search description..."
          value={search}
          onChange={(e) => setDebts({ search: e.target.value })}
          className="max-w-xs"
        />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetDebts}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>

      {/* Records List */}
      {filteredRecords.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No records found
        </p>
      ) : (
        <div className="space-y-1">
          {filteredRecords.map((record) => (
            <RecordRow
              key={record.id}
              record={record}
              expanded={expandedIds.has(record.id)}
              onToggleExpand={() => toggleExpand(record.id)}
              onEdit={openEdit}
              onDelete={setDeleteRecord}
              onAddPayment={openAddPayment}
              onToggleStatus={(id) => toggleStatusMutation.mutate(id)}
              onRemovePayment={handleRemovePayment}
              toggleStatusLoading={toggleStatusMutation.isPending}
              removePaymentLoading={removePaymentMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Create Record Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Record</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit(handleCreate)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Person</Label>
              <Select
                value={createForm.watch('personId')}
                onValueChange={(v) => createForm.setValue('personId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select person">
                    {(v: string) => people?.find((p) => p.id === v)?.name ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {people
                    ?.slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {createForm.formState.errors.personId && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.personId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={createForm.watch('type')}
                onValueChange={(v) =>
                  createForm.setValue('type', v as DebtType)
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) => v === 'DEBT' ? 'Debt (I owe)' : 'Loan (They owe me)'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEBT">Debt (I owe)</SelectItem>
                  <SelectItem value="LOAN">Loan (They owe me)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...createForm.register('amount')}
                  aria-invalid={!!createForm.formState.errors.amount}
                  className={cn(
                    createForm.formState.errors.amount && 'border-destructive',
                  )}
                />
                {createForm.formState.errors.amount && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.amount.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={createForm.watch('currency')}
                  onValueChange={(v) =>
                    createForm.setValue('currency', v as Currency)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category (optional)</Label>
              <Select
                value={createForm.watch('categoryId') || 'NONE'}
                onValueChange={(v) =>
                  createForm.setValue('categoryId', v === 'NONE' ? '' : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None">
                    {(v: string) => v === 'NONE' ? 'None' : categories?.find((c) => c.id === v)?.name ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {categories
                    ?.slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input {...createForm.register('description')} />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                {...createForm.register('date')}
                aria-invalid={!!createForm.formState.errors.date}
                className={cn(
                  createForm.formState.errors.date && 'border-destructive',
                )}
              />
              {createForm.formState.errors.date && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.date.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog
        open={!!editRecord}
        onOpenChange={(open) => !open && setEditRecord(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Record</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit(handleEdit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Person</Label>
              <Select
                value={editForm.watch('personId')}
                onValueChange={(v) => editForm.setValue('personId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select person">
                    {(v: string) => people?.find((p) => p.id === v)?.name ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {people
                    ?.slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {editForm.formState.errors.personId && (
                <p className="text-sm text-destructive">
                  {editForm.formState.errors.personId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={editForm.watch('type')}
                onValueChange={(v) =>
                  editForm.setValue('type', v as DebtType)
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) => v === 'DEBT' ? 'Debt (I owe)' : 'Loan (They owe me)'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEBT">Debt (I owe)</SelectItem>
                  <SelectItem value="LOAN">Loan (They owe me)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...editForm.register('amount')}
                  aria-invalid={!!editForm.formState.errors.amount}
                  className={cn(
                    editForm.formState.errors.amount && 'border-destructive',
                  )}
                />
                {editForm.formState.errors.amount && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.amount.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={editForm.watch('currency')}
                  onValueChange={(v) =>
                    editForm.setValue('currency', v as Currency)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category (optional)</Label>
              <Select
                value={editForm.watch('categoryId') || 'NONE'}
                onValueChange={(v) =>
                  editForm.setValue('categoryId', v === 'NONE' ? '' : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None">
                    {(v: string) => v === 'NONE' ? 'None' : categories?.find((c) => c.id === v)?.name ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {categories
                    ?.slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input {...editForm.register('description')} />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                {...editForm.register('date')}
                aria-invalid={!!editForm.formState.errors.date}
                className={cn(
                  editForm.formState.errors.date && 'border-destructive',
                )}
              />
              {editForm.formState.errors.date && (
                <p className="text-sm text-destructive">
                  {editForm.formState.errors.date.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog
        open={!!paymentRecord}
        onOpenChange={(open) => !open && setPaymentRecord(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Add Payment
              {paymentRecord && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  (Remaining:{' '}
                  {formatCurrency(
                    paymentRecord.remainingAmount,
                    paymentRecord.currency,
                  )}
                  )
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={paymentForm.handleSubmit(handleAddPayment)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                {...paymentForm.register('amount')}
                aria-invalid={!!paymentForm.formState.errors.amount}
                className={cn(
                  paymentForm.formState.errors.amount && 'border-destructive',
                )}
              />
              {paymentForm.formState.errors.amount && (
                <p className="text-sm text-destructive">
                  {paymentForm.formState.errors.amount.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                {...paymentForm.register('date')}
                aria-invalid={!!paymentForm.formState.errors.date}
                className={cn(
                  paymentForm.formState.errors.date && 'border-destructive',
                )}
              />
              {paymentForm.formState.errors.date && (
                <p className="text-sm text-destructive">
                  {paymentForm.formState.errors.date.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input {...paymentForm.register('description')} />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={addPaymentMutation.isPending}
            >
              {addPaymentMutation.isPending ? 'Adding...' : 'Add Payment'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Record Confirmation */}
      <ConfirmDialog
        open={!!deleteRecord}
        onOpenChange={(open) => !open && setDeleteRecord(null)}
        title="Delete Record"
        description={`Delete this ${deleteRecord?.type === 'DEBT' ? 'debt' : 'loan'} record for ${deleteRecord?.personName}?`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteRecord) {
            deleteMutation.mutate(deleteRecord.id, {
              onSuccess: () => setDeleteRecord(null),
            })
          }
        }}
      />

      {/* Remove Payment Confirmation */}
      <ConfirmDialog
        open={!!removePaymentTarget}
        onOpenChange={(open) => !open && setRemovePaymentTarget(null)}
        title="Remove Payment"
        description="Remove this payment? The covered amount will be recalculated."
        loading={removePaymentMutation.isPending}
        onConfirm={() => {
          if (removePaymentTarget) {
            removePaymentMutation.mutate(
              {
                recordId: removePaymentTarget.recordId,
                paymentId: removePaymentTarget.paymentId,
              },
              {
                onSuccess: () => setRemovePaymentTarget(null),
              },
            )
          }
        }}
      />
    </div>
  )
}
