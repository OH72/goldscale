import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTags, useCreateTag, useDeleteTag } from '@/api/use-tags'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import type { TagResponse } from '@/api/use-tags'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

type CreateForm = z.infer<typeof createSchema>

export function TagsPage() {
  const { data: tags, isLoading } = useTags()
  const createMutation = useCreateTag()
  const deleteMutation = useDeleteTag()

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTag, setDeleteTag] = useState<TagResponse | null>(null)

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '' },
  })

  function handleCreate(data: CreateForm) {
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

  const sorted = tags?.slice().sort((a, b) => a.name.localeCompare(b.name)) ?? []

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Tags">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Tag
        </Button>
      </PageHeader>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No tags yet</p>
      ) : (
        <div className="space-y-1">
          {sorted.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between rounded-md border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline">{tag.name}</Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteTag(tag)}
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
            <DialogTitle>New Tag</DialogTitle>
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTag}
        onOpenChange={(open) => !open && setDeleteTag(null)}
        title="Delete Tag"
        description={`Delete "${deleteTag?.name}"?`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTag) {
            deleteMutation.mutate(deleteTag.id, {
              onSuccess: () => setDeleteTag(null),
            })
          }
        }}
      />
    </div>
  )
}
