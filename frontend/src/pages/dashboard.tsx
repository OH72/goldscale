import { useDashboard } from '@/api/use-dashboard'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

    </div>
  )
}
