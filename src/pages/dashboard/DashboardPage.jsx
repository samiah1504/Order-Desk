import { useAuthStore } from '@/store/authStore'
import CEODashboard from './CEODashboard'
import FulfillmentDashboard from './FulfillmentDashboard'
import CustomerSupportDashboard from './CustomerSupportDashboard'
import WaybillDashboard from './WaybillDashboard'
import InventoryDashboard from './InventoryDashboard'
import OperationsManagerDashboard from './OperationsManagerDashboard'

export default function DashboardPage() {
  const { staff } = useAuthStore()
  const role = staff?.role

  const dashboards = {
    ceo: CEODashboard,
    operations_manager: OperationsManagerDashboard,
    customer_support: CustomerSupportDashboard,
    fulfillment: FulfillmentDashboard,
    waybill: WaybillDashboard,
    inventory: InventoryDashboard,
  }

  const Dashboard = dashboards[role] || CustomerSupportDashboard
  return <Dashboard />
}
