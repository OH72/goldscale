import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTags, useCreateTag, useUpdateTag, useMergeTag, useDeleteTag } from '@/api/use-tags'
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
import { Merge, MoreHorizontal, Plus, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/stores/filter-store'
import type { TagResponse } from '@/api/use-tags'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

type CreateForm = z.infer<typeof createSchema>

export function TagsPage() {
  const { data: tags, isLoading } = useTags()
  const createMutation = useCreateTag()
  const updateMutation = useUpdateTag()
  const mergeMutation = useMergeTag()
  const deleteMutation = useDeleteTag()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTag, setEditTag] = useState<TagResponse | null>(null)
  const [mergeTag, setMergeTag] = useState<TagResponse | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [mergeSearch, setMergeSearch] = useState('')
  const [deleteTag, setDeleteTag] = useState<TagResponse | null>(null)
  const { search } = useFilterStore((s) => s.tags)
  const setTags = useFilterStore((s) => s.setTags)
  const resetTags = useFilterStore((s) => s.resetTags)

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '' },
  })

  const editForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
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

  function handleEdit(data: CreateForm) {
    if (!editTag) return
    updateMutation.mutate(
      { id: editTag.id, data: { name: data.name } },
      { onSuccess: () => setEditTag(null) },
    )
  }

  function openEdit(tag: TagResponse) {
    editForm.reset({ name: tag.name })
    setEditTag(tag)
  }

  const sorted = useMemo(() => {
    let list = tags?.slice().sort((a, b) => a.name.localeCompare(b.name)) ?? []
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.name.toLowerCase().includes(q))
    }
    return list
  }, [tags, search])

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Tags">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Tag
        </Button>
      </PageHeader>

      <div className="mb-4 flex items-center gap-3">
        <Input
          placeholder="Search tags..."
          value={search}
          onChange={(e) => setTags({ search: e.target.value })}
          className="max-w-xs"
        />
        {search && (
          <Button variant="ghost" size="sm" onClick={resetTags}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>

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
                  <DropdownMenuItem onClick={() => openEdit(tag)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setMergeTag(tag); setMergeTargetId(''); setMergeSearch('') }}>
                    <Merge className="mr-2 h-4 w-4" /> Merge into...
                  </DropdownMenuItem>
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

      {/* Edit Dialog */}
      <Dialog open={!!editTag} onOpenChange={(open) => !open && setEditTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
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

      {/* Merge Dialog */}
      <Dialog open={!!mergeTag} onOpenChange={(open) => !open && setMergeTag(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge "{mergeTag?.name}" into...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search tags..."
              value={mergeSearch}
              onChange={(e) => setMergeSearch(e.target.value)}
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {tags
                ?.filter((t) => t.id !== mergeTag?.id)
                .filter((t) => !mergeSearch || t.name.toLowerCase().includes(mergeSearch.toLowerCase()))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center rounded-md border px-3 py-2 text-left text-sm hover:bg-accent',
                      mergeTargetId === t.id && 'border-primary bg-accent',
                    )}
                    onClick={() => setMergeTargetId(t.id)}
                  >
                    <Badge variant="outline">{t.name}</Badge>
                  </button>
                ))}
            </div>
            <Button
              className="w-full"
              disabled={!mergeTargetId || mergeMutation.isPending}
              onClick={() => {
                if (mergeTag && mergeTargetId) {
                  mergeMutation.mutate(
                    { sourceId: mergeTag.id, targetId: mergeTargetId },
                    { onSuccess: () => setMergeTag(null) },
                  )
                }
              }}
            >
              {mergeMutation.isPending ? 'Merging...' : 'Merge'}
            </Button>
          </div>
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
