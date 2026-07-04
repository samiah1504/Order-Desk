import { useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/PageHeader'
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

        <p className="text-xs text-center text-gray-400 px-4">
          To change your password, contact your administrator.
        </p>

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
