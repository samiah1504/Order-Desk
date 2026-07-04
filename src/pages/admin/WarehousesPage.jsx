import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const EMPTY = { name: '', location: '', state: '' }

function WarehouseForm({ initial = {}, onSave, loading }) {
  const [form, setForm] = useState({
    name:     initial.name     || '',
    location: initial.location || '',
    state:    initial.state    || '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <Input label="Warehouse Name *" value={form.name} onChange={e => set('name', e.target.value)} />
      <Input label="Location / Address" value={form.location} onChange={e => set('location', e.target.value)} />
      <Input label="State" value={form.state} onChange={e => set('state', e.target.value)} placeholder="e.g. Lagos" />
      <Button className="w-full" loading={loading} onClick={() => onSave(form)}>
        Save Warehouse
      </Button>
    </div>
  )
}

export default function WarehousesPage() {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const queryClient = useQueryClient()

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: async () => {
      const { data } = await supabase.from('warehouses').select('*').order('name')
      return data || []
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (form) => {
      if (!form.name.trim()) throw new Error('Warehouse name is required')
      const payload = {
        name:     form.name.trim(),
        location: form.location || null,
        state:    form.state    || null,
      }
      if (editing) {
        const { error } = await supabase.from('warehouses').update(payload).eq('id', editing.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('warehouses').insert(payload)
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Warehouse updated' : 'Warehouse created')
      queryClient.invalidateQueries({ queryKey: ['warehouses-all'] })
      setShowModal(false)
      setEditing(null)
    },
    onError: (err) => toast.error(err.message),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('warehouses').update({ is_active: !is_active }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['warehouses-all'] }),
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Warehouses"
        back
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setShowModal(true) }} className="flex items-center gap-1">
            <Plus size={16} /> Add
          </Button>
        }
      />

      <div className="px-4 pt-4 pb-6 space-y-3">
        {warehouses.map(wh => (
          <div key={wh.id} className="card space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-lg">{wh.name}</p>
                {wh.location && <p className="text-sm text-gray-500">{wh.location}</p>}
                {wh.state    && <p className="text-xs text-gray-400">{wh.state}</p>}
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${wh.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {wh.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setEditing(wh); setShowModal(true) }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-100 rounded-xl text-sm font-semibold"
              >
                <Edit size={14} /> Edit
              </button>
              <button
                onClick={() => toggleActive.mutate({ id: wh.id, is_active: wh.is_active })}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold ${wh.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
              >
                {wh.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}

        {warehouses.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🏭</p>
            <p className="font-semibold">No warehouses yet</p>
            <p className="text-sm mt-1">Add a warehouse to get started</p>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null) }}
        title={editing ? 'Edit Warehouse' : 'New Warehouse'}
      >
        <WarehouseForm
          initial={editing || {}}
          onSave={(form) => saveMutation.mutate(form)}
          loading={saveMutation.isPending}
        />
      </Modal>
    </div>
  )
}
