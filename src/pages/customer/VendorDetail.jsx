import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getVendor, getDistance } from '../../utils/data';

// ─── Full item pool with per-plate prices ─────────────────────────────────────
const POOL = {
  starters: {
    veg: [
      { name: 'Paneer Tikka',      price: 65 },
      { name: 'Veg Spring Rolls',  price: 40 },
      { name: 'Samosa',            price: 25 },
      { name: 'Hara Bhara Kabab',  price: 55 },
      { name: 'Soup of the Day',   price: 30 },
      { name: 'Dahi Puri',         price: 35 },
      { name: 'Papdi Chaat',       price: 40 },
      { name: 'Veg Cutlet',        price: 35 },
      { name: 'Corn Chaat',        price: 30 },
      { name: 'Bruschetta',        price: 45 },
      { name: 'Aloo Tikki',        price: 30 },
      { name: 'Mushroom Skewer',   price: 60 },
    ],
    nonveg: [
      { name: 'Chicken Tikka',         price: 120 },
      { name: 'Seekh Kabab',           price: 110 },
      { name: 'Fish Fingers',          price: 100 },
      { name: 'Mutton Shammi Kabab',   price: 130 },
      { name: 'Chicken Wings',         price: 90  },
      { name: 'Prawn Cocktail',        price: 150 },
      { name: 'Tandoori Chicken',      price: 140 },
      { name: 'Chicken Lollipop',      price: 95  },
    ],
  },
  mains: {
    veg: [
      { name: 'Dal Makhani',    price: 70 },
      { name: 'Palak Paneer',   price: 80 },
      { name: 'Shahi Paneer',   price: 85 },
      { name: 'Chana Masala',   price: 60 },
      { name: 'Aloo Gobi',      price: 55 },
      { name: 'Mix Veg Curry',  price: 65 },
      { name: 'Veg Biryani',    price: 90 },
      { name: 'Veg Fried Rice', price: 75 },
      { name: 'Kadai Paneer',   price: 85 },
      { name: 'Matar Paneer',   price: 80 },
      { name: 'Naan',           price: 20 },
      { name: 'Butter Roti',    price: 15 },
      { name: 'Paratha',        price: 25 },
      { name: 'Steamed Rice',   price: 30 },
      { name: 'Jeera Rice',     price: 40 },
      { name: 'Pav Bhaji',      price: 60 },
    ],
    nonveg: [
      { name: 'Butter Chicken',  price: 150 },
      { name: 'Chicken Biryani', price: 160 },
      { name: 'Mutton Curry',    price: 180 },
      { name: 'Fish Curry',      price: 140 },
      { name: 'Chicken Curry',   price: 130 },
      { name: 'Egg Curry',       price: 80  },
      { name: 'Prawn Masala',    price: 190 },
      { name: 'Chicken Korma',   price: 145 },
    ],
  },
  desserts: [
    { name: 'Gulab Jamun',  price: 35 },
    { name: 'Rasgulla',     price: 30 },
    { name: 'Kheer',        price: 40 },
    { name: 'Halwa',        price: 35 },
    { name: 'Kulfi',        price: 45 },
    { name: 'Ice Cream',    price: 50 },
    { name: 'Fruit Salad',  price: 40 },
    { name: 'Jalebi',       price: 30 },
    { name: 'Brownie',      price: 60 },
    { name: 'Rasmalai',     price: 50 },
    { name: 'Payasam',      price: 40 },
    { name: 'Double Ka Meetha', price: 45 },
  ],
  beverages: [
    { name: 'Masala Lassi',   price: 40 },
    { name: 'Buttermilk',     price: 25 },
    { name: 'Lemon Water',    price: 20 },
    { name: 'Cold Drinks',    price: 30 },
    { name: 'Fresh Juice',    price: 50 },
    { name: 'Tea / Coffee',   price: 20 },
    { name: 'Mineral Water',  price: 15 },
    { name: 'Coconut Water',  price: 35 },
    { name: 'Rose Sharbat',   price: 30 },
    { name: 'Jaljeera',       price: 25 },
  ],
};

