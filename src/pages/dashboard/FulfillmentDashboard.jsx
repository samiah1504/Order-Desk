import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

const buckets = [
  { status: 'new', label: 'New Orders', emoji: '🆕', color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700', to: '/fulfillment?status=new' },
  { status: 'awaiting_waybill', label: 'Awaiting Waybill', emoji: '📤', color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-700', to: '/fulfillment?status=awaiting_waybill' },
  { status: 'waybilled', label: 'Waybilled', emoji: '🚛', color: 'bg-purple-50 border-purple-200', textColor: 'text-purple-700', to: '/fulfillment?status=waybilled' },
  { status: 'processing', label: 'Processing', emoji: '⚙️', color: 'bg-yellow-50 border-yellow-200', textColor: 'text-yellow-700', to: '/fulfillment?status=processing' },
]

export default function FulfillmentDashboard() {
  const { staff } = useAuthStore()

  const { data: counts } = useQuery({
    queryKey: ['fulfillment-counts'],
    queryFn: async () => {
      const results = {}
      for (const bucket of buckets) {
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', bucket.status)
        results[bucket.status] = count || 0
      }
      // Scheduled today
      const today = new Date().toISOString().split('T')[0]
      const { count: scheduledToday } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('planned_delivery_date', today)
        .not('status', 'in', '(paid,cancelled,failed_delivery,returned)')
      results.scheduled_today = scheduledToday || 0
      return results
    },
    refetchInterval: 60_000,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-brand-yellow px-4 pt-12 pb-6">
        <p className="text-black/60 text-sm">Fulfillment</p>
        <h1 className="text-2xl font-black text-black">{staff?.full_name?.split(' ')[0]}</h1>
        <p className="text-black/60 text-xs font-medium mt-1">Operations Dashboard</p>
      </div>

      <div className="px-4 -mt-4 pb-6 space-y-4">
        {counts?.scheduled_today > 0 && (
          <Link to="/fulfillment?filter=scheduled_today" className="card bg-emerald-500 border-0 flex items-center gap-3 text-white active:scale-[0.98] transition-transform">
            <span className="text-2xl">📅</span>
            <div>
              <p className="font-bold">{counts.scheduled_today} orders scheduled today</p>
              <p className="text-sm text-emerald-100">Tap to view</p>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3">
          {buckets.map(bucket => (
            <Link key={bucket.status} to={bucket.to} className={`card border-2 ${bucket.color} border active:scale-[0.97] transition-transform`}>
              <p className="text-3xl mb-2">{bucket.emoji}</p>
              <p className={`text-3xl font-black ${bucket.textColor}`}>{counts?.[bucket.status] ?? '-'}</p>
              <p className="text-xs font-semibold text-gray-600 mt-1">{bucket.label}</p>
            </Link>
          ))}
        </div>

        <Link to="/fulfillment" className="card flex items-center justify-between active:bg-gray-50">
          <div>
            <p className="font-bold">View Orders by State</p>
            <p className="text-xs text-gray-500">Filter by Nigerian state</p>
          </div>
          <span className="text-2xl">🗺️</span>
        </Link>

        <Link to="/orders" className="card flex items-center justify-between active:bg-gray-50">
          <div>
            <p className="font-bold">All Orders</p>
            <p className="text-xs text-gray-500">Full order list</p>
          </div>
          <span className="text-2xl">📋</span>
        </Link>
      </div>
    </div>
  )
}
