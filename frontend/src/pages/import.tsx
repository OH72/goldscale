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
import type { ImportRowState, ConfirmRow, BankType } from '@/types/import'
import { BANK_TYPE_LABELS } from '@/types/import'
import type { CategoryResponse } from '@/types/category'
import type { AccountResponse } from '@/types/account'

const NONE_VALUE = '__none__'

const BANK_TYPES = Object.entries(BANK_TYPE_LABELS) as [BankType, string][]

function isMoneyManager(bankType: BankType) {
  return bankType === 'MONEYMANAGER'
}

export function ImportPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const previewMutation = useImportPreview()
  const confirmMutation = useImportConfirm()

  const [bankType, setBankType] = useState<BankType | ''>('')
  const [accountId, setAccountId] = useState('')
  const [rows, setRows] = useState<ImportRowState[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [previewMeta, setPreviewMeta] = useState<{
    bankName: string
    detectedCurrency: string
  } | null>(null)

  const isMM = bankType === 'MONEYMANAGER'

  function autoSelectCategory(
    categoryHint: string | null,
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'INITIAL_BALANCE',
    allCategories: CategoryResponse[],
  ): { categoryId?: string; categoryAutoSelected: boolean } {
    if (type === 'TRANSFER' || type === 'INITIAL_BALANCE')
      return { categoryAutoSelected: false }
    if (!categoryHint) return { categoryAutoSelected: false }
    const matchType = type === 'INCOME' ? 'INCOME' : 'EXPENSE'
    const match = allCategories.find(
      (c) =>
        (c.type === matchType || c.type === 'BOTH') &&
        c.name.toLowerCase() === categoryHint.toLowerCase(),
    )
    if (match) return { categoryId: match.id, categoryAutoSelected: true }
    return { categoryAutoSelected: false }
  }

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file || !bankType) return
    if (!isMM && !accountId) return

    previewMutation.mutate(
      { file, bankType },
      {
        onSuccess: (data) => {
          setPreviewMeta({
            bankName: data.bankName,
            detectedCurrency: data.detectedCurrency,
          })
          const mapped: ImportRowState[] = data.rows.map((row) => {
            const rowType = row.type as ImportRowState['type']
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
              accountName: row.accountName ?? undefined,
              targetAccountName: row.targetAccountName ?? undefined,
              targetAmount: row.targetAmount ?? undefined,
              currency: row.currency ?? undefined,
              targetCurrency: row.targetCurrency ?? undefined,
              tags: row.tags ?? undefined,
              categoryName: row.categoryHint ?? undefined,
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
    if (!bankType) return

    const confirmRows: ConfirmRow[] = rows.map((r) => {
      const isIncoming = r.type === 'TRANSFER' && r.transferDirection === 'in'
      return {
        type: r.type,
        amount: r.amount,
        date: r.date,
        description: r.description || null,
        categoryId: r.type === 'TRANSFER' || r.type === 'INITIAL_BALANCE' ? null : (r.categoryId ?? null),
        sourceRef: r.sourceRef,
        targetAccountId: r.type === 'TRANSFER'
          ? (isIncoming ? accountId : (r.targetAccountId ?? null))
          : null,
        targetAmount: r.type === 'TRANSFER' ? (r.targetAmount ?? r.amount) : null,
        // For incoming transfers, the other account becomes the source
        accountId: isIncoming ? (r.targetAccountId ?? null) : (r.accountId ?? null),
        accountName: r.accountName ?? null,
        categoryName: r.categoryName ?? null,
        targetAccountName: r.targetAccountName ?? null,
        currency: r.currency ?? null,
        targetCurrency: r.targetCurrency ?? null,
        tags: r.tags ?? null,
      }
    })

    confirmMutation.mutate(
      {
        accountId: isMM ? null : accountId,
        bankType,
        rows: confirmRows,
      },
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

  const canUpload =
    bankType && (isMM || accountId) && !previewMutation.isPending

  return (
    <div>
      <PageHeader title="Import Statement" />

      {/* Upload form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload Bank Statement</CardTitle>
          <CardDescription>
            Select bank type, upload a PDF statement to import transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Bank Type</Label>
              <Select
                value={bankType}
                onValueChange={(v) => setBankType(v as BankType)}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select bank type">
                    {(v: string) =>
                      BANK_TYPE_LABELS[v as BankType] ?? 'Select bank type'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {BANK_TYPES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account selector — only for bank statements, not MoneyManager */}
            {bankType && !isMM && (
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
                    {accounts
                      ?.slice()
                      .sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1))
                      .map((a) => (
                      <SelectItem key={a.id} value={a.id} className={!a.active ? 'text-muted-foreground' : ''}>
                        {a.name} ({a.currency}){!a.active ? ' (inactive)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>PDF File</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="w-64"
              />
            </div>

            <Button onClick={handleUpload} disabled={!canUpload}>
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
              <div className="max-h-[70vh] overflow-auto">
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
                      {isMM && <TableHead>Account</TableHead>}
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category / Target</TableHead>
                      {isMM && <TableHead>Tags</TableHead>}
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
                        sourceAccountId={accountId}
                        accounts={accounts ?? []}
                        isMoneyManager={isMM}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

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
  sourceAccountId: string
  accounts: AccountResponse[]
  isMoneyManager: boolean
}

function ImportTableRow({
  row,
  isSelected,
  onToggleSelect,
  onUpdate,
  onRemove,
  categories,
  sourceAccountId,
  accounts,
  isMoneyManager,
}: ImportTableRowProps) {
  const filteredCategories = useMemo(
    () =>
      categories
        .filter((c) =>
          row.type === 'INCOME'
            ? c.type === 'INCOME' || c.type === 'BOTH'
            : c.type === 'EXPENSE' || c.type === 'BOTH',
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, row.type],
  )

  const targetAccounts = useMemo(
    () => accounts.filter((a) => a.id !== sourceAccountId),
    [accounts, sourceAccountId],
  )

  function handleTypeChange(newType: string) {
    const t = newType as ImportRowState['type']
    onUpdate({
      type: t,
      categoryId: undefined,
      categoryAutoSelected: false,
      targetAccountId: undefined,
      targetAmount: undefined,
      transferDirection: t === 'TRANSFER' ? 'out' : undefined,
    })
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

  function handleTargetAccountChange(value: string) {
    onUpdate({ targetAccountId: value === NONE_VALUE ? undefined : value })
  }

  const sourceAccount = accounts.find((a) => a.id === sourceAccountId)
  const targetAccount = row.targetAccountId
    ? accounts.find((a) => a.id === row.targetAccountId)
    : null
  const isCrossCurrency =
    row.type === 'TRANSFER' &&
    sourceAccount &&
    targetAccount &&
    sourceAccount.currency !== targetAccount.currency

  const typeBadgeColor =
    row.type === 'INCOME'
      ? 'border-green-500 text-green-600'
      : row.type === 'EXPENSE'
        ? 'border-red-500 text-red-600'
        : row.type === 'TRANSFER'
          ? 'border-blue-500 text-blue-600'
          : 'border-gray-500 text-gray-600'

  return (
    <TableRow>
      <TableCell>
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
      </TableCell>
      <TableCell className="whitespace-nowrap">{row.date}</TableCell>
      <TableCell>
        {row.type === 'INITIAL_BALANCE' ? (
          <Badge variant="outline" className="border-gray-500 text-gray-600">
            INIT BAL
          </Badge>
        ) : (
          <Select value={row.type} onValueChange={handleTypeChange}>
            <SelectTrigger
              className={cn('h-7 w-28 text-xs font-medium', typeBadgeColor)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INCOME">Income</SelectItem>
              <SelectItem value="EXPENSE">Expense</SelectItem>
              <SelectItem value="TRANSFER">Transfer</SelectItem>
            </SelectContent>
          </Select>
        )}
      </TableCell>
      {isMoneyManager && (
        <TableCell className="whitespace-nowrap text-sm">
          {row.type === 'TRANSFER' ? (
            <span>
              {row.accountName} → {row.targetAccountName}
            </span>
          ) : (
            <span>{row.accountName}</span>
          )}
        </TableCell>
      )}
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <Input
            type="number"
            step="0.01"
            min="0"
            className="h-8 w-28"
            defaultValue={fromSubunits(row.amount).toFixed(2)}
            onBlur={(e) => handleAmountChange(e.target.value)}
          />
          {row.type === 'TRANSFER' &&
            row.targetAmount &&
            row.targetCurrency && (
              <span className="text-xs text-muted-foreground">
                → {fromSubunits(row.targetAmount).toFixed(2)}{' '}
                {row.targetCurrency}
              </span>
            )}
        </div>
      </TableCell>
      <TableCell>
        <Input
          className="h-8 w-48"
          value={row.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
        />
      </TableCell>
      <TableCell>
        {row.type === 'INITIAL_BALANCE' ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : row.type === 'TRANSFER' ? (
          isMoneyManager ? (
            <span className="text-sm text-muted-foreground">
              {row.targetAccountName}
            </span>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-medium',
                    (row.transferDirection ?? 'out') === 'out'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-green-100 text-green-700',
                  )}
                  onClick={() =>
                    onUpdate({
                      transferDirection:
                        (row.transferDirection ?? 'out') === 'out' ? 'in' : 'out',
                    })
                  }
                >
                  {(row.transferDirection ?? 'out') === 'out' ? 'OUT →' : '← IN'}
                </button>
              </div>
              <Select
                value={row.targetAccountId ?? NONE_VALUE}
                onValueChange={handleTargetAccountChange}
              >
                <SelectTrigger className="h-8 w-44">
                  <SelectValue>
                    {(v: string) => {
                      if (v === NONE_VALUE)
                        return (row.transferDirection ?? 'out') === 'out'
                          ? 'Target account'
                          : 'Source account'
                      const a = targetAccounts.find((acc) => acc.id === v)
                      return a ? a.name : 'Select account'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>
                    {(row.transferDirection ?? 'out') === 'out'
                      ? 'Target account'
                      : 'Source account'}
                  </SelectItem>
                  {targetAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCrossCurrency && (
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={`Target amount (${targetAccount.currency})`}
                  className="h-7 w-44 text-xs"
                  defaultValue={
                    row.targetAmount
                      ? fromSubunits(row.targetAmount).toFixed(2)
                      : ''
                  }
                  onBlur={(e) => {
                    const parsed = parseFloat(e.target.value)
                    if (!isNaN(parsed) && parsed > 0) {
                      onUpdate({ targetAmount: toSubunits(parsed) })
                    } else {
                      onUpdate({ targetAmount: undefined })
                    }
                  }}
                />
              )}
            </div>
          )
        ) : isMoneyManager ? (
          <span
            className={cn(
              'text-sm',
              row.categoryAutoSelected
                ? 'text-blue-600'
                : 'text-muted-foreground',
            )}
          >
            {row.categoryName ?? '—'}
          </span>
        ) : (
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
        )}
      </TableCell>
      {isMoneyManager && (
        <TableCell>
          {row.tags && row.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </TableCell>
      )}
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
