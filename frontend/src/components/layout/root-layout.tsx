import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'
import { LogoMark } from '@/components/brand/logo-mark'
import { Sidebar } from './sidebar'

export function RootLayout() {
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)
  const { pathname } = useLocation()

  // Close the drawer and return to the top on navigation
  useEffect(() => {
    setMobileNavOpen(false)
    window.scrollTo({ top: 0 })
  }, [pathname, setMobileNavOpen])

  return (
    <div className="flex min-h-dvh">
      {/* Desktop spine */}
      <div className="hidden shrink-0 bg-spine md:block">
        <div className="sticky top-0 h-dvh">
          <Sidebar />
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 md:hidden',
          mobileNavOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!mobileNavOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-spine/50 backdrop-blur-[2px] transition-opacity',
            mobileNavOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMobileNavOpen(false)}
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 transition-transform duration-200',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar mobile />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile masthead */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-6" />
            <span className="font-display text-xl leading-none">GoldScale</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex size-9 items-center justify-center rounded-md hover:bg-muted"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
        </header>

        <main className="mx-auto w-full max-w-[1380px] flex-1 px-4 pt-6 pb-16 sm:px-8 md:pt-10 lg:px-12">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
