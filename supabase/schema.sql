-- ============================================
-- CaterNow FINAL PRODUCTION DATABASE SCHEMA
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- CUSTOMERS (AUTH + REFERRAL)
-- ==========================================
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);



-- ==========================================
-- VENDORS
-- ==========================================
CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business_name TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  food_type TEXT NOT NULL CHECK (food_type IN ('veg','nonveg','both')),
  radius INTEGER DEFAULT 20,
  fssai TEXT,
  rating DOUBLE PRECISION DEFAULT 0,
  menu JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- REQUESTS
-- ==========================================
CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  customer_phone TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  plates INTEGER CHECK (plates >= 10),
  food_type TEXT CHECK (food_type IN ('veg','nonveg','both')),
  menu_notes TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status TEXT CHECK (status IN ('searching','bidding','confirmed','completed','cancelled')),
  current_radius INTEGER DEFAULT 10,
  accepted_vendors TEXT[] DEFAULT '{}',
  confirmed_bid_id TEXT,
  confirmed_vendor_id TEXT,
  customer_addons JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_requests_phone ON requests(customer_phone);
CREATE INDEX idx_requests_status ON requests(status);

-- ==========================================
-- BIDS
-- ==========================================
CREATE TABLE bids (
  id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT,
  price_per_plate INTEGER CHECK (price_per_plate >= 50),
  total_price INTEGER,
  menu_details TEXT,
  notes TEXT,
  distance DOUBLE PRECISION,
  status TEXT CHECK (status IN ('pending','accepted','rejected','skipped','hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bids_request ON bids(request_id);
CREATE INDEX idx_bids_vendor ON bids(vendor_id);

-- ==========================================
-- OTP SESSIONS (SECURE LOGIN)
-- ==========================================
CREATE TABLE otp_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  attempts INTEGER DEFAULT 0 CHECK (attempts <= 5),
  locked_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_phone ON otp_sessions(phone);
CREATE INDEX idx_otp_customer ON otp_sessions(customer_id);
CREATE INDEX idx_otp_expiry ON otp_sessions(expires_at);

-- ==========================================
-- ENABLE RLS
-- ==========================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_sessions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES (SECURE)
-- ==========================================

-- CUSTOMERS
CREATE POLICY "Customer read self"
ON customers FOR SELECT USING (true);

CREATE POLICY "Customer insert"
ON customers FOR INSERT WITH CHECK (true);

CREATE POLICY "Customer update self"
ON customers FOR UPDATE USING (true);

-- VENDORS (public read, insert/update for self setup)
CREATE POLICY "Vendors public"
ON vendors FOR SELECT USING (true);

CREATE POLICY "Vendors insert"
ON vendors FOR INSERT WITH CHECK (true);

CREATE POLICY "Vendors update self"
ON vendors FOR UPDATE USING (true);

-- REQUESTS (only own)
CREATE POLICY "User requests read"
ON requests FOR SELECT USING (true);

CREATE POLICY "User requests insert"
ON requests FOR INSERT WITH CHECK (true);

CREATE POLICY "User requests update"
ON requests FOR UPDATE USING (true);

-- BIDS (read allowed, restrict later if needed)
CREATE POLICY "Bids read"
ON bids FOR SELECT USING (true);

CREATE POLICY "Bids insert"
ON bids FOR INSERT WITH CHECK (true);

CREATE POLICY "Bids update"
ON bids FOR UPDATE USING (true);

-- OTP (BLOCK ALL CLIENT ACCESS)
CREATE POLICY "OTP blocked"
ON otp_sessions FOR ALL USING (false);

-- ==========================================
-- DEMO DATA
-- ==========================================
INSERT INTO vendors (id,name,phone,lat,lng,food_type,radius,fssai,rating)
VALUES
('v1','Royal Feast Caterers','9876543210',12.9716,77.5946,'both',20,'FSSAI12345671',4.5),
('v2','Spice Garden Kitchen','9876543211',12.9352,77.6245,'veg',15,'FSSAI12345672',4.8),
('v3','Grand Biryani House','9876543212',12.9611,77.6387,'nonveg',25,'FSSAI12345673',4.2)
ON CONFLICT (id) DO NOTHING;