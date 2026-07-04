import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, staff, session, initialized, setAuth, clearAuth } = useAuthStore()

  async function signIn(staffCode, password) {
    const email = `${staffCode.trim().toLowerCase()}@orderdesk.internal`
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error('Invalid staff code or password')
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    clearAuth()
  }

  return { user, staff, session, initialized, signIn, signOut, isAuthenticated: !!user && !!staff }
}
