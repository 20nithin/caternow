// Data layer — Supabase with localStorage fallback
// If Supabase is not configured, all operations use localStorage seamlessly.

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { isValidPhone, sanitizePhone, sanitizeText } from './security';

const STORAGE_KEYS = {
  USER: 'caternow_user',
  REQUESTS: 'caternow_requests',
  BIDS: 'caternow_bids',
  VENDORS: 'caternow_vendors',
};

// ===== MENU CATALOGUE =====
export const MENU_CATALOGUE = {
  starters: [
    'Paneer Tikka', 'Veg Spring Rolls', 'Samosa', 'Hara Bhara Kabab',
    'Chicken Tikka', 'Seekh Kabab', 'Fish Fingers', 'Mutton Shammi Kabab',
    'Soup', 'Bruschetta',
  ],
  mains: [
    'Dal Makhani', 'Palak Paneer', 'Shahi Paneer', 'Chana Masala',
    'Aloo Gobi', 'Mix Veg Curry', 'Butter Chicken', 'Chicken Biryani',
    'Mutton Curry', 'Fish Curry', 'Veg Biryani', 'Veg Fried Rice',
    'Naan', 'Roti', 'Paratha', 'Steamed Rice', 'Jeera Rice',
  ],
  desserts: [
    'Gulab Jamun', 'Rasgulla', 'Kheer', 'Halwa', 'Kulfi',
    'Ice Cream', 'Fruit Salad', 'Jalebi', 'Brownie',
  ],
  beverages: [
    'Lassi', 'Buttermilk', 'Lemon Water', 'Cold Drinks', 'Juice',
    'Tea / Coffee', 'Mineral Water',
  ],
};

// ===== STANDARD MENU PRICE TIERS =====
export const PRICE_TIERS = [
  { id: 'basic',    label: 'Basic',    price: 150, description: 'Simple home-style meal' },
  { id: 'standard',label: 'Standard', price: 250, description: 'Full course with starter & dessert' },
  { id: 'premium', label: 'Premium',  price: 400, description: 'Gourmet multi-cuisine spread' },
  { id: 'custom',  label: 'Custom',   price: null, description: 'Enter your own price' },
];

// ===== ADDON SUGGESTIONS =====
export const ADDON_SUGGESTIONS = {
  veg:    [
    { item: 'Paneer Tikka Starter', price: 40 },
    { item: 'Gulab Jamun Dessert', price: 30 },
    { item: 'Fresh Fruit Salad',   price: 25 },
    { item: 'Masala Chai for all', price: 15 },
  ],
  nonveg: [
    { item: 'Chicken Biryani upgrade', price: 50 },
    { item: 'Seekh Kabab Starter',     price: 55 },
    { item: 'Mutton Curry add-on',     price: 70 },
    { item: 'Ice Cream Dessert',       price: 30 },
  ],
  both:   [
    { item: 'Chicken Biryani counter', price: 50 },
    { item: 'Paneer Tikka counter',    price: 40 },
    { item: 'Live Chaat Station',      price: 35 },
    { item: 'Welcome Drink per head',  price: 20 },
  ],
};

