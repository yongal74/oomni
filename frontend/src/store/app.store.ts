import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Mission, Agent } from '../lib/api'

interface AppState {
  currentMission: Mission | null
  agents: Agent[]
  pendingApprovals: number
  setCurrentMission: (m: Mission | null) => void
  setAgents: (a: Agent[]) => void
  setPendingApprovals: (n: number) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentMission: null,
      agents: [],
      pendingApprovals: 0,
      setCurrentMission: (m) => set({ currentMission: m }),
      setAgents: (a) => set({ agents: a }),
      setPendingApprovals: (n) => set({ pendingApprovals: n }),
    }),
    {
      name: 'oomni-app-store',
      partialize: (state) => ({ currentMission: state.currentMission }),
    }
  )
)
