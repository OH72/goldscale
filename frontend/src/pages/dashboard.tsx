import { useDashboard } from '@/api/use-dashboard'
import { PageHeader } from '@/components/layout/page-header'
import { TransactionBadge } from '@/components/transaction-badge'
import { DateDisplay } from '@/components/date-display'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/currency'

export function DashboardPage() {
  const { data, isLoading, error } = useDashboard()

  if (isLoading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6 text-destructive">Failed to load dashboard: {error.message}</div>
  if (!data) return null

  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* Account cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.accounts.map((account) => (
          <Card key={account.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {account.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(account.balance, account.currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {account.currency}
              </p>
            </CardContent>
          </Card>
        ))}
        {data.accounts.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground">
            No accounts yet
          </p>
        )}
      </div>

      {/* Recent transactions */}
      <h2 className="mb-3 text-lg font-semibold">Recent Transactions</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="w-44 text-right">Amount</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.recentTransactions.map((txn) => {
            const account = data.accounts.find(
              (a) => a.id === txn.accountId,
            )
            const currency = account?.currency ?? 'UAH'

            return (
              <TableRow key={txn.id}>
                <TableCell>
                  <DateDisplay date={txn.date} />
                </TableCell>
                <TableCell>
                  <TransactionBadge type={txn.type} />
                </TableCell>
                <TableCell>
                  {txn.accountName}
                  {txn.type === 'TRANSFER' && txn.targetAccountName && (
                    <span className="text-muted-foreground">
                      {' → '}
                      {txn.targetAccountName}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {txn.categoryName ?? '—'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {txn.type === 'INCOME' && '+'}
                  {txn.type === 'EXPENSE' && '-'}
                  {formatCurrency(txn.amount, currency)}
                  {txn.type === 'TRANSFER' && txn.targetAmount && (() => {
                    const targetAccount = data.accounts.find(
                      (a) => a.id === txn.targetAccountId,
                    )
                    const targetCurrency = targetAccount?.currency ?? currency
                    return (
                      <span className="text-muted-foreground">
                        {' → '}
                        {formatCurrency(txn.targetAmount, targetCurrency)}
                        {txn.exchangeRate && txn.exchangeRate !== 1 && (
                          <span className="ml-1 text-xs">
                            ({txn.exchangeRate.toFixed(4)})
                          </span>
                        )}
                      </span>
                    )
                  })()}
                </TableCell>
                <TableCell className="truncate text-muted-foreground" title={txn.description ?? ''}>
                  {txn.description ?? ''}
                </TableCell>
              </TableRow>
            )
          })}
          {data.recentTransactions.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground"
              >
                No recent transactions
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
