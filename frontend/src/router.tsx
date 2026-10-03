import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/components/layout/root-layout'
import { DashboardPage } from '@/pages/dashboard'
import { AccountsPage } from '@/pages/accounts'
import { TransactionsPage } from '@/pages/transactions'
import { CategoriesPage } from '@/pages/categories'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'accounts', element: <AccountsPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'categories', element: <CategoriesPage /> },
    ],
  },
])
