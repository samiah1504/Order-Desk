import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LogOut, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

const ROLE_LABELS = {
  ceo:                'CEO / Super Admin',
  operations_manager: 'Operations Manager',
  customer_support:   'Customer Support',
  fulfillment:        'Fulfillment Officer',
  waybill:            'Waybill Officer',
  inventory:          'Inventory / Warehouse',
}

export default function ProfilePage() {
  const { staff, signOut } = useAuth()
  const navigate = useNavigate()

  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]                 = useState(false)

  async function handleChangePassword() {
    if (!newPassword) return toast.error('Enter a new password')
    if (newPassword.length < 6) return toast.error('Password must be at least 6 characters')
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match')

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)

    if (error) return toast.error(error.message)
    toast.success('Password updated!')
    setNewPassword('')
    setConfirmPassword('')
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="My Profile" />

      <div className="px-4 pt-4 pb-6 space-y-4">

        {/* Identity card */}
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-yellow rounded-2xl flex items-center justify-center shrink-0">
              <User size={24} className="text-black" />
            </div>
            <div>
              <p className="font-bold text-lg">{staff?.full_name}</p>
              <p className="text-sm font-mono text-gray-500">{staff?.staff_code}</p>
              <p className="text-sm text-gray-400">{ROLE_LABELS[staff?.role] || staff?.role}</p>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-gray-500" />
            <p className="font-semibold">Change Password</p>
          </div>
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Min. 6 characters"
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
          />
          <Button className="w-full" loading={loading} onClick={handleChangePassword}>
            Update Password
          </Button>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 text-red-600 font-semibold text-sm"
        >
          <LogOut size={16} />
          Sign Out
        </button>

      </div>
    </div>
  )
}
