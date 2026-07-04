import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, MessageCircle, Copy, Clock, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { formatNaira, formatDate, formatDateTime, getWhatsAppUrl, formatOrderForWhatsApp } from '@/lib/utils'
import toast from 'react-hot-toast'

const TRANSITION_MAP = {
  ceo: {
    new: ['awaiting_waybill', 'processing', 'cancelled'],
    awaiting_waybill: ['waybilled', 'cancelled'],
    waybilled: ['received_warehouse', 'cancelled'],
    received_warehouse: ['processing'],
    processing: ['delivered', 'failed_delivery'],
    delivered: ['paid', 'returned'],
    paid: ['returned'],
    failed_delivery: ['processing', 'cancelled', 'returned'],
  },
  operations_manager: {
    new: ['awaiting_waybill', 'processing', 'cancelled'],
    awaiting_waybill: ['waybilled', 'cancelled'],
    waybilled: ['received_warehouse'],
    received_warehouse: ['processing'],
    processing: ['delivered', 'failed_delivery'],
    delivered: ['paid', 'returned'],
    paid: [],
    failed_delivery: ['processing', 'cancelled'],
  },
  fulfillment: {
    new: ['awaiting_waybill', 'processing', 'cancelled'],
    processing: ['delivered', 'failed_delivery'],
    delivered: ['paid'],
    received_warehouse: ['processing'],
    failed_delivery: ['processing', 'cancelled'],
  },
  waybill: {
    awaiting_waybill: ['waybilled'],
    waybilled: ['received_warehouse'],
  },
}

