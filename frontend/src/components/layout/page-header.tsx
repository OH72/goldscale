import { Fragment } from 'react'
import { useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import { findNavItem } from './nav'

interface PageHeaderProps {
  title: string
  /** Optional standfirst; defaults to the section's description */
  description?: string
  children?: React.ReactNode
}

/** Set the ampersand in italic brass — a small editorial flourish. */
function Title({ text }: { text: string }) {
  const parts = text.split('&')
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="px-[0.08em] text-gold italic">&amp;</span>}
          {part}
        </Fragment>
      ))}
    </>
  )
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  const { pathname } = useLocation()
  const section = findNavItem(pathname)
  const standfirst = description ?? section?.description

  return (
    <header className="mb-8 md:mb-10">
      <div className="eyebrow flex items-center justify-between gap-4">
        <span>
          {section && <span className="text-gold">§ {section.number}</span>}
          {section && <span className="px-2 opacity-50">/</span>}
          {section?.group ?? 'GoldScale'}
        </span>
        <span className="hidden sm:inline">{format(new Date(), 'EEEE, d MMMM yyyy')}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-[2.75rem] leading-[0.95] tracking-[-0.02em] sm:text-6xl">
            <Title text={title} />
          </h1>
          {standfirst && (
            <p className="mt-3 max-w-xl font-display text-lg text-muted-foreground italic">
              {standfirst}
            </p>
          )}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2 pb-1">{children}</div>}
      </div>

      {/* Double rule, as under a newspaper masthead */}
      <div className="mt-6 space-y-[3px]" aria-hidden="true">
        <div className="h-px bg-foreground/85" />
        <div className="h-px bg-foreground/85" />
      </div>
    </header>
  )
}
