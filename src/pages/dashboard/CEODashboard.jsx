import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { TrendingUp, ShoppingBag, DollarSign, AlertTriangle, ArrowRight, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatNaira } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

function StatCard({ label, value, icon: Icon, color, to }) {
  const content = (
    <div className={`card bg-gradient-to-br ${color} border-0 p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-black text-white">{value}</p>
        </div>
        <div className="p-2 bg-white/20 rounded-xl">
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}

export default function CEODashboard() {
  const { staff } = useAuthStore()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['ceo-dashboard-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const [
        { count: totalOrders },
        { count: paidToday },
        { data: salesData },
        { count: pendingAlerts },
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'paid').gte('payment_confirmed_at', today),
        supabase.from('orders').select('total_amount').eq('status', 'paid').gte('payment_confirmed_at', today + 'T00:00:00'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
      ])
      const salesTotal = salesData?.reduce((s, o) => s + (o.total_amount || 0), 0) || 0
      return { totalOrders, paidToday, salesTotal, pendingAlerts }
    },
    staleTime: 60_000,
  })

  const { data: businesses } = useQuery({
    queryKey: ['businesses'],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('*').eq('is_active', true)
      return data || []
    },
  })

  const { data: recentOrders } = useQuery({
    queryKey: ['recent-orders-ceo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, businesses(name)')
        .order('created_at', { ascending: false })
        .limit(5)
      return data || []
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-brand-yellow px-4 pt-12 pb-6">
        <p className="text-black/60 text-sm font-medium">Good day,</p>
        <h1 className="text-2xl font-black text-black">{staff?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-black/60 text-xs mt-1">{new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="px-4 -mt-4 pb-6 space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Orders Today" value={stats?.totalOrders ?? 0} icon={ShoppingBag} color="from-blue-500 to-blue-600" to="/orders" />
            <StatCard label="Sales Today" value={formatNaira(stats?.salesTotal)} icon={DollarSign} color="from-emerald-500 to-emerald-600" to="/accounting" />
            <StatCard label="Paid Orders" value={stats?.paidToday ?? 0} icon={TrendingUp} color="from-purple-500 to-purple-600" to="/orders" />
            <StatCard label="Needs Attention" value={stats?.pendingAlerts ?? 0} icon={AlertTriangle} color="from-orange-500 to-orange-600" />
          </div>
        )}

        {businesses?.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm">Businesses</h2>
              <Link to="/admin/businesses" className="text-xs text-brand-yellow-dark font-semibold flex items-center gap-1">
                Manage <ChevronRight size={14} />
              </Link>
            </div>
            <div className="space-y-2">
              {businesses.map(b => (
                <div key={b.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 bg-brand-yellow rounded-lg flex items-center justify-center font-bold text-xs text-black">
                    {b.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{b.name}</p>
                    <p className="text-xs text-gray-500">Active</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <QuickLinks />

        {recentOrders?.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm">Recent Orders</h2>
              <Link to="/orders" className="text-xs text-brand-yellow-dark font-semibold flex items-center gap-1">
                See all <ChevronRight size={14} />
              </Link>
            </div>
            <div className="space-y-2">
              {recentOrders.map(order => (
                <Link key={order.id} to={`/orders/${order.id}`} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl active:bg-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{order.customer_name}</p>
                    <p className="text-xs text-gray-500">{order.order_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-gray-900">{formatNaira(order.total_amount)}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${order.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function QuickLinks() {
  const links = [
    { to: '/orders', label: 'All Orders', emoji: '📦' },
    { to: '/accounting', label: 'Accounting', emoji: '💰' },
    { to: '/reports', label: 'Reports', emoji: '📊' },
    { to: '/admin', label: 'Admin', emoji: '⚙️' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {links.map(({ to, label, emoji }) => (
        <Link key={to} to={to} className="flex flex-col items-center gap-2 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 active:bg-gray-50">
          <span className="text-2xl">{emoji}</span>
          <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{label}</span>
        </Link>
      ))}
    </div>
  )
}
