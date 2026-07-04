import { Phone, MessageCircle, Copy, MapPin, Package } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { formatNaira, formatDate, getWhatsAppUrl, formatOrderForWhatsApp } from '@/lib/utils'
import toast from 'react-hot-toast'

export function OrderCard({ order, onAction, showActions = true, compact = false }) {
  function handleCall() {
    window.open(`tel:${order.customer_phone}`)
  }

  function handleWhatsApp() {
    window.open(getWhatsAppUrl(order.customer_phone), '_blank')
  }

  function handleCopyForWhatsApp() {
    const text = formatOrderForWhatsApp(order)
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard')
    })
  }

  const items = order.order_items || []
  const itemSummary = items.length > 0
    ? items.map(i => `${i.product_name} x${i.quantity}`).join(', ')
    : order.product_summary || '-'

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-sm text-gray-900">{order.order_number}</p>
          <p className="text-xs text-gray-500">{order.businesses?.name || order.business_name || ''}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div>
        <p className="font-semibold text-gray-900">{order.customer_name}</p>
        <p className="text-sm text-gray-500">{order.customer_phone}</p>
      </div>

      {!compact && (
        <div className="flex items-start gap-1.5 text-sm text-gray-600">
          <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" />
          <span className="line-clamp-2">{order.customer_address}, {order.state}</span>
        </div>
      )}

      <div className="flex items-start gap-1.5 text-sm text-gray-600">
        <Package size={14} className="mt-0.5 shrink-0 text-gray-400" />
        <span className="line-clamp-2">{itemSummary}</span>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="font-bold text-brand-yellow-dark text-base">{formatNaira(order.total_amount)}</span>
        {order.customer_requested_date && (
          <span className="text-xs text-gray-500">
            Req: {formatDate(order.customer_requested_date)}
          </span>
        )}
      </div>

      {showActions && (
        <div className="flex gap-2 pt-1 border-t border-gray-50">
          <button
            onClick={handleCall}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-50 text-green-700 rounded-xl text-sm font-semibold active:scale-95 transition-all"
          >
            <Phone size={15} /> Call
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold active:scale-95 transition-all"
          >
            <MessageCircle size={15} /> WhatsApp
          </button>
          <button
            onClick={handleCopyForWhatsApp}
            className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl active:scale-95 transition-all"
            title="Copy for WhatsApp"
          >
            <Copy size={15} />
          </button>
          {onAction && (
            <button
              onClick={() => onAction(order)}
              className="px-3 py-2.5 bg-brand-yellow text-black rounded-xl active:scale-95 transition-all text-sm font-semibold"
            >
              Action
            </button>
          )}
        </div>
      )}
    </div>
  )
}
