import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { OrderCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatNaira, formatDate, NIGERIAN_STATES } from '@/lib/utils'
import { Package, MapPin } from 'lucide-react'

const STATUS_BUCKETS = [
  { key: 'new', label: 'New Orders', emoji: '🆕' },
  { key: 'awaiting_waybill', label: 'Awaiting Waybill', emoji: '📤' },
  { key: 'waybilled', label: 'Waybilled', emoji: '🚛' },
  { key: 'received_warehouse', label: 'At Warehouse', emoji: '🏭' },
  { key: 'processing', label: 'Processing', emoji: '⚙️' },
]

export default function FulfillmentPage() {
  const [searchParams] = useSearchParams()
  const [activeStatus, setActiveStatus] = useState(searchParams.get('status') || 'new')
  const [selectedState, setSelectedState] = useState('')

  const { data: orders, isLoading } = useQuery({
    queryKey: ['fulfillment-orders', activeStatus, selectedState],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, businesses(name), order_items(product_name, quantity)')
        .eq('status', activeStatus)
        .order('created_at', { ascending: false })

      if (selectedState) query = query.eq('state', selectedState)

      const { data } = await query
      return data || []
    },
    refetchInterval: 60_000,
  })

  const { data: stateCounts } = useQuery({
    queryKey: ['state-counts', activeStatus],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('state')
        .eq('status', activeStatus)
      if (!data) return {}
      return data.reduce((acc, o) => {
        acc[o.state] = (acc[o.state] || 0) + 1
        return acc
      }, {})
    },
  })

  const statesWithOrders = Object.entries(stateCounts || {}).sort((a, b) => b[1] - a[1])

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Fulfillment" />

      <div className="px-4 pt-3 space-y-3">
        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_BUCKETS.map(bucket => (
            <button
              key={bucket.key}
              onClick={() => { setActiveStatus(bucket.key); setSelectedState('') }}
              className={`whitespace-nowrap px-3 py-2 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeStatus === bucket.key
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {bucket.emoji} {bucket.label}
            </button>
          ))}
        </div>

        {/* State Filter */}
        {statesWithOrders.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedState('')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                !selectedState ? 'bg-brand-yellow text-black' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              All States ({Object.values(stateCounts || {}).reduce((a, b) => a + b, 0)})
            </button>
            {statesWithOrders.map(([state, count]) => (
              <button
                key={state}
                onClick={() => setSelectedState(state)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  selectedState === state ? 'bg-brand-yellow text-black' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {state} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 pb-6 space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => <OrderCardSkeleton key={i} />)
        ) : orders?.length === 0 ? (
          <EmptyState icon={Package} title="No orders here" description={`No ${activeStatus.replace(/_/g, ' ')} orders`} />
        ) : (
          orders.map(order => (
            <Link key={order.id} to={`/orders/${order.id}`} className="block card active:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-sm">{order.customer_name}</p>
                  <p className="text-xs text-gray-500">{order.order_number} · {order.businesses?.name}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                <MapPin size={12} />
                {order.city ? `${order.city}, ` : ''}{order.state}
              </div>
              <p className="text-xs text-gray-600 truncate mb-2">
                {order.order_items?.map(i => `${i.product_name} x${i.quantity}`).join(', ')}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-bold">{formatNaira(order.total_amount)}</span>
                {order.customer_requested_date && (
                  <span className="text-xs text-gray-400">Req: {formatDate(order.customer_requested_date)}</span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
