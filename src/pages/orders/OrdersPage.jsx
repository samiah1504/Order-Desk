import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, Plus, Filter, SlidersHorizontal } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { OrderCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatNaira, formatDate, STATUS_LABELS } from '@/lib/utils'

const STATUS_FILTERS = ['all', 'new', 'awaiting_waybill', 'waybilled', 'processing', 'delivered', 'paid', 'failed_delivery', 'cancelled']

export default function OrdersPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const { staff } = useAuthStore()
  const isCustomerSupport = staff?.role === 'customer_support'

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', statusFilter, search, staff?.id],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, businesses(name), order_items(product_name, quantity)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (isCustomerSupport) query = query.eq('created_by', staff.id)

      if (search.trim()) {
        query = query.or(
          `customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,order_number.ilike.%${search}%`
        )
      }

      const { data } = await query
      return data || []
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Orders"
        actions={
          <Link to="/orders/new" className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
            <Plus size={16} /> New
          </Link>
        }
      />

      <div className="px-4 py-3 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, phone, order#..."
            className="input-field pl-9 text-sm"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-6 space-y-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => <OrderCardSkeleton key={i} />)
        ) : orders?.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No orders found"
            description={search ? 'Try a different search term' : 'No orders in this category'}
            action={
              <Link to="/orders/new" className="btn-primary px-5 py-2.5 text-sm flex items-center gap-1.5 mx-auto w-fit">
                <Plus size={16} /> Create Order
              </Link>
            }
          />
        ) : (
          orders.map(order => (
            <Link key={order.id} to={`/orders/${order.id}`} className="block card active:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-sm text-gray-900">{order.customer_name}</p>
                  <p className="text-xs text-gray-500">{order.order_number} · {order.businesses?.name}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-xs text-gray-600 truncate mb-2">
                {order.order_items?.map(i => `${i.product_name} x${i.quantity}`).join(', ')}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">{formatNaira(order.total_amount)}</span>
                <span className="text-xs text-gray-400">{formatDate(order.created_at)}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