// ===== HAVERSINE DISTANCE (km) =====
export function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ===== DEMO VENDORS =====
const DEMO_VENDORS = [
  { id: 'v1', name: 'Royal Feast Caterers', phone: '9876543210', lat: 12.9716, lng: 77.5946, foodType: 'both', radius: 20, fssai: 'FSSAI12345671', rating: 4.5 },
  { id: 'v2', name: 'Spice Garden Kitchen', phone: '9876543211', lat: 12.9352, lng: 77.6245, foodType: 'veg', radius: 15, fssai: 'FSSAI12345672', rating: 4.8 },
  { id: 'v3', name: 'Grand Biryani House', phone: '9876543212', lat: 12.9611, lng: 77.6387, foodType: 'nonveg', radius: 25, fssai: 'FSSAI12345673', rating: 4.2 },
  { id: 'v4', name: 'Annapurna Catering', phone: '9876543213', lat: 13.0358, lng: 77.5970, foodType: 'veg', radius: 30, fssai: 'FSSAI12345674', rating: 4.7 },
  { id: 'v5', name: 'Tandoori Nights', phone: '9876543214', lat: 12.9141, lng: 77.6411, foodType: 'both', radius: 20, fssai: 'FSSAI12345675', rating: 4.4 },
  { id: 'v6', name: 'South Spice Events', phone: '9876543215', lat: 12.9063, lng: 77.5857, foodType: 'veg', radius: 15, fssai: 'FSSAI12345676', rating: 4.9 },
  { id: 'v7', name: 'Mughal Darbar', phone: '9876543216', lat: 13.0067, lng: 77.5654, foodType: 'nonveg', radius: 25, fssai: 'FSSAI12345677', rating: 4.1 },
  { id: 'v8', name: 'Fresh Bites Co.', phone: '9876543217', lat: 12.9698, lng: 77.7500, foodType: 'both', radius: 30, fssai: 'FSSAI12345678', rating: 4.6 },
  { id: 'v9', name: 'Heritage Kitchen', phone: '9876543218', lat: 13.0500, lng: 77.6200, foodType: 'veg', radius: 20, fssai: 'FSSAI12345679', rating: 4.3 },
  { id: 'v10', name: 'BBQ Nation Events', phone: '9876543219', lat: 12.8500, lng: 77.6600, foodType: 'nonveg', radius: 35, fssai: 'FSSAI12345680', rating: 4.0 },
];

// ===== Helper: Convert Supabase snake_case to camelCase =====
function toCamel(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function toSnake(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    result[snakeKey] = value;
  }
  return result;
}

function makeEntityId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeFoodType(value) {
  return value === 'veg' || value === 'nonveg' || value === 'both' ? value : 'veg';
}

function normalizeRequestPayload(request) {
  if (!request || typeof request !== 'object') return null;

  const customerPhone = sanitizePhone(request.customerPhone || '');
  if (!isValidPhone(customerPhone)) return null;

  const plates = toInt(request.plates);
  if (!plates || plates < 10 || plates > 100000) return null;

  const lat = toFiniteNumber(request.lat);
  const lng = toFiniteNumber(request.lng);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const eventName = sanitizeText(request.eventName || 'Catering Request', 120) || 'Catering Request';
  const eventDate = String(request.eventDate || '');
  if (!eventDate || Number.isNaN(new Date(eventDate).getTime())) return null;

  return {
    customerPhone,
    eventName,
    eventDate,
    plates,
    foodType: normalizeFoodType(request.foodType),
    menuNotes: sanitizeText(request.menuNotes || '', 500),
    lat,
    lng,
  };
}

function normalizeBidPayload(bid, request) {
  if (!bid || typeof bid !== 'object' || !request) return null;

  const vendorId = sanitizeText(String(bid.vendorId || ''), 60);
  if (!vendorId) return null;

  const rawPrice = toInt(bid.pricePerPlate);
  if (!rawPrice || rawPrice < 50 || rawPrice > 100000) return null;

  const menuDetails = sanitizeText(bid.menuDetails || '', 1000);
  if (!menuDetails) return null;

  const distance = toFiniteNumber(bid.distance);

  return {
    requestId: request.id,
    vendorId,
    vendorName: sanitizeText(bid.vendorName || 'Vendor', 100) || 'Vendor',
    pricePerPlate: rawPrice,
    totalPrice: rawPrice * request.plates,
    menuDetails,
    notes: sanitizeText(bid.notes || '', 500),
    distance: distance === null ? null : Math.max(0, distance),
  };
}

