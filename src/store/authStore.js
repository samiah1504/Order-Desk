import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      staff: null,
      session: null,
      initialized: false,

      setAuth: (user, session, staff) => set({ user, session, staff, initialized: true }),
      setStaff: (staff) => set({ staff }),
      clearAuth: () => set({ user: null, session: null, staff: null, initialized: true }),

      hasPermission: (permission) => {
        const { staff } = get()
        if (!staff) return false
        if (staff.role === 'ceo') return true
        return staff.permissions?.[permission] === true
      },

      canAccess: (section) => {
        const { staff } = get()
        if (!staff) return false
        const role = staff.role

        const roleAccess = {
          ceo: ['*'],
          operations_manager: ['orders', 'fulfillment', 'waybill', 'inventory', 'customers', 'documents', 'reports'],
          customer_support: ['orders_create', 'orders_view_own'],
          fulfillment: ['fulfillment', 'orders_view'],
          waybill: ['waybill'],
          inventory: ['inventory'],
        }

        const access = roleAccess[role] || []
        if (access.includes('*')) return true
        return access.includes(section)
      },
    }),
    {
      name: 'order-desk-auth',
      partialize: (state) => ({ staff: state.staff }),
    }
  )
)