function StatusTransitionModal({ open, onClose, order, onUpdate }) {
  const { staff } = useAuthStore()
  const [newStatus, setNewStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [expenses, setExpenses] = useState({ delivery_fee: '', installation_fee: '', offloading_fee: '', misc: '' })
  const [loading, setLoading] = useState(false)

  const transitions = TRANSITION_MAP[staff?.role] || TRANSITION_MAP.ceo
  const available = transitions[order?.status] || []

  async function handleSubmit() {
    if (!newStatus) return
    setLoading(true)
    try {
      const updates = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }
      if (newStatus === 'failed_delivery') updates.failed_reason = reason
      if (newStatus === 'cancelled') updates.cancel_reason = reason
      if (newStatus === 'paid') {
        updates.payment_confirmed_at = new Date().toISOString()
        updates.payment_confirmed_by = staff?.id
        updates.amount_paid = order.total_amount
      }

      await supabase.from('orders').update(updates).eq('id', order.id)

      await supabase.from('order_timeline').insert({
        order_id: order.id,
        action: `Status changed to ${newStatus}`,
        from_status: order.status,
        to_status: newStatus,
        notes: notes || null,
        performed_by: staff?.id,
        staff_name: staff?.full_name,
      })

      if (newStatus === 'paid') {
        const expenseItems = [
          { category: 'delivery_fee', amount: parseFloat(expenses.delivery_fee) || 0 },
          { category: 'installation_fee', amount: parseFloat(expenses.installation_fee) || 0 },
          { category: 'offloading_fee', amount: parseFloat(expenses.offloading_fee) || 0 },
          { category: 'miscellaneous', amount: parseFloat(expenses.misc) || 0 },
        ].filter(e => e.amount > 0)

        if (expenseItems.length > 0) {
          await supabase.from('expenses').insert(
            expenseItems.map(e => ({
              business_id: order.business_id,
              order_id: order.id,
              ...e,
              expense_date: new Date().toISOString().split('T')[0],
              created_by: staff?.id,
            }))
          )
        }
      }

      toast.success('Order updated!')
      onUpdate()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Update Order Status">
      <div className="space-y-4">
        <Select
          label="New Status"
          value={newStatus}
          onChange={e => setNewStatus(e.target.value)}
        >
          <option value="">Select status</option>
          {available.map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </Select>

        {(newStatus === 'failed_delivery' || newStatus === 'cancelled') && (
          <Textarea
            label="Reason *"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Enter reason..."
          />
        )}

        {newStatus === 'paid' && (
          <div className="space-y-3 bg-green-50 p-3 rounded-xl">
            <p className="text-xs font-bold text-green-800 uppercase">Record Delivery Expenses</p>
            <Input label="Delivery Fee (₦)" type="number" value={expenses.delivery_fee} onChange={e => setExpenses(p => ({ ...p, delivery_fee: e.target.value }))} placeholder="0" />
            <Input label="Installation Fee (₦)" type="number" value={expenses.installation_fee} onChange={e => setExpenses(p => ({ ...p, installation_fee: e.target.value }))} placeholder="0" />
            <Input label="Offloading Fee (₦)" type="number" value={expenses.offloading_fee} onChange={e => setExpenses(p => ({ ...p, offloading_fee: e.target.value }))} placeholder="0" />
            <Input label="Miscellaneous (₦)" type="number" value={expenses.misc} onChange={e => setExpenses(p => ({ ...p, misc: e.target.value }))} placeholder="0" />
          </div>
        )}

        <Textarea
          label="Notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes..."
        />

        <Button onClick={handleSubmit} className="w-full" loading={loading} disabled={!newStatus}>
          Update Status
        </Button>
      </div>
    </Modal>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { staff } = useAuthStore()
  const queryClient = useQueryClient()
  const [statusModalOpen, setStatusModalOpen] = useState(false)

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, businesses(*), order_items(*, products(name)), order_timeline(*, staff(full_name))')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: expenses } = useQuery({
    queryKey: ['order-expenses', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('order_id', id)
      return data || []
    },
  })

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin" /></div>
  if (!order) return <div className="p-4 text-center text-gray-500">Order not found</div>

  const canUpdateStatus = ['ceo', 'operations_manager', 'fulfillment', 'waybill'].includes(staff?.role)
  const availableTransitions = (TRANSITION_MAP[staff?.role] || {})[order.status] || []

  function handleCopyWhatsApp() {
    const text = formatOrderForWhatsApp({ ...order, order_items: order.order_items })
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={order.order_number}
        subtitle={order.businesses?.name}
        back
      />

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Status + Quick Actions */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <StatusBadge status={order.status} className="text-sm px-3 py-1.5" />
            {canUpdateStatus && availableTransitions.length > 0 && (
              <Button size="sm" onClick={() => setStatusModalOpen(true)} className="flex items-center gap-1">
                Update <ChevronDown size={14} />
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <a href={`tel:${order.customer_phone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-50 text-green-700 rounded-xl text-sm font-semibold active:scale-95 transition-all">
              <Phone size={15} /> Call
            </a>
            <a href={getWhatsAppUrl(order.customer_phone)} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold active:scale-95 transition-all">
              <MessageCircle size={15} /> WhatsApp
            </a>
            <button onClick={handleCopyWhatsApp} className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl active:scale-95 transition-all" title="Copy for WhatsApp">
              <Copy size={15} />
            </button>
          </div>
        </div>

        {/* Customer */}
        <div className="card space-y-2">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wide">Customer</h2>
          <p className="font-bold text-lg">{order.customer_name}</p>
          <p className="text-gray-600">{order.customer_phone}</p>
          <p className="text-sm text-gray-600">{order.customer_address}</p>
          <p className="text-sm text-gray-500">{order.city ? `${order.city}, ` : ''}{order.state}</p>
        </div>

        {/* Order Items */}
        <div className="card space-y-3">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wide">Items</h2>
          {order.order_items?.map((item, i) => (
            <div key={i} className="flex items-start justify-between bg-gray-50 rounded-xl p-3">
              <div>
                <p className="font-semibold text-sm">{item.product_name}</p>
                <p className="text-xs text-gray-500">
                  Qty: {item.quantity}
                  {item.colour ? ` · ${item.colour}` : ''}
                  {item.size ? ` · ${item.size}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{formatNaira(item.unit_price)}</p>
                <p className="text-xs text-gray-500">= {formatNaira(item.total_price)}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="font-bold">Total</span>
            <span className="font-black text-xl text-brand-yellow-dark">{formatNaira(order.total_amount)}</span>
          </div>
        </div>

        {/* Delivery */}
        <div className="card space-y-2">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wide">Delivery</h2>
          {order.customer_requested_date && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Customer Requested</span>
              <span className="text-sm font-semibold">{formatDate(order.customer_requested_date)}</span>
            </div>
          )}
          {order.preferred_delivery_window && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Preferred Window</span>
              <span className="text-sm font-semibold">{order.preferred_delivery_window}</span>
            </div>
          )}
          {order.planned_delivery_date && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Planned Date</span>
              <span className="text-sm font-semibold">{formatDate(order.planned_delivery_date)}</span>
            </div>
          )}
          {order.order_source && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Source</span>
              <span className="text-sm font-semibold capitalize">{order.order_source.replace('_', ' ')}</span>
            </div>
          )}
          {order.delivery_note && (
            <div className="bg-yellow-50 rounded-xl p-3 mt-1">
              <p className="text-xs font-semibold text-yellow-800 mb-1">Delivery Note</p>
              <p className="text-sm text-yellow-900">{order.delivery_note}</p>
            </div>
          )}
        </div>

        {/* Expenses */}
        {expenses?.length > 0 && (
          <div className="card space-y-2">
            <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wide">Expenses</h2>
            {expenses.map(e => (
              <div key={e.id} className="flex justify-between">
                <span className="text-sm text-gray-500 capitalize">{e.category.replace(/_/g, ' ')}</span>
                <span className="text-sm font-semibold">{formatNaira(e.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t">
              <span className="font-bold text-sm">Total Expenses</span>
              <span className="font-bold text-red-600">{formatNaira(expenses.reduce((s, e) => s + e.amount, 0))}</span>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="card space-y-3">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wide">Timeline</h2>
          <div className="space-y-3">
            {[...(order.order_timeline || [])].reverse().map((entry, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-brand-yellow mt-1.5 shrink-0" />
                  {i < (order.order_timeline.length - 1) && <div className="w-0.5 bg-gray-200 flex-1 mt-1" />}
                </div>
                <div className="flex-1 pb-3">
                  <p className="font-semibold text-sm">{entry.action}</p>
                  <p className="text-xs text-gray-500">{entry.staff_name || 'System'}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(entry.created_at)}</p>
                  {entry.notes && <p className="text-xs text-gray-600 mt-1 bg-gray-50 px-2 py-1 rounded-lg">{entry.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <StatusTransitionModal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        order={order}
        onUpdate={refetch}
      />
    </div>
  )
}
