import { useAuth } from '@/hooks/useAuth'

export default function NoProfilePage() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🔗</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Account not linked</h1>
        <p className="text-sm text-gray-500 mb-2">
          You are signed in as:
        </p>
        <p className="text-sm font-mono font-semibold text-gray-700 mb-6">
          {user?.email}
        </p>
        <p className="text-sm text-gray-500 mb-8">
          This account has no staff profile attached. Ask your administrator to link this account to a staff record in Supabase.
        </p>
        <button
          onClick={signOut}
          className="w-full py-3 rounded-2xl bg-black text-white font-semibold text-sm"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