// ===== SEED DATA =====
export async function seedVendors() {
  if (isSupabaseConfigured()) {
    // Check if vendors exist in Supabase
    const { data } = await supabase.from('vendors').select('id').limit(1);
    if (!data || data.length === 0) {
      const rows = DEMO_VENDORS.map(v => toSnake(v));
      await supabase.from('vendors').insert(rows);
    }
  } else {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.VENDORS) || '[]');
    if (existing.length === 0) {
      localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(DEMO_VENDORS));
    }
  }
}

// ===== CUSTOMERS =====
export async function getCustomer(phone) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('customers').select('*').eq('phone', phone).single();
    if (error) return null;
    return toCamel(data);
  }
  const customers = JSON.parse(localStorage.getItem('caternow_customers') || '[]');
  return customers.find(c => c.phone === phone) || null;
}

export async function createCustomer(customerData) {
  const normalized = {
    id: customerData.id || makeEntityId('cust'),
    phone: customerData.phone,
    name: customerData.name || null,
    email: customerData.email || null,
    isVerified: true
  };

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('customers').insert([toSnake(normalized)]).select().single();
    if (error) { console.error('createCustomer:', error); return null; }
    
    return toCamel(data);
  }

  const customers = JSON.parse(localStorage.getItem('caternow_customers') || '[]');
  customers.push(normalized);
  localStorage.setItem('caternow_customers', JSON.stringify(customers));
  return normalized;
}

export async function updateCustomer(phone, updates) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('customers')
      .update(toSnake(updates))
      .eq('phone', phone)
      .select()
      .single();
    if (error) { console.error('updateCustomer:', error); return null; }
    return toCamel(data);
  }
  const customers = JSON.parse(localStorage.getItem('caternow_customers') || '[]');
  const idx = customers.findIndex((c) => c.phone === phone);
  if (idx !== -1) {
    customers[idx] = { ...customers[idx], ...updates };
    localStorage.setItem('caternow_customers', JSON.stringify(customers));
    return customers[idx];
  }
  return null;
}

// ===== USER =====
export function getUser() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

export function logout() {
  try {
    // Clear all CaterNow data from localStorage
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch { /* ignore */ }
  if (isSupabaseConfigured()) {
    supabase.auth.signOut().catch(() => {});
  }
}

// ===== REQUESTS =====
export async function getRequests() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('getRequests:', error); return []; }
    return (data || []).map(toCamel);
  }
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.REQUESTS) || '[]');
}

export async function getRequest(id) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('requests').select('*').eq('id', id).single();
    if (error) return null;
    return toCamel(data);
  }
  const requests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REQUESTS) || '[]');
  return requests.find(r => r.id === id) || null;
}

export async function createRequest(request) {
  const normalized = normalizeRequestPayload(request);
  if (!normalized) return null;

  const newReq = {
    ...normalized,
    id: makeEntityId('req'),
    status: 'searching',
    currentRadius: 10,
    createdAt: new Date().toISOString(),
    acceptedVendors: [],
  };

  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('requests').insert([toSnake(newReq)]);
    if (error) {
      console.error('createRequest:', error);
      return null;
    }
  } else {
    const requests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REQUESTS) || '[]');
    requests.push(newReq);
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
  }
  return newReq;
}

export async function updateRequest(id, updates) {
  if (isSupabaseConfigured()) {
    const snakeUpdates = toSnake(updates);
    const { data, error } = await supabase
      .from('requests')
      .update(snakeUpdates)
      .eq('id', id)
      .select()
      .single();

    // If the error is a schema cache miss for customer_addons, retry without it
    if (error) {
      const isColumnMissing =
        error.message?.includes('customer_addons') ||
        error.code === 'PGRST204' ||
        error.details?.includes('customer_addons');

      if (isColumnMissing && 'customer_addons' in snakeUpdates) {
        console.warn('customer_addons column not in schema yet — saving without it. Run: ALTER TABLE requests ADD COLUMN IF NOT EXISTS customer_addons JSONB DEFAULT \'[]\'::jsonb;');
        const { customer_addons, ...fallbackUpdates } = snakeUpdates;
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('requests')
          .update(fallbackUpdates)
          .eq('id', id)
          .select()
          .single();
        if (fallbackError) { console.error('updateRequest (fallback):', fallbackError); return null; }
        return toCamel(fallbackData);
      }

      console.error('updateRequest:', error);
      return null;
    }
    return toCamel(data);
  }
  const requests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REQUESTS) || '[]');
  const idx = requests.findIndex(r => r.id === id);
  if (idx !== -1) {
    requests[idx] = { ...requests[idx], ...updates };
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
    return requests[idx];
  }
  return null;
}


