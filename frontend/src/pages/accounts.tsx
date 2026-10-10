import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
} from '@/api/use-accounts'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Plus, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from '@/api/use-settings'
import { formatCurrency, toSubunits } from '@/lib/currency'
import type { AccountResponse } from '@/types/account'
import type { Currency } from '@/types/common'
import { useFilterStore } from '@/stores/filter-store'

const CURRENCIES: Currency[] = ['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'USDT']

const ACCOUNT_COLORS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#78716c', label: 'Stone' },
  { value: '#1e293b', label: 'Slate' },
]

type SortField = 'name' | 'balance' | 'converted'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  currency: z.enum(['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'USDT']),
  initialBalance: z.coerce.number().min(0, 'Balance must be >= 0'),
  color: z.string().nullable(),
})

const editSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  currency: z.enum(['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'USDT']),
  active: z.boolean(),
  color: z.string().nullable(),
})

type CreateForm = z.infer<typeof createSchema>
type EditForm = z.infer<typeof editSchema>

interface SortableHeadProps {
  field: SortField
  label: string
  className?: string
  sortField: SortField | null
  sortDir: 'asc' | 'desc'
  onSort: (field: SortField) => void
}

function SortableHead({ field, label, className, sortField, sortDir, onSort }: SortableHeadProps) {
  return (
    <TableHead className={className}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort(field)}>
        {label}
        {sortField === field ? (
          sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

export function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts()
  const { data: settings } = useSettings()
  const displayCurrency = settings?.displayCurrency
  const createMutation = useCreateAccount()
  const updateMutation = useUpdateAccount()
  const deleteMutation = useDeleteAccount()

  const [createOpen, setCreateOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AccountResponse | null>(null)
  const [deleteAccount, setDeleteAccount] = useState<AccountResponse | null>(
    null,
  )
  const { currencyFilter, sortField, sortDir } = useFilterStore((s) => s.accounts)
  const setAccounts = useFilterStore((s) => s.setAccounts)
  const resetAccounts = useFilterStore((s) => s.resetAccounts)
  const hasActiveFilters = currencyFilter !== '' || sortField !== 'name' || sortDir !== 'asc'

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setAccounts({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      setAccounts({ sortField: field, sortDir: field === 'name' ? 'asc' : 'desc' })
    }
  }

  const filteredAccounts = useMemo(() => {
    let list = accounts ?? []
    if (currencyFilter) {
      list = list.filter((a) => a.currency === currencyFilter)
    }
    if (sortField) {
      const dir = sortDir === 'asc' ? 1 : -1
      list = [...list].sort((a, b) => {
        if (sortField === 'name') return a.name.localeCompare(b.name) * dir
        if (sortField === 'converted') {
          const x = a.balanceInDisplayCurrency
          const y = b.balanceInDisplayCurrency
          // null (no exchange rate) always sorts last, in both directions
          if (x === null && y === null) return 0
          if (x === null) return 1
          if (y === null) return -1
          return (x - y) * dir
        }
        return (a.balance - b.balance) * dir
      })
    }
    return list
  }, [accounts, currencyFilter, sortField, sortDir])

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', currency: 'UAH', initialBalance: 0, color: null },
  })

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  })

  function handleCreate(data: CreateForm) {
    createMutation.mutate(
      {
        name: data.name,
        currency: data.currency,
        initialBalance: toSubunits(data.initialBalance),
        color: data.color,
      },
      {
        onSuccess: () => {
          setCreateOpen(false)
          createForm.reset()
        },
      },
    )
  }

  function handleEdit(data: EditForm) {
    if (!editAccount) return
    updateMutation.mutate(
      { id: editAccount.id, data: { name: data.name, currency: data.currency, active: data.active, color: data.color } },
      {
        onSuccess: () => setEditAccount(null),
      },
    )
  }

  function openEdit(account: AccountResponse) {
    editForm.reset({ name: account.name, currency: account.currency, active: account.active, color: account.color })
    setEditAccount(account)
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Accounts">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Account
        </Button>
      </PageHeader>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Currency</Label>
          <Select
            value={currencyFilter || 'ALL'}
            onValueChange={(v) => setAccounts({ currencyFilter: v === 'ALL' ? '' : (v as Currency) })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetAccounts}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead field="name" label="Name" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
            <TableHead className="w-16">Active</TableHead>
            <TableHead>Currency</TableHead>
            <SortableHead field="balance" label="Balance" className="text-right" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
            <SortableHead
              field="converted"
              label={displayCurrency ? `Balance in ${displayCurrency}` : 'Balance (display)'}
              className="text-right"
              sortField={sortField}
              sortDir={sortDir}
              onSort={toggleSort}
            />
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAccounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className={cn('font-medium', !account.active && 'text-muted-foreground')}>
                <span className="inline-flex items-center gap-2">
                  {account.color && (
                    <span
                      className="inline-block h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: account.color }}
                    />
                  )}
                  {account.name}
                </span>
              </TableCell>
              <TableCell>
                <Checkbox
                  checked={account.active}
                  onCheckedChange={(checked) => {
                    updateMutation.mutate({
                      id: account.id,
                      data: { name: account.name, currency: account.currency, active: !!checked, color: account.color },
                    })
                  }}
                />
              </TableCell>
              <TableCell>{account.currency}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(account.balance, account.currency)}
              </TableCell>
              <TableCell className="text-right">
                {displayCurrency && account.balanceInDisplayCurrency !== null ? (
                  formatCurrency(account.balanceInDisplayCurrency, displayCurrency)
                ) : (
                  <span
                    className="text-muted-foreground"
                    title={displayCurrency ? 'No exchange rate' : undefined}
                  >
                    -
                  </span>
                )}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(account)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteAccount(account)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {filteredAccounts.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No accounts yet
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Account</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit(handleCreate)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                {...createForm.register('name')}
                aria-invalid={!!createForm.formState.errors.name}
                className={cn(createForm.formState.errors.name && 'border-destructive')}
              />
              {createForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.name.message}
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
            <div className="space-y-2">
              <Label>Initial Balance</Label>
              <Input
                type="number"
                step="0.01"
                {...createForm.register('initialBalance')}
                aria-invalid={!!createForm.formState.errors.initialBalance}
                className={cn(createForm.formState.errors.initialBalance && 'border-destructive')}
              />
              {createForm.formState.errors.initialBalance && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.initialBalance.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {ACCOUNT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                      createForm.watch('color') === c.value ? 'border-foreground scale-110' : 'border-transparent',
                    )}
                    style={{ backgroundColor: c.value }}
                    onClick={() =>
                      createForm.setValue('color', createForm.watch('color') === c.value ? null : c.value)
                    }
                  />
                ))}
              </div>
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

      {/* Edit Dialog */}
      <Dialog
        open={!!editAccount}
        onOpenChange={(open) => !open && setEditAccount(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit(handleEdit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                {...editForm.register('name')}
                aria-invalid={!!editForm.formState.errors.name}
                className={cn(editForm.formState.errors.name && 'border-destructive')}
              />
              {editForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {editForm.formState.errors.name.message}
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-active"
                checked={editForm.watch('active')}
                onCheckedChange={(checked) =>
                  editForm.setValue('active', !!checked)
                }
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {ACCOUNT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                      editForm.watch('color') === c.value ? 'border-foreground scale-110' : 'border-transparent',
                    )}
                    style={{ backgroundColor: c.value }}
                    onClick={() =>
                      editForm.setValue('color', editForm.watch('color') === c.value ? null : c.value)
                    }
                  />
                ))}
              </div>
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteAccount}
        onOpenChange={(open) => !open && setDeleteAccount(null)}
        title="Delete Account"
        description={`Delete "${deleteAccount?.name}"? All related transactions will be removed.`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteAccount) {
            deleteMutation.mutate(deleteAccount.id, {
              onSuccess: () => setDeleteAccount(null),
            })
          }
        }}
      />
    </div>
  )
}
