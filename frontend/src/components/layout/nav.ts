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
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  description: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, description: 'The state of the purse, at a glance.' },
    ],
  },
  {
    label: 'Ledger',
    items: [
      { to: '/accounts', label: 'Accounts', icon: Wallet, description: 'Every place the money is kept.' },
      { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight, description: 'The running record of money in and out.' },
      { to: '/import', label: 'Import', icon: Upload, description: 'Bring in statements from your banks.' },
    ],
  },
  {
    label: 'Counterparties',
    items: [
      { to: '/people', label: 'People', icon: Users, description: 'Who owes whom, settled in one place.' },
      { to: '/debts', label: 'Debts & Loans', icon: HandCoins, description: 'Money lent and borrowed, until it is square.' },
    ],
  },
  {
    label: 'Taxonomy',
    items: [
      { to: '/categories', label: 'Categories', icon: Tag, description: 'How the spending is sorted.' },
      { to: '/tags', label: 'Tags', icon: Tags, description: 'Threads that cut across categories.' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings, description: 'Currency, dates and housekeeping.' },
    ],
  },
]

/** Flat list with a running section number ("01", "02", ...). */
export const navItems = navGroups.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label })),
).map((item, i) => ({ ...item, number: String(i + 1).padStart(2, '0') }))

export function findNavItem(pathname: string) {
  return navItems.find((item) =>
    item.to === '/' ? pathname === '/' : pathname.startsWith(item.to),
  )
}
