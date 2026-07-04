import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { formatNaira } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function ReceiveStockPage() {
  const navigate = useNavigate()
  const { staff } = useAuthStore()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    business_id: '',
    product_id: '',
    warehouse_id: '',
    quantity: '',
    purchase_cost_per_unit: '',
    supplier: '',
    date_received: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const { data: businesses } = useQuery({
    queryKey: ['businesses-active'],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('id, name').eq('is_active', true)
      return data || []
    },
  })

  const { data: products } = useQuery({
    queryKey: ['products-by-business', form.business_id],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name').eq('business_id', form.business_id).eq('is_active', true)
      return data || []
    },
    enabled: !!form.business_id,
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data } = await supabase.from('warehouses').select('id, name').eq('is_active', true)
      return data || []
    },
  })

  const totalCost = (parseFloat(form.quantity) || 0) * (parseFloat(form.purchase_cost_per_unit) || 0)

  const receiveStock = useMutation({
    mutationFn: async () => {
      if (!form.business_id || !form.product_id || !form.quantity) throw new Error('Fill in required fields')

      await supabase.from('inventory_movements').insert({
        business_id: form.business_id,
        product_id: form.product_id,
        warehouse_id: form.warehouse_id || null,
        movement_type: 'received',
        quantity: parseInt(form.quantity),
        purchase_cost_per_unit: parseFloat(form.purchase_cost_per_unit) || null,
        total_purchase_cost: totalCost || null,
        supplier: form.supplier || null,
        date_received: form.date_received,
        notes: form.notes || null,
        created_by: staff?.id,
      })

      const { data: existing } = await supabase
        .from('inventory_stock')
        .select('id, physical_qty')
        .eq('business_id', form.business_id)
        .eq('product_id', form.product_id)
        .eq('warehouse_id', form.warehouse_id || null)
        .single()

      if (existing) {
        await supabase.from('inventory_stock').update({
          physical_qty: existing.physical_qty + parseInt(form.quantity),
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id)
      } else {
        await supabase.from('inventory_stock').insert({
          business_id: form.business_id,
          product_id: form.product_id,
          warehouse_id: form.warehouse_id || null,
          physical_qty: parseInt(form.quantity),
          reserved_qty: 0,
          sold_qty: 0,
          returned_qty: 0,
          damaged_qty: 0,
        })
      }
    },
    onSuccess: () => {
      toast.success('Stock received!')
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] })
      navigate('/inventory')
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Receive Stock" back />
      <div className="px-4 pt-4 pb-6 space-y-4">
        <div className="card space-y-4">
          <Select label="Business *" value={form.business_id} onChange={e => setField('business_id', e.target.value)}>
            <option value="">Select business</option>
            {businesses?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Select label="Product *" value={form.product_id} onChange={e => setField('product_id', e.target.value)} disabled={!form.business_id}>
            <option value="">Select product</option>
            {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="Warehouse / Location" value={form.warehouse_id} onChange={e => setField('warehouse_id', e.target.value)}>
            <option value="">No specific warehouse</option>
            {warehouses?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
          <Input label="Quantity *" type="number" min="1" value={form.quantity} onChange={e => setField('quantity', e.target.value)} />
          <Input label="Purchase Cost Per Unit (₦)" type="number" value={form.purchase_cost_per_unit} onChange={e => setField('purchase_cost_per_unit', e.target.value)} placeholder="0" />
          {totalCost > 0 && (
            <p className="text-sm font-bold text-gray-700">Total Cost: {formatNaira(totalCost)}</p>
          )}
          <Input label="Supplier" value={form.supplier} onChange={e => setField('supplier', e.target.value)} placeholder="Supplier name" />
          <Input label="Date Received" type="date" value={form.date_received} onChange={e => setField('date_received', e.target.value)} />
          <Textarea label="Notes" value={form.notes} onChange={e => setField('notes', e.target.value)} />
        </div>

        <Button className="w-full" size="lg" loading={receiveStock.isPending} onClick={() => receiveStock.mutate()}>
          Receive Stock
        </Button>
      </div>
    </div>
  )
}
