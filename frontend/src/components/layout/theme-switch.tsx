import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

/** Three-way theme selector styled for the dark sidebar spine. */
export function ThemeSwitch({ compact }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const current = mounted ? theme : undefined

  if (compact) {
    const next = current === 'dark' ? 'light' : 'dark'
    const Icon = current === 'dark' ? Moon : Sun
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        className="flex size-9 items-center justify-center rounded-md text-spine-muted transition-colors hover:bg-sidebar-accent hover:text-spine-foreground"
        aria-label={`Switch to ${next} theme`}
      >
        <Icon className="size-4" />
      </button>
    )
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid grid-cols-3 rounded-md border border-sidebar-border p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          onClick={() => setTheme(value)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-[4px] py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors',
            current === value
              ? 'bg-sidebar-accent text-gold'
              : 'text-spine-muted hover:text-spine-foreground',
          )}
        >
          <Icon className="size-3" />
          {label}
        </button>
      ))}
    </div>
  )
}
