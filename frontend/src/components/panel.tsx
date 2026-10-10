import { cn } from '@/lib/utils'

interface PanelProps {
  /** Figure number, e.g. "1" renders "Fig. 1" */
  figure?: string
  /** Small label above the title */
  kicker?: string
  title: React.ReactNode
  /** Right-aligned header content (totals, legends, controls) */
  meta?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}

/** A figure on the page: kicker, serif title, hairline rule, content. */
export function Panel({ figure, kicker, title, meta, className, bodyClassName, children }: PanelProps) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-md bg-card/85 shadow-paper ring-1 ring-border',
        className,
      )}
    >
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-5 pt-4 pb-3">
        <div className="min-w-0">
          {(figure || kicker) && (
            <div className="eyebrow">
              {figure && <span className="text-gold">Fig. {figure}</span>}
              {figure && kicker && <span className="px-1.5 opacity-50">—</span>}
              {kicker}
            </div>
          )}
          <h2 className="mt-1 font-display text-[1.65rem] leading-tight tracking-[-0.01em]">{title}</h2>
        </div>
        {meta && <div className="flex flex-wrap items-center gap-x-5 gap-y-1">{meta}</div>}
      </header>
      <div className="mx-5 h-px bg-border" />
      <div className={cn('flex-1 px-5 pt-4 pb-5', bodyClassName)}>{children}</div>
    </section>
  )
}

/** Small "label — figure" pair used in panel headers. */
export function PanelStat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="text-right">
      <div className="eyebrow">{label}</div>
      <div
        className={cn(
          'num text-sm',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-negative',
        )}
      >
        {value}
      </div>
    </div>
  )
}

/** Empty / loading placeholder inside a panel. */
export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center font-display text-lg text-muted-foreground italic">
      {children}
    </div>
  )
}
