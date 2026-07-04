import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { formatDate, formatNaira } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function WaybillBatchDetailPage() {
  const { id } = useParams()
  const { staff } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('orders')
  const [packedItems, setPackedItems] = useState({})

  const { data: batch, refetch } = useQuery({
    queryKey: ['waybill-batch', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('waybill_batches')
        .select(`
          *,
          waybill_batch_orders(
            id, order_id, allocated_cost, is_packed,
            orders(order_number, customer_name, customer_phone, state, total_amount, order_items(product_name, quantity))
          )
        `)
        .eq('id', id)
        .single()
      return data
    },
  })

  const productSummary = () => {
    const summary = {}
    batch?.waybill_batch_orders?.forEach(batchOrder => {
      const order = batchOrder.orders
      const state = order?.state || 'Unknown'
      if (!summary[state]) summary[state] = {}
      order?.order_items?.forEach(item => {
        const key = item.product_name
        if (!summary[state][key]) summary[state][key] = { qty: 0, packed: 0 }
        summary[state][key].qty += item.quantity
      })
    })
    return summary
  }

  const updateStatus = useMutation({
    mutationFn: async (newStatus) => {
      await supabase.from('waybill_batches').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)

      if (newStatus === 'received') {
        const orderIds = batch?.waybill_batch_orders?.map(bo => bo.order_id) || []
        await supabase.from('orders')
          .update({ status: 'received_warehouse', updated_at: new Date().toISOString() })
          .in('id', orderIds)

        for (const orderId of orderIds) {
          await supabase.from('order_timeline').insert({
            order_id: orderId,
            action: 'Received at destination warehouse',
            from_status: 'waybilled',
            to_status: 'received_warehouse',
            performed_by: staff?.id,
            staff_name: staff?.full_name,
          })
        }
      }
    },
    onSuccess: () => { toast.success('Batch updated!'); refetch(); queryClient.invalidateQueries({ queryKey: ['orders'] }) },
    onError: (err) => toast.error(err.message),
  })

  if (!batch) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin" /></div>

  const summary = productSummary()
  const orderCount = batch.waybill_batch_orders?.length || 0

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title={batch.batch_number} back subtitle={batch.destination_state} />

      <div className="px-4 pt-4 pb-6 space-y-4">
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              batch.status === 'pending' ? 'bg-orange-100 text-orange-700' :
              batch.status === 'waybilled' ? 'bg-purple-100 text-purple-700' :
              'bg-teal-100 text-teal-700'
            }`}>
              {batch.status}
            </span>
            <span className="text-xs text-gray-500">{orderCount} orders</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Type</p>
              <p className="font-semibold capitalize">{batch.waybill_type}</p>
            </div>
            {batch.courier_company && <div>
              <p className="text-xs text-gray-400">Courier</p>
              <p className="font-semibold">{batch.courier_company}</p>
            </div>}
            {batch.waybill_number && <div>
              <p className="text-xs text-gray-400">Waybill #</p>
              <p className="font-semibold">{batch.waybill_number}</p>
            </div>}
            {batch.date_shipped && <div>
              <p className="text-xs text-gray-400">Date Shipped</p>
              <p className="font-semibold">{formatDate(batch.date_shipped)}</p>
            </div>}
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-sm text-gray-500">Total Logistics Cost</span>
            <span className="font-bold text-red-600">{formatNaira(batch.total_logistics_cost)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        {batch.status === 'pending' && (
          <Button className="w-full" onClick={() => updateStatus.mutate('waybilled')} loading={updateStatus.isPending}>
            Mark as Waybilled
          </Button>
        )}
        {batch.status === 'waybilled' && (
          <Button className="w-full" onClick={() => updateStatus.mutate('received')} loading={updateStatus.isPending}>
            Mark Received at Warehouse
          </Button>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          {['orders', 'products', 'packing'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${
                activeTab === tab ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'orders' && (
          <div className="space-y-2">
            {batch.waybill_batch_orders?.map(batchOrder => {
              const order = batchOrder.orders
              return (
                <div key={batchOrder.id} className="card">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="font-bold text-sm">{order?.customer_name}</p>
                      <p className="text-xs text-gray-500">{order?.order_number} · {order?.state}</p>
                    </div>
                    <p className="font-bold text-sm">{formatNaira(order?.total_amount)}</p>
                  </div>
                  <p className="text-xs text-gray-600">
                    {order?.order_items?.map(i => `${i.product_name} ×${i.quantity}`).join(', ')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Allocated cost: {formatNaira(batchOrder.allocated_cost)}</p>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'products' && (
          <div className="card space-y-4">
            <h3 className="font-bold text-sm">Product Summary by State</h3>
            {Object.entries(summary).map(([state, products]) => (
              <div key={state}>
                <p className="font-bold text-xs uppercase tracking-wide text-gray-500 mb-2">{state}</p>
                {Object.entries(products).map(([name, data]) => (
                  <div key={name} className="flex justify-between items-center py-1.5 border-b border-gray-50">
                    <span className="text-sm">{name}</span>
                    <span className="font-bold text-sm bg-brand-yellow-light text-yellow-800 px-2.5 py-0.5 rounded-full">×{data.qty}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'packing' && (
          <div className="card space-y-3">
            <h3 className="font-bold text-sm">Packing Checklist</h3>
            <p className="text-xs text-gray-500">Tick each order when packed</p>
            {batch.waybill_batch_orders?.map(batchOrder => {
              const order = batchOrder.orders
              const isPacked = packedItems[batchOrder.id] || batchOrder.is_packed
              return (
                <button
                  key={batchOrder.id}
                  onClick={() => setPackedItems(p => ({ ...p, [batchOrder.id]: !isPacked }))}
                  className={`w-full text-left p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                    isPacked ? 'border-green-400 bg-green-50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    isPacked ? 'bg-green-500' : 'bg-gray-200'
                  }`}>
                    {isPacked && <Check size={14} className="text-white" strokeWidth={3} />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{order?.customer_name}</p>
                    <p className="text-xs text-gray-500">{order?.order_items?.map(i => `${i.product_name} ×${i.quantity}`).join(', ')}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
