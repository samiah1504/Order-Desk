import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { formatNaira, formatDate } from '@/lib/utils'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'

const REPORT_TYPES = [
  { key: 'orders', label: '📦 Orders Report' },
  { key: 'sales', label: '💰 Sales Report' },
  { key: 'expenses', label: '📉 Expenses Report' },
  { key: 'inventory', label: '📊 Inventory Report' },
]

export default function ReportsPage() {
  const [reportType, setReportType] = useState('sales')
  const [period, setPeriod] = useState('month')
  const [businessId, setBusinessId] = useState('')

  const { data: businesses } = useQuery({
    queryKey: ['businesses-active'],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('id, name').eq('is_active', true)
      return data || []
    },
  })

  function getStartDate() {
    const now = new Date()
    if (period === 'today') return now.toISOString().split('T')[0]
    if (period === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 7)
      return d.toISOString().split('T')[0]
    }
    if (period === 'month') {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    }
    return `${now.getFullYear()}-01-01`
  }

  const { data: reportData } = useQuery({
    queryKey: ['report', reportType, period, businessId],
    queryFn: async () => {
      const startDate = getStartDate()

      if (reportType === 'orders') {
        let query = supabase.from('orders').select('*, businesses(name)')
          .gte('created_at', startDate + 'T00:00:00').order('created_at', { ascending: false })
        if (businessId) query = query.eq('business_id', businessId)
        const { data } = await query
        return data || []
      }

      if (reportType === 'sales') {
        let query = supabase.from('orders').select('*, businesses(name)')
          .eq('status', 'paid').gte('payment_confirmed_at', startDate + 'T00:00:00')
          .order('payment_confirmed_at', { ascending: false })
        if (businessId) query = query.eq('business_id', businessId)
        const { data } = await query
        return data || []
      }

      if (reportType === 'expenses') {
        let query = supabase.from('expenses').select('*, businesses(name)')
          .gte('expense_date', startDate).order('expense_date', { ascending: false })
        if (businessId) query = query.eq('business_id', businessId)
        const { data } = await query
        return data || []
      }

      if (reportType === 'inventory') {
        let query = supabase.from('inventory_stock').select('*, products(name), businesses(name), warehouses(name)')
        if (businessId) query = query.eq('business_id', businessId)
        const { data } = await query
        return data || []
      }

      return []
    },
  })

  async function downloadCSV() {
    if (!reportData?.length) { toast.error('No data to download'); return }

    let headers = []
    let rows = []

    if (reportType === 'orders') {
      headers = ['Order Number', 'Customer', 'Phone', 'Business', 'State', 'Status', 'Total Amount', 'Date']
      rows = reportData.map(o => [o.order_number, o.customer_name, o.customer_phone, o.businesses?.name, o.state, o.status, o.total_amount, formatDate(o.created_at)])
    } else if (reportType === 'sales') {
      headers = ['Order Number', 'Customer', 'Business', 'Amount', 'Paid At']
      rows = reportData.map(o => [o.order_number, o.customer_name, o.businesses?.name, o.total_amount, formatDate(o.payment_confirmed_at)])
    } else if (reportType === 'expenses') {
      headers = ['Category', 'Amount', 'Business', 'Date', 'Description']
      rows = reportData.map(e => [e.category, e.amount, e.businesses?.name, formatDate(e.expense_date), e.description || ''])
    } else if (reportType === 'inventory') {
      headers = ['Product', 'Business', 'Warehouse', 'Physical', 'Reserved', 'Available', 'Sold']
      rows = reportData.map(s => [s.products?.name, s.businesses?.name, s.warehouses?.name || 'N/A', s.physical_qty, s.reserved_qty, s.available_qty, s.sold_qty])
    }

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportType}-report-${period}.csv`
    a.click()
    toast.success('Download started')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Reports"
        actions={
          <Button size="sm" variant="secondary" onClick={downloadCSV} className="flex items-center gap-1.5">
            <Download size={14} /> CSV
          </Button>
        }
      />

      <div className="px-4 pt-3 space-y-4 pb-6">
        {/* Report Type */}
        <div className="grid grid-cols-2 gap-2">
          {REPORT_TYPES.map(rt => (
            <button key={rt.key} onClick={() => setReportType(rt.key)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${reportType === rt.key ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {rt.label}
            </button>
          ))}
        </div>

        {/* Period */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']].map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${period === k ? 'bg-brand-yellow text-black' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Business */}
        {businesses?.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setBusinessId('')} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${!businessId ? 'bg-brand-yellow text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>All</button>
            {businesses.map(b => (
              <button key={b.id} onClick={() => setBusinessId(b.id)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${businessId === b.id ? 'bg-brand-yellow text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>{b.name}</button>
            ))}
          </div>
        )}

        {/* Report Summary */}
        {reportData?.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-sm">{reportData.length} records</p>
              {(reportType === 'sales') && (
                <p className="font-black text-emerald-600">{formatNaira(reportData.reduce((s, o) => s + o.total_amount, 0))}</p>
              )}
              {reportType === 'expenses' && (
                <p className="font-black text-red-500">{formatNaira(reportData.reduce((s, e) => s + e.amount, 0))}</p>
              )}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {reportData.slice(0, 30).map((item, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 text-sm">
                  <div className="flex-1 min-w-0 pr-2">
                    {reportType === 'orders' && (
                      <>
                        <p className="font-semibold truncate">{item.customer_name}</p>
                        <p className="text-xs text-gray-400">{item.order_number} · {item.status}</p>
                      </>
                    )}
                    {reportType === 'sales' && (
                      <>
                        <p className="font-semibold truncate">{item.customer_name}</p>
                        <p className="text-xs text-gray-400">{item.order_number} · {item.businesses?.name}</p>
                      </>
                    )}
                    {reportType === 'expenses' && (
                      <>
                        <p className="font-semibold capitalize">{item.category?.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-400">{item.businesses?.name} · {formatDate(item.expense_date)}</p>
                      </>
                    )}
                    {reportType === 'inventory' && (
                      <>
                        <p className="font-semibold truncate">{item.products?.name}</p>
                        <p className="text-xs text-gray-400">{item.businesses?.name}</p>
                      </>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {(reportType === 'orders' || reportType === 'sales') && (
                      <p className="font-bold">{formatNaira(item.total_amount)}</p>
                    )}
                    {reportType === 'expenses' && (
                      <p className="font-bold text-red-500">{formatNaira(item.amount)}</p>
                    )}
                    {reportType === 'inventory' && (
                      <p className={`font-bold ${item.available_qty < 5 ? 'text-red-500' : 'text-green-600'}`}>
                        {item.available_qty} avail
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
