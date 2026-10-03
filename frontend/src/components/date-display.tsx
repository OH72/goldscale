import { formatDate } from '@/lib/date'

interface DateDisplayProps {
  date: string
}

export function DateDisplay({ date }: DateDisplayProps) {
  return <span>{formatDate(date)}</span>
}
