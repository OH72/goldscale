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

/**
 * Split an amount into typographic parts so the whole and fractional
 * parts can be set at different sizes: { sign: '−', whole: '463 350', fraction: ',50' }.
 */
export function splitAmount(amountInSubunits: number) {
  const formatted = numberFormatter.format(Math.abs(amountInSubunits) / 100)
  const cut = formatted.length - 3
  return {
    sign: amountInSubunits < 0 ? '−' : '',
    whole: formatted.slice(0, cut),
    fraction: formatted.slice(cut),
  }
}

/** Like formatCurrency, but always shows the sign: "+1 200,00 UAH" / "−300,00 UAH". */
export function formatSigned(amountInSubunits: number, currency: string): string {
  const sign = amountInSubunits > 0 ? '+' : amountInSubunits < 0 ? '−' : ''
  return `${sign}${formatCurrency(Math.abs(amountInSubunits), currency)}`
}
