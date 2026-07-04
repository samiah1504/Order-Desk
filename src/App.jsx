import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from '@/components/layout/AppLayout'

// Auth
import LoginPage from '@/pages/auth/LoginPage'

// Dashboard
import DashboardPage from '@/pages/dashboard/DashboardPage'

// Orders
import OrdersPage from '@/pages/orders/OrdersPage'
import NewOrderPage from '@/pages/orders/NewOrderPage'
import OrderDetailPage from '@/pages/orders/OrderDetailPage'

// Fulfillment
import FulfillmentPage from '@/pages/fulfillment/FulfillmentPage'

// Waybill
import WaybillPage from '@/pages/waybill/WaybillPage'
import NewWaybillBatchPage from '@/pages/waybill/NewWaybillBatchPage'
import WaybillBatchDetailPage from '@/pages/waybill/WaybillBatchDetailPage'

// Inventory
import InventoryPage from '@/pages/inventory/InventoryPage'
import ReceiveStockPage from '@/pages/inventory/ReceiveStockPage'

// Accounting
import AccountingPage from '@/pages/accounting/AccountingPage'

// Customers
import CustomersPage from '@/pages/customers/CustomersPage'
import CustomerDetailPage from '@/pages/customers/CustomerDetailPage'

// Reports
import ReportsPage from '@/pages/reports/ReportsPage'

// Admin
import AdminPage from '@/pages/admin/AdminPage'
import BusinessesPage from '@/pages/admin/BusinessesPage'
import StaffPage from '@/pages/admin/StaffPage'
import ProductsPage from '@/pages/admin/ProductsPage'

// Profile
import ProfilePage from '@/pages/profile/ProfilePage'

function RequireAuth({ children }) {
  const { isAuthenticated, staff } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-brand-yellow rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-black text-black">OD</span>
        </div>
        <div className="w-6 h-6 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  )
}

export default function App() {
  const { isAuthenticated, user } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/new" element={<NewOrderPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />

          <Route path="fulfillment" element={<FulfillmentPage />} />

          <Route path="waybill" element={<WaybillPage />} />
          <Route path="waybill/new" element={<NewWaybillBatchPage />} />
          <Route path="waybill/:id" element={<WaybillBatchDetailPage />} />

          <Route path="inventory" element={<InventoryPage />} />
          <Route path="inventory/receive" element={<ReceiveStockPage />} />

          <Route path="accounting" element={<AccountingPage />} />

          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />

          <Route path="reports" element={<ReportsPage />} />

          <Route path="admin" element={<AdminPage />} />
          <Route path="admin/businesses" element={<BusinessesPage />} />
          <Route path="admin/staff" element={<StaffPage />} />
          <Route path="admin/products" element={<ProductsPage />} />

          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
