import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useBulkDeleteCategories,
} from '@/api/use-categories'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { MoreHorizontal, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CategoryResponse } from '@/types/category'
import type { CategoryType } from '@/types/common'
import { useFilterStore } from '@/stores/filter-store'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['INCOME', 'EXPENSE', 'BOTH']),
})

type CategoryForm = z.infer<typeof categorySchema>

const TYPE_LABELS: Record<CategoryType, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
  BOTH: 'Both',
}

const TYPE_COLORS: Record<CategoryType, string> = {
  INCOME: 'border-green-500 text-green-600',
  EXPENSE: 'border-red-500 text-red-600',
  BOTH: 'border-blue-500 text-blue-600',
}

export function CategoriesPage() {
  const { data: categories, isLoading } = useCategories()
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()
  const bulkDeleteMutation = useBulkDeleteCategories()

  const [createOpen, setCreateOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<CategoryResponse | null>(
    null,
  )
  const [deleteCategory, setDeleteCategory] =
    useState<CategoryResponse | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const { typeFilter, search } = useFilterStore((s) => s.categories)
  const setCategories = useFilterStore((s) => s.setCategories)
  const resetCategories = useFilterStore((s) => s.resetCategories)
  const hasActiveFilters = typeFilter !== 'ALL' || search !== ''

  const createForm = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', type: 'EXPENSE' },
  })

  const editForm = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
  })

  const sortedCategories = [...(categories ?? [])]
    .filter((c) => typeFilter === 'ALL' || c.type === typeFilter)
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  function handleCreate(data: CategoryForm) {
    createMutation.mutate(
      { name: data.name, type: data.type as CategoryType, icon: null },
      {
        onSuccess: () => {
          setCreateOpen(false)
          createForm.reset()
        },
      },
    )
  }

  function handleEdit(data: CategoryForm) {
    if (!editCategory) return
    updateMutation.mutate(
      {
        id: editCategory.id,
        data: { name: data.name, type: data.type as CategoryType, icon: null },
      },
      {
        onSuccess: () => setEditCategory(null),
      },
    )
  }

  function openEdit(category: CategoryResponse) {
    editForm.reset({ name: category.name, type: category.type })
    setEditCategory(category)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const allSelected = sortedCategories.every((c) => selectedIds.has(c.id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        sortedCategories.forEach((c) => next.delete(c.id))
      } else {
        sortedCategories.forEach((c) => next.add(c.id))
      }
      return next
    })
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  const allSelected =
    sortedCategories.length > 0 &&
    sortedCategories.every((c) => selectedIds.has(c.id))
  const someSelected = sortedCategories.some((c) => selectedIds.has(c.id))

  return (
    <div>
      <PageHeader title="Categories">
        {selectedIds.size > 0 && (
          <Button variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete selected ({selectedIds.size})
          </Button>
        )}
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Category
        </Button>
      </PageHeader>

      <Tabs
        value={typeFilter}
        onValueChange={(v) => {
          setCategories({ typeFilter: v as 'ALL' | CategoryType })
          setSelectedIds(new Set())
        }}
      >
        <TabsList>
          <TabsTrigger value="ALL">
            All ({categories?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="EXPENSE">
            Expense ({categories?.filter((c) => c.type === 'EXPENSE').length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="INCOME">
            Income ({categories?.filter((c) => c.type === 'INCOME').length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="BOTH">
            Both ({categories?.filter((c) => c.type === 'BOTH').length ?? 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 flex items-center gap-2">
        <Input
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setCategories({ search: e.target.value })}
          className="max-w-sm"
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => { resetCategories(); setSelectedIds(new Set()) }}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>

      {sortedCategories.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No categories yet
        </p>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center px-4 py-2">
            <Checkbox
              checked={allSelected}
              data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
              onCheckedChange={() => toggleSelectAll()}
            />
          </div>
          {sortedCategories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded-md border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedIds.has(cat.id)}
                  onCheckedChange={() => toggleSelect(cat.id)}
                />
                <span className="font-medium">{cat.name}</span>
                <Badge variant="outline" className={TYPE_COLORS[cat.type]}>
                  {TYPE_LABELS[cat.type]}
                </Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon" />}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(cat)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteCategory(cat)}
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
            <DialogTitle>New Category</DialogTitle>
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
              <Label>Type</Label>
              <Select
                value={createForm.watch('type')}
                onValueChange={(v) =>
                  createForm.setValue('type', v as CategoryType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="BOTH">Both</SelectItem>
                </SelectContent>
              </Select>
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
        open={!!editCategory}
        onOpenChange={(open) => !open && setEditCategory(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
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
              <Label>Type</Label>
              <Select
                value={editForm.watch('type')}
                onValueChange={(v) =>
                  editForm.setValue('type', v as CategoryType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="BOTH">Both</SelectItem>
                </SelectContent>
              </Select>
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
        open={!!deleteCategory}
        onOpenChange={(open) => !open && setDeleteCategory(null)}
        title="Delete Category"
        description={`Delete "${deleteCategory?.name}"? This will fail if transactions reference it.`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteCategory) {
            deleteMutation.mutate(deleteCategory.id, {
              onSuccess: () => setDeleteCategory(null),
            })
          }
        }}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title="Delete Categories"
        description={`Delete ${selectedIds.size} selected ${selectedIds.size === 1 ? 'category' : 'categories'}? This will fail if any are referenced by transactions.`}
        loading={bulkDeleteMutation.isPending}
        onConfirm={() => {
          bulkDeleteMutation.mutate(Array.from(selectedIds), {
            onSuccess: () => {
              setSelectedIds(new Set())
              setBulkDeleteOpen(false)
            },
          })
        }}
      />
    </div>
  )
}
