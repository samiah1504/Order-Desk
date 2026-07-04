import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Phone, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatNaira, formatDate, getWhatsAppUrl } from '@/lib/utils'

export default function CustomerDetailPage() {
  const { id } = useParams()

  const { data: customer } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('*, orders(*, businesses(name), order_items(product_name, quantity)), customer_addresses(*)')
        .eq('id', id)
        .single()
      return data
    },
  })

  if (!customer) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin" /></div>

  const orders = customer.orders || []
  const paid = orders.filter(o => o.status === 'paid')
  const failed = orders.filter(o => o.status === 'failed_delivery')
  const totalSpent = paid.reduce((s, o) => s + (o.total_amount || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title={customer.full_name} back />

      <div className="px-4 pt-4 pb-6 space-y-4">
        <div className="card space-y-3">
          <p className="font-bold text-xl">{customer.full_name}</p>
          <p className="text-gray-600">{customer.phone}</p>

          <div className="flex gap-2">
            <a href={`tel:${customer.phone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-50 text-green-700 rounded-xl text-sm font-semibold">
              <Phone size={15} /> Call
            </a>
            <a href={getWhatsAppUrl(customer.phone)} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold">
              <MessageCircle size={15} /> WhatsApp
            </a>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900">{orders.length}</p>
              <p className="text-xs text-gray-400">Total Orders</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-green-600">{paid.length}</p>
              <p className="text-xs text-gray-400">Paid</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-red-500">{failed.length}</p>
              <p className="text-xs text-gray-400">Failed</p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-1 border-t">
            <span className="text-sm text-gray-500">Total Spent</span>
            <span className="font-black text-lg text-emerald-600">{formatNaira(totalSpent)}</span>
          </div>

          {customer.notes && (
            <div className="bg-yellow-50 rounded-xl p-3">
              <p className="text-xs font-bold text-yellow-800 mb-1">Notes</p>
              <p className="text-sm text-yellow-900">{customer.notes}</p>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-bold text-sm mb-3">Order History</h2>
          <div className="space-y-2">
            {orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(order => (
              <Link key={order.id} to={`/orders/${order.id}`} className="block p-3 bg-gray-50 rounded-xl active:bg-gray-100">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <p className="font-semibold text-sm">{order.order_number}</p>
                    <p className="text-xs text-gray-400">{formatDate(order.created_at)} · {order.businesses?.name}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-600">
                    {order.order_items?.map(i => `${i.product_name} ×${i.quantity}`).join(', ')}
                  </p>
                  <p className="font-bold text-sm">{formatNaira(order.total_amount)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
