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
        'border-r bg-sidebar text-sidebar-foreground transition-all duration-200',
        sidebarOpen ? 'w-56' : 'w-14',
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        {sidebarOpen && (
          <span className="text-lg font-semibold">GoldScale</span>
        )}
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive &&
                  'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
