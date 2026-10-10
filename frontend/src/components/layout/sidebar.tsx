import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'
import { useSettings } from '@/api/use-settings'
import { LogoMark } from '@/components/brand/logo-mark'
import { navGroups, navItems } from './nav'
import { ThemeSwitch } from './theme-switch'

interface SidebarProps {
  /** Rendered inside the mobile drawer: always expanded, with a close button */
  mobile?: boolean
}

export function Sidebar({ mobile }: SidebarProps) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)
  const expanded = mobile || sidebarOpen
  const { data: settings } = useSettings()

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col bg-spine text-spine-foreground transition-[width] duration-200',
        expanded ? 'w-64' : 'w-[4.25rem]',
      )}
    >
      {/* Brass hairline down the spine's edge */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-gold/0 via-gold/45 to-gold/0" />

      {/* Masthead */}
      <div className={cn('flex items-start gap-3 pt-6 pb-7', expanded ? 'px-6' : 'flex-col items-center px-0')}>
        <LogoMark className="size-8 shrink-0" />
        {expanded && (
          <div className="min-w-0 flex-1">
            <div className="font-display text-[1.65rem] leading-none tracking-tight">GoldScale</div>
            <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-spine-muted">
              Personal ledger
            </div>
          </div>
        )}
        {mobile ? (
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="flex size-8 items-center justify-center rounded-md text-spine-muted hover:bg-sidebar-accent hover:text-spine-foreground"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex size-8 items-center justify-center rounded-md text-spine-muted transition-colors hover:bg-sidebar-accent hover:text-spine-foreground"
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {expanded ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </button>
        )}
      </div>

      {/* Contents */}
      <nav className={cn('flex-1 overflow-y-auto pb-6', expanded ? 'px-3' : 'px-2.5')}>
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            {expanded ? (
              <div className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-spine-muted/80">
                {group.label}
              </div>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const numbered = navItems.find((n) => n.to === item.to)
                const Icon = item.icon
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      title={expanded ? undefined : item.label}
                      onClick={() => mobile && setMobileNavOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center rounded-md text-[0.9rem] transition-colors',
                          expanded ? 'gap-3 px-3 py-[0.45rem]' : 'justify-center py-2.5',
                          isActive
                            ? 'bg-sidebar-accent text-spine-foreground'
                            : 'text-spine-foreground/70 hover:bg-sidebar-accent/60 hover:text-spine-foreground',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={cn(
                              'absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-full bg-gold transition-opacity',
                              isActive ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          {expanded ? (
                            <span
                              className={cn(
                                'w-5 font-mono text-[10.5px] tabular-nums',
                                isActive ? 'text-gold' : 'text-spine-muted group-hover:text-spine-foreground/70',
                              )}
                            >
                              {numbered?.number}
                            </span>
                          ) : (
                            <Icon className={cn('size-[1.1rem]', isActive && 'text-gold')} />
                          )}
                          {expanded && <span className="truncate">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Colophon */}
      <div className={cn('border-t border-sidebar-border', expanded ? 'space-y-3 px-6 py-5' : 'flex justify-center py-4')}>
        {expanded ? (
          <>
            <ThemeSwitch />
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-spine-muted/70">
              Kept in {settings?.displayCurrency ?? '—'}
            </div>
          </>
        ) : (
          <ThemeSwitch compact />
        )}
      </div>
    </aside>
  )
}
