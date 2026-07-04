import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function formatNaira(amount) {
  if (amount == null) return '₦0'
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateString) {
  if (!dateString) return '-'
  try {
    return format(parseISO(dateString), 'dd MMM yyyy')
  } catch {
    return dateString
  }
}

export function formatDateTime(dateString) {
  if (!dateString) return '-'
  try {
    return format(parseISO(dateString), 'dd MMM yyyy, h:mm a')
  } catch {
    return dateString
  }
}

export function timeAgo(dateString) {
  if (!dateString) return '-'
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true })
  } catch {
    return dateString
  }
}

export function generateOrderNumber(seq) {
  const year = new Date().getFullYear()
  return `ORD-${year}-${String(seq).padStart(5, '0')}`
}

export function generateDocNumber(type, seq) {
  const year = new Date().getFullYear()
  const prefix = { invoice: 'INV', receipt: 'RCP', waybill: 'WB' }[type] || 'DOC'
  return `${prefix}-${year}-${String(seq).padStart(5, '0')}`
}

export const STATUS_LABELS = {
  new: 'New Order',
  awaiting_waybill: 'Awaiting Waybill',
  waybilled: 'Waybilled',
  received_warehouse: 'Received at Warehouse',
  processing: 'Processing',
  delivered: 'Delivered',
  paid: 'Paid',
  failed_delivery: 'Failed Delivery',
  cancelled: 'Cancelled',
  returned: 'Returned',
}

export const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700',
  awaiting_waybill: 'bg-orange-100 text-orange-700',
  waybilled: 'bg-purple-100 text-purple-700',
  received_warehouse: 'bg-teal-100 text-teal-700',
  processing: 'bg-yellow-100 text-yellow-700',
  delivered: 'bg-green-100 text-green-700',
  paid: 'bg-emerald-100 text-emerald-800',
  failed_delivery: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  returned: 'bg-amber-100 text-amber-800',
}

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo',
  'Ekiti', 'Enugu', 'Abuja (FCT)', 'Gombe', 'Imo', 'Jigawa',
  'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

export const ORDER_SOURCES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'website', label: 'Website' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
]

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function getWhatsAppUrl(phone, message = '') {
  const cleaned = phone.replace(/\D/g, '')
  const international = cleaned.startsWith('0') ? '234' + cleaned.slice(1) : cleaned
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`
}

export function formatOrderForWhatsApp(order) {
  const items = order.order_items?.map(i => `• ${i.product_name} x${i.quantity} - ${formatNaira(i.unit_price)}`).join('\n') || ''
  return `*ORDER: ${order.order_number}*
Customer: ${order.customer_name}
Phone: ${order.customer_phone}
Address: ${order.customer_address}
State: ${order.state}
${order.city ? `City: ${order.city}` : ''}

*Items:*
${items}

*Total: ${formatNaira(order.total_amount)}*
${order.delivery_note ? `\nNote: ${order.delivery_note}` : ''}
${order.customer_requested_date ? `\nRequested Delivery: ${formatDate(order.customer_requested_date)}` : ''}`
}
