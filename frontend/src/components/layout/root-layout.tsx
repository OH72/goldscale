import { Outlet } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { Sidebar } from './sidebar'
import { Menu, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/stores/ui-store'

export function RootLayout() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-border bg-background/60 px-4 backdrop-blur-sm">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
            <Menu className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 scale-100 dark:scale-0" />
            <Moon className="absolute h-4 w-4 scale-0 dark:scale-100" />
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
