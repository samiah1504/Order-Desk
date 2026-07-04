import { NavLink } from 'react-router-dom'
import {
  Home, ShoppingBag, Truck, Package, BarChart2, Settings, Users, FileText, ClipboardList, UserCircle
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

const navConfigs = {
  ceo: [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/orders', icon: ShoppingBag, label: 'Orders' },
    { to: '/accounting', icon: BarChart2, label: 'Accounting' },
    { to: '/admin', icon: Settings, label: 'Admin' },
    { to: '/profile', icon: UserCircle, label: 'Profile' },
  ],
  operations_manager: [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/orders', icon: ShoppingBag, label: 'Orders' },
    { to: '/fulfillment', icon: Truck, label: 'Fulfillment' },
    { to: '/customers', icon: Users, label: 'Customers' },
    { to: '/profile', icon: UserCircle, label: 'Profile' },
  ],
  customer_support: [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/orders/new', icon: ShoppingBag, label: 'New Order' },
    { to: '/orders', icon: ClipboardList, label: 'My Orders' },
    { to: '/customers', icon: Users, label: 'Customers' },
    { to: '/profile', icon: UserCircle, label: 'Profile' },
  ],
  fulfillment: [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/fulfillment', icon: Truck, label: 'Fulfillment' },
    { to: '/orders', icon: ShoppingBag, label: 'Orders' },
    { to: '/profile', icon: UserCircle, label: 'Profile' },
  ],
  waybill: [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/waybill', icon: Package, label: 'Waybill' },
    { to: '/orders', icon: ShoppingBag, label: 'Orders' },
    { to: '/profile', icon: UserCircle, label: 'Profile' },
  ],
  inventory: [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/profile', icon: UserCircle, label: 'Profile' },
  ],
}

export function BottomNav() {
  const { staff } = useAuthStore()
  const role = staff?.role || 'customer_support'
  const navItems = navConfigs[role] || navConfigs.customer_support

  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-1 py-2 px-3 min-w-[56px] transition-colors',
              isActive ? 'text-brand-yellow' : 'text-gray-500'
            )}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
