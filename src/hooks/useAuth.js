import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, staff, session, initialized, noProfile, clearAuth } = useAuthStore()

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw new Error(error.message)
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    clearAuth()
  }

  return {
    user,
    staff,
    session,
    initialized,
    noProfile,
    signIn,
    signOut,
    isAuthenticated: !!user && !!staff,
  }
}
