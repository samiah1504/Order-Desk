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

async function fetchStaffProfile(user, session) {
  const { setAuth, clearAuth } = useAuthStore.getState()
  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!staff) {
    await supabase.auth.signOut()
    return
  }

  setAuth(user, session, staff)
}

// Single auth initialisation — runs once before the app mounts
supabase.auth.getSession().then(({ data: { session } }) => {
  const { clearAuth } = useAuthStore.getState()
  if (session?.user) {
    fetchStaffProfile(session.user, session)
  } else {
    clearAuth()
  }
})

supabase.auth.onAuthStateChange(async (event, session) => {
  const { clearAuth } = useAuthStore.getState()
  if (event === 'SIGNED_IN' && session?.user) {
    await fetchStaffProfile(session.user, session)
  } else if (event === 'SIGNED_OUT') {
    clearAuth()
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