// ─── Deterministic shuffle seeded by vendor ID ────────────────────────────────
function hashId(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function seededPick(arr, count, seed) {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = Math.abs(Math.imul(s ^ (s >>> 15), 2246822519));
    s = Math.abs(Math.imul(s ^ (s >>> 13), 3266489917));
    const j = (s >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, Math.min(count, arr.length));
}

// Try loading vendor's saved custom menu from localStorage
function loadCustomMenu(vendorId) {
  try { return JSON.parse(localStorage.getItem(`caternow_vendor_menu_${vendorId}`) || 'null'); }
  catch { return null; }
}

function getVendorMenu(vendor) {
  // ── Priority 1: use vendor's own saved menu ──────────────────────────────
  const custom = loadCustomMenu(vendor.id);
  if (custom) {
    const result = {};
    const keys = {
      '🥗 Starters':       'starters',
      '🍛 Mains & Breads': 'mains',
      '🍮 Desserts':       'desserts',
      '🥤 Beverages':      'beverages',
    };
    for (const [label, cat] of Object.entries(keys)) {
      result[label] = (custom[cat] || [])
        .filter(r => r.enabled)
        .map(r => ({ name: r.name, price: r.price || 50 }));
    }
    // Remove empty categories
    for (const k of Object.keys(result)) {
      if (result[k].length === 0) delete result[k];
    }
    if (Object.keys(result).length > 0) return result;
  }

  // ── Priority 2: seeded-random generation ────────────────────────────────
  const seed = hashId(vendor.id || 'x');
  const { starters, mains, desserts, beverages } = POOL;

  let st = [], mn = [];

  if (vendor.foodType === 'veg') {
    st = seededPick(starters.veg,  3 + (seed % 4), seed);
    mn = [
      ...seededPick(mains.veg.filter(i => !['Naan','Butter Roti','Paratha','Steamed Rice','Jeera Rice'].includes(i.name)), 4 + (seed % 3), seed + 1),
      ...seededPick(mains.veg.filter(i =>  ['Naan','Butter Roti','Paratha','Steamed Rice','Jeera Rice'].includes(i.name)), 2, seed + 2),
    ];
  } else if (vendor.foodType === 'nonveg') {
    st = [
      ...seededPick(starters.nonveg, 3 + (seed % 2), seed),
      ...seededPick(starters.veg,    2,               seed + 7),
    ];
    mn = [
      ...seededPick(mains.nonveg, 3 + (seed % 2), seed + 1),
      ...seededPick(mains.veg.filter(i => ['Naan','Butter Roti','Paratha','Steamed Rice','Jeera Rice'].includes(i.name)), 2, seed + 2),
      ...seededPick(mains.veg.filter(i => !['Naan','Butter Roti','Paratha','Steamed Rice','Jeera Rice'].includes(i.name)), 2, seed + 3),
    ];
  } else {
    st = [
      ...seededPick(starters.veg,    3, seed),
      ...seededPick(starters.nonveg, 3, seed + 5),
    ];
    mn = [
      ...seededPick(mains.nonveg, 3 + (seed % 2), seed + 1),
      ...seededPick(mains.veg.filter(i => !['Naan','Butter Roti','Paratha','Steamed Rice','Jeera Rice'].includes(i.name)), 3, seed + 2),
      ...seededPick(mains.veg.filter(i =>  ['Naan','Butter Roti','Paratha','Steamed Rice','Jeera Rice'].includes(i.name)), 2, seed + 3),
    ];
  }

  return {
    '🥗 Starters':        st,
    '🍛 Mains & Breads':  mn,
    '🍮 Desserts':        seededPick(desserts,  3 + (seed % 4), seed + 8),
    '🥤 Beverages':       seededPick(beverages, 3 + (seed % 3), seed + 9),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ratingStars(r) {
  const full = Math.floor(r), half = r % 1 >= 0.5;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}
function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function avatarGrad(type) {
  if (type === 'veg')    return 'linear-gradient(135deg,#059669,#047857)';
  if (type === 'nonveg') return 'linear-gradient(135deg,#DC2626,#B91C1C)';
  return 'linear-gradient(135deg,#E8590C,#7C3AED)';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useApp();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('menu');

  useEffect(() => {
    if (!user || user.role !== 'customer') navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    getVendor(id).then(v => {
      if (v) {
        const uLat = 12.9716, uLng = 77.5946;
        setVendor({ ...v, distance: getDistance(uLat, uLng, v.lat, v.lng) });
      }
      setLoading(false);
    });
  }, [id]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="app-container">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate('/customer/vendors')}>←</button>
          <h1>Vendor Profile</h1>
        </div>
        <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="app-container">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate('/customer/vendors')}>←</button>
          <h1>Not Found</h1>
        </div>
        <div className="page">
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>Vendor not found</h3>
            <p>This vendor may no longer be active.</p>
            <button className="btn btn-secondary mt-md" onClick={() => navigate('/customer/vendors')}>
              Back to Search
            </button>
          </div>
        </div>
      </div>
    );
  }

  const menu         = getVendorMenu(vendor);
  const totalItems   = Object.values(menu).reduce((s, arr) => s + arr.length, 0);
  const foodLabel    = { veg: '🟢 Veg', nonveg: '🔴 Non-Veg', both: '🟠 Veg + Non-Veg' };
  const badgeCls     = { veg: 'badge-veg', nonveg: 'badge-nonveg', both: 'badge-both' };

  return (
    <div className="app-container">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/customer/vendors')}>←</button>
        <h1>Vendor Profile</h1>
      </div>

      <div className="page">

        {/* ── Hero ── */}
        <div className="vd-hero">
          <div className="vd-avatar" style={{ background: avatarGrad(vendor.foodType) }}>
            {getInitials(vendor.name)}
          </div>
          <div className="vd-hero-body">
            <h2 className="vd-name">{vendor.name}</h2>
            <div className="vd-meta-row">
              <span className={`badge ${badgeCls[vendor.foodType]}`}>{foodLabel[vendor.foodType]}</span>
              <span className="vd-dist">📍 {vendor.distance?.toFixed(1)} km away</span>
            </div>
            {vendor.rating > 0 && (
              <div className="vd-rating">
                <span className="vd-stars">{ratingStars(vendor.rating)}</span>
                <span className="vd-rating-num">{vendor.rating.toFixed(1)}</span>
                <span className="vd-rating-max">/ 5.0</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="vd-stats">
          <div className="vd-stat">
            <span className="vd-stat-icon">📡</span>
            <span className="vd-stat-value">{vendor.radius} km</span>
            <span className="vd-stat-label">Service Radius</span>
          </div>
          <div className="vd-stat-divider" />
          <div className="vd-stat">
            <span className="vd-stat-icon">🍽️</span>
            <span className="vd-stat-value">{totalItems}</span>
            <span className="vd-stat-label">Menu Items</span>
          </div>
          <div className="vd-stat-divider" />
          <div className="vd-stat">
            <span className="vd-stat-icon">⭐</span>
            <span className="vd-stat-value">{vendor.rating > 0 ? vendor.rating.toFixed(1) : '—'}</span>
            <span className="vd-stat-label">Rating</span>
          </div>
        </div>

        {/* ── Info card ── */}
        <div className="vd-info-card">
          {vendor.fssai && (
            <div className="vd-info-row">
              <span className="vd-info-icon">✅</span>
              <div>
                <div className="vd-info-label">FSSAI License</div>
                <div className="vd-info-value vd-fssai">{vendor.fssai}</div>
              </div>
            </div>
          )}
          <div className="vd-info-row">
            <span className="vd-info-icon">📞</span>
            <div>
              <div className="vd-info-label">Contact</div>
              <div className="vd-info-value">Available after booking</div>
            </div>
          </div>
          <div className="vd-info-row">
            <span className="vd-info-icon">🍱</span>
            <div>
              <div className="vd-info-label">Speciality</div>
              <div className="vd-info-value">{foodLabel[vendor.foodType]} Cuisine</div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="vd-tabs">
          <button className={`vd-tab ${activeTab === 'menu' ? 'active' : ''}`}    onClick={() => setActiveTab('menu')}>
            📋 Menu &amp; Prices
          </button>
          <button className={`vd-tab ${activeTab === 'pricing' ? 'active' : ''}`} onClick={() => setActiveTab('pricing')}>
            💰 Package Deals
          </button>
        </div>

        {/* ── MENU TAB ── */}
        {activeTab === 'menu' && (
          <div className="vd-menu">
            <p className="vd-menu-intro">
              Prices shown are <strong>per plate</strong>. Final menu &amp; pricing is confirmed when the vendor submits their bid.
            </p>

            {Object.entries(menu).map(([catLabel, items]) => (
              <div key={catLabel} className="vd-menu-section">
                {/* Category header */}
                <div className="vd-menu-cat">
                  <span className="vd-menu-cat-icon">{catLabel.split(' ')[0]}</span>
                  <span className="vd-menu-cat-label">{catLabel.split(' ').slice(1).join(' ')}</span>
                  <span className="vd-menu-cat-count">{items.length} items</span>
                </div>

                {/* List rows */}
                <div className="vd-item-list">
                  {items.map((item, idx) => (
                    <div key={item.name} className="vd-item-row" style={{ animationDelay: `${idx * 0.03}s` }}>
                      <span className="vd-item-dot" />
                      <span className="vd-item-name">{item.name}</span>
                      <span className="vd-item-dots" />
                      <span className="vd-item-price">₹{item.price}<span className="vd-item-unit">/plate</span></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PRICING TAB ── */}
        {activeTab === 'pricing' && (
          <div className="vd-pricing">
            <p className="vd-menu-intro">
              Choose a package — the vendor will customise the menu from the above selection.
            </p>
            <div className="vd-price-cards">
              <div className="vd-price-card">
                <div className="vd-price-tier">🌱 Basic</div>
                <div className="vd-price-range">₹120 – ₹180<span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>/plate</span></div>
                <div className="vd-price-desc">Simple home-style meal · 1 starter · 2 mains · rice or roti · 1 dessert · water</div>
              </div>
              <div className="vd-price-card highlight">
                <div className="vd-price-badge">Most Popular</div>
                <div className="vd-price-tier">🍛 Standard</div>
                <div className="vd-price-range">₹200 – ₹300<span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>/plate</span></div>
                <div className="vd-price-desc">Full course · 2 starters · 3 mains · breads · 2 desserts · beverage</div>
              </div>
              <div className="vd-price-card">
                <div className="vd-price-tier">👑 Premium</div>
                <div className="vd-price-range">₹350 – ₹500<span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>/plate</span></div>
                <div className="vd-price-desc">Gourmet spread · live counters · 4+ starters · 5+ mains · unlimited desserts &amp; drinks</div>
              </div>
            </div>
            <div className="vd-pricing-note">
              <span>💡</span>
              <span>Exact price is finalised when the vendor submits their bid on your request.</span>
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div className="vd-cta">
          <button className="btn btn-primary btn-block btn-lg" onClick={() => navigate('/customer/new-request')}>
            🚀 Post a Request
          </button>
          <p className="vd-cta-note">
            Create a catering request and {vendor.name} will be notified if they cover your area.
          </p>
        </div>

      </div>
    </div>
  );
}
