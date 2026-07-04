import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Package } from 'lucide-react'

export default function InventoryPage() {
  const [filter, setFilter] = useState('all')
  const [businessFilter, setBusinessFilter] = useState('')

  const { data: stock } = useQuery({
    queryKey: ['inventory-stock', filter, businessFilter],
    queryFn: async () => {
      let query = supabase
        .from('inventory_stock')
        .select('*, products(name, category), businesses(name), warehouses(name)')
        .order('available_qty', { ascending: true })

      if (businessFilter) query = query.eq('business_id', businessFilter)
      if (filter === 'low') query = query.lt('available_qty', 5)

      const { data } = await query
      return data || []
    },
  })

  const { data: businesses } = useQuery({
    queryKey: ['businesses-active'],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('id, name').eq('is_active', true)
      return data || []
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Inventory"
        actions={
          <Link to="/inventory/receive">
            <Button size="sm" className="flex items-center gap-1.5">
              <Plus size={16} /> Receive
            </Button>
          </Link>
        }
      />

      <div className="px-4 pt-3 space-y-3">
        <div className="flex gap-2">
          {['all', 'low'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${
                filter === f ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {f === 'low' ? '⚠️ Low Stock' : 'All Stock'}
            </button>
          ))}
        </div>

        {businesses?.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setBusinessFilter('')} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${!businessFilter ? 'bg-brand-yellow text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
              All
            </button>
            {businesses.map(b => (
              <button key={b.id} onClick={() => setBusinessFilter(b.id)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${businessFilter === b.id ? 'bg-brand-yellow text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {b.name}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2 pb-6">
          {stock?.length === 0 ? (
            <EmptyState icon={Package} title="No stock records" description="Add received stock to track inventory" />
          ) : (
            stock?.map(item => (
              <div key={item.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-sm">{item.products?.name}</p>
                    <p className="text-xs text-gray-500">{item.businesses?.name} · {item.products?.category || 'Uncategorized'}</p>
                    {item.warehouses && <p className="text-xs text-gray-400">{item.warehouses.name}</p>}
                  </div>
                  {item.available_qty < 5 && (
                    <AlertTriangle size={16} className="text-red-500 shrink-0" />
                  )}
                </div>
                <div className="flex gap-4 mt-3 pt-2 border-t border-gray-50">
                  <div className="text-center">
                    <p className="text-lg font-black text-gray-900">{item.physical_qty}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Physical</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-orange-500">{item.reserved_qty}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Reserved</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-black ${item.available_qty < 5 ? 'text-red-500' : 'text-green-600'}`}>{item.available_qty}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Available</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-blue-600">{item.sold_qty}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Sold</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
