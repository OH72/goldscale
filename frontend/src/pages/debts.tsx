import { useState, useMemo } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
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
  useDebtSummary,
} from '@/api/use-debt-records'
import { usePeople } from '@/api/use-people'
import { useCategories } from '@/api/use-categories'
import { useTags } from '@/api/use-tags'
import { CategorySelect } from '@/components/category-select'
import { TagMultiSelect } from '@/components/tag-multi-select'
import { useFilterStore } from '@/stores/filter-store'
import { PageHeader } from '@/components/layout/page-header'
import { TagChip } from '@/components/tag-chip'
import { FigureStrip } from '@/components/figure-strip'
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
  ChevronRight,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatSigned, toSubunits, fromSubunits } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import type { Currency } from '@/types/common'
import type {
  DebtRecordResponse,
  DebtType,
  DebtStatus,
  PaymentResponse,
  PersonResponse,
} from '@/types/debt'
import type { CategoryResponse } from '@/types/category'
import type { TagResponse } from '@/api/use-tags'

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
  tagIds: z.array(z.string()).optional(),
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
  tagIds: z.array(z.string()).optional(),
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
    <li className="grid grid-cols-[5.25rem_minmax(0,1fr)_auto_2rem] items-center gap-x-4 py-1.5 text-sm">
      <span className="num text-xs text-muted-foreground">{formatDate(payment.date)}</span>
      <span className="truncate text-muted-foreground">{payment.description || 'Payment'}</span>
      <span className="num">{formatCurrency(payment.amount, currency)}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(recordId, payment.id)}
        disabled={removeLoading}
        aria-label="Remove payment"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  )
}

// --- Record Row ---

/** Column template shared by the list header and each record row */
const RECORD_GRID =
  'grid grid-cols-[1rem_minmax(0,1fr)_auto_2.25rem] items-center gap-x-4 md:grid-cols-[1rem_5.25rem_minmax(0,1fr)_3.75rem_minmax(8rem,auto)_9.5rem_4.25rem_2.25rem]'

