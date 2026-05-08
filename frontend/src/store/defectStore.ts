import { create } from 'zustand'
import { Defect, Stats } from '../types'
import { defectApi } from '../api/client'

interface DefectStore {
  defects: Defect[]
  stats: Stats | null
  loading: boolean
  fetchDefects: (filters?: { defect_type?: string; severity?: string }) => Promise<void>
  fetchStats: () => Promise<void>
  deleteDefect: (id: number) => Promise<void>
}

export const useDefectStore = create<DefectStore>((set, get) => ({
  defects: [],
  stats: null,
  loading: false,

  fetchDefects: async (filters) => {
    set({ loading: true })
    try {
      const defects = await defectApi.getAll(filters)
      set({ defects })
    } finally {
      set({ loading: false })
    }
  },

  fetchStats: async () => {
    const stats = await defectApi.getStats()
    set({ stats })
  },

  deleteDefect: async (id) => {
    await defectApi.delete(id)
    set({ defects: get().defects.filter((d) => d.id !== id) })
  },
}))
