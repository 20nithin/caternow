import { useState, useEffect, useCallback } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

// ─── Item pool per food type ──────────────────────────────────────────────────
const ITEM_POOL = {
  starters: {
    veg:    ['Paneer Tikka','Veg Spring Rolls','Samosa','Hara Bhara Kabab','Soup of the Day','Dahi Puri','Papdi Chaat','Veg Cutlet','Corn Chaat','Bruschetta','Aloo Tikki','Mushroom Skewer'],
    nonveg: ['Chicken Tikka','Seekh Kabab','Fish Fingers','Mutton Shammi Kabab','Chicken Wings','Prawn Cocktail','Tandoori Chicken','Chicken Lollipop'],
  },
  mains: {
    veg:    ['Dal Makhani','Palak Paneer','Shahi Paneer','Chana Masala','Aloo Gobi','Mix Veg Curry','Veg Biryani','Veg Fried Rice','Kadai Paneer','Matar Paneer','Pav Bhaji'],
    nonveg: ['Butter Chicken','Chicken Biryani','Mutton Curry','Fish Curry','Chicken Curry','Egg Curry','Prawn Masala','Chicken Korma'],
    breads: ['Naan','Butter Roti','Paratha','Steamed Rice','Jeera Rice'],
  },
  desserts:  ['Gulab Jamun','Rasgulla','Kheer','Halwa','Kulfi','Ice Cream','Fruit Salad','Jalebi','Brownie','Rasmalai','Payasam','Double Ka Meetha'],
  beverages: ['Masala Lassi','Buttermilk','Lemon Water','Cold Drinks','Fresh Juice','Tea / Coffee','Mineral Water','Coconut Water','Rose Sharbat','Jaljeera'],
};

function getDefaultPrice(cat, name) {
  const nonvegStarters = ITEM_POOL.starters.nonveg;
  const nonvegMains    = ITEM_POOL.mains.nonveg;
  const breads         = ITEM_POOL.mains.breads;
  if (cat === 'starters' || cat === 'startersNonveg') return nonvegStarters.includes(name) ? 110 : 45;
  if (cat === 'mainsNonveg') return 150;
  if (cat === 'breads')      return breads.includes(name) ? 20 : 50;
  if (cat === 'mainsVeg')    return 70;
  if (cat === 'mains')       return nonvegMains.includes(name) ? 150 : breads.includes(name) ? 20 : 70;
  if (cat === 'desserts')    return 40;
  if (cat === 'beverages')   return 25;
  return 50;
}

const LS_MENU_KEY = (id) => `caternow_vendor_menu_${id}`;

function loadSavedMenu(id) {
  try { return JSON.parse(localStorage.getItem(LS_MENU_KEY(id)) || 'null'); }
  catch { return null; }
}
function saveMenu(id, menu) {
  localStorage.setItem(LS_MENU_KEY(id), JSON.stringify(menu));
}

// Build the full menu split into separate sub-categories
function buildFullMenu(foodType) {
  const { starters, mains, desserts, beverages } = ITEM_POOL;

  function toRows(cat, items) {
    return items.map(name => ({
      name,
      enabled: true,
      price: getDefaultPrice(cat, name),
    }));
  }

  const isVeg    = foodType === 'veg'    || foodType === 'both';
  const isNonveg = foodType === 'nonveg' || foodType === 'both';

  // Starters: show veg always; nonveg only if vendor serves nonveg
  const starterItems = isNonveg
    ? [...starters.veg, ...starters.nonveg]
    : starters.veg;

  const result = {
    starters:  toRows('starters', starterItems),
    desserts:  toRows('desserts', desserts),
    beverages: toRows('beverages', beverages),
    breads:    toRows('breads', mains.breads),
  };

  if (isVeg)    result.mainsVeg    = toRows('mainsVeg',    mains.veg);
  if (isNonveg) result.mainsNonveg = toRows('mainsNonveg', mains.nonveg);

  return result;
}

