import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usePeople, useCreatePerson, useUpdatePerson, useDeletePerson } from '@/api/use-people'
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
import { MoreHorizontal, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PersonResponse } from '@/types/debt'

const personSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

type PersonForm = z.infer<typeof personSchema>

export function PeoplePage() {
  const { data: people, isLoading } = usePeople()
  const createMutation = useCreatePerson()
  const updateMutation = useUpdatePerson()
  const deleteMutation = useDeletePerson()

  const [createOpen, setCreateOpen] = useState(false)
  const [editPerson, setEditPerson] = useState<PersonResponse | null>(null)
  const [deletePerson, setDeletePerson] = useState<PersonResponse | null>(null)

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

  const sorted = people?.slice().sort((a, b) => a.name.localeCompare(b.name)) ?? []

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
          {sorted.map((person) => (
            <div
              key={person.id}
              className="flex items-center justify-between rounded-md border px-4 py-3"
            >
              <span className="font-medium">{person.name}</span>
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
          ))}
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
