import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/api/use-categories'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { MoreHorizontal, Plus } from 'lucide-react'
import type { CategoryResponse } from '@/types/category'
import type { CategoryType } from '@/types/common'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['INCOME', 'EXPENSE']),
})

const editSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

type CreateForm = z.infer<typeof createSchema>
type EditForm = z.infer<typeof editSchema>

export function CategoriesPage() {
  const { data: categories, isLoading } = useCategories()
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()

  const [createOpen, setCreateOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<CategoryResponse | null>(
    null,
  )
  const [deleteCategory, setDeleteCategory] =
    useState<CategoryResponse | null>(null)

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', type: 'EXPENSE' },
  })

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  })

  const incomeCategories =
    categories?.filter((c) => c.type === 'INCOME') ?? []
  const expenseCategories =
    categories?.filter((c) => c.type === 'EXPENSE') ?? []

  function handleCreate(data: CreateForm) {
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

  function handleEdit(data: EditForm) {
    if (!editCategory) return
    updateMutation.mutate(
      { id: editCategory.id, data: { name: data.name, icon: null } },
      {
        onSuccess: () => setEditCategory(null),
      },
    )
  }

  function openEdit(category: CategoryResponse) {
    editForm.reset({ name: category.name })
    setEditCategory(category)
  }

  function renderList(items: CategoryResponse[]) {
    if (items.length === 0) {
      return (
        <p className="py-8 text-center text-muted-foreground">
          No categories yet
        </p>
      )
    }
    return (
      <div className="space-y-1">
        {items.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-between rounded-md border px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">{cat.name}</span>
              <Badge variant="secondary">{cat.type}</Badge>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
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
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Categories">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Category
        </Button>
      </PageHeader>

      <Tabs defaultValue="expense">
        <TabsList>
          <TabsTrigger value="expense">
            Expense ({expenseCategories.length})
          </TabsTrigger>
          <TabsTrigger value="income">
            Income ({incomeCategories.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="expense" className="mt-4">
          {renderList(expenseCategories)}
        </TabsContent>
        <TabsContent value="income" className="mt-4">
          {renderList(incomeCategories)}
        </TabsContent>
      </Tabs>

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
              <Input {...createForm.register('name')} />
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
    </div>
  )
}
