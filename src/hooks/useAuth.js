import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, staff, session, setAuth, clearAuth } = useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchStaffProfile(session.user, session)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchStaffProfile(session.user, session)
        } else if (event === 'SIGNED_OUT') {
          clearAuth()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchStaffProfile(user, session) {
    const { data: staff } = await supabase
      .from('staff')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    setAuth(user, session, staff)
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    clearAuth()
  }

  return { user, staff, session, signIn, signOut, isAuthenticated: !!user && !!staff }
}
