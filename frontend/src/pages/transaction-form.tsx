import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useAccounts } from '@/api/use-accounts'
import { useCategories } from '@/api/use-categories'
import {
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toSubunits, fromSubunits } from '@/lib/currency'
import { toISODate } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { TransactionResponse } from '@/types/transaction'
import type { TransactionType } from '@/types/common'

const formSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
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
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  editTransaction,
}: TransactionFormDialogProps) {
  const isEdit = !!editTransaction
  const [txnType, setTxnType] = useState<TransactionType>(
    editTransaction?.type ?? 'EXPENSE',
  )

  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction()

  const filteredCategories = categories?.filter((c) =>
    txnType === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE',
  )

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
      form.reset({
        amount: 0,
        accountId: accounts?.[0]?.id ?? '',
        description: '',
        date: new Date(),
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTransaction, open, accounts])

  function handleSubmit(values: FormValues) {
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
            {isEdit ? 'Edit Transaction' : 'New Transaction'}
          </DialogTitle>
        </DialogHeader>

        {!isEdit && (
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
          <div className="space-y-2">
            <Label>
              {txnType === 'TRANSFER' ? 'Source Account' : 'Account'}
            </Label>
            <Select
              value={form.watch('accountId')}
              onValueChange={(v) => form.setValue('accountId', v)}
              disabled={isEdit}
            >
              <SelectTrigger aria-invalid={!!form.formState.errors.accountId}>
                <SelectValue placeholder="Select account">
                  {(v: string) => {
                    const a = accounts?.find((acc) => acc.id === v)
                    return a ? `${a.name} (${a.currency})` : 'Select account'
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Account (transfer only) */}
          {txnType === 'TRANSFER' && !isEdit && (
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
                      return a ? `${a.name} (${a.currency})` : 'Select target'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    ?.filter((a) => a.id !== form.watch('accountId'))
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.currency})
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
          {txnType === 'TRANSFER' && (isCrossCurrency || isEdit) && (
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
          {txnType !== 'TRANSFER' && txnType !== 'INITIAL_BALANCE' && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.watch('categoryId') ?? ''}
                onValueChange={(v) => form.setValue('categoryId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category">
                    {(v: string) => {
                      const c = filteredCategories?.find((cat) => cat.id === v)
                      return c ? c.name : 'Select category'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  selected={form.watch('date')}
                  onSelect={(d) => d && form.setValue('date', d)}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Input {...form.register('description')} />
          </div>

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
