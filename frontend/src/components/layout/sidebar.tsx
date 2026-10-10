import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Tag,
  Tags,
  Users,
  HandCoins,
  Upload,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/categories', label: 'Categories', icon: Tag },
  { to: '/tags', label: 'Tags', icon: Tags },
  { to: '/people', label: 'People', icon: Users },
  { to: '/debts', label: 'Debts & Loans', icon: HandCoins },
  { to: '/import', label: 'Import', icon: Upload },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)

  return (
    <aside
      className={cn(
        'relative shrink-0 bg-spine text-spine-foreground transition-all duration-200',
        sidebarOpen ? 'w-56' : 'w-14',
      )}
    >
      {/* Brass hairline down the spine's edge */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-gold/0 via-gold/40 to-gold/0" />

      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        {sidebarOpen && (
          <span className="font-display text-[1.6rem] leading-none tracking-tight">
            Gold<span className="text-gold italic">Scale</span>
          </span>
        )}
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={sidebarOpen ? undefined : label}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                'hover:bg-sidebar-accent hover:text-spine-foreground',
                isActive
                  ? 'bg-sidebar-accent text-spine-foreground before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-gold'
                  : 'text-spine-foreground/70',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-gold')} />
                {sidebarOpen && <span>{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
