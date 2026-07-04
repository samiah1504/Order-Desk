import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

function BusinessForm({ initial = {}, onSave, loading }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    phone: initial.phone || '',
    email: initial.email || '',
    address: initial.address || '',
    invoice_details: initial.invoice_details || '',
    bank_details: initial.bank_details ? JSON.stringify(initial.bank_details) : '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <Input label="Business Name *" value={form.name} onChange={e => set('name', e.target.value)} />
      <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
      <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
      <Textarea label="Address" value={form.address} onChange={e => set('address', e.target.value)} rows={2} />
      <Textarea label="Invoice Details" value={form.invoice_details} onChange={e => set('invoice_details', e.target.value)} rows={2} />
      <Button className="w-full" loading={loading} onClick={() => onSave(form)}>
        Save Business
      </Button>
    </div>
  )
}

export default function BusinessesPage() {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const queryClient = useQueryClient()

  const { data: businesses } = useQuery({
    queryKey: ['businesses-all'],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('*').order('name')
      return data || []
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (form) => {
      if (!form.name.trim()) throw new Error('Business name required')
      if (editing) {
        await supabase.from('businesses').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id)
      } else {
        await supabase.from('businesses').insert(form)
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Business updated' : 'Business created')
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['businesses-all'] })
      setShowModal(false)
      setEditing(null)
    },
    onError: (err) => toast.error(err.message),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }) => {
      await supabase.from('businesses').update({ is_active: !is_active }).eq('id', id)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['businesses-all'] }) },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Businesses"
        back
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setShowModal(true) }} className="flex items-center gap-1">
            <Plus size={16} /> Add
          </Button>
        }
      />

      <div className="px-4 pt-4 pb-6 space-y-3">
        {businesses?.map(biz => (
          <div key={biz.id} className="card space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-lg">{biz.name}</p>
                {biz.phone && <p className="text-sm text-gray-500">{biz.phone}</p>}
                {biz.email && <p className="text-sm text-gray-500">{biz.email}</p>}
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${biz.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {biz.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setEditing(biz); setShowModal(true) }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-100 rounded-xl text-sm font-semibold">
                <Edit size={14} /> Edit
              </button>
              <button onClick={() => toggleActive.mutate({ id: biz.id, is_active: biz.is_active })}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold ${biz.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {biz.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); setEditing(null) }} title={editing ? 'Edit Business' : 'New Business'}>
        <BusinessForm initial={editing || {}} onSave={(form) => saveMutation.mutate(form)} loading={saveMutation.isPending} />
      </Modal>
    </div>
  )
}
