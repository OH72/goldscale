import { useState } from 'react'
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
import { MoreHorizontal, Plus } from 'lucide-react'
import { formatCurrency, toSubunits } from '@/lib/currency'
import type { AccountResponse } from '@/types/account'
import type { Currency } from '@/types/common'

const CURRENCIES: Currency[] = ['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'JPY']

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  currency: z.enum(['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'JPY']),
  initialBalance: z.coerce.number().min(0, 'Balance must be >= 0'),
})

const editSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

type CreateForm = z.infer<typeof createSchema>
type EditForm = z.infer<typeof editSchema>

export function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts()
  const createMutation = useCreateAccount()
  const updateMutation = useUpdateAccount()
  const deleteMutation = useDeleteAccount()

  const [createOpen, setCreateOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AccountResponse | null>(null)
  const [deleteAccount, setDeleteAccount] = useState<AccountResponse | null>(
    null,
  )

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', currency: 'UAH', initialBalance: 0 },
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
      { id: editAccount.id, data: { name: data.name } },
      {
        onSuccess: () => setEditAccount(null),
      },
    )
  }

  function openEdit(account: AccountResponse) {
    editForm.reset({ name: account.name })
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts?.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium">{account.name}</TableCell>
              <TableCell>{account.currency}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(account.balance, account.currency)}
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
          {accounts?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
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
              <Input {...createForm.register('name')} />
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
              />
              {createForm.formState.errors.initialBalance && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.initialBalance.message}
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
              <Input {...editForm.register('name')} />
              {editForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {editForm.formState.errors.name.message}
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
