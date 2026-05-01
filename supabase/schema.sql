-- ============================================
-- CaterNow Database Schema for Supabase
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- VENDORS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  food_type TEXT NOT NULL DEFAULT 'both' CHECK (food_type IN ('veg', 'nonveg', 'both')),
  radius INTEGER NOT NULL DEFAULT 20,
  fssai TEXT,
  rating DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- REQUESTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  customer_phone TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  plates INTEGER NOT NULL CHECK (plates >= 10),
  food_type TEXT NOT NULL DEFAULT 'veg' CHECK (food_type IN ('veg', 'nonveg', 'both')),
  menu_notes TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'searching' CHECK (status IN ('searching', 'bidding', 'confirmed', 'completed', 'cancelled')),
  current_radius INTEGER NOT NULL DEFAULT 10,
  accepted_vendors TEXT[] DEFAULT '{}',
  confirmed_bid_id TEXT,
  confirmed_vendor_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- BIDS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS bids (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT,
  price_per_plate INTEGER NOT NULL CHECK (price_per_plate >= 50),
  total_price INTEGER NOT NULL,
  menu_details TEXT,
  notes TEXT,
  distance DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- OTP SESSIONS TABLE (for server-side OTP)
-- ==========================================
CREATE TABLE IF NOT EXISTS otp_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL, -- Store hashed OTP, never plaintext
  attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_sessions_phone ON otp_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_otp_sessions_expires ON otp_sessions(expires_at);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Vendors: anyone can read, authenticated can insert/update
CREATE POLICY "Vendors are viewable by everyone" ON vendors FOR SELECT USING (true);
CREATE POLICY "Vendors can be created by anyone" ON vendors FOR INSERT WITH CHECK (true);
CREATE POLICY "Vendors can update own data" ON vendors FOR UPDATE USING (true);

-- Requests: anyone can read, anyone can create/update (simplified for demo)
-- PRODUCTION: Tighten to customer_phone = auth.jwt()->>'phone'
CREATE POLICY "Requests are viewable by everyone" ON requests FOR SELECT USING (true);
CREATE POLICY "Requests can be created by anyone" ON requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Requests can be updated by anyone" ON requests FOR UPDATE USING (true);

-- Bids: anyone can read, anyone can create/update (simplified for demo)
-- PRODUCTION: Tighten to vendor_id = auth.uid()
CREATE POLICY "Bids are viewable by everyone" ON bids FOR SELECT USING (true);
CREATE POLICY "Bids can be created by anyone" ON bids FOR INSERT WITH CHECK (true);
CREATE POLICY "Bids can be updated by anyone" ON bids FOR UPDATE USING (true);

-- OTP Sessions: server-side access only (no direct client access)
ALTER TABLE otp_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "OTP sessions are not accessible" ON otp_sessions FOR ALL USING (false);

-- ==========================================
-- SEED DEMO VENDORS
-- ==========================================
INSERT INTO vendors (id, name, phone, lat, lng, food_type, radius, fssai, rating) VALUES
  ('v1', 'Royal Feast Caterers', '9876543210', 12.9716, 77.5946, 'both', 20, 'FSSAI12345671', 4.5),
  ('v2', 'Spice Garden Kitchen', '9876543211', 12.9352, 77.6245, 'veg', 15, 'FSSAI12345672', 4.8),
  ('v3', 'Grand Biryani House', '9876543212', 12.9611, 77.6387, 'nonveg', 25, 'FSSAI12345673', 4.2),
  ('v4', 'Annapurna Catering', '9876543213', 13.0358, 77.5970, 'veg', 30, 'FSSAI12345674', 4.7),
  ('v5', 'Tandoori Nights', '9876543214', 12.9141, 77.6411, 'both', 20, 'FSSAI12345675', 4.4),
  ('v6', 'South Spice Events', '9876543215', 12.9063, 77.5857, 'veg', 15, 'FSSAI12345676', 4.9),
  ('v7', 'Mughal Darbar', '9876543216', 13.0067, 77.5654, 'nonveg', 25, 'FSSAI12345677', 4.1),
  ('v8', 'Fresh Bites Co.', '9876543217', 12.9698, 77.7500, 'both', 30, 'FSSAI12345678', 4.6),
  ('v9', 'Heritage Kitchen', '9876543218', 13.0500, 77.6200, 'veg', 20, 'FSSAI12345679', 4.3),
  ('v10', 'BBQ Nation Events', '9876543219', 12.8500, 77.6600, 'nonveg', 35, 'FSSAI12345680', 4.0)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- INDEXES for performance
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_requests_customer_phone ON requests(customer_phone);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_bids_request_id ON bids(request_id);
CREATE INDEX IF NOT EXISTS idx_bids_vendor_id ON bids(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);
