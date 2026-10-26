import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DatePreferenceState {
  lastEnteredDate: string
  setLastEnteredDate: (date: string) => void
}

export const useDatePreferenceStore = create<DatePreferenceState>()(
  persist(
    (set) => ({
      lastEnteredDate: '',
      setLastEnteredDate: (date) => set({ lastEnteredDate: date }),
    }),
    { name: 'goldscale-date-preference', version: 2 },
  ),
)
