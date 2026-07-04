import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export default function WaybillDashboard() {
  const { staff } = useAuthStore()

  const { data: counts } = useQuery({
    queryKey: ['waybill-counts'],
    queryFn: async () => {
      const [
        { count: awaitingWaybill },
        { count: waybilled },
        { count: receivedWarehouse },
        { count: activeBatches },
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'awaiting_waybill'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'waybilled'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'received_warehouse'),
        supabase.from('waybill_batches').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ])
      return { awaitingWaybill, waybilled, receivedWarehouse, activeBatches }
    },
    refetchInterval: 60_000,
  })

  const stats = [
    { label: 'Awaiting Waybill', value: counts?.awaitingWaybill ?? '-', emoji: '📤', to: '/fulfillment?status=awaiting_waybill', color: 'text-orange-600' },
    { label: 'Waybilled', value: counts?.waybilled ?? '-', emoji: '🚛', to: '/fulfillment?status=waybilled', color: 'text-purple-600' },
    { label: 'At Warehouse', value: counts?.receivedWarehouse ?? '-', emoji: '🏭', to: '/fulfillment?status=received_warehouse', color: 'text-teal-600' },
    { label: 'Active Batches', value: counts?.activeBatches ?? '-', emoji: '📦', to: '/waybill', color: 'text-blue-600' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-brand-yellow px-4 pt-12 pb-6">
        <p className="text-black/60 text-sm">Waybill Officer</p>
        <h1 className="text-2xl font-black text-black">{staff?.full_name?.split(' ')[0]}</h1>
      </div>

      <div className="px-4 -mt-4 pb-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {stats.map(s => (
            <Link key={s.label} to={s.to} className="card text-center active:scale-[0.97] transition-transform">
              <p className="text-3xl mb-1">{s.emoji}</p>
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs font-semibold text-gray-500 mt-1">{s.label}</p>
            </Link>
          ))}
        </div>

        <Link to="/waybill/new" className="card bg-black border-0 flex items-center gap-4 text-white active:scale-[0.98] transition-transform">
          <div className="w-12 h-12 bg-brand-yellow rounded-xl flex items-center justify-center shrink-0 text-xl">
            📦
          </div>
          <div>
            <p className="font-bold">Create Waybill Batch</p>
            <p className="text-xs text-gray-400">Select orders and batch them</p>
          </div>
        </Link>

        <Link to="/waybill" className="card flex items-center justify-between active:bg-gray-50">
          <div>
            <p className="font-bold">Waybill Batches</p>
            <p className="text-xs text-gray-500">View all batches and history</p>
          </div>
          <span className="text-2xl">🗂️</span>
        </Link>
      </div>
    </div>
  )
}
