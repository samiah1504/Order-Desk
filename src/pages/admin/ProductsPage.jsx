import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatNaira } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function ProductsPage() {
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [businessFilter, setBusinessFilter] = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState('')
  const [form, setForm] = useState({ name: '', business_id: '', category: '', default_selling_price: '', default_cost_price: '' })
  const queryClient = useQueryClient()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const { data: businesses } = useQuery({
    queryKey: ['businesses-active'],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('id, name').eq('is_active', true)
      return data || []
    },
  })

  const { data: products } = useQuery({
    queryKey: ['products-admin', search, businessFilter, verifiedFilter],
    queryFn: async () => {
      let query = supabase.from('products').select('*, businesses(name)').order('name')
      if (search) query = query.ilike('name', `%${search}%`)
      if (businessFilter) query = query.eq('business_id', businessFilter)
      if (verifiedFilter === 'unverified') query = query.eq('is_verified', false)
      if (verifiedFilter === 'verified') query = query.eq('is_verified', true)
      const { data } = await query
      return data || []
    },
  })

  const createProduct = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.business_id) throw new Error('Name and business required')
      const { error } = await supabase.from('products').insert({
        name: form.name,
        business_id: form.business_id,
        category: form.category || null,
        default_selling_price: parseFloat(form.default_selling_price) || null,
        default_cost_price: parseFloat(form.default_cost_price) || null,
        is_active: true,
        is_verified: true,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success('Product created!')
      queryClient.invalidateQueries({ queryKey: ['products-admin'] })
      setShowModal(false)
      setForm({ name: '', business_id: '', category: '', default_selling_price: '', default_cost_price: '' })
    },
    onError: (err) => toast.error(err.message),
  })

  const verify = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('products').update({ is_verified: true }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products-admin'] }),
    onError: (err) => toast.error(err.message),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('products').update({ is_active: !is_active }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products-admin'] }),
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Products"
        back
        actions={
          <Button size="sm" onClick={() => setShowModal(true)} className="flex items-center gap-1">
            <Plus size={16} /> Add
          </Button>
        }
      />

      <div className="px-4 pt-3 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="input-field pl-9" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setBusinessFilter('')} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${!businessFilter ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>All</button>
          {businesses?.map(b => (
            <button key={b.id} onClick={() => setBusinessFilter(b.id)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${businessFilter === b.id ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{b.name}</button>
          ))}
          <button onClick={() => setVerifiedFilter(verifiedFilter === 'unverified' ? '' : 'unverified')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${verifiedFilter === 'unverified' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            Unverified
          </button>
        </div>

        <div className="space-y-2 pb-6">
          {products?.map(product => (
            <div key={product.id} className="card space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.businesses?.name} · {product.category || 'No category'}</p>
                  {product.default_selling_price && <p className="text-xs font-semibold text-brand-yellow-dark">{formatNaira(product.default_selling_price)}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!product.is_verified && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-semibold">Unverified</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                {!product.is_verified && (
                  <button onClick={() => verify.mutate(product.id)} className="flex-1 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-semibold">
                    Verify
                  </button>
                )}
                <button onClick={() => toggleActive.mutate({ id: product.id, is_active: product.is_active })}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold ${product.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {product.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Product">
        <div className="space-y-4">
          <Input label="Product Name *" value={form.name} onChange={e => set('name', e.target.value)} />
          <Select label="Business *" value={form.business_id} onChange={e => set('business_id', e.target.value)}>
            <option value="">Select business</option>
            {businesses?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Input label="Category" value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Chairs, Toys" />
          <Input label="Default Selling Price (₦)" type="number" value={form.default_selling_price} onChange={e => set('default_selling_price', e.target.value)} />
          <Input label="Default Cost Price (₦)" type="number" value={form.default_cost_price} onChange={e => set('default_cost_price', e.target.value)} />
          <Button className="w-full" loading={createProduct.isPending} onClick={() => createProduct.mutate()}>
            Add Product
          </Button>
        </div>
      </Modal>
    </div>
  )
}
