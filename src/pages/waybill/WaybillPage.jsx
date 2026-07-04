import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatNaira } from '@/lib/utils'
import { Package, Plus } from 'lucide-react'

export default function WaybillPage() {
  const [filter, setFilter] = useState('pending')

  const { data: batches, isLoading } = useQuery({
    queryKey: ['waybill-batches', filter],
    queryFn: async () => {
      let query = supabase
        .from('waybill_batches')
        .select('*, waybill_batch_orders(id, order_id)')
        .order('created_at', { ascending: false })

      if (filter !== 'all') query = query.eq('status', filter)

      const { data } = await query
      return data || []
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Waybill"
        actions={
          <Link to="/waybill/new">
            <Button size="sm" className="flex items-center gap-1.5">
              <Plus size={16} /> New Batch
            </Button>
          </Link>
        }
      />

      <div className="px-4 pt-3 space-y-3">
        <div className="flex gap-2">
          {['pending', 'waybilled', 'received', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize ${
                filter === f ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-3 pb-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card h-24 shimmer" />
              ))}
            </div>
          ) : batches?.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No waybill batches"
              description="Create your first batch to get started"
              action={
                <Link to="/waybill/new">
                  <Button className="flex items-center gap-1.5">
                    <Plus size={16} /> Create Batch
                  </Button>
                </Link>
              }
            />
          ) : (
            batches.map(batch => (
              <Link key={batch.id} to={`/waybill/${batch.id}`} className="block card active:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm">{batch.batch_number}</p>
                    <p className="text-xs text-gray-500">{batch.destination_state || 'No destination'}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    batch.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                    batch.status === 'waybilled' ? 'bg-purple-100 text-purple-700' :
                    'bg-teal-100 text-teal-700'
                  }`}>
                    {batch.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="space-x-3">
                    <span className="text-gray-500">{batch.waybill_batch_orders?.length || 0} orders</span>
                    <span className="text-gray-500 capitalize">{batch.waybill_type}</span>
                    {batch.courier_company && <span className="text-gray-500">{batch.courier_company}</span>}
                  </div>
                  <span className="font-bold text-brand-yellow-dark">{formatNaira(batch.total_logistics_cost)}</span>
                </div>
                {batch.date_shipped && (
                  <p className="text-xs text-gray-400 mt-1">Shipped: {formatDate(batch.date_shipped)}</p>
                )}
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