export async function getCustomerRequests(phone) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false });
    if (error) { console.error('getCustomerRequests:', error); return []; }
    return (data || []).map(toCamel);
  }
  const requests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REQUESTS) || '[]');
  return requests.filter(r => r.customerPhone === phone);
}

// ===== VENDORS =====
export async function getVendors() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('vendors').select('*');
    if (error) { console.error('getVendors:', error); return []; }
    return (data || []).map(toCamel);
  }
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.VENDORS) || '[]');
}

export async function getVendor(id) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('vendors').select('*').eq('id', id).single();
    if (error) return null;
    return toCamel(data);
  }
  const vendors = JSON.parse(localStorage.getItem(STORAGE_KEYS.VENDORS) || '[]');
  return vendors.find(v => v.id === id) || null;
}

export async function upsertVendorProfile(vendor) {
  const normalized = {
    id: vendor.id,
    name: vendor.name || 'Business User',
    businessName: vendor.businessName || null,
    email: vendor.email || null,
    phone: vendor.phone,
    lat: vendor.lat,
    lng: vendor.lng,
    foodType: vendor.foodType || 'both',
    radius: vendor.radius || 20,
    fssai: vendor.fssai || null,
    rating: typeof vendor.rating === 'number' ? vendor.rating : 0,
  };

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('vendors')
      .upsert([toSnake(normalized)], { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('upsertVendorProfile:', error);
      return null;
    }

    return toCamel(data);
  }

  const vendors = JSON.parse(localStorage.getItem(STORAGE_KEYS.VENDORS) || '[]');
  const idx = vendors.findIndex((v) => v.id === normalized.id);

  if (idx !== -1) {
    vendors[idx] = { ...vendors[idx], ...normalized };
  } else {
    vendors.push(normalized);
  }

  localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(vendors));
  return normalized;
}

export async function getVendorsInRadius(lat, lng, radiusKm, foodType) {
  const vendors = await getVendors();
  return vendors
    .map(v => ({
      ...v,
      distance: getDistance(lat, lng, v.lat, v.lng),
    }))
    .filter(v => {
      const inRadius = v.distance <= radiusKm;
      const matchesFood = foodType === 'both' || v.foodType === 'both' || v.foodType === foodType;
      return inRadius && matchesFood;
    })
    .sort((a, b) => a.distance - b.distance);
}

export async function getRequestsForVendor(vendorId) {
  const vendor = await getVendor(vendorId);
  if (!vendor) return [];
  const requests = await getRequests();
  return requests
    .filter(r => {
      if (r.status === 'cancelled' || r.status === 'completed') return false;
      const dist = getDistance(vendor.lat, vendor.lng, r.lat, r.lng);
      return dist <= r.currentRadius && dist <= vendor.radius;
    })
    .map(r => ({
      ...r,
      distance: getDistance(vendor.lat, vendor.lng, r.lat, r.lng),
    }))
    .sort((a, b) => a.distance - b.distance);
}

// ===== BIDS =====
export async function getBids() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('bids').select('*').order('created_at', { ascending: false });
    if (error) { console.error('getBids:', error); return []; }
    return (data || []).map(toCamel);
  }
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.BIDS) || '[]');
}

export async function getBidsForRequest(requestId) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('bids').select('*').eq('request_id', requestId);
    if (error) { console.error('getBidsForRequest:', error); return []; }
    return (data || []).map(toCamel);
  }
  const bids = JSON.parse(localStorage.getItem(STORAGE_KEYS.BIDS) || '[]');
  return bids.filter(b => b.requestId === requestId);
}

