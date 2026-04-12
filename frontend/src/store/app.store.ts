import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Mission, Agent } from '../lib/api'

interface AppState {
  currentMission: Mission | null
  agents: Agent[]
  pendingApprovals: number
  /** 봇 간 산출물 전달 — 현재 봇 결과를 다음 봇 입력으로 */
  pendingBotInput: string | null
  setCurrentMission: (m: Mission | null) => void
  setAgents: (a: Agent[]) => void
  setPendingApprovals: (n: number) => void
  setPendingBotInput: (input: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentMission: null,
      agents: [],
      pendingApprovals: 0,
      pendingBotInput: null,
      setCurrentMission: (m) => set({ currentMission: m }),
      setAgents: (a) => set({ agents: a }),
      setPendingApprovals: (n) => set({ pendingApprovals: n }),
      setPendingBotInput: (input) => set({ pendingBotInput: input }),
    }),
    {
      name: 'oomni-app-store',
      partialize: (state) => ({ currentMission: state.currentMission }),
    }
  )
)
