const formatters = new Map<string, Intl.NumberFormat>()

export function formatCurrency(
  amountInSubunits: number,
  currency: string,
): string {
  if (!formatters.has(currency)) {
    formatters.set(
      currency,
      new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    )
  }
  return formatters.get(currency)!.format(amountInSubunits / 100)
}

export function toSubunits(displayAmount: number): number {
  return Math.round(displayAmount * 100)
}

export function fromSubunits(subunits: number): number {
  return subunits / 100
}
