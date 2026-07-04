import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Square, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { formatNaira, NIGERIAN_STATES } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function NewWaybillBatchPage() {
  const navigate = useNavigate()
  const { staff } = useAuthStore()
  const queryClient = useQueryClient()

  const [selectedOrders, setSelectedOrders] = useState([])
  const [waybillData, setWaybillData] = useState({
    waybill_type: 'internal',
    courier_company: '',
    waybill_number: '',
    date_shipped: new Date().toISOString().split('T')[0],
    destination_state: '',
    waybill_cost: '',
    packaging_cost: '',
    loading_cost: '',
    transport_cost: '',
    dispatch_cost: '',
    other_logistics_cost: '',
    notes: '',
  })
  const [step, setStep] = useState(1)
  const [filterState, setFilterState] = useState('')

  const { data: awaitingOrders } = useQuery({
    queryKey: ['awaiting-waybill-orders', filterState],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, businesses(name), order_items(product_name, quantity, business_id)')
        .eq('status', 'awaiting_waybill')
        .order('created_at', { ascending: false })
      if (filterState) query = query.eq('state', filterState)
      const { data } = await query
      return data || []
    },
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data } = await supabase.from('warehouses').select('*').eq('is_active', true)
      return data || []
    },
  })

  function toggleOrder(orderId) {
    setSelectedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    )
  }

  function setField(key, value) {
    setWaybillData(p => ({ ...p, [key]: value }))
  }

  const productSummary = () => {
    const selectedOrderData = awaitingOrders?.filter(o => selectedOrders.includes(o.id)) || []
    const summary = {}
    selectedOrderData.forEach(order => {
      const state = order.state
      if (!summary[state]) summary[state] = {}
      order.order_items?.forEach(item => {
        if (!summary[state][item.product_name]) summary[state][item.product_name] = 0
        summary[state][item.product_name] += item.quantity
      })
    })
    return summary
  }

  const totalLogistics = [
    'waybill_cost', 'packaging_cost', 'loading_cost', 'transport_cost', 'dispatch_cost', 'other_logistics_cost'
  ].reduce((s, k) => s + (parseFloat(waybillData[k]) || 0), 0)

  const createBatch = useMutation({
    mutationFn: async () => {
      if (selectedOrders.length === 0) throw new Error('Select at least one order')

      const year = new Date().getFullYear()
      const { count } = await supabase.from('waybill_batches').select('*', { count: 'exact', head: true })
      const batchNumber = `WB-${year}-${String((count || 0) + 1).padStart(4, '0')}`

      const { data: batch, error } = await supabase
        .from('waybill_batches')
        .insert({
          batch_number: batchNumber,
          waybill_type: waybillData.waybill_type,
          courier_company: waybillData.courier_company || null,
          waybill_number: waybillData.waybill_number || null,
          date_shipped: waybillData.date_shipped,
          destination_state: waybillData.destination_state || null,
          waybill_cost: parseFloat(waybillData.waybill_cost) || 0,
          packaging_cost: parseFloat(waybillData.packaging_cost) || 0,
          loading_cost: parseFloat(waybillData.loading_cost) || 0,
          transport_cost: parseFloat(waybillData.transport_cost) || 0,
          dispatch_cost: parseFloat(waybillData.dispatch_cost) || 0,
          other_logistics_cost: parseFloat(waybillData.other_logistics_cost) || 0,
          total_logistics_cost: totalLogistics,
          notes: waybillData.notes || null,
          status: 'pending',
          created_by: staff?.id,
        })
        .select('id, batch_number')
        .single()

      if (error) throw error

      const perOrderCost = totalLogistics / selectedOrders.length

      await supabase.from('waybill_batch_orders').insert(
        selectedOrders.map(orderId => ({
          batch_id: batch.id,
          order_id: orderId,
          allocated_cost: perOrderCost,
        }))
      )

      await supabase.from('orders')
        .update({ status: 'waybilled', updated_at: new Date().toISOString() })
        .in('id', selectedOrders)

      for (const orderId of selectedOrders) {
        await supabase.from('order_timeline').insert({
          order_id: orderId,
          action: `Added to waybill batch ${batchNumber}`,
          from_status: 'awaiting_waybill',
          to_status: 'waybilled',
          performed_by: staff?.id,
          staff_name: staff?.full_name,
        })
      }

      if (totalLogistics > 0) {
        const selectedOrdersData = awaitingOrders?.filter(o => selectedOrders.includes(o.id)) || []
        for (const order of selectedOrdersData) {
          await supabase.from('expenses').insert({
            business_id: order.business_id,
            order_id: order.id,
            waybill_batch_id: batch.id,
            category: 'waybill_courier',
            amount: perOrderCost,
            description: `Waybill batch ${batchNumber}`,
            expense_date: waybillData.date_shipped,
            created_by: staff?.id,
          })
        }
      }

      return batch
    },
    onSuccess: (batch) => {
      toast.success(`Batch ${batch.batch_number} created!`)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['waybill-batches'] })
      navigate(`/waybill/${batch.id}`)
    },
    onError: (err) => toast.error(err.message),
  })

  const summary = productSummary()

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="New Waybill Batch" back />

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Step 1: Select Orders */}
        {step === 1 && (
          <>
            <div className="card space-y-3">
              <h2 className="font-bold text-sm">Select Orders</h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setFilterState('')} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${!filterState ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
                  All States
                </button>
                {NIGERIAN_STATES.map(s => (
                  <button key={s} onClick={() => setFilterState(s)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${filterState === s ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {s}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {awaitingOrders?.map(order => (
                  <button
                    key={order.id}
                    onClick={() => toggleOrder(order.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      selectedOrders.includes(order.id)
                        ? 'border-brand-yellow bg-brand-yellow-light'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center mt-0.5 shrink-0 ${
                        selectedOrders.includes(order.id) ? 'bg-brand-yellow' : 'bg-gray-200'
                      }`}>
                        {selectedOrders.includes(order.id) && <Check size={12} strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{order.customer_name}</p>
                        <p className="text-xs text-gray-500">{order.order_number} · {order.state}</p>
                        <p className="text-xs text-gray-600 truncate">
                          {order.order_items?.map(i => `${i.product_name} x${i.quantity}`).join(', ')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}

                {awaitingOrders?.length === 0 && (
                  <p className="text-center py-8 text-gray-500 text-sm">No orders awaiting waybill</p>
                )}
              </div>

              {selectedOrders.length > 0 && (
                <div className="bg-brand-yellow-light rounded-xl p-3">
                  <p className="font-bold text-sm">{selectedOrders.length} orders selected</p>
                  <div className="mt-2 space-y-1">
                    {Object.entries(summary).map(([state, products]) => (
                      <div key={state}>
                        <p className="text-xs font-bold text-gray-700">{state}:</p>
                        {Object.entries(products).map(([name, qty]) => (
                          <p key={name} className="text-xs text-gray-600 ml-2">• {name} × {qty}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => setStep(2)}
              disabled={selectedOrders.length === 0}
            >
              Continue with {selectedOrders.length} orders
            </Button>
          </>
        )}

        {/* Step 2: Waybill Details */}
        {step === 2 && (
          <>
            <div className="card space-y-4">
              <h2 className="font-bold text-sm">Waybill Details</h2>
              <Select label="Waybill Type" value={waybillData.waybill_type} onChange={e => setField('waybill_type', e.target.value)}>
                <option value="internal">Internal (From Lagos Warehouse)</option>
                <option value="supplier">Supplier Direct</option>
              </Select>
              <Input label="Courier Company" value={waybillData.courier_company} onChange={e => setField('courier_company', e.target.value)} placeholder="e.g. GIG Logistics" />
              <Input label="Waybill / Tracking Number" value={waybillData.waybill_number} onChange={e => setField('waybill_number', e.target.value)} />
              <Input label="Date Shipped" type="date" value={waybillData.date_shipped} onChange={e => setField('date_shipped', e.target.value)} />
              <Select label="Destination State" value={waybillData.destination_state} onChange={e => setField('destination_state', e.target.value)}>
                <option value="">Select state</option>
                {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>

            <div className="card space-y-4">
              <h2 className="font-bold text-sm">Logistics Expenses</h2>
              <Input label="Waybill / Courier Cost (₦)" type="number" value={waybillData.waybill_cost} onChange={e => setField('waybill_cost', e.target.value)} placeholder="0" />
              <Input label="Packaging Cost (₦)" type="number" value={waybillData.packaging_cost} onChange={e => setField('packaging_cost', e.target.value)} placeholder="0" />
              <Input label="Loading Cost (₦)" type="number" value={waybillData.loading_cost} onChange={e => setField('loading_cost', e.target.value)} placeholder="0" />
              <Input label="Transport Cost (₦)" type="number" value={waybillData.transport_cost} onChange={e => setField('transport_cost', e.target.value)} placeholder="0" />
              <Input label="Dispatch Cost (₦)" type="number" value={waybillData.dispatch_cost} onChange={e => setField('dispatch_cost', e.target.value)} placeholder="0" />
              <Input label="Other (₦)" type="number" value={waybillData.other_logistics_cost} onChange={e => setField('other_logistics_cost', e.target.value)} placeholder="0" />

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-bold">Total Logistics Cost</span>
                <span className="font-black text-lg text-red-600">{formatNaira(totalLogistics)}</span>
              </div>
              <p className="text-xs text-gray-500">
                = {formatNaira(totalLogistics / selectedOrders.length)} per order (equal allocation)
              </p>

              <Textarea label="Notes" value={waybillData.notes} onChange={e => setField('notes', e.target.value)} placeholder="Additional notes..." />
            </div>

            <div className="card bg-blue-50 border-blue-100">
              <h3 className="font-bold text-sm text-blue-800 mb-2">Product Summary ({selectedOrders.length} orders)</h3>
              {Object.entries(summary).map(([state, products]) => (
                <div key={state} className="mb-3">
                  <p className="text-xs font-bold text-blue-700 uppercase">{state}</p>
                  {Object.entries(products).map(([name, qty]) => (
                    <p key={name} className="text-sm text-blue-900">• {name} × {qty}</p>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                className="flex-1"
                loading={createBatch.isPending}
                onClick={() => createBatch.mutate()}
              >
                Create Batch
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
