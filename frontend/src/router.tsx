import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/components/layout/root-layout'
import { DashboardPage } from '@/pages/dashboard'
import { AccountsPage } from '@/pages/accounts'
import { TransactionsPage } from '@/pages/transactions'
import { CategoriesPage } from '@/pages/categories'
import { TagsPage } from '@/pages/tags'
import { ImportPage } from '@/pages/import'
import { SettingsPage } from '@/pages/settings'
import { PeoplePage } from '@/pages/people'
import { DebtsPage } from '@/pages/debts'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'accounts', element: <AccountsPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'tags', element: <TagsPage /> },
      { path: 'people', element: <PeoplePage /> },
      { path: 'debts', element: <DebtsPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
