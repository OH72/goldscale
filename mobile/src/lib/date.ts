import { format, parseISO } from 'date-fns'

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd.MM.yyyy')
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}