// Merge saved menu with full pool — also handles old flat 'mains' data
function mergeMenu(full, saved) {
  const result = {};
  for (const cat of Object.keys(full)) {
    // Try the exact key first; fall back to the old 'mains' key for migration
    const savedCat = saved[cat] || saved['mains'] || [];
    result[cat] = full[cat].map(row => {
      const s = savedCat.find(r => r.name === row.name);
      return s ? { ...row, enabled: s.enabled, price: s.price ?? row.price } : row;
    });
  }
  return result;
}

// Order of display in the UI
const CATEGORY_META = {
  starters:    { icon: '🥗', label: 'Starters' },
  mainsVeg:    { icon: '🟢', label: 'Veg Mains' },
  mainsNonveg: { icon: '🔴', label: 'Non-Veg Mains' },
  breads:      { icon: '🍞', label: 'Breads & Rice' },
  desserts:    { icon: '🍮', label: 'Desserts' },
  beverages:   { icon: '🥤', label: 'Beverages' },
};

const BID_STATUS = {
  pending:  { cls: 'badge-bidding',   label: '⏳ Pending' },
  accepted: { cls: 'badge-confirmed', label: '✅ Won' },
  rejected: { cls: 'badge-cancelled', label: '✕ Rejected' },
  hidden:   { cls: 'badge-cancelled', label: '👁 Hidden' },
};

