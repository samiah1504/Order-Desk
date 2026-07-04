-- ============================================================
-- ORDER DESK — Internal Operations PWA
-- Full Database Schema v1.0
-- Tables · Indexes · Triggers · Functions · RLS · Seed Data
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- trigram index for fast ILIKE search


-- ============================================================
-- HELPER: generic updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 1. BUSINESSES
-- ============================================================
CREATE TABLE businesses (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT        NOT NULL,
  logo_url        TEXT,
  brand_color     TEXT        NOT NULL DEFAULT '#EAB308',
  address         TEXT,
  phone           TEXT,
  email           TEXT,
  invoice_details TEXT,
  receipt_details TEXT,
  bank_details    JSONB,                       -- { bank, account_number, account_name }
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_businesses_active ON businesses(is_active);


-- ============================================================
-- 2. STAFF
-- ============================================================
CREATE TABLE staff (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name    TEXT        NOT NULL,
  email        TEXT        UNIQUE NOT NULL,
  phone        TEXT,
  staff_code   TEXT        UNIQUE NOT NULL,
  role         TEXT        NOT NULL CHECK (role IN (
                 'ceo', 'operations_manager', 'customer_support',
                 'fulfillment', 'waybill', 'inventory'
               )),
  -- granular permission overrides (e.g. {"view_profit": true, "download_reports": false})
  permissions  JSONB       NOT NULL DEFAULT '{}',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_staff_role       ON staff(role);
CREATE INDEX idx_staff_active     ON staff(is_active);
CREATE INDEX idx_staff_auth_user  ON staff(auth_user_id);


-- ============================================================
-- 3. WAREHOUSES
-- ============================================================
CREATE TABLE warehouses (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL,
  location   TEXT,
  state      TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_warehouses_state  ON warehouses(state);
CREATE INDEX idx_warehouses_active ON warehouses(is_active);


-- ============================================================
-- 4. PRODUCTS
-- ============================================================
CREATE TABLE products (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id           UUID        NOT NULL REFERENCES businesses(id),
  name                  TEXT        NOT NULL,
  category              TEXT,
  default_selling_price DECIMAL(12,2),
  default_cost_price    DECIMAL(12,2),
  image_url             TEXT,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  is_verified           BOOLEAN     NOT NULL DEFAULT false,
  created_by            UUID        REFERENCES staff(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_products_business  ON products(business_id);
CREATE INDEX idx_products_active    ON products(is_active);
CREATE INDEX idx_products_verified  ON products(is_verified);
-- trigram index for fast name search
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);


-- ============================================================
-- 5. CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name  TEXT        NOT NULL,
  phone      TEXT        NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX idx_customers_phone      ON customers(phone);
CREATE INDEX        idx_customers_name_trgm  ON customers USING gin(full_name gin_trgm_ops);

-- address history per customer
CREATE TABLE customer_addresses (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  address     TEXT        NOT NULL,
  state       TEXT,
  city        TEXT,
  is_default  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_addresses_customer ON customer_addresses(customer_id);


-- ============================================================
-- 6. ORDER AUTO-NUMBERING (year-aware, resets per year)
-- ============================================================
CREATE TABLE order_number_counter (
  year     INTEGER PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year INTEGER;
  v_seq  INTEGER;
BEGIN
  -- Only generate if not already provided
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
    INSERT INTO order_number_counter (year, last_seq)
    VALUES (v_year, 1)
    ON CONFLICT (year) DO UPDATE
      SET last_seq = order_number_counter.last_seq + 1
    RETURNING last_seq INTO v_seq;
    NEW.order_number := 'ORD-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 7. ORDERS
-- ============================================================
CREATE TABLE orders (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number          TEXT        UNIQUE,           -- auto-generated by trigger
  customer_id           UUID        REFERENCES customers(id) ON DELETE SET NULL,
  customer_name         TEXT        NOT NULL,
  customer_phone        TEXT        NOT NULL,
  customer_address      TEXT        NOT NULL,
  state                 TEXT        NOT NULL,
  city                  TEXT,
  business_id           UUID        NOT NULL REFERENCES businesses(id),
  status                TEXT        NOT NULL DEFAULT 'new' CHECK (status IN (
                          'new', 'awaiting_waybill', 'waybilled', 'received_warehouse',
                          'processing', 'delivered', 'paid', 'failed_delivery',
                          'cancelled', 'returned'
                        )),
  order_source          TEXT        CHECK (order_source IN (
                          'whatsapp', 'instagram', 'phone_call', 'website',
                          'facebook', 'walk_in', 'referral', 'other'
                        )),
  delivery_note         TEXT,
  customer_requested_date DATE,
  preferred_delivery_window TEXT,
  planned_delivery_date DATE,
  reschedule_reason     TEXT,
  -- financials
  total_amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid           DECIMAL(12,2)           DEFAULT 0,
  -- payment confirmation
  payment_confirmed_at  TIMESTAMPTZ,
  payment_confirmed_by  UUID        REFERENCES staff(id) ON DELETE SET NULL,
  -- failure / cancellation
  failed_reason         TEXT,
  cancel_reason         TEXT,
  -- return tracking
  return_id             UUID,                    -- set when a return record is created
  -- staff
  created_by            UUID        REFERENCES staff(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generate order_number before insert
CREATE TRIGGER trg_orders_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Auto-update updated_at
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Performance indexes
CREATE INDEX idx_orders_status         ON orders(status);
CREATE INDEX idx_orders_state          ON orders(state);
CREATE INDEX idx_orders_business       ON orders(business_id);
CREATE INDEX idx_orders_customer_id    ON orders(customer_id);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_created_at     ON orders(created_at DESC);
CREATE INDEX idx_orders_planned_date   ON orders(planned_delivery_date);
CREATE INDEX idx_orders_paid_at        ON orders(payment_confirmed_at DESC);
CREATE INDEX idx_orders_created_by     ON orders(created_by);
-- composite for fulfillment dashboard (status + state)
CREATE INDEX idx_orders_status_state   ON orders(status, state);
-- trigram search on customer name
CREATE INDEX idx_orders_name_trgm      ON orders USING gin(customer_name gin_trgm_ops);


-- ============================================================
-- 8. ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   UUID          REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT          NOT NULL,
  business_id  UUID          NOT NULL REFERENCES businesses(id),
  quantity     INTEGER       NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price   DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price  DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  colour       TEXT,
  size         TEXT,
  cost_price   DECIMAL(12,2),          -- for profit calculation
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);


-- ============================================================
-- TRIGGER: recalculate orders.total_amount when items change
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_order_total()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  UPDATE orders
  SET total_amount = (
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    FROM order_items
    WHERE order_id = v_order_id
  )
  WHERE id = v_order_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_items_total
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();


-- ============================================================
-- 9. ORDER TIMELINE  (immutable audit log)
-- ============================================================
CREATE TABLE order_timeline (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  action       TEXT        NOT NULL,
  from_status  TEXT,
  to_status    TEXT,
  notes        TEXT,
  performed_by UUID        REFERENCES staff(id) ON DELETE SET NULL,
  staff_name   TEXT,                  -- denormalised so history survives staff deletion
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeline_order      ON order_timeline(order_id);
CREATE INDEX idx_timeline_created_at ON order_timeline(created_at DESC);


-- ============================================================
-- TRIGGER: auto-append timeline entry on every status change
-- ============================================================
CREATE OR REPLACE FUNCTION auto_order_timeline_on_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_timeline (order_id, action, from_status, to_status, staff_name)
    VALUES (
      NEW.id,
      'Status changed to ' || REPLACE(NEW.status, '_', ' '),
      OLD.status,
      NEW.status,
      'System'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_auto_timeline
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION auto_order_timeline_on_status();


-- ============================================================
-- TRIGGER: auto-set payment_confirmed_at when status → paid
-- ============================================================
CREATE OR REPLACE FUNCTION auto_set_payment_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status <> 'paid' THEN
    IF NEW.payment_confirmed_at IS NULL THEN
      NEW.payment_confirmed_at := NOW();
    END IF;
    IF NEW.amount_paid = 0 OR NEW.amount_paid IS NULL THEN
      NEW.amount_paid := NEW.total_amount;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_payment_confirmed
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION auto_set_payment_confirmed();


-- ============================================================
-- 10. WAYBILL BATCHES
-- ============================================================

-- Year-aware batch numbering
CREATE TABLE waybill_batch_counter (
  year     INTEGER PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year INTEGER;
  v_seq  INTEGER;
BEGIN
  IF NEW.batch_number IS NULL OR NEW.batch_number = '' THEN
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
    INSERT INTO waybill_batch_counter (year, last_seq)
    VALUES (v_year, 1)
    ON CONFLICT (year) DO UPDATE
      SET last_seq = waybill_batch_counter.last_seq + 1
    RETURNING last_seq INTO v_seq;
    NEW.batch_number := 'WB-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE waybill_batches (
  id                       UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_number             TEXT          UNIQUE,          -- auto-generated
  waybill_type             TEXT          NOT NULL DEFAULT 'internal'
                                           CHECK (waybill_type IN ('internal', 'supplier')),
  courier_company          TEXT,
  waybill_number           TEXT,
  date_shipped             DATE,
  destination_state        TEXT,
  destination_warehouse_id UUID          REFERENCES warehouses(id) ON DELETE SET NULL,
  -- logistics cost breakdown
  waybill_cost             DECIMAL(12,2) NOT NULL DEFAULT 0,
  packaging_cost           DECIMAL(12,2) NOT NULL DEFAULT 0,
  loading_cost             DECIMAL(12,2) NOT NULL DEFAULT 0,
  transport_cost           DECIMAL(12,2) NOT NULL DEFAULT 0,
  dispatch_cost            DECIMAL(12,2) NOT NULL DEFAULT 0,
  other_logistics_cost     DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_logistics_cost     DECIMAL(12,2) NOT NULL DEFAULT 0,  -- auto-calculated by trigger
  cost_allocation_method   TEXT          NOT NULL DEFAULT 'equal'
                                           CHECK (cost_allocation_method IN ('equal', 'manual')),
  notes                    TEXT,
  receipt_url              TEXT,
  packing_confirmed        BOOLEAN       NOT NULL DEFAULT false,
  status                   TEXT          NOT NULL DEFAULT 'pending'
                                           CHECK (status IN ('pending', 'waybilled', 'received')),
  created_by               UUID          REFERENCES staff(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_waybill_batches_number
  BEFORE INSERT ON waybill_batches
  FOR EACH ROW EXECUTE FUNCTION generate_batch_number();

CREATE TRIGGER trg_waybill_batches_updated_at
  BEFORE UPDATE ON waybill_batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-compute total_logistics_cost whenever any cost column changes
CREATE OR REPLACE FUNCTION recalculate_waybill_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_logistics_cost :=
    COALESCE(NEW.waybill_cost, 0)
    + COALESCE(NEW.packaging_cost, 0)
    + COALESCE(NEW.loading_cost, 0)
    + COALESCE(NEW.transport_cost, 0)
    + COALESCE(NEW.dispatch_cost, 0)
    + COALESCE(NEW.other_logistics_cost, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_waybill_batches_total
  BEFORE INSERT OR UPDATE OF
    waybill_cost, packaging_cost, loading_cost,
    transport_cost, dispatch_cost, other_logistics_cost
  ON waybill_batches
  FOR EACH ROW EXECUTE FUNCTION recalculate_waybill_total();

CREATE INDEX idx_waybill_batches_status ON waybill_batches(status);
CREATE INDEX idx_waybill_batches_state  ON waybill_batches(destination_state);


-- ============================================================
-- 11. WAYBILL BATCH ORDERS (join table)
-- ============================================================
CREATE TABLE waybill_batch_orders (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id       UUID          NOT NULL REFERENCES waybill_batches(id) ON DELETE CASCADE,
  order_id       UUID          NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  allocated_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_packed      BOOLEAN       NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, order_id)
);

CREATE INDEX idx_wbo_batch ON waybill_batch_orders(batch_id);
CREATE INDEX idx_wbo_order ON waybill_batch_orders(order_id);


-- ============================================================
-- TRIGGER: auto-equalise allocated costs when batch total changes
-- ============================================================
CREATE OR REPLACE FUNCTION equalise_batch_allocated_costs()
RETURNS TRIGGER AS $$
DECLARE
  v_order_count INTEGER;
  v_per_order   DECIMAL(12,2);
BEGIN
  -- Only run on equal-allocation batches when cost changes
  IF NEW.cost_allocation_method = 'equal'
     AND NEW.total_logistics_cost IS DISTINCT FROM OLD.total_logistics_cost THEN
    SELECT COUNT(*) INTO v_order_count
    FROM waybill_batch_orders WHERE batch_id = NEW.id;
    IF v_order_count > 0 THEN
      v_per_order := ROUND(NEW.total_logistics_cost / v_order_count, 2);
      UPDATE waybill_batch_orders
      SET allocated_cost = v_per_order
      WHERE batch_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_waybill_equalise_costs
  AFTER UPDATE OF total_logistics_cost ON waybill_batches
  FOR EACH ROW EXECUTE FUNCTION equalise_batch_allocated_costs();


-- ============================================================
-- 12. INVENTORY MOVEMENTS  (immutable ledger)
-- ============================================================
CREATE TABLE inventory_movements (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id           UUID          NOT NULL REFERENCES businesses(id),
  product_id            UUID          NOT NULL REFERENCES products(id),
  warehouse_id          UUID          REFERENCES warehouses(id) ON DELETE SET NULL,
  movement_type         TEXT          NOT NULL CHECK (movement_type IN (
                          'received',   -- stock purchased and received
                          'reserved',   -- stock reserved for an order
                          'released',   -- reservation reversed (order cancelled)
                          'sold',       -- stock confirmed sold (order paid)
                          'returned',   -- sold stock returned to warehouse
                          'damaged',    -- stock written off as damaged
                          'adjusted'    -- manual stock count correction (qty can be negative)
                        )),
  quantity              INTEGER       NOT NULL,      -- positive or negative depending on type
  purchase_cost_per_unit DECIMAL(12,2),
  total_purchase_cost   DECIMAL(12,2),
  supplier              TEXT,
  order_id              UUID          REFERENCES orders(id) ON DELETE SET NULL,
  waybill_batch_id      UUID          REFERENCES waybill_batches(id) ON DELETE SET NULL,
  date_received         DATE,
  notes                 TEXT,
  attachment_url        TEXT,
  created_by            UUID          REFERENCES staff(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_movements_business ON inventory_movements(business_id);
CREATE INDEX idx_inv_movements_product  ON inventory_movements(product_id);
CREATE INDEX idx_inv_movements_type     ON inventory_movements(movement_type);
CREATE INDEX idx_inv_movements_created  ON inventory_movements(created_at DESC);


-- ============================================================
-- 13. INVENTORY STOCK  (running totals — updated by trigger)
-- ============================================================
CREATE TABLE inventory_stock (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID          NOT NULL REFERENCES businesses(id),
  product_id   UUID          NOT NULL REFERENCES products(id),
  warehouse_id UUID          REFERENCES warehouses(id) ON DELETE SET NULL,
  physical_qty INTEGER       NOT NULL DEFAULT 0,
  reserved_qty INTEGER       NOT NULL DEFAULT 0,
  available_qty INTEGER      GENERATED ALWAYS AS (physical_qty - reserved_qty) STORED,
  sold_qty     INTEGER       NOT NULL DEFAULT 0,
  returned_qty INTEGER       NOT NULL DEFAULT 0,
  damaged_qty  INTEGER       NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, product_id, warehouse_id),
  CONSTRAINT chk_physical_non_negative CHECK (physical_qty >= 0),
  CONSTRAINT chk_reserved_non_negative CHECK (reserved_qty >= 0)
);

CREATE INDEX idx_inv_stock_business ON inventory_stock(business_id);
CREATE INDEX idx_inv_stock_product  ON inventory_stock(product_id);
CREATE INDEX idx_inv_stock_low      ON inventory_stock(available_qty) WHERE available_qty < 5;


-- ============================================================
-- TRIGGER: update inventory_stock when a movement is inserted
-- ============================================================
CREATE OR REPLACE FUNCTION apply_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert the stock row first
  INSERT INTO inventory_stock (business_id, product_id, warehouse_id)
  VALUES (NEW.business_id, NEW.product_id, NEW.warehouse_id)
  ON CONFLICT (business_id, product_id, warehouse_id) DO NOTHING;

  IF NEW.movement_type = 'received' THEN
    -- New stock arrives
    UPDATE inventory_stock
    SET physical_qty = physical_qty + NEW.quantity,
        updated_at   = NOW()
    WHERE business_id = NEW.business_id AND product_id = NEW.product_id
      AND warehouse_id IS NOT DISTINCT FROM NEW.warehouse_id;

  ELSIF NEW.movement_type = 'reserved' THEN
    -- Reserve stock for an order
    UPDATE inventory_stock
    SET reserved_qty = reserved_qty + NEW.quantity,
        updated_at   = NOW()
    WHERE business_id = NEW.business_id AND product_id = NEW.product_id
      AND warehouse_id IS NOT DISTINCT FROM NEW.warehouse_id;

  ELSIF NEW.movement_type = 'released' THEN
    -- Un-reserve (order cancelled before paid)
    UPDATE inventory_stock
    SET reserved_qty = GREATEST(0, reserved_qty - NEW.quantity),
        updated_at   = NOW()
    WHERE business_id = NEW.business_id AND product_id = NEW.product_id
      AND warehouse_id IS NOT DISTINCT FROM NEW.warehouse_id;

  ELSIF NEW.movement_type = 'sold' THEN
    -- Stock leaves physical inventory and reserved queue
    UPDATE inventory_stock
    SET physical_qty = GREATEST(0, physical_qty - NEW.quantity),
        reserved_qty = GREATEST(0, reserved_qty - NEW.quantity),
        sold_qty     = sold_qty + NEW.quantity,
        updated_at   = NOW()
    WHERE business_id = NEW.business_id AND product_id = NEW.product_id
      AND warehouse_id IS NOT DISTINCT FROM NEW.warehouse_id;

  ELSIF NEW.movement_type = 'returned' THEN
    -- Stock comes back after a return
    UPDATE inventory_stock
    SET physical_qty  = physical_qty + NEW.quantity,
        returned_qty  = returned_qty + NEW.quantity,
        updated_at    = NOW()
    WHERE business_id = NEW.business_id AND product_id = NEW.product_id
      AND warehouse_id IS NOT DISTINCT FROM NEW.warehouse_id;

  ELSIF NEW.movement_type = 'damaged' THEN
    -- Remove from physical, record as damaged
    UPDATE inventory_stock
    SET physical_qty = GREATEST(0, physical_qty - NEW.quantity),
        damaged_qty  = damaged_qty + NEW.quantity,
        updated_at   = NOW()
    WHERE business_id = NEW.business_id AND product_id = NEW.product_id
      AND warehouse_id IS NOT DISTINCT FROM NEW.warehouse_id;

  ELSIF NEW.movement_type = 'adjusted' THEN
    -- Manual correction; quantity may be negative (write-down) or positive (write-up)
    UPDATE inventory_stock
    SET physical_qty = GREATEST(0, physical_qty + NEW.quantity),
        updated_at   = NOW()
    WHERE business_id = NEW.business_id AND product_id = NEW.product_id
      AND warehouse_id IS NOT DISTINCT FROM NEW.warehouse_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_movements_apply
  AFTER INSERT ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION apply_inventory_movement();


-- ============================================================
-- 14. EXPENSES
-- ============================================================
CREATE TABLE expenses (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID          NOT NULL REFERENCES businesses(id),
  order_id         UUID          REFERENCES orders(id) ON DELETE SET NULL,
  waybill_batch_id UUID          REFERENCES waybill_batches(id) ON DELETE SET NULL,
  category         TEXT          NOT NULL CHECK (category IN (
                     'delivery_fee', 'installation_fee', 'offloading_fee',
                     'waybill_courier', 'packaging', 'loading', 'transport',
                     'dispatch', 'admin', 'supplier', 'ads',
                     'miscellaneous', 'other'
                   )),
  amount           DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  description      TEXT,
  expense_date     DATE          NOT NULL DEFAULT CURRENT_DATE,
  created_by       UUID          REFERENCES staff(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_business ON expenses(business_id);
CREATE INDEX idx_expenses_order    ON expenses(order_id);
CREATE INDEX idx_expenses_batch    ON expenses(waybill_batch_id);
CREATE INDEX idx_expenses_date     ON expenses(expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses(category);


-- ============================================================
-- 15. RETURNS
-- ============================================================
CREATE TABLE returns (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         UUID        NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  status           TEXT        NOT NULL DEFAULT 'requested' CHECK (status IN (
                     'requested', 'returned_warehouse', 'inspection_pending',
                     'returned_sellable', 'damaged', 'sent_repair',
                     'replaced', 'written_off'
                   )),
  reason           TEXT,
  inspection_notes TEXT,
  outcome          TEXT,
  handled_by       UUID        REFERENCES staff(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_returns_order  ON returns(order_id);
CREATE INDEX idx_returns_status ON returns(status);


-- ============================================================
-- 16. DOCUMENTS  (generated from order data)
-- ============================================================

-- Year-aware counters per document type
CREATE TABLE document_counters (
  doc_type TEXT    NOT NULL,
  year     INTEGER NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, year)
);

CREATE OR REPLACE FUNCTION generate_doc_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year   INTEGER;
  v_seq    INTEGER;
  v_prefix TEXT;
BEGIN
  IF NEW.doc_number IS NULL OR NEW.doc_number = '' THEN
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
    v_prefix := CASE NEW.doc_type
      WHEN 'invoice'         THEN 'INV'
      WHEN 'receipt'         THEN 'RCP'
      WHEN 'delivery_note'   THEN 'DN'
      WHEN 'packing_list'    THEN 'PL'
      WHEN 'waybill_summary' THEN 'WBS'
      ELSE 'DOC'
    END;
    INSERT INTO document_counters (doc_type, year, last_seq)
    VALUES (NEW.doc_type, v_year, 1)
    ON CONFLICT (doc_type, year) DO UPDATE
      SET last_seq = document_counters.last_seq + 1
    RETURNING last_seq INTO v_seq;
    NEW.doc_number := v_prefix || '-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE documents (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         UUID        REFERENCES orders(id) ON DELETE SET NULL,
  waybill_batch_id UUID        REFERENCES waybill_batches(id) ON DELETE SET NULL,
  doc_type         TEXT        NOT NULL CHECK (doc_type IN (
                     'invoice', 'receipt', 'delivery_note',
                     'packing_list', 'waybill_summary'
                   )),
  doc_number       TEXT        UNIQUE,        -- auto-generated
  generated_by     UUID        REFERENCES staff(id) ON DELETE SET NULL,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_documents_number
  BEFORE INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION generate_doc_number();

CREATE INDEX idx_documents_order    ON documents(order_id);
CREATE INDEX idx_documents_batch    ON documents(waybill_batch_id);
CREATE INDEX idx_documents_type     ON documents(doc_type);


-- ============================================================
-- 17. ALERTS  (dashboard notifications)
-- ============================================================
CREATE TABLE alerts (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type         TEXT        NOT NULL CHECK (alert_type IN (
                       'order_stale_new',
                       'order_awaiting_waybill_long',
                       'waybilled_not_received',
                       'scheduled_not_processing',
                       'delivered_not_paid',
                       'low_stock',
                       'repeated_failed_delivery'
                     )),
  message            TEXT        NOT NULL,
  related_order_id   UUID        REFERENCES orders(id) ON DELETE CASCADE,
  related_business_id UUID       REFERENCES businesses(id) ON DELETE CASCADE,
  related_product_id UUID        REFERENCES products(id) ON DELETE CASCADE,
  severity           TEXT        NOT NULL DEFAULT 'warning'
                                   CHECK (severity IN ('info', 'warning', 'error')),
  is_resolved        BOOLEAN     NOT NULL DEFAULT false,
  resolved_at        TIMESTAMPTZ,
  resolved_by        UUID        REFERENCES staff(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_unresolved ON alerts(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_alerts_type       ON alerts(alert_type);
CREATE INDEX idx_alerts_order      ON alerts(related_order_id);


-- ============================================================
-- TRIGGER: auto-resolve alert when related order status changes
-- ============================================================
CREATE OR REPLACE FUNCTION auto_resolve_order_alerts()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE alerts
    SET is_resolved = true,
        resolved_at = NOW()
    WHERE related_order_id = NEW.id
      AND is_resolved = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_resolve_alerts
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION auto_resolve_order_alerts();


-- ============================================================
-- ROW LEVEL SECURITY
-- All authenticated users can read everything.
-- Writes are permitted; app-layer RBAC enforces who can do what.
-- ============================================================

ALTER TABLE businesses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff                ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_timeline       ENABLE ROW LEVEL SECURITY;
ALTER TABLE waybill_batches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE waybill_batch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_number_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE waybill_batch_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_counters    ENABLE ROW LEVEL SECURITY;

-- Read policies
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'businesses','staff','warehouses','products','customers','customer_addresses',
    'orders','order_items','order_timeline','waybill_batches','waybill_batch_orders',
    'inventory_movements','inventory_stock','expenses','returns','documents','alerts',
    'order_number_counter','waybill_batch_counter','document_counters'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "auth_read_%s" ON %I FOR SELECT TO authenticated USING (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Write policies
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'businesses','staff','warehouses','products','customers','customer_addresses',
    'orders','order_items','order_timeline','waybill_batches','waybill_batch_orders',
    'inventory_movements','inventory_stock','expenses','returns','documents','alerts',
    'order_number_counter','waybill_batch_counter','document_counters'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "auth_write_%s" ON %I FOR ALL TO authenticated USING (true)',
      tbl, tbl
    );
  END LOOP;
END $$;


-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Live order summary (used by fulfillment and CEO dashboards)
CREATE OR REPLACE VIEW v_order_summary AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.state,
  o.city,
  o.customer_name,
  o.customer_phone,
  o.total_amount,
  o.payment_confirmed_at,
  o.customer_requested_date,
  o.planned_delivery_date,
  o.created_at,
  b.name  AS business_name,
  s.full_name AS created_by_name,
  (
    SELECT STRING_AGG(oi.product_name || ' ×' || oi.quantity, ', ' ORDER BY oi.created_at)
    FROM order_items oi WHERE oi.order_id = o.id
  ) AS items_summary,
  (
    SELECT SUM(e.amount) FROM expenses e WHERE e.order_id = o.id
  ) AS total_expenses,
  (
    SELECT SUM(wbo.allocated_cost)
    FROM waybill_batch_orders wbo WHERE wbo.order_id = o.id
  ) AS waybill_allocated_cost
FROM orders o
LEFT JOIN businesses b ON b.id = o.business_id
LEFT JOIN staff      s ON s.id = o.created_by;

-- Profit per order (CEO / accounting view)
CREATE OR REPLACE VIEW v_order_profit AS
SELECT
  o.id,
  o.order_number,
  o.status,
  b.name                                                           AS business_name,
  o.customer_name,
  o.total_amount                                                   AS sales_amount,
  COALESCE((
    SELECT SUM(oi.quantity * oi.cost_price)
    FROM order_items oi WHERE oi.order_id = o.id AND oi.cost_price IS NOT NULL
  ), 0)                                                            AS product_cost,
  COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.order_id = o.id), 0)
                                                                   AS fulfillment_expenses,
  COALESCE((SELECT SUM(wbo.allocated_cost) FROM waybill_batch_orders wbo WHERE wbo.order_id = o.id), 0)
                                                                   AS logistics_cost,
  o.total_amount
    - COALESCE((SELECT SUM(oi.quantity * oi.cost_price) FROM order_items oi WHERE oi.order_id = o.id AND oi.cost_price IS NOT NULL), 0)
    - COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.order_id = o.id), 0)
    - COALESCE((SELECT SUM(wbo.allocated_cost) FROM waybill_batch_orders wbo WHERE wbo.order_id = o.id), 0)
                                                                   AS net_profit,
  o.payment_confirmed_at,
  o.created_at
FROM orders o
LEFT JOIN businesses b ON b.id = o.business_id
WHERE o.status = 'paid';

-- Monthly business summary (accounting dashboard)
CREATE OR REPLACE VIEW v_monthly_business_summary AS
SELECT
  b.id                                       AS business_id,
  b.name                                     AS business_name,
  DATE_TRUNC('month', o.created_at)          AS month,
  COUNT(*)                                   AS orders_received,
  COUNT(*) FILTER (WHERE o.status = 'paid')  AS orders_paid,
  COUNT(*) FILTER (WHERE o.status IN ('delivered','paid')) AS orders_delivered,
  COUNT(*) FILTER (WHERE o.status = 'cancelled')           AS orders_cancelled,
  COUNT(*) FILTER (WHERE o.status = 'failed_delivery')     AS orders_failed,
  COUNT(*) FILTER (WHERE o.status = 'returned')            AS orders_returned,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'paid'), 0) AS total_sales,
  COALESCE((
    SELECT SUM(e.amount)
    FROM expenses e
    WHERE e.business_id = b.id
      AND DATE_TRUNC('month', e.expense_date) = DATE_TRUNC('month', o.created_at)
  ), 0)                                      AS total_expenses
FROM orders o
JOIN businesses b ON b.id = o.business_id
GROUP BY b.id, b.name, DATE_TRUNC('month', o.created_at);

-- Low-stock alert view
CREATE OR REPLACE VIEW v_low_stock AS
SELECT
  ist.*,
  p.name        AS product_name,
  p.category,
  b.name        AS business_name,
  w.name        AS warehouse_name
FROM inventory_stock ist
JOIN products    p ON p.id = ist.product_id
JOIN businesses  b ON b.id = ist.business_id
LEFT JOIN warehouses w ON w.id = ist.warehouse_id
WHERE ist.available_qty < 5
ORDER BY ist.available_qty ASC;


-- ============================================================
-- SEED DATA
-- ============================================================

-- Businesses
INSERT INTO businesses (id, name, brand_color, phone, email, invoice_details, is_active) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Kanziy',    '#EAB308',
   '+234 800 000 0001', 'hello@kanziy.com',
   'Kanziy Furniture Ltd · RC: 0000001 · Lagos, Nigeria',
   true),
  ('b2000000-0000-0000-0000-000000000002', 'Toy Store', '#EAB308',
   '+234 800 000 0002', 'hello@toystore.ng',
   'Toy Store Nigeria Ltd · RC: 0000002 · Lagos, Nigeria',
   true);

-- Warehouses
INSERT INTO warehouses (id, name, location, state, is_active) VALUES
  ('w1000000-0000-0000-0000-000000000001', 'Lagos Main Warehouse',  'Lagos Island, Lagos',   'Lagos',  true),
  ('w2000000-0000-0000-0000-000000000002', 'Abuja Partner Warehouse','Garki, Abuja',          'Abuja',  true),
  ('w3000000-0000-0000-0000-000000000003', 'Kano Distribution Hub',  'Sabon Gari, Kano',      'Kano',   true),
  ('w4000000-0000-0000-0000-000000000004', 'Rivers Holding Point',   'Trans-Amadi, Port Harcourt','Rivers',true);

-- Staff  (auth_user_id linked after creating auth users in Supabase Auth)
INSERT INTO staff (id, full_name, email, phone, staff_code, role, permissions, is_active) VALUES
  ('s1000000-0000-0000-0000-000000000001', 'Amina Bello',       'amina@company.ng',   '+234 801 000 0001', 'CEO001',  'ceo',               '{}', true),
  ('s2000000-0000-0000-0000-000000000002', 'Tunde Adeyemi',     'tunde@company.ng',   '+234 801 000 0002', 'OPS001',  'operations_manager','{}', true),
  ('s3000000-0000-0000-0000-000000000003', 'Fatima Usman',      'fatima@company.ng',  '+234 801 000 0003', 'CS001',   'customer_support',  '{}', true),
  ('s4000000-0000-0000-0000-000000000004', 'Chidi Okonkwo',     'chidi@company.ng',   '+234 801 000 0004', 'CS002',   'customer_support',  '{}', true),
  ('s5000000-0000-0000-0000-000000000005', 'Aisha Ibrahim',     'aisha@company.ng',   '+234 801 000 0005', 'FUL001',  'fulfillment',       '{}', true),
  ('s6000000-0000-0000-0000-000000000006', 'Emeka Eze',         'emeka@company.ng',   '+234 801 000 0006', 'FUL002',  'fulfillment',       '{}', true),
  ('s7000000-0000-0000-0000-000000000007', 'Hauwa Musa',        'hauwa@company.ng',   '+234 801 000 0007', 'WB001',   'waybill',           '{}', true),
  ('s8000000-0000-0000-0000-000000000008', 'Seun Adebayo',      'seun@company.ng',    '+234 801 000 0008', 'INV001',  'inventory',         '{}', true);

-- Kanziy Products
INSERT INTO products (business_id, name, category, default_selling_price, default_cost_price, is_active, is_verified) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Executive Office Chair',     'Chairs',    85000,  42000, true, true),
  ('b1000000-0000-0000-0000-000000000001', 'Mesh Back Office Chair',     'Chairs',    55000,  27000, true, true),
  ('b1000000-0000-0000-0000-000000000001', 'Recliner Chair',             'Chairs',   120000,  58000, true, true),
  ('b1000000-0000-0000-0000-000000000001', 'Dining Chair (Single)',      'Chairs',    18000,   8500, true, true),
  ('b1000000-0000-0000-0000-000000000001', 'L-Shaped Office Desk',       'Tables',   145000,  70000, true, true),
  ('b1000000-0000-0000-0000-000000000001', 'Glass Top Executive Desk',   'Tables',   195000,  95000, true, true),
  ('b1000000-0000-0000-0000-000000000001', 'Study Table',                'Tables',    65000,  30000, true, true),
  ('b1000000-0000-0000-0000-000000000001', '3-Seater Sofa',              'Sofas',    250000, 120000, true, true),
  ('b1000000-0000-0000-0000-000000000001', '2-Seater Sofa',              'Sofas',    180000,  85000, true, true),
  ('b1000000-0000-0000-0000-000000000001', 'Bookshelf (5-Tier)',         'Storage',   75000,  35000, true, true),
  ('b1000000-0000-0000-0000-000000000001', 'Wardrobe (3-Door)',          'Storage',  320000, 155000, true, true),
  ('b1000000-0000-0000-0000-000000000001', 'TV Stand',                   'Storage',   55000,  25000, true, true),
  ('b1000000-0000-0000-0000-000000000001', 'Bed Frame (King Size)',      'Beds',     280000, 130000, true, true),
  ('b1000000-0000-0000-0000-000000000001', 'Bed Frame (Queen Size)',     'Beds',     220000, 105000, true, true),
  ('b1000000-0000-0000-0000-000000000001', 'Bedside Table',             'Beds',      28000,  12000, true, true);

-- Toy Store Products
INSERT INTO products (business_id, name, category, default_selling_price, default_cost_price, is_active, is_verified) VALUES
  ('b2000000-0000-0000-0000-000000000002', 'Children Tricycle (Red)',    'Tricycles',  35000,  16000, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Children Tricycle (Blue)',   'Tricycles',  35000,  16000, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Children Tricycle (Yellow)', 'Tricycles',  35000,  16000, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Children Bicycle (14-inch)', 'Bicycles',   45000,  20000, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Children Bicycle (16-inch)', 'Bicycles',   52000,  24000, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Children Bicycle (20-inch)', 'Bicycles',   65000,  29000, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Ride-On Car (Battery)',      'Ride-On',    95000,  44000, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Scooter (3-Wheel)',          'Ride-On',    22000,   9500, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'LEGO Classic Set',           'Toys',       18000,   7500, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Barbie Dreamhouse Set',      'Toys',       75000,  32000, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Remote Control Car',         'Toys',       28000,  12000, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Wooden Puzzle Set',          'Educational',12000,   4800, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Educational Tablet (Kids)',  'Educational',42000,  18000, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Play Kitchen Set',           'Toys',       38000,  16000, true, true),
  ('b2000000-0000-0000-0000-000000000002', 'Inflatable Bounce Castle',   'Outdoor',   180000,  80000, true, true);

-- Seed initial stock for Lagos warehouse (for demo purposes)
INSERT INTO inventory_stock
  (business_id, product_id, warehouse_id, physical_qty, reserved_qty, sold_qty, returned_qty, damaged_qty)
SELECT
  p.business_id,
  p.id,
  'w1000000-0000-0000-0000-000000000001',
  20,   -- physical_qty
  0,    -- reserved_qty
  0,    -- sold_qty
  0,    -- returned_qty
  0     -- damaged_qty
FROM products p
WHERE p.is_active = true;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
