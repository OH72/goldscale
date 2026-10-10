import { cn } from '@/lib/utils'

/** A tag name set as a small mono "#tag" chip. */
export function TagChip({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 max-w-40 items-center rounded-[3px] border border-foreground/15 px-1.5 font-mono text-[11px] text-foreground/75',
        className,
      )}
      title={name}
    >
      <span className="mr-0.5 text-gold">#</span>
      <span className="truncate">{name}</span>
    </span>
  )
}
