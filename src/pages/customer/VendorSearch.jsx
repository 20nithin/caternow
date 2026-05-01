import { useState, useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getVendors, getDistance } from '../../utils/data';

export default function VendorSearch() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [query, setQuery] = useState('');
  const [foodFilter, setFoodFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rating');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'customer') navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    getVendors().then(list => {
      // Attach distance using user's last known location (or Bangalore default)
      const userLat = 12.9716, userLng = 77.5946;
      const withDist = list.map(v => ({
        ...v,
        distance: getDistance(userLat, userLng, v.lat, v.lng),
      }));
      setVendors(withDist);
      setLoading(false);
    });
  }, []);

  const foodTypeLabel = { veg: '🟢 Veg', nonveg: '🔴 Non-Veg', both: '🟠 Both' };

  const filtered = vendors
    .filter(v => {
      const matchQuery = v.name.toLowerCase().includes(query.toLowerCase());
      const matchFood = foodFilter === 'all' || v.foodType === foodFilter || v.foodType === 'both';
      return matchQuery && matchFood;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'distance') return (a.distance || 0) - (b.distance || 0);
      return a.name.localeCompare(b.name);
    });

  const getInitials = (name) => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const ratingStars = (rating) => {
    const r = Math.round(rating * 2) / 2;
    const full = Math.floor(r);
    const half = r % 1 !== 0;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <div className="logo" style={{ fontSize: '1.1rem' }}>
            <span className="logo-icon" style={{ fontSize: '1.4rem' }}>🍽️</span>
            <span className="logo-text">Explore Vendors</span>
          </div>
        </div>
      </div>

      <div className="page">
        {/* Search bar */}
        <div className="vendor-search-bar">
          <span className="search-icon">🔍</span>
          <input
            className="vendor-search-input"
            placeholder="Search vendors by name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery('')}>✕</button>
          )}
        </div>

        {/* Filters row */}
        <div className="filter-row">
          <div className="filter-chips">
            {['all', 'veg', 'nonveg', 'both'].map(f => (
              <button
                key={f}
                className={`filter-chip ${foodFilter === f ? 'active' : ''}`}
                onClick={() => setFoodFilter(f)}
              >
                {f === 'all' ? '🍽️ All' : foodTypeLabel[f]}
              </button>
            ))}
          </div>
          <select
            className="sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="rating">⭐ Top Rated</option>
            <option value="distance">📍 Nearest</option>
            <option value="name">🔤 A–Z</option>
          </select>
        </div>

        {/* Count */}
        {!loading && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            {filtered.length} vendor{filtered.length !== 1 ? 's' : ''} found
          </p>
        )}

        {/* Results */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '60px' }}>
            <div className="loading-spinner"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No vendors found</h3>
            <p>Try a different search term or filter.</p>
          </div>
        ) : (
          <div className="vendor-list">
            {filtered.map((vendor, i) => (
              <div
                key={vendor.id}
                className="vendor-card"
                style={{ animationDelay: `${i * 0.04}s`, cursor: 'pointer' }}
                onClick={() => navigate(`/customer/vendors/${vendor.id}`)}
              >
                <div className="vendor-card-left">
                  <div className="vendor-avatar-lg" style={{
                    background: vendor.foodType === 'veg'
                      ? 'linear-gradient(135deg,#059669,#047857)'
                      : vendor.foodType === 'nonveg'
                        ? 'linear-gradient(135deg,#DC2626,#B91C1C)'
                        : 'linear-gradient(135deg,#E8590C,#7C3AED)',
                  }}>
                    {getInitials(vendor.name)}
                  </div>
                </div>
                <div className="vendor-card-body">
                  <div className="vendor-card-name">{vendor.name}</div>
                  <div className="vendor-card-meta">
                    <span className={`badge ${vendor.foodType === 'veg' ? 'badge-veg' : vendor.foodType === 'nonveg' ? 'badge-nonveg' : 'badge-both'}`}>
                      {foodTypeLabel[vendor.foodType] || vendor.foodType}
                    </span>
                    <span className="vendor-card-dist">📍 {vendor.distance?.toFixed(1)} km</span>
                  </div>
                  {vendor.rating > 0 && (
                    <div className="vendor-card-rating">
                      <span style={{ color: 'var(--warning)', fontSize: '0.82rem', letterSpacing: '-1px' }}>
                        {ratingStars(vendor.rating)}
                      </span>
                      <span style={{ marginLeft: '5px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {vendor.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {vendor.fssai && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '4px' }}>
                      ✅ FSSAI: {vendor.fssai}
                    </div>
                  )}
                </div>
                <div className="vendor-card-right">
                  <div className="vendor-card-radius">Serves {vendor.radius} km</div>
                  <div style={{ color: 'var(--primary-light)', fontSize: '1rem', marginTop: '8px' }}>›</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="bottom-nav">
        <NavLink to="/customer" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <span className="nav-icon">🏠</span>
          <span>Home</span>
        </NavLink>
        <NavLink to="/customer/new-request" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">➕</span>
          <span>New</span>
        </NavLink>
        <NavLink to="/customer/vendors" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🔍</span>
          <span>Vendors</span>
        </NavLink>
        <NavLink to="/customer/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">👤</span>
          <span>Profile</span>
        </NavLink>
      </div>
    </div>
  );
}