export async function getVendorBids(vendorId) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('bids').select('*').eq('vendor_id', vendorId);
    if (error) { console.error('getVendorBids:', error); return []; }
    return (data || []).map(toCamel);
  }
  const bids = JSON.parse(localStorage.getItem(STORAGE_KEYS.BIDS) || '[]');
  return bids.filter(b => b.vendorId === vendorId);
}

export async function createBid(bid) {
  const request = await getRequest(bid.requestId);
  if (!request) return null;
  if (request.status !== 'searching' && request.status !== 'bidding') {
    return null;
  }

  const normalized = normalizeBidPayload(bid, request);
  if (!normalized) return null;

  const newBid = {
    ...normalized,
    id: makeEntityId('bid'),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('bids').insert([toSnake(newBid)]);
    if (error) console.error('createBid:', error);
    await updateRequest(newBid.requestId, { status: 'bidding' });
  } else {
    const bids = JSON.parse(localStorage.getItem(STORAGE_KEYS.BIDS) || '[]');
    bids.push(newBid);
    localStorage.setItem(STORAGE_KEYS.BIDS, JSON.stringify(bids));
    await updateRequest(newBid.requestId, { status: 'bidding' });
  }
  return newBid;
}

export async function updateBid(id, updates) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('bids')
      .update(toSnake(updates))
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('updateBid:', error); return null; }
    return toCamel(data);
  }
  const bids = JSON.parse(localStorage.getItem(STORAGE_KEYS.BIDS) || '[]');
  const idx = bids.findIndex(b => b.id === id);
  if (idx !== -1) {
    bids[idx] = { ...bids[idx], ...updates };
    localStorage.setItem(STORAGE_KEYS.BIDS, JSON.stringify(bids));
    return bids[idx];
  }
  return null;
}

export async function acceptBid(bidId, customerAddons = []) {
  const allBids = await getBids();
  const bid = allBids.find(b => b.id === bidId);
  if (!bid) return null;

  const request = await getRequest(bid.requestId);
  if (!request) return null;
  if (request.status === 'cancelled' || request.status === 'completed') return null;

  const requestBids = await getBidsForRequest(bid.requestId);
  if (requestBids.length === 0) return null;

  const alreadyConfirmedDifferentBid =
    request.status === 'confirmed' &&
    request.confirmedBidId &&
    request.confirmedBidId !== bidId;

  if (alreadyConfirmedDifferentBid) {
    return requestBids.find((b) => b.id === request.confirmedBidId) || null;
  }

  for (const requestBid of requestBids) {
    const nextStatus = requestBid.id === bidId ? 'accepted' : 'rejected';
    if (requestBid.status !== nextStatus) {
      await updateBid(requestBid.id, { status: nextStatus });
    }
  }

  await updateRequest(bid.requestId, {
    status: 'confirmed',
    confirmedBidId: bidId,
    confirmedVendorId: bid.vendorId,
    customerAddons: Array.isArray(customerAddons) ? customerAddons : [],
  });

  return { ...bid, status: 'accepted' };
}

export async function cancelAcceptedBid(requestId) {
  const request = await getRequest(requestId);
  if (!request) return null;

  const requestBids = await getBidsForRequest(requestId);
  const acceptedBid = requestBids.find((b) => b.status === 'accepted');
  if (!acceptedBid) return null;

  await updateBid(acceptedBid.id, { status: 'skipped' });

  for (const requestBid of requestBids) {
    if (requestBid.id !== acceptedBid.id && requestBid.status === 'rejected') {
      await updateBid(requestBid.id, { status: 'pending' });
    }
  }

  const hasPendingBids = requestBids.some(
    (requestBid) => requestBid.id !== acceptedBid.id && (requestBid.status === 'pending' || requestBid.status === 'rejected')
  );

  await updateRequest(requestId, {
    status: hasPendingBids ? 'bidding' : 'searching',
    confirmedBidId: null,
    confirmedVendorId: null,
  });

  return acceptedBid;
}

