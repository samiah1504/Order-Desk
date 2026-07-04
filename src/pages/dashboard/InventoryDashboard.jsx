import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export default function InventoryDashboard() {
  const { staff } = useAuthStore()

  const { data: stats } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: async () => {
      const { data: stock } = await supabase.from('inventory_stock').select('*')
      const lowStock = stock?.filter(s => s.available_qty < 5) || []
      return {
        totalProducts: stock?.length || 0,
        lowStock: lowStock.length,
      }
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-brand-yellow px-4 pt-12 pb-6">
        <p className="text-black/60 text-sm">Inventory</p>
        <h1 className="text-2xl font-black text-black">{staff?.full_name?.split(' ')[0]}</h1>
      </div>

      <div className="px-4 -mt-4 pb-6 space-y-4">
        {stats?.lowStock > 0 && (
          <div className="card bg-red-50 border-red-200 border">
            <p className="font-bold text-red-700">⚠️ {stats.lowStock} products low in stock</p>
            <p className="text-xs text-red-500 mt-1">Review inventory levels</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link to="/inventory/receive" className="card text-center active:scale-[0.97] transition-transform">
            <p className="text-3xl mb-1">📥</p>
            <p className="font-bold text-sm">Receive Stock</p>
            <p className="text-xs text-gray-500">Add new inventory</p>
          </Link>
          <Link to="/inventory" className="card text-center active:scale-[0.97] transition-transform">
            <p className="text-3xl mb-1">📊</p>
            <p className="font-bold text-sm">Current Stock</p>
            <p className="text-xs text-gray-500">{stats?.totalProducts ?? 0} items</p>
          </Link>
        </div>

        <Link to="/inventory?filter=low" className="card flex items-center justify-between active:bg-gray-50">
          <div>
            <p className="font-bold">Low Stock Items</p>
            <p className="text-xs text-gray-500">Products needing restock</p>
          </div>
          <span className="bg-red-100 text-red-700 font-bold text-sm px-3 py-1.5 rounded-full">
            {stats?.lowStock ?? 0}
          </span>
        </Link>
      </div>
    </div>
  )
}
