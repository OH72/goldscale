import { useState, useMemo, useEffect } from 'react'
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
  useReconcileDebt,
} from '@/api/use-debt-records'
import { useTransaction } from '@/api/use-transactions'
import { useAccounts } from '@/api/use-accounts'
import { usePeople } from '@/api/use-people'
import { useCategories } from '@/api/use-categories'
import { useTags } from '@/api/use-tags'
import { useSettings } from '@/api/use-settings'
import { CategorySelect } from '@/components/category-select'
import { TagMultiSelect } from '@/components/tag-multi-select'
import { useFilterStore } from '@/stores/filter-store'
import { useDatePreferenceStore } from '@/stores/date-preference-store'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { TransactionBadge } from '@/components/transaction-badge'
import {
  ChevronDown,
  ChevronRight,
  Link,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Scale,
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

// --- Reconcile Dialog ---

function ReconcileDialog({
  source,
  allRecords,
  onClose,
}: {
  source: DebtRecordResponse | null
  allRecords: DebtRecordResponse[]
  onClose: () => void
}) {
  const reconcileMutation = useReconcileDebt()
  const [counterpartId, setCounterpartId] = useState('')
  const [sourceAmount, setSourceAmount] = useState('')
  const [counterpartAmount, setCounterpartAmount] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setCounterpartId('')
    setSourceAmount('')
    setCounterpartAmount('')
    setError('')
  }, [source])

  const eligible = useMemo(() => {
    if (!source) return []
    return allRecords.filter(
      (r) =>
        r.personId === source.personId &&
        r.type !== source.type &&
        r.status === 'OPEN' &&
        r.remainingAmount > 0 &&
        r.id !== source.id,
    )
  }, [source, allRecords])

  const counterpart = eligible.find((r) => r.id === counterpartId)
  const sameCurrency = source && counterpart && source.currency === counterpart.currency

  function handleCounterpartChange(id: string) {
    setCounterpartId(id)
    setError('')
    const cp = eligible.find((r) => r.id === id)
    if (!cp || !source) return
    if (source.currency === cp.currency) {
      const defaultAmt = Math.min(source.remainingAmount, cp.remainingAmount)
      setSourceAmount(String(fromSubunits(defaultAmt)))
      setCounterpartAmount(String(fromSubunits(defaultAmt)))
    } else {
      setSourceAmount(String(fromSubunits(source.remainingAmount)))
      setCounterpartAmount(String(fromSubunits(cp.remainingAmount)))
    }
  }

  function handleSubmit() {
    if (!source || !counterpartId) return
    setError('')

    const srcAmt = toSubunits(parseFloat(sourceAmount) || 0)
    const cpAmt = toSubunits(parseFloat(counterpartAmount) || 0)

    if (srcAmt <= 0 || cpAmt <= 0) {
      setError('Both amounts must be positive')
      return
    }
    if (srcAmt > source.remainingAmount) {
      setError(`Source amount exceeds remaining (${fromSubunits(source.remainingAmount)})`)
      return
    }
    if (counterpart && cpAmt > counterpart.remainingAmount) {
      setError(`Counterpart amount exceeds remaining (${fromSubunits(counterpart.remainingAmount)})`)
      return
    }

    reconcileMutation.mutate(
      { id: source.id, data: { counterpartId, sourceAmount: srcAmt, counterpartAmount: cpAmt } },
      { onSuccess: onClose },
    )
  }

  if (!source) return null

  return (
    <Dialog open={!!source} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reconcile</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border p-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                source.type === 'DEBT'
                  ? 'border-red-500 text-red-600'
                  : 'border-green-500 text-green-600',
              )}
            >
              {TYPE_LABELS[source.type]}
            </Badge>
            <span className="font-medium">
              {formatCurrency(source.amount, source.currency)}
            </span>
            <span className="text-muted-foreground">
              (remaining: {formatCurrency(source.remainingAmount, source.currency)})
            </span>
          </div>
          {source.description && (
            <p className="mt-1 text-muted-foreground">{source.description}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Counterpart record</Label>
            {eligible.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No eligible {source.type === 'DEBT' ? 'loans' : 'debts'} for this person
              </p>
            ) : (
              <Select value={counterpartId} onValueChange={handleCounterpartChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select record">
                    {(v: string) => {
                      const r = eligible.find((e) => e.id === v)
                      if (!r) return v
                      return `${TYPE_LABELS[r.type]} · ${formatCurrency(r.amount, r.currency)} (rem: ${formatCurrency(r.remainingAmount, r.currency)})`
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-[400px]">
                  {eligible.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            r.type === 'DEBT'
                              ? 'border-red-500 text-red-600'
                              : 'border-green-500 text-green-600',
                          )}
                        >
                          {TYPE_LABELS[r.type]}
                        </Badge>
                        <span>{formatCurrency(r.amount, r.currency)}</span>
                        <span className="text-muted-foreground">
                          (rem: {formatCurrency(r.remainingAmount, r.currency)})
                        </span>
                      </div>
                      {r.description && (
                        <p className="text-xs text-muted-foreground">{r.description}</p>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {counterpartId && counterpart && (
            <>
              {sameCurrency ? (
                <div className="space-y-2">
                  <Label>Amount ({source.currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={sourceAmount}
                    onChange={(e) => {
                      setSourceAmount(e.target.value)
                      setCounterpartAmount(e.target.value)
                    }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Source ({source.currency})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={sourceAmount}
                      onChange={(e) => setSourceAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Counterpart ({counterpart.currency})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={counterpartAmount}
                      onChange={(e) => setCounterpartAmount(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={reconcileMutation.isPending}
              >
                {reconcileMutation.isPending ? 'Reconciling...' : 'Reconcile'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Transaction Info Popover ---

function TransactionInfoPopover({ transactionId }: { transactionId: string }) {
  const { data: txn, isLoading } = useTransaction(transactionId)
  const { data: accounts } = useAccounts()

  const currency = accounts?.find((a) => a.id === txn?.accountId)?.currency ?? 'UAH'

  return (
    <Popover>
      <PopoverTrigger>
        <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-secondary/80">
          <Link className="h-3 w-3" />
          Transaction
        </Badge>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 p-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : txn ? (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <TransactionBadge type={txn.type} />
              <span className="text-muted-foreground">{formatDate(txn.date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Account</span>
              <span className="font-medium">{txn.accountName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatCurrency(txn.amount, currency)}</span>
            </div>
            {txn.categoryName && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Category</span>
                <span>{txn.categoryName}</span>
              </div>
            )}
            {txn.description && (
              <div>
                <span className="text-muted-foreground">Description: </span>
                <span>{txn.description}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Transaction not found</p>
        )}
      </PopoverContent>
    </Popover>
  )
}

// --- Offset Info Popover ---

function OffsetInfoPopover({
  offsetGroupId,
  currentRecordId,
  allRecords,
}: {
  offsetGroupId: string
  currentRecordId: string
  allRecords: DebtRecordResponse[]
}) {
  const counterparts = allRecords.filter(
    (r) =>
      r.id !== currentRecordId &&
      r.payments.some((p) => p.offsetGroupId === offsetGroupId),
  )

  return (
    <Popover>
      <PopoverTrigger>
        <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-secondary/80">
          <Link className="h-3 w-3" />
          Offset
        </Badge>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 p-3">
        <p className="font-medium text-xs mb-2">Offset counterparts</p>
        {counterparts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No counterpart records found (may be filtered out)</p>
        ) : (
          <div className="space-y-1.5">
            {counterparts.map((r) => {
              const offsetPayment = r.payments.find((p) => p.offsetGroupId === offsetGroupId)
              return (
                <div key={r.id} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.personName}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1 py-0',
                        r.type === 'DEBT'
                          ? 'border-red-500 text-red-600'
                          : 'border-green-500 text-green-600',
                      )}
                    >
                      {r.type === 'DEBT' ? 'Debt' : 'Loan'}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {formatCurrency(r.amount, r.currency)} total
                    {offsetPayment && ` · ${formatCurrency(offsetPayment.amount, r.currency)} offset`}
                  </div>
                  {r.description && (
                    <div className="text-muted-foreground truncate">{r.description}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// --- Payment Row ---

interface PaymentRowProps {
  payment: PaymentResponse
  currency: Currency
  recordId: string
  allRecords: DebtRecordResponse[]
  onRemove: (recordId: string, paymentId: string) => void
  removeLoading: boolean
}

function PaymentRow({ payment, currency, recordId, allRecords, onRemove, removeLoading }: PaymentRowProps) {
  const isLinked = !!payment.transactionId
  const isOffset = !!payment.offsetGroupId
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
      <div className="flex items-center gap-4">
        <span className="font-medium">
          {formatCurrency(payment.amount, currency)}
        </span>
        <span className="text-muted-foreground">{formatDate(payment.date)}</span>
        {payment.description && !isOffset && (
          <span className="text-muted-foreground">{payment.description}</span>
        )}
        {isLinked && (
          <TransactionInfoPopover transactionId={payment.transactionId!} />
        )}
        {isOffset && (
          <OffsetInfoPopover
            offsetGroupId={payment.offsetGroupId!}
            currentRecordId={recordId}
            allRecords={allRecords}
          />
        )}
      </div>
      {isLinked ? (
        <span className="text-xs text-muted-foreground">Via transaction</span>
      ) : isOffset ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onRemove(recordId, payment.id)}
          disabled={removeLoading}
          title="Remove this offset (removes all paired payments)"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onRemove(recordId, payment.id)}
          disabled={removeLoading}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

// --- Record Row ---

interface RecordRowProps {
  record: DebtRecordResponse
  allRecords: DebtRecordResponse[]
  expanded: boolean
  onToggleExpand: () => void
  onEdit: (record: DebtRecordResponse) => void
  onDelete: (record: DebtRecordResponse) => void
  onAddPayment: (record: DebtRecordResponse) => void
  onToggleStatus: (id: string) => void
  onRemovePayment: (recordId: string, paymentId: string) => void
  onReconcile: (record: DebtRecordResponse) => void
  toggleStatusLoading: boolean
  removePaymentLoading: boolean
}

function RecordRow({
  record,
  allRecords,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddPayment,
  onToggleStatus,
  onRemovePayment,
  onReconcile,
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
          {record.sourceTransactionId && (
            <span onClick={(e) => e.stopPropagation()}>
              <TransactionInfoPopover transactionId={record.sourceTransactionId} />
            </span>
          )}
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
          {record.tagNames?.map((name) => (
            <Badge key={name} variant="outline" className="text-xs">
              {name}
            </Badge>
          ))}
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
            {!record.sourceTransactionId && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onAddPayment(record)
                }}
              >
                Add Payment
              </DropdownMenuItem>
            )}
            {record.status === 'OPEN' && record.remainingAmount > 0 && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onReconcile(record)
                }}
              >
                <Scale className="mr-2 h-4 w-4" />
                Reconcile
              </DropdownMenuItem>
            )}
            {record.sourceTransactionId ? (
              <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                Edit via transaction
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(record)
                }}
              >
                Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onToggleStatus(record.id)
              }}
              disabled={toggleStatusLoading}
            >
              {record.status === 'OPEN' ? 'Close' : 'Reopen'}
            </DropdownMenuItem>
            {!record.sourceTransactionId && (
              <>
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
              </>
            )}
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
              allRecords={allRecords}
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
  const { data: tags } = useTags()
  const { data: settings } = useSettings()
  const defaultCurrency = settings?.displayCurrency ?? 'UAH'
  const lastEnteredDate = useDatePreferenceStore((s) => s.lastEnteredDate)
  const setLastEnteredDate = useDatePreferenceStore((s) => s.setLastEnteredDate)
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
  const { data: allRecordsData } = useDebtRecords()
  const allRecords = allRecordsData ?? []
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
    isOffset: boolean
  } | null>(null)
  const [reconcileRecord, setReconcileRecord] = useState<DebtRecordResponse | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const hasActiveFilters = personId !== '' || type !== 'ALL' || status !== 'ALL' || search !== ''

  const createForm = useForm<CreateRecordForm>({
    resolver: zodResolver(createRecordSchema),
    defaultValues: {
      personId: '',
      type: 'DEBT',
      amount: 0,
      currency: defaultCurrency,
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
          setLastEnteredDate(data.date)
          setCreateOpen(false)
          createForm.reset({
            personId: '', type: 'DEBT', amount: 0, currency: defaultCurrency,
            categoryId: '', tagIds: [], description: '', date: new Date().toISOString().slice(0, 10),
          })
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
          setLastEnteredDate(data.date)
          setPaymentRecord(null)
          paymentForm.reset({ amount: 0, date: new Date().toISOString().slice(0, 10), description: '' })
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
    const record = filteredRecords.find((r) => r.id === recordId)
    const payment = record?.payments.find((p) => p.id === paymentId)
    setRemovePaymentTarget({ recordId, paymentId, isOffset: !!payment?.offsetGroupId })
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
          onValueChange={(v) => setDebts({ personId: v === 'ALL' ? '' : (v ?? '') })}
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
              allRecords={allRecords}
              expanded={expandedIds.has(record.id)}
              onToggleExpand={() => toggleExpand(record.id)}
              onEdit={openEdit}
              onDelete={setDeleteRecord}
              onAddPayment={openAddPayment}
              onToggleStatus={(id) => toggleStatusMutation.mutate(id)}
              onRemovePayment={handleRemovePayment}
              onReconcile={setReconcileRecord}
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
                onValueChange={(v) => createForm.setValue('personId', v ?? '')}
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
              <CategorySelect
                categories={categories}
                value={createForm.watch('categoryId') ?? ''}
                onChange={(id) => createForm.setValue('categoryId', id)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags (optional)</Label>
              <TagMultiSelect
                tags={tags}
                value={createForm.watch('tagIds') ?? []}
                onChange={(ids) => createForm.setValue('tagIds', ids)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input {...createForm.register('description')} />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  {...createForm.register('date')}
                  aria-invalid={!!createForm.formState.errors.date}
                  className={cn(
                    'flex-1',
                    createForm.formState.errors.date && 'border-destructive',
                  )}
                />
                {lastEnteredDate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => createForm.setValue('date', lastEnteredDate)}
                  >
                    Last: {formatDate(lastEnteredDate)}
                  </Button>
                )}
              </div>
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
          {editRecord?.sourceTransactionId && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              This record was created from a transaction. Changes here won't update the linked transaction.
            </div>
          )}
          <form
            onSubmit={editForm.handleSubmit(handleEdit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Person</Label>
              <Select
                value={editForm.watch('personId')}
                onValueChange={(v) => editForm.setValue('personId', v ?? '')}
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
              <CategorySelect
                categories={categories}
                value={editForm.watch('categoryId') ?? ''}
                onChange={(id) => editForm.setValue('categoryId', id)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags (optional)</Label>
              <TagMultiSelect
                tags={tags}
                value={editForm.watch('tagIds') ?? []}
                onChange={(ids) => editForm.setValue('tagIds', ids)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input {...editForm.register('description')} />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  {...editForm.register('date')}
                  aria-invalid={!!editForm.formState.errors.date}
                  className={cn(
                    'flex-1',
                    editForm.formState.errors.date && 'border-destructive',
                  )}
                />
                {lastEnteredDate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => editForm.setValue('date', lastEnteredDate)}
                  >
                    Last: {formatDate(lastEnteredDate)}
                  </Button>
                )}
              </div>
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
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  {...paymentForm.register('date')}
                  aria-invalid={!!paymentForm.formState.errors.date}
                  className={cn(
                    'flex-1',
                    paymentForm.formState.errors.date && 'border-destructive',
                  )}
                />
                {lastEnteredDate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => paymentForm.setValue('date', lastEnteredDate)}
                  >
                    Last: {formatDate(lastEnteredDate)}
                  </Button>
                )}
              </div>
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

      {/* Reconcile Dialog */}
      <ReconcileDialog
        source={reconcileRecord}
        allRecords={allRecords}
        onClose={() => setReconcileRecord(null)}
      />

      {/* Remove Payment Confirmation */}
      <ConfirmDialog
        open={!!removePaymentTarget}
        onOpenChange={(open) => !open && setRemovePaymentTarget(null)}
        title={removePaymentTarget?.isOffset ? 'Remove Offset' : 'Remove Payment'}
        description={
          removePaymentTarget?.isOffset
            ? 'Remove this offset? All paired offset payments on both sides will be removed and covered amounts recalculated.'
            : 'Remove this payment? The covered amount will be recalculated.'
        }
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
