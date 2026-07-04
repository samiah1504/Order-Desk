-- ============================================================
-- Order Desk Internal Operations PWA - Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BUSINESSES
-- ============================================================
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#EAB308',
  address TEXT,
  phone TEXT,
  email TEXT,
  invoice_details TEXT,
  receipt_details TEXT,
  bank_details JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STAFF / USERS
-- ============================================================
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  staff_code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ceo', 'operations_manager', 'customer_support', 'fulfillment', 'waybill', 'inventory')),
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  category TEXT,
  default_selling_price DECIMAL(12,2),
  default_cost_price DECIMAL(12,2),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WAREHOUSES
-- ============================================================
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  state TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);

CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  address TEXT NOT NULL,
  state TEXT,
  city TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT,
  business_id UUID NOT NULL REFERENCES businesses(id),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'awaiting_waybill', 'waybilled', 'received_warehouse',
    'processing', 'delivered', 'paid', 'failed_delivery', 'cancelled', 'returned'
  )),
  order_source TEXT CHECK (order_source IN (
    'whatsapp', 'instagram', 'phone_call', 'website', 'facebook', 'walk_in', 'referral', 'other'
  )),
  delivery_note TEXT,
  customer_requested_date DATE,
  preferred_delivery_window TEXT,
  planned_delivery_date DATE,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  payment_confirmed_at TIMESTAMPTZ,
  payment_confirmed_by UUID REFERENCES staff(id),
  failed_reason TEXT,
  cancel_reason TEXT,
  reschedule_reason TEXT,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_state ON orders(state);
CREATE INDEX idx_orders_business ON orders(business_id);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Order sequence for numbering
CREATE SEQUENCE order_number_seq START 1;

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  colour TEXT,
  size TEXT,
  cost_price DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDER TIMELINE
-- ============================================================
CREATE TABLE order_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  notes TEXT,
  performed_by UUID REFERENCES staff(id),
  staff_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_timeline_order ON order_timeline(order_id);

-- ============================================================
-- WAYBILL BATCHES
-- ============================================================
CREATE TABLE waybill_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_number TEXT UNIQUE NOT NULL,
  waybill_type TEXT NOT NULL DEFAULT 'internal' CHECK (waybill_type IN ('internal', 'supplier')),
  courier_company TEXT,
  waybill_number TEXT,
  date_shipped DATE,
  destination_state TEXT,
  destination_warehouse_id UUID REFERENCES warehouses(id),
  waybill_cost DECIMAL(12,2) DEFAULT 0,
  packaging_cost DECIMAL(12,2) DEFAULT 0,
  loading_cost DECIMAL(12,2) DEFAULT 0,
  transport_cost DECIMAL(12,2) DEFAULT 0,
  dispatch_cost DECIMAL(12,2) DEFAULT 0,
  other_logistics_cost DECIMAL(12,2) DEFAULT 0,
  total_logistics_cost DECIMAL(12,2) DEFAULT 0,
  cost_allocation_method TEXT DEFAULT 'equal' CHECK (cost_allocation_method IN ('equal', 'manual')),
  notes TEXT,
  receipt_url TEXT,
  packing_confirmed BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'waybilled', 'received')),
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE waybill_batch_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES waybill_batches(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id),
  allocated_cost DECIMAL(12,2) DEFAULT 0,
  is_packed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, order_id)
);

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID REFERENCES warehouses(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'received', 'reserved', 'sold', 'returned', 'damaged', 'adjusted', 'released'
  )),
  quantity INTEGER NOT NULL,
  purchase_cost_per_unit DECIMAL(12,2),
  total_purchase_cost DECIMAL(12,2),
  supplier TEXT,
  order_id UUID REFERENCES orders(id),
  waybill_batch_id UUID REFERENCES waybill_batches(id),
  date_received DATE,
  notes TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID REFERENCES warehouses(id),
  physical_qty INTEGER DEFAULT 0,
  reserved_qty INTEGER DEFAULT 0,
  available_qty INTEGER GENERATED ALWAYS AS (physical_qty - reserved_qty) STORED,
  sold_qty INTEGER DEFAULT 0,
  returned_qty INTEGER DEFAULT 0,
  damaged_qty INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, product_id, warehouse_id)
);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  order_id UUID REFERENCES orders(id),
  waybill_batch_id UUID REFERENCES waybill_batches(id),
  category TEXT NOT NULL CHECK (category IN (
    'delivery_fee', 'installation_fee', 'offloading_fee', 'waybill_courier',
    'packaging', 'loading', 'transport', 'dispatch', 'admin', 'supplier',
    'ads', 'miscellaneous', 'other'
  )),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_business ON expenses(business_id);
CREATE INDEX idx_expenses_order ON expenses(order_id);

-- ============================================================
-- RETURNS
-- ============================================================
CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'returned_warehouse', 'inspection_pending',
    'returned_sellable', 'damaged', 'sent_repair', 'replaced', 'written_off'
  )),
  reason TEXT,
  inspection_notes TEXT,
  outcome TEXT,
  handled_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  waybill_batch_id UUID REFERENCES waybill_batches(id),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('invoice', 'receipt', 'delivery_note', 'packing_list', 'waybill_summary')),
  doc_number TEXT UNIQUE,
  generated_by UUID REFERENCES staff(id),
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENT SEQUENCES
-- ============================================================
CREATE SEQUENCE invoice_seq START 1;
CREATE SEQUENCE receipt_seq START 1;
CREATE SEQUENCE waybill_seq START 1;

-- ============================================================
-- ALERTS (for dashboard notifications)
-- ============================================================
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  related_order_id UUID REFERENCES orders(id),
  related_business_id UUID REFERENCES businesses(id),
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE waybill_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE waybill_batch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all (app-level RBAC handles permissions)
CREATE POLICY "authenticated_read_businesses" ON businesses FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_staff" ON staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_order_items" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_timeline" ON order_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_waybill_batches" ON waybill_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_waybill_batch_orders" ON waybill_batch_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_inventory_movements" ON inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_inventory_stock" ON inventory_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_expenses" ON expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_returns" ON returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_documents" ON documents FOR SELECT TO authenticated USING (true);

-- Write policies
CREATE POLICY "authenticated_write_businesses" ON businesses FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_staff" ON staff FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_products" ON products FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_customers" ON customers FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_orders" ON orders FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_order_items" ON order_items FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_timeline" ON order_timeline FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_waybill_batches" ON waybill_batches FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_waybill_batch_orders" ON waybill_batch_orders FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_inventory_movements" ON inventory_movements FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_inventory_stock" ON inventory_stock FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_expenses" ON expenses FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_returns" ON returns FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_write_documents" ON documents FOR ALL TO authenticated USING (true);

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO businesses (name, brand_color, is_active) VALUES
  ('Kanziy', '#EAB308', true),
  ('Toy Store', '#EAB308', true);

INSERT INTO warehouses (name, location, state, is_active) VALUES
  ('Lagos Main Warehouse', 'Lagos Island', 'Lagos', true),
  ('Abuja Warehouse', 'Garki', 'Abuja', true);
