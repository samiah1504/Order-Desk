import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/utils'
import { OrderCardSkeleton } from '@/components/ui/Skeleton'

export default function CustomerSupportDashboard() {
  const { staff } = useAuthStore()

  const { data: myOrders, isLoading } = useQuery({
    queryKey: ['my-orders', staff?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(product_name, quantity)')
        .eq('created_by', staff?.id)
        .in('status', ['new', 'awaiting_waybill'])
        .order('created_at', { ascending: false })
        .limit(10)
      return data || []
    },
    enabled: !!staff?.id,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-brand-yellow px-4 pt-12 pb-6">
        <p className="text-black/60 text-sm">Welcome back,</p>
        <h1 className="text-2xl font-black text-black">{staff?.full_name?.split(' ')[0]}</h1>
        <p className="text-black/60 text-xs font-medium mt-1">{staff?.staff_code} · Customer Support</p>
      </div>

      <div className="px-4 -mt-4 pb-6 space-y-4">
        <Link
          to="/orders/new"
          className="card flex items-center gap-4 bg-black border-0 text-white active:scale-[0.98] transition-transform"
        >
          <div className="w-12 h-12 bg-brand-yellow rounded-xl flex items-center justify-center shrink-0">
            <Plus size={24} className="text-black" />
          </div>
          <div>
            <p className="font-bold">Create New Order</p>
            <p className="text-xs text-gray-400">Capture a customer order</p>
          </div>
        </Link>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm">My Active Orders</h2>
            <Link to="/orders" className="text-xs text-brand-yellow-dark font-semibold flex items-center gap-1">
              See all <ChevronRight size={14} />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <OrderCardSkeleton key={i} />)}
            </div>
          ) : myOrders?.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-4xl mb-2">📋</p>
              <p className="font-semibold text-gray-700">No active orders</p>
              <p className="text-sm text-gray-500">Create your first order above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myOrders.map(order => (
                <Link key={order.id} to={`/orders/${order.id}`} className="block p-3 bg-gray-50 rounded-xl active:bg-gray-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-sm">{order.customer_name}</p>
                      <p className="text-xs text-gray-500">{order.order_number}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-gray-600 truncate">
                    {order.order_items?.map(i => `${i.product_name} x${i.quantity}`).join(', ')}
                  </p>
                  {order.customer_requested_date && (
                    <p className="text-xs text-gray-400 mt-1">
                      Requested: {formatDate(order.customer_requested_date)}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                    <a href={`tel:${order.customer_phone}`} onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                      <Phone size={12} /> Call
                    </a>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
