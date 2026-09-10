import { createJSONStorage, type StateStorage } from 'zustand/middleware'

export const STORAGE_KEY = 'spin-wheel-lucky-draw:v1'

/**
 * localStorage-backed storage with graceful failure (private mode, quota).
 * Data size for ~1000 participants is well under 1MB so localStorage is sufficient.
 */
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch (e) {
      console.warn('Failed to persist session', e)
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}

export const sessionStorageAdapter = createJSONStorage(() => safeLocalStorage)
