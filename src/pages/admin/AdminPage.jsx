import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { ChevronRight } from 'lucide-react'

const ADMIN_SECTIONS = [
  { to: '/admin/businesses', emoji: '🏢', label: 'Businesses', sub: 'Manage business units' },
  { to: '/admin/products', emoji: '📦', label: 'Products', sub: 'Manage product catalogue' },
  { to: '/admin/staff', emoji: '👥', label: 'Staff & Access', sub: 'Manage staff accounts and permissions' },
  { to: '/admin/warehouses', emoji: '🏭', label: 'Warehouses', sub: 'Manage warehouse locations' },
]

export default function AdminPage() {
  const { staff } = useAuthStore()

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Admin" />

      <div className="px-4 pt-4 pb-6 space-y-3">
        <div className="card bg-black text-white">
          <p className="text-gray-400 text-xs mb-1">Signed in as</p>
          <p className="font-bold text-lg">{staff?.full_name}</p>
          <p className="text-brand-yellow text-sm font-semibold capitalize">{staff?.role?.replace(/_/g, ' ')} · {staff?.staff_code}</p>
        </div>

        {ADMIN_SECTIONS.map(({ to, emoji, label, sub }) => (
          <Link key={to} to={to} className="card flex items-center gap-3 active:bg-gray-50">
            <span className="text-2xl w-10 text-center shrink-0">{emoji}</span>
            <div className="flex-1">
              <p className="font-bold">{label}</p>
              <p className="text-xs text-gray-500">{sub}</p>
            </div>
            <ChevronRight size={16} className="text-gray-400 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
