const numberFormatter = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(
  amountInSubunits: number,
  currency: string,
): string {
  return `${numberFormatter.format(amountInSubunits / 100)} ${currency}`
}

export function toSubunits(displayAmount: number): number {
  return Math.round(displayAmount * 100)
}

export function fromSubunits(subunits: number): number {
  return subunits / 100
}