function RecordListHeader() {
  return (
    <div className={cn(RECORD_GRID, 'eyebrow hidden border-b border-foreground/60 px-4 py-2.5 md:grid')}>
      <span />
      <span>Date</span>
      <span>Person · note</span>
      <span>Kind</span>
      <span className="text-right">Amount</span>
      <span>Repaid</span>
      <span>Status</span>
      <span />
    </div>
  )
}

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
  const remaining = record.amount - record.coveredAmount
  const isDebt = record.type === 'DEBT'
  const closed = record.status === 'CLOSED'

  return (
    <div className={cn('border-b border-border/80 last:border-0', expanded && 'bg-gold/[0.04]')}>
      <div
        className={cn(RECORD_GRID, 'cursor-pointer px-4 py-3 transition-colors hover:bg-gold/[0.05]')}
        onClick={onToggleExpand}
      >
        <ChevronRight
          className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-90')}
        />
        <span className="num hidden text-xs text-muted-foreground md:block">
          {formatDate(record.date)}
        </span>

        <div className={cn('min-w-0', closed && 'opacity-60')}>
          <div className="truncate font-medium">{record.personName}</div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="num md:hidden">{formatDate(record.date)}</span>
            {record.description && <span className="truncate">{record.description}</span>}
            {record.categoryName && <Badge variant="secondary">{record.categoryName}</Badge>}
            {record.tagNames?.map((name) => <TagChip key={name} name={name} />)}
          </div>
        </div>

        <Badge variant={isDebt ? 'negative' : 'positive'} className="hidden md:inline-flex">
          {TYPE_LABELS[record.type]}
        </Badge>

        <div className={cn('text-right', closed && 'opacity-60')}>
          <div className={cn('num', isDebt ? 'text-negative' : 'text-positive')}>
            {formatCurrency(record.amount, record.currency)}
          </div>
          <div className="eyebrow mt-0.5 md:hidden">
            {TYPE_LABELS[record.type]} · {STATUS_LABELS[record.status]}
          </div>
        </div>

        <div className="hidden md:block">
          <Progress value={coveragePercent} className="w-full gap-0" />
          <div className="num mt-1.5 flex justify-between gap-2 text-[10.5px] text-muted-foreground">
            <span>{coveragePercent}%</span>
            <span className="truncate">
              {remaining > 0 ? `${formatCurrency(remaining, record.currency)} left` : 'settled'}
            </span>
          </div>
        </div>

        <Badge variant={closed ? 'secondary' : 'gold'} className="hidden md:inline-flex">
          {STATUS_LABELS[record.status]}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
                aria-label="Record actions"
              />
            }
          >
            <MoreHorizontal className="h-4 w-4" />
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

      {expanded && (
        <div className="px-4 pb-4 pl-12 md:pl-[8.5rem]">
          <div className="border-l-2 border-gold/50 pl-4">
            <div className="eyebrow mb-1">
              Payments · {record.payments.length}
            </div>
            {record.payments.length === 0 ? (
              <p className="py-1.5 font-display text-base text-muted-foreground italic">
                No payments yet.
              </p>
            ) : (
              <ul className="max-w-2xl divide-y divide-border/70">
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
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Record form fields (shared by create and edit) ---

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

interface RecordFieldsProps {
  form: UseFormReturn<CreateRecordForm>
  people: PersonResponse[] | undefined
  categories: CategoryResponse[] | undefined
  tags: TagResponse[] | undefined
}

function RecordFields({ form, people, categories, tags }: RecordFieldsProps) {
  const errors = form.formState.errors
  const type = form.watch('type')

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      {/* Kind: two-way toggle in the ledger's red/green inks */}
      <div className="col-span-2 space-y-2">
        <Label>Kind</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['DEBT', 'LOAN'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => form.setValue('type', t)}
              className={cn(
                'rounded-md px-3 py-2.5 text-left ring-1 transition-colors',
                type === t
                  ? t === 'DEBT'
                    ? 'bg-negative/10 ring-negative/50'
                    : 'bg-positive/10 ring-positive/50'
                  : 'bg-card/60 ring-border hover:ring-foreground/30',
              )}
            >
              <span
                className={cn(
                  'block text-sm font-medium',
                  type === t && (t === 'DEBT' ? 'text-negative' : 'text-positive'),
                )}
              >
                {t === 'DEBT' ? 'Debt' : 'Loan'}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t === 'DEBT' ? 'I owe them' : 'They owe me'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="col-span-2 space-y-2">
        <Label>Person</Label>
        <Select
          value={form.watch('personId')}
          onValueChange={(v) => form.setValue('personId', v ?? '', { shouldValidate: true })}
        >
          <SelectTrigger aria-invalid={!!errors.personId}>
            <SelectValue>
              {(v: string) =>
                people?.find((p) => p.id === v)?.name ?? (
                  <span className="text-muted-foreground">Select a person</span>
                )
              }
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
        <FieldError message={errors.personId?.message} />
      </div>

      <div className="space-y-2">
        <Label>Amount</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            step="0.01"
            {...form.register('amount')}
            aria-invalid={!!errors.amount}
            className="num min-w-0 flex-1"
          />
          <Select
            value={form.watch('currency')}
            onValueChange={(v) => v && form.setValue('currency', v as Currency)}
          >
            <SelectTrigger className="num w-[5.5rem] shrink-0">
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
        <FieldError message={errors.amount?.message} />
      </div>

      <div className="space-y-2">
        <Label>Date</Label>
        <Input
          type="date"
          {...form.register('date')}
          aria-invalid={!!errors.date}
          className="num"
        />
        <FieldError message={errors.date?.message} />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <CategorySelect
          categories={categories}
          value={form.watch('categoryId') ?? ''}
          onChange={(id) => form.setValue('categoryId', id)}
        />
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <TagMultiSelect
          tags={tags}
          value={form.watch('tagIds') ?? []}
          onChange={(ids) => form.setValue('tagIds', ids)}
        />
      </div>

      <div className="col-span-2 space-y-2">
        <Label>Note</Label>
        <Input {...form.register('description')} placeholder="What was it for?" />
      </div>
    </div>
  )
}

// --- Main Page ---

export function DebtsPage() {
  const { data: debtSummary } = useDebtSummary()
  const { data: people } = usePeople()
  const { data: categories } = useCategories()
  const { data: tags } = useTags()
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
      tagIds: [],
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
        tagIds: data.tagIds ?? [],
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
          tagIds: data.tagIds ?? [],
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
      tagIds: record.tagIds ?? [],
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

      {/* Totals, converted to the display currency */}
      {debtSummary && (() => {
        const entries = Array.isArray(debtSummary.entries) ? debtSummary.entries : []
        const owedToYou = entries.reduce((sum, e) => sum + e.totalLoan, 0)
        const youOwe = entries.reduce((sum, e) => sum + e.totalDebt, 0)
        const net = owedToYou - youOwe
        const cur = debtSummary.displayCurrency
        return (
          <FigureStrip
            className="mb-6"
            figures={[
              { label: 'Owed to you', value: formatCurrency(owedToYou, cur), tone: 'positive' },
              { label: 'You owe', value: formatCurrency(youOwe, cur), tone: 'negative' },
              { label: 'Net', value: formatSigned(net, cur), tone: net > 0 ? 'positive' : net < 0 ? 'negative' : undefined },
              { label: 'Counterparties', value: String(entries.length), note: 'with open balances' },
            ]}
          />
        )
      })()}

      {/* Filter Bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select
          value={personId || 'ALL'}
          onValueChange={(v) => setDebts({ personId: !v || v === 'ALL' ? '' : v })}
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
        <p className="py-16 text-center font-display text-xl text-muted-foreground italic">
          No records found.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md bg-card/85 shadow-paper ring-1 ring-border">
          <RecordListHeader />
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="eyebrow">Debts & loans</div>
            <DialogTitle>New record</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit(handleCreate)}
            className="space-y-6"
          >
            <RecordFields form={createForm} people={people} categories={categories} tags={tags} />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Recording…' : 'Record it'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog
        open={!!editRecord}
        onOpenChange={(open) => !open && setEditRecord(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="eyebrow">Debts & loans</div>
            <DialogTitle>Edit record</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit(handleEdit)}
            className="space-y-6"
          >
            <RecordFields form={editForm} people={people} categories={categories} tags={tags} />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
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
