import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="mb-10">
          <div className="w-14 h-14 bg-brand-yellow rounded-2xl flex items-center justify-center mb-6">
            <span className="text-2xl font-black text-black">OD</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Order Desk</h1>
          <p className="text-gray-500 text-base">Internal Operations Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
          />
          <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
            Sign In
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          Contact your administrator to reset your password
        </p>
      </div>

      <div className="px-6 pb-8">
        <div className="flex items-center gap-2 bg-brand-yellow-light rounded-2xl p-4">
          <div className="text-yellow-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </div>
          <p className="text-xs text-yellow-800 font-medium">
            Access is restricted to authorized staff only.
          </p>
        </div>
      </div>
    </div>
  )
}
