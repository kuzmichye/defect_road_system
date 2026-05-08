import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../api/client'

interface AuthStore {
  token: string | null
  username: string | null
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      username: null,

      login: async (username, password) => {
        const res = await api.post('/auth/login', { username, password })
        set({ token: res.data.access_token, username })
      },

      register: async (username, password) => {
        await api.post('/auth/register', { username, password })
        const res = await api.post('/auth/login', { username, password })
        set({ token: res.data.access_token, username })
      },

      logout: () => set({ token: null, username: null }),
    }),
    { name: 'auth' }
  )
)
