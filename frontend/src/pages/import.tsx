import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccounts } from '@/api/use-accounts'
import { useCategories } from '@/api/use-categories'
import { useImportPreview, useImportConfirm } from '@/api/use-import'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fromSubunits, toSubunits } from '@/lib/currency'
import type { ImportRowState, ConfirmRow } from '@/types/import'
import type { CategoryResponse } from '@/types/category'

const NONE_VALUE = '__none__'

export function ImportPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const previewMutation = useImportPreview()
  const confirmMutation = useImportConfirm()

  const [accountId, setAccountId] = useState('')
  const [rows, setRows] = useState<ImportRowState[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [previewMeta, setPreviewMeta] = useState<{
    bankName: string
    detectedCurrency: string
  } | null>(null)

  function autoSelectCategory(
    categoryHint: string | null,
    type: 'INCOME' | 'EXPENSE',
    allCategories: CategoryResponse[],
  ): { categoryId?: string; categoryAutoSelected: boolean } {
    if (!categoryHint) return { categoryAutoSelected: false }
    const match = allCategories.find(
      (c) =>
        c.type === type &&
        c.name.toLowerCase() === categoryHint.toLowerCase(),
    )
    if (match) return { categoryId: match.id, categoryAutoSelected: true }
    return { categoryAutoSelected: false }
  }

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file || !accountId) return

    previewMutation.mutate(
      { file, accountId },
      {
        onSuccess: (data) => {
          setPreviewMeta({
            bankName: data.bankName,
            detectedCurrency: data.detectedCurrency,
          })
          const mapped: ImportRowState[] = data.rows.map((row) => {
            const rowType = row.type as 'INCOME' | 'EXPENSE'
            const cat = autoSelectCategory(
              row.categoryHint,
              rowType,
              categories ?? [],
            )
            return {
              index: row.index,
              type: rowType,
              amount: row.amount,
              date: row.date,
              description: row.description ?? '',
              sourceRef: row.sourceRef,
              ...cat,
            }
          })
          setRows(mapped)
          setSelected(new Set())
        },
      },
    )
  }

  function updateRow(index: number, patch: Partial<ImportRowState>) {
    setRows((prev) =>
      prev.map((r) => (r.index === index ? { ...r, ...patch } : r)),
    )
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((r) => r.index !== index))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
  }

  function removeSelected() {
    setRows((prev) => prev.filter((r) => !selected.has(r.index)))
    setSelected(new Set())
  }

  function toggleSelect(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === rows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rows.map((r) => r.index)))
    }
  }

  function handleConfirm() {
    const confirmRows: ConfirmRow[] = rows.map((r) => ({
      type: r.type,
      amount: r.amount,
      date: r.date,
      description: r.description || null,
      categoryId: r.categoryId ?? null,
      sourceRef: r.sourceRef,
    }))

    confirmMutation.mutate(
      { accountId, rows: confirmRows },
      { onSuccess: () => navigate('/transactions') },
    )
  }

  const totalAmount = useMemo(
    () => rows.reduce((sum, r) => sum + r.amount, 0),
    [rows],
  )

  const allChecked = rows.length > 0 && selected.size === rows.length
  const someChecked = selected.size > 0 && selected.size < rows.length

  const hasPreview = rows.length > 0 || previewMeta

  return (
    <div>
      <PageHeader title="Import Statement" />

      {/* Upload form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload Bank Statement</CardTitle>
          <CardDescription>
            Select a PDF bank statement and target account to import
            transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select account">
                    {(v: string) => {
                      const a = accounts?.find((acc) => acc.id === v)
                      return a
                        ? `${a.name} (${a.currency})`
                        : 'Select account'
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

            <div className="space-y-2">
              <Label>PDF File</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="w-64"
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={!accountId || previewMutation.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              {previewMutation.isPending ? 'Parsing...' : 'Upload & Parse'}
            </Button>
          </div>

          {/* Parse error */}
          {previewMutation.isError && (
            <div className="mt-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {previewMutation.error.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {hasPreview && (
        <>
          {/* Summary bar */}
          {previewMeta && (
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {previewMeta.bankName}
                </span>
              </div>
              <Badge variant="secondary">{previewMeta.detectedCurrency}</Badge>
              <span className="text-sm text-muted-foreground">
                {rows.length} rows
              </span>
              <span className="text-sm text-muted-foreground">
                Total: {fromSubunits(totalAmount).toFixed(2)}{' '}
                {previewMeta.detectedCurrency}
              </span>
            </div>
          )}

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="mb-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={removeSelected}
              >
                <X className="mr-1 h-4 w-4" />
                Remove selected ({selected.size})
              </Button>
            </div>
          )}

          {/* Table */}
          {rows.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <ImportTableRow
                      key={row.index}
                      row={row}
                      isSelected={selected.has(row.index)}
                      onToggleSelect={() => toggleSelect(row.index)}
                      onUpdate={(patch) => updateRow(row.index, patch)}
                      onRemove={() => removeRow(row.index)}
                      categories={categories ?? []}
                    />
                  ))}
                </TableBody>
              </Table>

              {/* Confirm button */}
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleConfirm}
                  disabled={rows.length === 0 || confirmMutation.isPending}
                >
                  {confirmMutation.isPending
                    ? 'Importing...'
                    : `Import ${rows.length} transactions`}
                </Button>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              All rows have been removed
            </div>
          )}
        </>
      )}
    </div>
  )
}

// --- Row component ---

interface ImportTableRowProps {
  row: ImportRowState
  isSelected: boolean
  onToggleSelect: () => void
  onUpdate: (patch: Partial<ImportRowState>) => void
  onRemove: () => void
  categories: CategoryResponse[]
}

function ImportTableRow({
  row,
  isSelected,
  onToggleSelect,
  onUpdate,
  onRemove,
  categories,
}: ImportTableRowProps) {
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === row.type),
    [categories, row.type],
  )

  function handleTypeToggle() {
    const newType = row.type === 'INCOME' ? 'EXPENSE' : 'INCOME'
    onUpdate({ type: newType, categoryId: undefined, categoryAutoSelected: false })
  }

  function handleAmountChange(value: string) {
    const parsed = parseFloat(value)
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdate({ amount: toSubunits(parsed) })
    }
  }

  function handleCategoryChange(value: string) {
    onUpdate({
      categoryId: value === NONE_VALUE ? undefined : value,
      categoryAutoSelected: false,
    })
  }

  return (
    <TableRow>
      <TableCell>
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
      </TableCell>
      <TableCell className="whitespace-nowrap">{row.date}</TableCell>
      <TableCell>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 text-xs font-medium',
            row.type === 'INCOME' && 'border-green-500 text-green-600',
            row.type === 'EXPENSE' && 'border-red-500 text-red-600',
          )}
          onClick={handleTypeToggle}
        >
          {row.type}
        </Button>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          min="0"
          className="h-8 w-28"
          defaultValue={fromSubunits(row.amount).toFixed(2)}
          onBlur={(e) => handleAmountChange(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Input
          className="h-8 w-48"
          value={row.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
        />
      </TableCell>
      <TableCell>
        <Select
          value={row.categoryId ?? NONE_VALUE}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger
            className={cn(
              'h-8 w-44',
              row.categoryAutoSelected && 'border-blue-400',
            )}
          >
            <SelectValue>
              {(v: string) => {
                if (v === NONE_VALUE) return 'No category'
                const c = filteredCategories.find((cat) => cat.id === v)
                return c ? c.name : 'No category'
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>No category</SelectItem>
            {filteredCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}
