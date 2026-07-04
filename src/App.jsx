import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppLayout } from '@/components/layout/AppLayout'

// Auth
import LoginPage from '@/pages/auth/LoginPage'
import NoProfilePage from '@/pages/auth/NoProfilePage'

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

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', background: '#fff', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, background: '#F5C842', borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <span style={{ fontSize: 20, fontWeight: 900 }}>OD</span>
        </div>
        <div style={{
          width: 24, height: 24, border: '2px solid #F5C842',
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

function EnvError() {
  return (
    <div style={{
      minHeight: '100vh', background: '#fff', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚙️</div>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Missing Configuration</h1>
        <p style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>
          <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> must be set.
        </p>
        <p style={{ fontSize: 13, color: '#888' }}>
          Set these in Netlify → Site Settings → Environment Variables, then redeploy.
        </p>
      </div>
    </div>
  )
}

function RequireAuth({ children }) {
  const { initialized, user, staff } = useAuthStore()
  const location = useLocation()

  if (!initialized) return <LoadingScreen />
  if (!user)  return <Navigate to="/login" state={{ from: location }} replace />
  if (!staff) return <NoProfilePage />
  return children
}

export default function App() {
  const missingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY
  if (missingEnv) return <EnvError />

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={
            <RequireAuth>
              <ErrorBoundary>
                <AppLayout />
              </ErrorBoundary>
            </RequireAuth>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />

            <Route path="orders"       element={<OrdersPage />} />
            <Route path="orders/new"   element={<NewOrderPage />} />
            <Route path="orders/:id"   element={<OrderDetailPage />} />

            <Route path="fulfillment"  element={<FulfillmentPage />} />

            <Route path="waybill"      element={<WaybillPage />} />
            <Route path="waybill/new"  element={<NewWaybillBatchPage />} />
            <Route path="waybill/:id"  element={<WaybillBatchDetailPage />} />

            <Route path="inventory"         element={<InventoryPage />} />
            <Route path="inventory/receive" element={<ReceiveStockPage />} />

            <Route path="accounting" element={<AccountingPage />} />

            <Route path="customers"    element={<CustomersPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />

            <Route path="reports" element={<ReportsPage />} />

            <Route path="admin"            element={<AdminPage />} />
            <Route path="admin/businesses" element={<BusinessesPage />} />
            <Route path="admin/staff"      element={<StaffPage />} />
            <Route path="admin/products"   element={<ProductsPage />} />

            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
