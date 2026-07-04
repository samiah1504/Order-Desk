import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, User, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

async function callFunction(path, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json
}

const ROLES = [
  { value: 'ceo',                label: 'CEO / Super Admin' },
  { value: 'operations_manager', label: 'Operations Manager' },
  { value: 'customer_support',   label: 'Customer Support' },
  { value: 'fulfillment',        label: 'Fulfillment Officer' },
  { value: 'waybill',            label: 'Waybill Officer' },
  { value: 'inventory',          label: 'Inventory / Warehouse' },
]

const ROLE_COLORS = {
  ceo:                'bg-yellow-100 text-yellow-800',
  operations_manager: 'bg-blue-100 text-blue-700',
  customer_support:   'bg-green-100 text-green-700',
  fulfillment:        'bg-purple-100 text-purple-700',
  waybill:            'bg-orange-100 text-orange-700',
  inventory:          'bg-teal-100 text-teal-700',
}

const EMPTY_FORM = { full_name: '', phone: '', staff_code: '', role: 'customer_support', password: '', confirm_password: '' }

export default function StaffPage() {
  const [showAdd, setShowAdd]         = useState(false)
  const [showReset, setShowReset]     = useState(null)   // staff record or null
  const [form, setForm]               = useState(EMPTY_FORM)
  const [newPassword, setNewPassword] = useState('')
  const queryClient = useQueryClient()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-all'],
    queryFn: async () => {
      const { data } = await supabase.from('staff').select('*').order('full_name')
      return data || []
    },
  })

  const createStaff = useMutation({
    mutationFn: async () => {
      if (!form.full_name || !form.staff_code || !form.role || !form.password) throw new Error('Fill in all required fields')
      if (form.password !== form.confirm_password) throw new Error('Passwords do not match')
      if (form.password.length < 6) throw new Error('Password must be at least 6 characters')

      await callFunction('/.netlify/functions/create-staff', {
        full_name:  form.full_name,
        phone:      form.phone,
        staff_code: form.staff_code,
        role:       form.role,
        password:   form.password,
      })
    },
    onSuccess: () => {
      toast.success('Staff account created!')
      queryClient.invalidateQueries({ queryKey: ['staff-all'] })
      setShowAdd(false)
      setForm(EMPTY_FORM)
    },
    onError: (err) => toast.error(err.message),
  })

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (!newPassword) throw new Error('Enter a new password')
      if (newPassword.length < 6) throw new Error('Password must be at least 6 characters')

      await callFunction('/.netlify/functions/reset-staff-password', {
        staff_id: showReset.id, new_password: newPassword,
      })
    },
    onSuccess: () => {
      toast.success('Password updated!')
      queryClient.invalidateQueries({ queryKey: ['staff-all'] })
      setShowReset(null)
      setNewPassword('')
    },
    onError: (err) => toast.error(err.message),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('staff').update({ is_active: !is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-all'] }),
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Staff"
        back
        actions={
          <Button size="sm" onClick={() => setShowAdd(true)} className="flex items-center gap-1">
            <Plus size={16} /> Add Staff
          </Button>
        }
      />

      <div className="px-4 pt-4 pb-6 space-y-3">
        {staff.map(member => (
          <div key={member.id} className="card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                  <User size={18} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-bold">{member.full_name}</p>
                  <p className="text-xs font-mono text-gray-500">{member.staff_code}</p>
                  {member.phone && <p className="text-xs text-gray-400">{member.phone}</p>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[member.role] || 'bg-gray-100'}`}>
                  {ROLES.find(r => r.value === member.role)?.label || member.role}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {member.is_active ? 'Active' : 'Inactive'}
                </span>
                {!member.auth_user_id && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-50 text-red-600">
                    No login yet
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowReset(member); setNewPassword('') }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700"
              >
                <KeyRound size={14} />
                {member.auth_user_id ? 'Reset Password' : 'Set Password'}
              </button>
              <button
                onClick={() => toggleActive.mutate({ id: member.id, is_active: member.is_active })}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold ${
                  member.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                }`}
              >
                {member.is_active
                  ? <><ShieldOff size={14} /> Deactivate</>
                  : <><ShieldCheck size={14} /> Reactivate</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Staff Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setForm(EMPTY_FORM) }} title="Add Staff">
        <div className="space-y-4">
          <Input
            label="Full Name *"
            value={form.full_name}
            onChange={e => set('full_name', e.target.value)}
          />
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
          />
          <Input
            label="Staff Code *"
            value={form.staff_code}
            onChange={e => set('staff_code', e.target.value.toUpperCase())}
            placeholder="e.g. CS003"
          />
          <Select label="Role *" value={form.role} onChange={e => set('role', e.target.value)}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          <Input
            label="Password *"
            type="password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder="Min. 6 characters"
          />
          <Input
            label="Confirm Password *"
            type="password"
            value={form.confirm_password}
            onChange={e => set('confirm_password', e.target.value)}
          />
          <p className="text-xs text-gray-500">
            Staff will log in with their Staff Code and this password.
          </p>
          <Button className="w-full" loading={createStaff.isPending} onClick={() => createStaff.mutate()}>
            Create Staff Account
          </Button>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={!!showReset}
        onClose={() => { setShowReset(null); setNewPassword('') }}
        title={showReset?.auth_user_id ? 'Reset Password' : 'Set Login Password'}
      >
        {showReset && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="font-semibold">{showReset.full_name}</p>
              <p className="text-sm text-gray-500 font-mono">{showReset.staff_code}</p>
            </div>
            <Input
              label="New Password *"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
            />
            <p className="text-xs text-gray-500">
              Staff logs in with <span className="font-mono font-semibold">{showReset.staff_code}</span> and this password.
            </p>
            <Button className="w-full" loading={resetPassword.isPending} onClick={() => resetPassword.mutate()}>
              {showReset.auth_user_id ? 'Update Password' : 'Set Password & Enable Login'}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
