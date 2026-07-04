import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatNaira, formatDate } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag } from 'lucide-react'

function StatCard({ label, value, icon: Icon, color = 'text-gray-900', bgColor = 'bg-white' }) {
  return (
    <div className={`card ${bgColor}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={color} />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  )
}

export default function AccountingPage() {
  const [period, setPeriod] = useState('month')
  const [businessId, setBusinessId] = useState('')

  const { data: businesses } = useQuery({
    queryKey: ['businesses-active'],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('id, name').eq('is_active', true)
      return data || []
    },
  })

  const { data: summary } = useQuery({
    queryKey: ['accounting-summary', period, businessId],
    queryFn: async () => {
      const now = new Date()
      let startDate
      if (period === 'today') startDate = now.toISOString().split('T')[0]
      else if (period === 'week') {
        const d = new Date(now); d.setDate(d.getDate() - 7)
        startDate = d.toISOString().split('T')[0]
      } else if (period === 'month') {
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      } else {
        startDate = `${now.getFullYear()}-01-01`
      }

      let salesQuery = supabase.from('orders').select('total_amount, business_id, businesses(name)')
        .eq('status', 'paid').gte('payment_confirmed_at', startDate + 'T00:00:00')
      let expenseQuery = supabase.from('expenses').select('amount, category, business_id')
        .gte('expense_date', startDate)

      if (businessId) {
        salesQuery = salesQuery.eq('business_id', businessId)
        expenseQuery = expenseQuery.eq('business_id', businessId)
      }

      const [{ data: salesData }, { data: expenseData }, { count: orderCount }] = await Promise.all([
        salesQuery,
        expenseQuery,
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('status', 'paid').gte('payment_confirmed_at', startDate + 'T00:00:00'),
      ])

      const totalSales = salesData?.reduce((s, o) => s + (o.total_amount || 0), 0) || 0
      const totalExpenses = expenseData?.reduce((s, e) => s + (e.amount || 0), 0) || 0
      const grossProfit = totalSales - totalExpenses

      const byBusiness = {}
      salesData?.forEach(o => {
        const name = o.businesses?.name || 'Unknown'
        if (!byBusiness[name]) byBusiness[name] = { sales: 0, expenses: 0 }
        byBusiness[name].sales += o.total_amount || 0
      })
      expenseData?.forEach(e => {
        const match = salesData?.find(o => o.business_id === e.business_id)
        const name = match?.businesses?.name || 'Unknown'
        if (!byBusiness[name]) byBusiness[name] = { sales: 0, expenses: 0 }
        byBusiness[name].expenses += e.amount || 0
      })

      return { totalSales, totalExpenses, grossProfit, orderCount, byBusiness }
    },
  })

  const { data: recentPaid } = useQuery({
    queryKey: ['recent-paid-orders', businessId],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, businesses(name)')
        .eq('status', 'paid')
        .order('payment_confirmed_at', { ascending: false })
        .limit(10)
      if (businessId) query = query.eq('business_id', businessId)
      const { data } = await query
      return data || []
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Accounting" />

      <div className="px-4 pt-3 space-y-4 pb-6">
        {/* Period Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['year', 'This Year']].map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${period === k ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Business Filter */}
        {businesses?.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setBusinessId('')} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${!businessId ? 'bg-brand-yellow text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
              All Businesses
            </button>
            {businesses.map(b => (
              <button key={b.id} onClick={() => setBusinessId(b.id)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${businessId === b.id ? 'bg-brand-yellow text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {b.name}
              </button>
            ))}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Sales" value={formatNaira(summary?.totalSales)} icon={DollarSign} color="text-emerald-600" />
          <StatCard label="Total Expenses" value={formatNaira(summary?.totalExpenses)} icon={TrendingDown} color="text-red-500" />
          <StatCard label="Gross Profit" value={formatNaira(summary?.grossProfit)}
            icon={TrendingUp}
            color={summary?.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}
          />
          <StatCard label="Paid Orders" value={summary?.orderCount ?? 0} icon={ShoppingBag} color="text-blue-600" />
        </div>

        {/* By Business Breakdown */}
        {Object.keys(summary?.byBusiness || {}).length > 0 && (
          <div className="card">
            <h2 className="font-bold text-sm mb-3">By Business</h2>
            <div className="space-y-3">
              {Object.entries(summary.byBusiness).map(([name, data]) => (
                <div key={name} className="bg-gray-50 rounded-xl p-3">
                  <p className="font-bold text-sm mb-2">{name}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-gray-400">Sales</p>
                      <p className="font-bold text-xs text-emerald-600">{formatNaira(data.sales)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Expenses</p>
                      <p className="font-bold text-xs text-red-500">{formatNaira(data.expenses)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Profit</p>
                      <p className={`font-bold text-xs ${data.sales - data.expenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNaira(data.sales - data.expenses)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Paid Orders */}
        <div className="card">
          <h2 className="font-bold text-sm mb-3">Recent Paid Orders</h2>
          <div className="space-y-2">
            {recentPaid?.map(order => (
              <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-semibold text-sm">{order.customer_name}</p>
                  <p className="text-xs text-gray-400">{order.order_number} · {order.businesses?.name}</p>
                </div>
                <p className="font-bold text-sm text-emerald-600">{formatNaira(order.total_amount)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
