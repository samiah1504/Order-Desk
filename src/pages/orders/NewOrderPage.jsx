import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Search, ChevronDown, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatNaira, NIGERIAN_STATES, ORDER_SOURCES } from '@/lib/utils'
import toast from 'react-hot-toast'

function ProductSearchModal({ open, onClose, onSelect }) {
  const [search, setSearch] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customBusiness, setCustomBusiness] = useState('')

  const { data: products } = useQuery({
    queryKey: ['products-search', search],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*, businesses(name)')
        .eq('is_active', true)
        .limit(30)
      if (search.trim()) query = query.ilike('name', `%${search}%`)
      const { data } = await query
      return data || []
    },
    enabled: open,
  })

  const { data: businesses } = useQuery({
    queryKey: ['businesses-active'],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('id, name').eq('is_active', true)
      return data || []
    },
    enabled: open && showCustom,
  })

  async function handleAddCustom() {
    if (!customName.trim() || !customBusiness) return
    const { data, error } = await supabase
      .from('products')
      .insert({ name: customName.trim(), business_id: customBusiness, is_active: true, is_verified: false })
      .select('*, businesses(name)')
      .single()
    if (error) { toast.error('Failed to add product'); return }
    onSelect(data)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Select Product">
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="input-field pl-9"
          />
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {products?.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); onClose() }}
              className="w-full text-left p-3 bg-gray-50 rounded-xl active:bg-gray-100 transition-colors"
            >
              <p className="font-semibold text-sm">{p.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-gray-500">{p.businesses?.name}</p>
                {!p.is_verified && (
                  <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">Unverified</span>
                )}
              </div>
              {p.default_selling_price && (
                <p className="text-xs font-semibold text-brand-yellow-dark mt-0.5">{formatNaira(p.default_selling_price)}</p>
              )}
            </button>
          ))}
        </div>

        <div className="border-t pt-3">
          {!showCustom ? (
            <button
              onClick={() => setShowCustom(true)}
              className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-600 font-semibold flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Add Custom Product
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase">Custom Product</p>
              <Input
                label="Product Name"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="Enter product name"
              />
              <Select
                label="Business"
                value={customBusiness}
                onChange={e => setCustomBusiness(e.target.value)}
              >
                <option value="">Select business</option>
                {businesses?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
              <Button onClick={handleAddCustom} className="w-full">Add Custom Product</Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function CustomerLookup({ phone, onFound }) {
  const { data: customer } = useQuery({
    queryKey: ['customer-lookup', phone],
    queryFn: async () => {
      if (phone.length < 10) return null
      const { data } = await supabase
        .from('customers')
        .select('*, orders(id, status, order_number, created_at)')
        .eq('phone', phone)
        .single()
      return data
    },
    enabled: phone.length >= 10,
  })

  if (!customer) return null

  const orders = customer.orders || []
  const failed = orders.filter(o => o.status === 'failed_delivery').length
  const paid = orders.filter(o => o.status === 'paid').length

  return (
    <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
      <div className="flex items-center gap-2 mb-2">
        <User size={14} className="text-blue-600" />
        <p className="text-xs font-bold text-blue-800">Returning Customer</p>
      </div>
      <p className="font-semibold text-sm text-gray-900">{customer.full_name}</p>
      <div className="flex gap-3 mt-1">
        <p className="text-xs text-gray-500">{orders.length} orders</p>
        <p className="text-xs text-green-600 font-semibold">{paid} paid</p>
        {failed > 0 && <p className="text-xs text-red-600 font-semibold">⚠️ {failed} failed</p>}
      </div>
      {customer.notes && <p className="text-xs text-gray-500 mt-1 italic">{customer.notes}</p>}
    </div>
  )
}

export default function NewOrderPage() {
  const navigate = useNavigate()
  const { staff } = useAuthStore()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    state: '',
    city: '',
    order_source: '',
    delivery_note: '',
    customer_requested_date: '',
    preferred_delivery_window: '',
  })
  const [items, setItems] = useState([])
  const [productModalOpen, setProductModalOpen] = useState(false)

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function addProduct(product) {
    setItems(prev => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        business_id: product.business_id,
        business_name: product.businesses?.name,
        quantity: 1,
        unit_price: product.default_selling_price || 0,
        cost_price: product.default_cost_price || 0,
        colour: '',
        size: '',
      }
    ])
  }

  function updateItem(index, key, value) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [key]: value } : item))
  }

  function removeItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const total = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0)

  const businessId = items[0]?.business_id || null

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!form.customer_name || !form.customer_phone || !form.customer_address || !form.state) {
        throw new Error('Please fill in all required fields')
      }
      if (items.length === 0) throw new Error('Add at least one product')

      // Upsert customer
      let customerId = null
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', form.customer_phone)
        .single()

      if (existingCustomer) {
        customerId = existingCustomer.id
        await supabase.from('customers').update({ full_name: form.customer_name }).eq('id', customerId)
      } else {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({ full_name: form.customer_name, phone: form.customer_phone })
          .select('id')
          .single()
        customerId = newCustomer?.id
      }

      // Generate order number
      const year = new Date().getFullYear()
      const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true })
      const orderNumber = `ORD-${year}-${String((count || 0) + 1).padStart(5, '0')}`

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_id: customerId,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_address: form.customer_address,
          state: form.state,
          city: form.city,
          business_id: businessId,
          order_source: form.order_source || null,
          delivery_note: form.delivery_note || null,
          customer_requested_date: form.customer_requested_date || null,
          preferred_delivery_window: form.preferred_delivery_window || null,
          total_amount: total,
          status: 'new',
          created_by: staff?.id,
        })
        .select('id, order_number')
        .single()

      if (error) throw error

      await supabase.from('order_items').insert(
        items.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          business_id: item.business_id,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          cost_price: Number(item.cost_price) || null,
          colour: item.colour || null,
          size: item.size || null,
        }))
      )

      await supabase.from('order_timeline').insert({
        order_id: order.id,
        action: 'Order created',
        to_status: 'new',
        performed_by: staff?.id,
        staff_name: staff?.full_name,
      })

      return order
    },
    onSuccess: (order) => {
      toast.success(`Order ${order.order_number} created!`)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      navigate(`/orders/${order.id}`)
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="New Order" back />

      <form onSubmit={e => { e.preventDefault(); createOrder.mutate() }} className="px-4 pb-6 space-y-4 pt-4">
        {/* Customer Details */}
        <div className="card space-y-4">
          <h2 className="font-bold text-sm text-gray-700 uppercase tracking-wide">Customer Details</h2>
          <Input
            label="Customer Name *"
            value={form.customer_name}
            onChange={e => setField('customer_name', e.target.value)}
            placeholder="Full name"
          />
          <Input
            label="Phone Number *"
            type="tel"
            value={form.customer_phone}
            onChange={e => setField('customer_phone', e.target.value)}
            placeholder="080..."
          />
          <CustomerLookup phone={form.customer_phone} />
          <Textarea
            label="Delivery Address *"
            value={form.customer_address}
            onChange={e => setField('customer_address', e.target.value)}
            placeholder="Full delivery address"
          />
          <Select
            label="State *"
            value={form.state}
            onChange={e => setField('state', e.target.value)}
          >
            <option value="">Select state</option>
            {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input
            label="City / Area"
            value={form.city}
            onChange={e => setField('city', e.target.value)}
            placeholder="City or area"
          />
        </div>

        {/* Products */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-gray-700 uppercase tracking-wide">Products</h2>
            {businessId && (
              <span className="text-xs bg-brand-yellow-light text-yellow-800 px-2 py-1 rounded-full font-semibold">
                {items[0]?.business_name}
              </span>
            )}
          </div>

          {items.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-3 space-y-3">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-sm">{item.product_name}</p>
                <button type="button" onClick={() => removeItem(index)} className="p-1 text-red-500">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={e => updateItem(index, 'quantity', e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Unit Price (₦)</label>
                  <input
                    type="number"
                    min="0"
                    value={item.unit_price}
                    onChange={e => updateItem(index, 'unit_price', e.target.value)}
                    className="input-field"
                  />
                </div>
                <Input
                  label="Colour"
                  value={item.colour}
                  onChange={e => updateItem(index, 'colour', e.target.value)}
                  placeholder="e.g. Brown"
                />
                <Input
                  label="Size"
                  value={item.size}
                  onChange={e => updateItem(index, 'size', e.target.value)}
                  placeholder="e.g. Large"
                />
              </div>
              <p className="text-xs font-bold text-right text-brand-yellow-dark">
                Subtotal: {formatNaira(item.quantity * item.unit_price)}
              </p>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setProductModalOpen(true)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-600 font-semibold flex items-center justify-center gap-2 active:bg-gray-50"
          >
            <Plus size={16} /> Add Product
          </button>

          {items.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="font-bold text-gray-700">Total Amount</span>
              <span className="text-xl font-black text-brand-yellow-dark">{formatNaira(total)}</span>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="card space-y-4">
          <h2 className="font-bold text-sm text-gray-700 uppercase tracking-wide">Order Details</h2>
          <Select
            label="Order Source"
            value={form.order_source}
            onChange={e => setField('order_source', e.target.value)}
          >
            <option value="">Select source</option>
            {ORDER_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <Textarea
            label="Delivery Note"
            value={form.delivery_note}
            onChange={e => setField('delivery_note', e.target.value)}
            placeholder="Special instructions..."
          />
          <Input
            label="Customer Requested Date"
            type="date"
            value={form.customer_requested_date}
            onChange={e => setField('customer_requested_date', e.target.value)}
          />
          <Input
            label="Preferred Delivery Window"
            value={form.preferred_delivery_window}
            onChange={e => setField('preferred_delivery_window', e.target.value)}
            placeholder="e.g. Morning, Afternoon"
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={createOrder.isPending}
        >
          Create Order
        </Button>
      </form>

      <ProductSearchModal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        onSelect={addProduct}
      />
    </div>
  )
}
