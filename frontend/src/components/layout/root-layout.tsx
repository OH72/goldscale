import { Outlet } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/stores/ui-store'

export function RootLayout() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b px-4">
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <Menu className="h-4 w-4" />
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
