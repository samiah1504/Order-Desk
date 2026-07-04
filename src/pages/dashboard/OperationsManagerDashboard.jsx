import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatNaira } from '@/lib/utils'

export default function OperationsManagerDashboard() {
  const { staff } = useAuthStore()

  const { data: stats } = useQuery({
    queryKey: ['ops-manager-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const [
        { count: newOrders },
        { count: processing },
        { count: waybilled },
        { count: scheduledToday },
        { data: salesData },
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'waybilled'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('planned_delivery_date', today),
        supabase.from('orders').select('total_amount').eq('status', 'paid').gte('payment_confirmed_at', today + 'T00:00:00'),
      ])
      return {
        newOrders,
        processing,
        waybilled,
        scheduledToday,
        salesToday: salesData?.reduce((s, o) => s + (o.total_amount || 0), 0) || 0,
      }
    },
  })

  const quickStats = [
    { label: 'New Orders', value: stats?.newOrders ?? '-', color: 'text-blue-600', to: '/orders?status=new' },
    { label: 'Processing', value: stats?.processing ?? '-', color: 'text-yellow-600', to: '/fulfillment?status=processing' },
    { label: 'Waybilled', value: stats?.waybilled ?? '-', color: 'text-purple-600', to: '/fulfillment?status=waybilled' },
    { label: 'Scheduled Today', value: stats?.scheduledToday ?? '-', color: 'text-green-600', to: '/fulfillment?filter=scheduled_today' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-brand-yellow px-4 pt-12 pb-6">
        <p className="text-black/60 text-sm">Operations Manager</p>
        <h1 className="text-2xl font-black text-black">{staff?.full_name?.split(' ')[0]}</h1>
      </div>

      <div className="px-4 -mt-4 pb-6 space-y-4">
        <div className="card">
          <p className="text-xs font-semibold text-gray-500 mb-1">Sales Today</p>
          <p className="text-3xl font-black text-emerald-600">{formatNaira(stats?.salesToday)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {quickStats.map(s => (
            <Link key={s.label} to={s.to} className="card text-center active:scale-[0.97] transition-transform">
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs font-semibold text-gray-500 mt-1">{s.label}</p>
            </Link>
          ))}
        </div>

        {[
          { to: '/orders', label: 'All Orders', sub: 'View and manage all orders', emoji: '📋' },
          { to: '/fulfillment', label: 'Fulfillment', sub: 'Monitor delivery operations', emoji: '🚛' },
          { to: '/customers', label: 'Customers', sub: 'Customer profiles & history', emoji: '👥' },
          { to: '/reports', label: 'Reports', sub: 'Business reports & analytics', emoji: '📊' },
        ].map(({ to, label, sub, emoji }) => (
          <Link key={to} to={to} className="card flex items-center gap-3 active:bg-gray-50">
            <span className="text-2xl">{emoji}</span>
            <div className="flex-1">
              <p className="font-bold">{label}</p>
              <p className="text-xs text-gray-500">{sub}</p>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>
        ))}
      </div>
    </div>
  )
}
