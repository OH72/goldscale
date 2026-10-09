import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDebtSummary } from '@/api/use-debt-records'
import {
  usePeople,
  useCreatePerson,
  useUpdatePerson,
  useDeletePerson,
  useOffsetPreview,
  useOffsetPerson,
} from '@/api/use-people'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { ArrowDown, ArrowUp, ArrowLeftRight, MoreHorizontal, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import type {
  OffsetAllocation,
  PersonResponse,
  PersonSortField,
  SortDirection,
} from '@/types/debt'

const personSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

type PersonForm = z.infer<typeof personSchema>

interface SortHeaderProps {
  label: string
  field: PersonSortField
  sortBy: PersonSortField
  direction: SortDirection
  onSort: (field: PersonSortField) => void
  className?: string
}

function SortHeader({ label, field, sortBy, direction, onSort, className }: SortHeaderProps) {
  const active = sortBy === field
  return (
    <button
      type="button"
      className={cn('flex items-center gap-1 hover:text-foreground', active && 'text-foreground', className)}
      onClick={() => onSort(field)}
    >
      {label}
      {active && (direction === 'ASC' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  )
}

function AllocationList({
  title,
  allocations,
  currency,
}: {
  title: string
  allocations: OffsetAllocation[]
  currency: string
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-1">
        {allocations.map((a) => (
          <div
            key={a.recordId}
            className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-1.5 text-sm"
          >
            <span className="min-w-0 truncate">
              {formatDate(a.date)}
              {a.description ? ` · ${a.description}` : ''}
            </span>
            <span className="shrink-0 text-right">
              <span className="font-medium">−{formatCurrency(a.amount, currency)}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {formatCurrency(a.remainingBefore, currency)} →{' '}
                {a.remainingAfter === 0 ? 'closed' : formatCurrency(a.remainingAfter, currency)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PeoplePage() {
  const [sortBy, setSortBy] = useState<PersonSortField>('NAME')
  const [direction, setDirection] = useState<SortDirection>('ASC')
  const { data: people, isLoading } = usePeople(sortBy, direction)
  const { data: debtSummary } = useDebtSummary()
  const displayCurrency = debtSummary?.displayCurrency ?? ''

  function toggleSort(field: PersonSortField) {
    if (field === sortBy) {
      setDirection((d) => (d === 'ASC' ? 'DESC' : 'ASC'))
    } else {
      setSortBy(field)
      setDirection(field === 'NAME' ? 'ASC' : 'DESC')
    }
  }

  const createMutation = useCreatePerson()
  const updateMutation = useUpdatePerson()
  const deleteMutation = useDeletePerson()

  const [createOpen, setCreateOpen] = useState(false)
  const [editPerson, setEditPerson] = useState<PersonResponse | null>(null)
  const [deletePerson, setDeletePerson] = useState<PersonResponse | null>(null)
  const [offsetPersonTarget, setOffsetPersonTarget] = useState<PersonResponse | null>(null)
  const offsetPreview = useOffsetPreview(offsetPersonTarget?.id ?? null)
  const offsetMutation = useOffsetPerson()

  const createForm = useForm<PersonForm>({
    resolver: zodResolver(personSchema),
    defaultValues: { name: '' },
  })

  const editForm = useForm<PersonForm>({
    resolver: zodResolver(personSchema),
  })

  function handleCreate(data: PersonForm) {
    createMutation.mutate(
      { name: data.name },
      {
        onSuccess: () => {
          setCreateOpen(false)
          createForm.reset()
        },
      },
    )
  }

  function handleEdit(data: PersonForm) {
    if (!editPerson) return
    updateMutation.mutate(
      { id: editPerson.id, data: { name: data.name } },
      {
        onSuccess: () => setEditPerson(null),
      },
    )
  }

  function openEdit(person: PersonResponse) {
    editForm.reset({ name: person.name })
    setEditPerson(person)
  }

  const sorted = people ?? []

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="People">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Person
        </Button>
      </PageHeader>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No people yet</p>
      ) : (
        <div className="space-y-1">
          <div className="hidden grid-cols-[1fr_8rem_8rem_8rem_9rem] gap-4 px-4 text-xs font-medium text-muted-foreground sm:grid">
            <SortHeader label="Name" field="NAME" sortBy={sortBy} direction={direction} onSort={toggleSort} />
            <SortHeader label="I owe" field="TOTAL_DEBT" sortBy={sortBy} direction={direction} onSort={toggleSort} className="justify-end" />
            <SortHeader label="They owe" field="TOTAL_LOAN" sortBy={sortBy} direction={direction} onSort={toggleSort} className="justify-end" />
            <SortHeader label="Net" field="NET" sortBy={sortBy} direction={direction} onSort={toggleSort} className="justify-end" />
            <span />
          </div>
          {sorted.map((person) => {
            const { totalDebt, totalLoan, net } = person
            return (
              <div
                key={person.id}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-md border px-4 py-3 sm:grid-cols-[1fr_8rem_8rem_8rem_9rem]"
              >
                <span className="font-medium">{person.name}</span>
                <span
                  className={cn(
                    'hidden text-right text-sm sm:block',
                    totalDebt > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground',
                  )}
                >
                  {totalDebt > 0 ? formatCurrency(totalDebt, displayCurrency) : '—'}
                </span>
                <span
                  className={cn(
                    'hidden text-right text-sm sm:block',
                    totalLoan > 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-muted-foreground',
                  )}
                >
                  {totalLoan > 0 ? formatCurrency(totalLoan, displayCurrency) : '—'}
                </span>
                <span
                  className={cn(
                    'hidden text-right text-sm font-medium sm:block',
                    net > 0
                      ? 'text-green-600 dark:text-green-400'
                      : net < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground',
                  )}
                >
                  {net === 0
                    ? '—'
                    : `${net > 0 ? '+' : ''}${formatCurrency(net, displayCurrency)}`}
                </span>
                <div className="flex items-center justify-end gap-1">
                {person.canOffset && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffsetPersonTarget(person)}
                  >
                    <ArrowLeftRight className="mr-1 h-3.5 w-3.5" /> Offset
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(person)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeletePerson(person)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Person</DialogTitle>
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
        open={!!editPerson}
        onOpenChange={(open) => !open && setEditPerson(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Person</DialogTitle>
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

      {/* Offset Dialog */}
      <Dialog
        open={!!offsetPersonTarget}
        onOpenChange={(open) => !open && setOffsetPersonTarget(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Offset debts and loans: {offsetPersonTarget?.name}</DialogTitle>
          </DialogHeader>
          {offsetPreview.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {offsetPreview.data && offsetPreview.data.currencies.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing to offset anymore.</p>
          )}
          {offsetPreview.data?.currencies.map((entry) => (
            <div key={entry.currency} className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">
                {formatCurrency(entry.amount, entry.currency)} will be offset
              </p>
              <AllocationList
                title="I owe (debts)"
                allocations={entry.debts}
                currency={entry.currency}
              />
              <AllocationList
                title="They owe (loans)"
                allocations={entry.loans}
                currency={entry.currency}
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Oldest records are covered first. A payment is added to each record, and
            fully covered records are closed. Amounts in different currencies are not offset.
          </p>
          <Button
            className="w-full"
            disabled={
              offsetMutation.isPending ||
              !offsetPreview.data ||
              offsetPreview.data.currencies.length === 0
            }
            onClick={() => {
              if (offsetPersonTarget) {
                offsetMutation.mutate(offsetPersonTarget.id, {
                  onSuccess: () => setOffsetPersonTarget(null),
                })
              }
            }}
          >
            {offsetMutation.isPending ? 'Offsetting...' : 'Confirm offset'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletePerson}
        onOpenChange={(open) => !open && setDeletePerson(null)}
        title="Delete Person"
        description={`Delete "${deletePerson?.name}"? This will fail if they have open records.`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletePerson) {
            deleteMutation.mutate(deletePerson.id, {
              onSuccess: () => setDeletePerson(null),
            })
          }
        }}
      />
    </div>
  )
}
