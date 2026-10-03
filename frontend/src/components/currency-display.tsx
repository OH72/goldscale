import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

interface CurrencyDisplayProps {
  amount: number
  currency: string
  className?: string
}

export function CurrencyDisplay({
  amount,
  currency,
  className,
}: CurrencyDisplayProps) {
  return <span className={cn(className)}>{formatCurrency(amount, currency)}</span>
}
