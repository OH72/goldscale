import { create } from 'zustand'

interface UiState {
  /** Desktop: expanded vs. collapsed rail */
  sidebarOpen: boolean
  /** Mobile: navigation drawer */
  mobileNavOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setMobileNavOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  mobileNavOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}))
