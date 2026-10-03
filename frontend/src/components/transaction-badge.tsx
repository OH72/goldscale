import { Badge } from '@/components/ui/badge'
import type { TransactionType } from '@/types/common'

const typeConfig: Record<TransactionType, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  INCOME: { label: 'Income', variant: 'default' },
  EXPENSE: { label: 'Expense', variant: 'destructive' },
  TRANSFER: { label: 'Transfer', variant: 'secondary' },
  INITIAL_BALANCE: { label: 'Initial', variant: 'outline' },
}

interface TransactionBadgeProps {
  type: TransactionType
}

export function TransactionBadge({ type }: TransactionBadgeProps) {
  const config = typeConfig[type]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
