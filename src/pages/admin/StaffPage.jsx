import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const ROLES = [
  { value: 'ceo', label: 'CEO / Super Admin' },
  { value: 'operations_manager', label: 'Operations Manager' },
  { value: 'customer_support', label: 'Customer Support' },
  { value: 'fulfillment', label: 'Fulfillment Officer' },
  { value: 'waybill', label: 'Waybill Officer' },
  { value: 'inventory', label: 'Inventory / Warehouse' },
]

const ROLE_COLORS = {
  ceo: 'bg-yellow-100 text-yellow-800',
  operations_manager: 'bg-blue-100 text-blue-700',
  customer_support: 'bg-green-100 text-green-700',
  fulfillment: 'bg-purple-100 text-purple-700',
  waybill: 'bg-orange-100 text-orange-700',
  inventory: 'bg-teal-100 text-teal-700',
}

export default function StaffPage() {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'customer_support', staff_code: '' })
  const queryClient = useQueryClient()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const { data: staff } = useQuery({
    queryKey: ['staff-all'],
    queryFn: async () => {
      const { data } = await supabase.from('staff').select('*').order('full_name')
      return data || []
    },
  })

  const createStaff = useMutation({
    mutationFn: async () => {
      if (!form.full_name || !form.email || !form.role || !form.staff_code) throw new Error('Fill in all required fields')
      const { error } = await supabase.from('staff').insert(form)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Staff created!')
      queryClient.invalidateQueries({ queryKey: ['staff-all'] })
      setShowModal(false)
      setForm({ full_name: '', email: '', phone: '', role: 'customer_support', staff_code: '' })
    },
    onError: (err) => toast.error(err.message),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }) => {
      await supabase.from('staff').update({ is_active: !is_active }).eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-all'] }),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Staff"
        back
        actions={
          <Button size="sm" onClick={() => setShowModal(true)} className="flex items-center gap-1">
            <Plus size={16} /> Add
          </Button>
        }
      />

      <div className="px-4 pt-4 pb-6 space-y-3">
        {staff?.map(member => (
          <div key={member.id} className="card space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <User size={18} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-bold">{member.full_name}</p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                  <p className="text-xs text-gray-400 font-mono">{member.staff_code}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[member.role] || 'bg-gray-100'}`}>
                  {ROLES.find(r => r.value === member.role)?.label || member.role}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {member.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <button
              onClick={() => toggleActive.mutate({ id: member.id, is_active: member.is_active })}
              className={`w-full py-2 rounded-xl text-sm font-semibold ${member.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
            >
              {member.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Staff">
        <div className="space-y-4">
          <Input label="Full Name *" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
          <Input label="Email *" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          <Input label="Phone" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
          <Input label="Staff Code *" value={form.staff_code} onChange={e => set('staff_code', e.target.value.toUpperCase())} placeholder="e.g. CS001" />
          <Select label="Role *" value={form.role} onChange={e => set('role', e.target.value)}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          <Button className="w-full" loading={createStaff.isPending} onClick={() => createStaff.mutate()}>
            Create Staff Account
          </Button>
        </div>
      </Modal>
    </div>
  )
}
