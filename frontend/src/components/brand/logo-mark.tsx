import { cn } from '@/lib/utils'

/** A balance scale drawn as a single brass line: beam, fulcrum and two pans. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-gold', className)}
      aria-hidden="true"
    >
      <circle cx="16" cy="5.5" r="1.6" />
      <path d="M16 7.2V27" />
      <path d="M11 27h10" />
      <path d="M5 10.5h22" />
      <path d="M8 10.5 4.5 19M8 10.5l3.5 8.5" />
      <path d="M24 10.5 20.5 19M24 10.5l3.5 8.5" />
      <path d="M3.8 19a4.2 2 0 0 0 8.4 0Z" />
      <path d="M19.8 19a4.2 2 0 0 0 8.4 0Z" />
    </svg>
  )
}