function getInitials(name, phone) {
  if (name && name.trim()) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  const d = String(phone || '').replace(/\D/g, '');
  return d.slice(-2) || '??';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function VendorProfile() {
  const { user, logout, updateUser, bids: allBids } = useApp();
  const navigate = useNavigate();

  const [activeTab, setActiveTab]  = useState('history');
  const [menu, setMenu]            = useState(null);
  const [saved, setSaved]          = useState(false);
  const [openCats, setOpenCats]    = useState(
    () => new Set(['starters','mainsVeg','mainsNonveg','breads','desserts','beverages'])
  );

  // Edit profile state
  const [name, setName]               = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail]             = useState('');
  const [saveFeedback, setSaveFeedback] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'vendor') navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    const full   = buildFullMenu(user.foodType || 'both');
    const stored = loadSavedMenu(user.id);
    setMenu(stored ? mergeMenu(full, stored) : full);
    setName(user.name || '');
    setBusinessName(user.businessName || '');
    setEmail(user.email || '');
  }, [user]);

  const myBids      = allBids.filter(b => b.vendorId === user?.id);
  const wonBids     = myBids.filter(b => b.status === 'accepted');
  const pendingBids = myBids.filter(b => b.status === 'pending');

  // Toggle item on/off
  const toggleItem = useCallback((cat, name) => {
    setSaved(false);
    setMenu(prev => ({
      ...prev,
      [cat]: prev[cat].map(r => r.name === name ? { ...r, enabled: !r.enabled } : r),
    }));
  }, []);

  // Update price for an item
  const updatePrice = useCallback((cat, name, raw) => {
    const price = parseInt(raw, 10);
    setSaved(false);
    setMenu(prev => ({
      ...prev,
      [cat]: prev[cat].map(r => r.name === name ? { ...r, price: isNaN(price) ? '' : price } : r),
    }));
  }, []);

  const handleSave = () => {
    saveMenu(user.id, menu);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setMenu(buildFullMenu(user.foodType || 'both'));
    setSaved(false);
  };

  const handleSaveProfile = () => {
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setSaveFeedback('⚠️ Enter a valid email address.');
      return;
    }
    updateUser({ name: name.trim(), businessName: businessName.trim(), email: trimmedEmail });
    setSaveFeedback('✅ Profile updated!');
    setTimeout(() => setSaveFeedback(''), 2500);
  };

  if (!user || !menu) return null;

  const enabledCount = Object.values(menu).flat().filter(r => r.enabled).length;
  const totalCount   = Object.values(menu).flat().length;

  return (
    <div className="app-container">
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <div className="logo" style={{ fontSize: '1.1rem' }}>
            <span className="logo-icon" style={{ fontSize: '1.4rem' }}>🍽️</span>
            <span className="logo-text">My Profile</span>
          </div>
        </div>
      </div>

      <div className="page">

        {/* ── Hero ── */}
        <div className="profile-hero">
          <div className="profile-avatar" style={{ background:'linear-gradient(135deg,#E8590C,#7C3AED)' }}>
            {getInitials(user.name, user.phone)}
          </div>
          <div className="profile-info">
            <div className="profile-name">{user.name || user.businessName || 'Vendor'}</div>
            <div className="profile-phone">
              +91 {String(user.phone || '').replace(/\D/g,'').slice(-10).replace(/(\d{5})(\d{5})/,'$1 $2')}
            </div>
            {user.email && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                ✉️ {user.email}
              </div>
            )}
            <div className="profile-role-badge" style={{ background:'rgba(124,58,237,0.15)', borderColor:'rgba(124,58,237,0.3)', color:'#A78BFA' }}>
              Vendor Account
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="vd-stats" style={{ marginBottom:'20px' }}>
          <div className="vd-stat">
            <span className="vd-stat-icon">📋</span>
            <span className="vd-stat-value">{myBids.length}</span>
            <span className="vd-stat-label">Total Bids</span>
          </div>
          <div className="vd-stat-divider" />
          <div className="vd-stat">
            <span className="vd-stat-icon">✅</span>
            <span className="vd-stat-value">{wonBids.length}</span>
            <span className="vd-stat-label">Won</span>
          </div>
          <div className="vd-stat-divider" />
          <div className="vd-stat">
            <span className="vd-stat-icon">⏳</span>
            <span className="vd-stat-value">{pendingBids.length}</span>
            <span className="vd-stat-label">Pending</span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="vd-tabs">
          <button className={`vd-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}>
            📋 Bid History
          </button>
          <button className={`vd-tab ${activeTab === 'menu' ? 'active' : ''}`}
            onClick={() => setActiveTab('menu')}>
            🍽️ My Menu
          </button>
          <button className={`vd-tab ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}>
            ✏️ Account
          </button>
        </div>

        {/* ══════════ BID HISTORY ══════════ */}
        {activeTab === 'history' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {myBids.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No bids yet</h3>
                <p>Your submitted bids and outcomes will appear here.</p>
                <button className="btn btn-primary mt-md" onClick={() => navigate('/vendor')}>View Requests</button>
              </div>
            ) : (
              [...myBids].reverse().map((bid, i) => {
                const s = BID_STATUS[bid.status] || { cls:'badge-pending', label: bid.status };
                return (
                  <div key={bid.id} className="history-card"
                    onClick={() => navigate(`/vendor/request/${bid.requestId}`)}
                    style={{ animationDelay:`${i * 0.04}s` }}>
                    <div className="history-card-left">
                      <div className={`history-status-dot ${bid.status}`}>
                        {bid.status === 'accepted' ? '✅' : bid.status === 'pending' ? '⏳' : '✕'}
                      </div>
                    </div>
                    <div className="history-card-body">
                      <div className="history-card-title">
                        Order #{bid.requestId?.split('_')[1]?.slice(-4) || i + 1}
                      </div>
                      <div className="history-card-meta">
                        <span style={{ color:'var(--primary-light)', fontWeight:700 }}>₹{bid.pricePerPlate}/plate</span>
                        <span>·</span>
                        <span>Total ₹{bid.totalPrice?.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="history-card-right">
                      <span className={`badge ${s.cls}`} style={{ fontSize:'0.65rem' }}>{s.label}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ══════════ MY MENU ══════════ */}
        {activeTab === 'menu' && (
          <div>
            {/* Header bar */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', margin:0 }}>
                <strong style={{ color:'var(--primary-light)' }}>{enabledCount}</strong> of {totalCount} items offered
              </p>
              <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', margin:0 }}>
                Toggle on/off · edit ₹ price
              </p>
            </div>

            {Object.entries(CATEGORY_META).map(([cat, meta]) => {
              // Skip categories not applicable to this vendor's food type
              if (!menu[cat]) return null;
              const rows    = menu[cat] || [];
              const enabled = rows.filter(r => r.enabled).length;
              const isOpen  = openCats.has(cat);
              const toggle  = () => setOpenCats(prev => {
                const next = new Set(prev);
                next.has(cat) ? next.delete(cat) : next.add(cat);
                return next;
              });

              return (
                <div key={cat} className="vm-category" style={{ marginBottom: '10px' }}>
                  {/* Category header — tap to open/close */}
                  <button className="vm-cat-header" onClick={toggle}>
                    <span className="vm-cat-icon">{meta.icon}</span>
                    <span className="vm-cat-label">{meta.label}</span>
                    <span className="vm-cat-count">{enabled}/{rows.length}</span>
                    <span className="vm-cat-arrow">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {/* Items — shown when open */}
                  {isOpen && (
                    <div className="vm-item-list">
                      <div className="vm-col-header">
                        <span style={{ flex:1 }}></span>
                        <span>Item</span>
                        <span style={{ marginLeft:'auto', color:'var(--text-muted)', fontSize:'0.7rem' }}>₹/plate</span>
                      </div>

                      {rows.map((row, idx) => (
                        <div
                          key={row.name}
                          className={`vm-item-row ${row.enabled ? 'enabled' : 'disabled'}`}
                          style={{ animationDelay:`${idx * 0.02}s` }}
                        >
                          {/* Toggle */}
                          <button
                            className={`vm-toggle ${row.enabled ? 'on' : 'off'}`}
                            onClick={() => toggleItem(cat, row.name)}
                            title={row.enabled ? 'Click to hide from menu' : 'Click to show on menu'}
                          >
                            <span className="vm-toggle-knob" />
                          </button>

                          {/* Item name */}
                          <span className="vm-item-name">{row.name}</span>

                          {/* Price input */}
                          <div className="vm-price-field">
                            <span className="vm-price-rs">₹</span>
                            <input
                              type="number"
                              className="vm-price-input"
                              value={row.price}
                              min={1}
                              max={9999}
                              disabled={!row.enabled}
                              onChange={e => updatePrice(cat, row.name, e.target.value)}
                              placeholder="—"
                            />
                            <span className="vm-price-unit">/pl</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Save / Reset */}
            <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={handleSave}>
                {saved ? '✅ Saved!' : '💾 Save Menu'}
              </button>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={handleReset}>
                ↺ Reset
              </button>
            </div>
            <p style={{ fontSize:'0.7rem', color:'var(--text-muted)', textAlign:'center', marginTop:'10px' }}>
              Customers see your enabled items with these prices on your profile page.
            </p>
          </div>
        )}

        {/* ══════════ ACCOUNT EDIT ══════════ */}
        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Your Name</label>
              <input className="form-input" type="text" placeholder="e.g. Ravi Kumar" value={name} maxLength={60} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Business / Brand Name</label>
              <input className="form-input" type="text" placeholder="e.g. Ravi's Royal Kitchen" value={businessName} maxLength={80} onChange={e => setBusinessName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Email Address <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
              <input className="form-input" type="email" placeholder="e.g. ravi@gmail.com" value={email} maxLength={100} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Mobile Number</label>
              <input className="form-input" type="text"
                value={'+91 ' + String(user.phone || '').replace(/\D/g,'').slice(-10).replace(/(\d{5})(\d{5})/,'$1 $2')}
                disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>📱 Phone number is used for login and cannot be changed.</p>
            </div>
            {saveFeedback && (
              <p style={{ fontSize: '0.82rem', color: saveFeedback.startsWith('⚠️') ? 'var(--warning)' : 'var(--success)', margin: 0 }}>
                {saveFeedback}
              </p>
            )}
            <button className="btn btn-primary btn-block" onClick={handleSaveProfile}>💾 Save Profile</button>
          </div>
        )}

        {/* ── Logout ── */}
        <div style={{ marginTop:'32px', paddingBottom:'8px' }}>
          <button className="btn btn-secondary btn-block" onClick={logout}
            style={{ borderColor:'rgba(239,68,68,0.3)', color:'var(--danger)' }}>
            🚪 Logout
          </button>
        </div>
      </div>

      <div className="bottom-nav">
        <NavLink to="/vendor" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <span className="nav-icon">🏠</span>
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/vendor/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">👤</span>
          <span>Profile</span>
        </NavLink>
      </div>
    </div>
  );
}