export async function cancelRequest(requestId) {
  const request = await getRequest(requestId);
  if (!request) return null;

  if (isSupabaseConfigured()) {
    const { error: bidsError } = await supabase
      .from('bids')
      .update({ status: 'skipped' })
      .eq('request_id', requestId)
      .in('status', ['pending', 'accepted', 'rejected']);

    if (bidsError) {
      console.error('cancelRequest bids update:', bidsError);
      return null;
    }

    const { data, error: requestError } = await supabase
      .from('requests')
      .update(
        toSnake({
          status: 'cancelled',
          confirmedBidId: null,
          confirmedVendorId: null,
          acceptedVendors: [],
        })
      )
      .eq('id', requestId)
      .select()
      .single();

    if (requestError) {
      console.error('cancelRequest request update:', requestError);
      return null;
    }

    return toCamel(data);
  }

  const bids = JSON.parse(localStorage.getItem(STORAGE_KEYS.BIDS) || '[]');
  const nextBids = bids.map((bid) => {
    if (bid.requestId !== requestId) return bid;
    if (bid.status === 'skipped') return bid;
    return { ...bid, status: 'skipped' };
  });
  localStorage.setItem(STORAGE_KEYS.BIDS, JSON.stringify(nextBids));

  const requests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REQUESTS) || '[]');
  const idx = requests.findIndex((r) => r.id === requestId);
  if (idx === -1) return null;

  requests[idx] = {
    ...requests[idx],
    status: 'cancelled',
    confirmedBidId: null,
    confirmedVendorId: null,
    acceptedVendors: [],
  };
  localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
  return requests[idx];
}

export async function skipBid(bidId) {
  return updateBid(bidId, { status: 'skipped' });
}

// Hide a bid (reversible — customer can un-hide)
export async function hideBid(bidId) {
  return updateBid(bidId, { status: 'hidden' });
}

// Un-hide a bid — restore it to pending so customer can accept
export async function unhideBid(bidId) {
  return updateBid(bidId, { status: 'pending' });
}

// Restore a cancelled request so bids can be reviewed again
export async function restoreRequest(requestId) {
  const request = await getRequest(requestId);
  if (!request || request.status !== 'cancelled') return null;

  // Re-open any bids that were skipped/hidden when the request was cancelled
  const bids = await getBidsForRequest(requestId);
  for (const bid of bids) {
    if (bid.status === 'skipped' || bid.status === 'hidden') {
      await updateBid(bid.id, { status: 'pending' });
    }
  }

  const hasBids = bids.length > 0;
  return updateRequest(requestId, {
    status: hasBids ? 'bidding' : 'searching',
    confirmedBidId: null,
    confirmedVendorId: null,
  });
}

// ===== ACCEPT REQUEST (vendor-side) =====
export async function vendorAcceptRequest(requestId, vendorId) {
  const request = await getRequest(requestId);
  if (!request) return null;
  if (request.status !== 'searching' && request.status !== 'bidding') return null;
  const accepted = request.acceptedVendors || [];
  if (!accepted.includes(vendorId)) {
    accepted.push(vendorId);
    await updateRequest(requestId, { acceptedVendors: accepted });
  }
  return request;
}

// ===== EXPAND RADIUS =====
export async function expandRadius(requestId) {
  const request = await getRequest(requestId);
  if (!request) return null;
  const newRadius = request.currentRadius + 10;
  return updateRequest(requestId, { currentRadius: newRadius });
}

// ===== GENERATE ID =====
export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// ===== FORMAT DATE =====
export function formatEventDate(dateStr) {
  if (!dateStr) return 'Date not set';
  const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (parts) {
    const [, year, month, day, hour, minute] = parts;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return 'N/A';
  const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts) {
    const [, year, month, day] = parts;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
