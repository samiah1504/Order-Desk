import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, Phone, MessageCircle, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { getWhatsAppUrl } from '@/lib/utils'

export default function CustomersPage() {
  const [search, setSearch] = useState('')

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*, orders(id, status)')
        .order('updated_at', { ascending: false })
        .limit(50)

      if (search.trim()) {
        query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
      }

      const { data } = await query
      return data || []
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Customers" />

      <div className="px-4 pt-3 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or phone..."
            className="input-field pl-9"
          />
        </div>

        <div className="space-y-2 pb-6">
          {isLoading ? (
            [...Array(5)].map((_, i) => <div key={i} className="card h-20 shimmer" />)
          ) : customers?.length === 0 ? (
            <EmptyState icon={Users} title="No customers found" description="Customers are created when orders are placed" />
          ) : (
            customers.map(customer => {
              const orders = customer.orders || []
              const paid = orders.filter(o => o.status === 'paid').length
              const failed = orders.filter(o => o.status === 'failed_delivery').length

              return (
                <div key={customer.id} className="card space-y-2">
                  <div className="flex items-start justify-between">
                    <Link to={`/customers/${customer.id}`} className="flex-1">
                      <p className="font-bold text-base">{customer.full_name}</p>
                      <p className="text-sm text-gray-500">{customer.phone}</p>
                    </Link>
                    <div className="flex gap-2">
                      <a href={`tel:${customer.phone}`} className="p-2 bg-green-50 text-green-700 rounded-xl">
                        <Phone size={16} />
                      </a>
                      <a href={getWhatsAppUrl(customer.phone)} target="_blank" rel="noreferrer" className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                        <MessageCircle size={16} />
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-gray-500">{orders.length} orders</span>
                    <span className="text-green-600 font-semibold">{paid} paid</span>
                    {failed > 0 && <span className="text-red-500 font-semibold">⚠️ {failed} failed</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
