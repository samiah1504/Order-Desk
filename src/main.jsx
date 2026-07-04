import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

// Single auth listener — handles every state change including the initial session check.
// INITIAL_SESSION fires immediately on subscribe with the current session (or null).
// This replaces the need for a separate getSession() call.
supabase.auth.onAuthStateChange(async (event, session) => {
  const store = useAuthStore.getState()

  if (!session?.user) {
    store.clearAuth()
    return
  }

  // TOKEN_REFRESHED: session is still valid, just update it silently
  if (event === 'TOKEN_REFRESHED') {
    const { staff } = store
    if (staff) store.setAuth(session.user, session, staff)
    return
  }

  // INITIAL_SESSION / SIGNED_IN: resolve the staff profile
  try {
    const { data: staff, error } = await supabase
      .from('staff')
      .select('*')
      .eq('auth_user_id', session.user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('[Auth] Staff profile fetch error:', error.message)
      store.setNoProfile(session.user, session)
      return
    }

    if (staff) {
      store.setAuth(session.user, session, staff)
    } else {
      console.warn('[Auth] No staff profile linked to this account:', session.user.email)
      store.setNoProfile(session.user, session)
    }
  } catch (err) {
    console.error('[Auth] Unexpected error:', err)
    store.setNoProfile(session.user, session)
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { background: '#0A0A0A', color: '#fff', borderRadius: '12px' },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
)
