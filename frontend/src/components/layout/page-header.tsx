import { Fragment } from 'react'

interface PageHeaderProps {
  title: string
  children?: React.ReactNode
}

/** Set an ampersand in italic brass — a small typographic flourish. */
function Title({ text }: { text: string }) {
  return (
    <>
      {text.split('&').map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="px-[0.08em] text-gold italic">&amp;</span>}
          {part}
        </Fragment>
      ))}
    </>
  )
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-b border-foreground/80 pb-4">
      <h1 className="font-display text-4xl leading-none tracking-[-0.02em] sm:text-5xl">
        <Title text={title} />
      </h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
