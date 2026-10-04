import { useRef, useState } from 'react'
import { useBackupDownload, useBackupRestore } from '@/api/use-backup'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Download, Upload } from 'lucide-react'

export function SettingsPage() {
  const downloadMutation = useBackupDownload()
  const restoreMutation = useBackupRestore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)

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
