import { cn } from '@/lib/utils'

export interface StripFigure {
  label: string
  value: string
  tone?: 'positive' | 'negative' | 'gold'
  note?: string
  /** A name rather than a number: set in the display serif */
  text?: boolean
}

/** A row of headline figures separated by hairlines, set like a newspaper market table. */
export function FigureStrip({ figures, className }: { figures: StripFigure[]; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 border-b border-foreground/15 sm:flex sm:flex-wrap',
        className,
      )}
    >
      {figures.map((f, i) => (
        <div
          key={f.label}
          className={cn(
            'min-w-0 py-4 pr-6 sm:flex-1',
            i > 0 && 'sm:border-l sm:border-border sm:pl-6',
            i % 2 === 1 && 'border-l border-border pl-4 sm:pl-6',
          )}
        >
          <div className="eyebrow">{f.label}</div>
          <div
            className={cn(
              'mt-1.5 truncate',
              f.text ? 'font-display text-2xl leading-tight sm:text-[1.75rem]' : 'num text-xl sm:text-2xl',
              f.tone === 'positive' && 'text-positive',
              f.tone === 'negative' && 'text-negative',
              f.tone === 'gold' && 'text-gold',
            )}
          >
            {f.value}
          </div>
          {f.note && <div className="mt-0.5 text-xs text-muted-foreground">{f.note}</div>}
        </div>
      ))}
    </div>
  )
}
