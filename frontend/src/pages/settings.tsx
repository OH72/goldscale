import { useRef, useState } from 'react'
import { useBackupDownload, useBackupRestore } from '@/api/use-backup'
import { useSettings, useUpdateSettings } from '@/api/use-settings'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Download, Upload } from 'lucide-react'
import type { Currency } from '@/types/common'

const CURRENCIES: Currency[] = ['UAH', 'USD', 'EUR', 'PLN', 'GBP', 'USDT']

export function SettingsPage() {
  const downloadMutation = useBackupDownload()
  const restoreMutation = useBackupRestore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)

  const { data: settings, isLoading: settingsLoading } = useSettings()
  const updateSettings = useUpdateSettings()

  function handleCurrencyChange(currency: Currency) {
    updateSettings.mutate({ displayCurrency: currency })
  }

  function handleRestore() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setConfirmRestore(true)
  }

  function doRestore() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    restoreMutation.mutate(file, {
      onSuccess: () => {
        setConfirmRestore(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
      onSettled: () => setConfirmRestore(false),
    })
  }

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="grid gap-6">
        {/* Display Currency */}
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>
              Dashboard currency and the starting date for "All Time" filter.
              Exchange rates are fetched automatically from NBU.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="flex flex-wrap gap-6">
                <div className="space-y-2">
                  <Label>Display Currency</Label>
                  <Select
                    value={settings?.displayCurrency ?? 'UAH'}
                    onValueChange={(v) => handleCurrencyChange(v as Currency)}
                    disabled={updateSettings.isPending}
                  >
                    <SelectTrigger className="w-32 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Initial Date</Label>
                  <Input
                    type="date"
                    className="w-40 h-9"
                    value={settings?.initialDate ?? '2022-01-01'}
                    onChange={(e) => {
                      if (e.target.value) {
                        updateSettings.mutate({ initialDate: e.target.value })
                      }
                    }}
                    disabled={updateSettings.isPending}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Backup / Restore */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Export Backup</CardTitle>
              <CardDescription>
                Download a full backup of all data as a ZIP file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                {downloadMutation.isPending ? 'Downloading...' : 'Download Backup'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Restore from Backup</CardTitle>
              <CardDescription>
                Upload a backup ZIP to replace all current data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Backup File</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip"
                />
              </div>
              <Button
                onClick={handleRestore}
                disabled={restoreMutation.isPending}
                variant="destructive"
              >
                <Upload className="mr-2 h-4 w-4" />
                {restoreMutation.isPending ? 'Restoring...' : 'Restore'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        title="Restore Backup"
        description="This will replace ALL current data with the backup. This action cannot be undone."
        loading={restoreMutation.isPending}
        onConfirm={doRestore}
      />
    </div>
  )
}
