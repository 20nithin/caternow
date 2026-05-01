import { useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getCustomerRequests, getBidsForRequest, formatDateShort } from '../../utils/data';

export default function CustomerDashboard() {
  const { user, logout, refresh, requests: allRequests, bids: allBids } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'customer') navigate('/');
  }, [user, navigate]);

  // Auto-refresh every 5 seconds to pick up vendor bids
  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!user) return null;

  // Filter requests for this customer from context
  const requests = allRequests.filter(r => r.customerPhone === user.phone);
  const activeRequests = requests.filter(r => r.status !== 'completed' && r.status !== 'cancelled');
  const cancelledRequests = requests.filter(r => r.status === 'cancelled');
  const completedRequests = requests.filter(r => r.status === 'completed');

  const getStatusBadge = (status) => {
    const map = {
      searching: { cls: 'badge-searching', label: '🔍 Searching' },
      bidding:   { cls: 'badge-bidding',   label: '💰 Bids Received' },
      confirmed: { cls: 'badge-confirmed', label: '✅ Confirmed' },
      completed: { cls: 'badge-confirmed', label: '🎉 Completed' },
      cancelled: { cls: 'badge-cancelled', label: '✕ Cancelled' },
    };
    const s = map[status] || { cls: 'badge-pending', label: status };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  const foodBadge = (type) => {
    const map = {
      veg:    { cls: 'badge-veg',    label: '🟢 Veg' },
      nonveg: { cls: 'badge-nonveg', label: '🔴 Non-Veg' },
      both:   { cls: 'badge-both',   label: '🟠 Veg + Non-Veg' },
    };
    const s = map[type] || { cls: '', label: type };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  const getBidCount = (requestId) => allBids.filter(b => b.requestId === requestId).length;

  return (
    <div className="app-container">
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <div className="logo" style={{ fontSize: '1.1rem' }}>
            <span className="logo-icon" style={{ fontSize: '1.4rem' }}>🍽️</span>
            <span className="logo-text">CaterNow</span>
          </div>
        </div>
      </div>

      <div className="page">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{requests.length}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{activeRequests.length}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{requests.filter(r => r.status === 'bidding').length}</div>
            <div className="stat-label">Bids</div>
          </div>
        </div>

        {/* New Request Button */}
        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={() => navigate('/customer/new-request')}
          style={{ marginBottom: '24px' }}
        >
          ✨ Create New Request
        </button>

        {/* Active Requests */}
        {activeRequests.length > 0 && (
          <>
            <div className="section-title">Active Requests</div>
            {activeRequests.map((req, i) => {
              const bidCount = getBidCount(req.id);
              return (
                <div
                  key={req.id}
                  className="card"
                  onClick={() => navigate(`/customer/request/${req.id}`)}
                  style={{ cursor: 'pointer', animationDelay: `${i * 0.05}s` }}
                >
                  <div className="card-header">
                    <span className="card-title">Catering Order #{req.id?.split('_')[1]?.slice(-4)}</span>
                    {getStatusBadge(req.status)}
                  </div>
                  <div className="card-meta">
                    <div className="card-meta-item">
                      <span className="icon">🍽️</span>
                      <span>{req.plates} plates</span>
                      <span style={{ marginLeft: '8px' }}>{foodBadge(req.foodType)}</span>
                    </div>
                    <div className="card-meta-item">
                      <span className="icon">📍</span>
                      <span>Radius: {req.currentRadius} km</span>
                    </div>
                    {bidCount > 0 && (
                      <div className="card-meta-item" style={{ color: 'var(--primary-light)', fontWeight: 600 }}>
                        <span className="icon">💰</span>
                        <span>{bidCount} bid{bidCount !== 1 ? 's' : ''} received</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Empty State */}
        {requests.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🎉</div>
            <h3>No requests yet</h3>
            <p>Create your first catering request and get bids from nearby vendors!</p>
          </div>
        )}

        {/* ===== CANCELLED — Recoverable ===== */}
        {cancelledRequests.length > 0 && (
          <>
            <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Cancelled Requests</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: 500 }}>Tap to restore</span>
            </div>
            {cancelledRequests.map(req => (
              <div
                key={req.id}
                className="card recoverable-card"
                onClick={() => navigate(`/customer/request/${req.id}`)}
                style={{ cursor: 'pointer', borderColor: 'rgba(217,119,6,0.35)' }}
              >
                <div className="card-header">
                  <span className="card-title" style={{ opacity: 0.75 }}>
                    Catering Order #{req.id?.split('_')[1]?.slice(-4)}
                  </span>
                  {getStatusBadge(req.status)}
                </div>
                <div className="card-meta">
                  <div className="card-meta-item">
                    <span className="icon">🍽️</span>
                    <span>{req.plates} plates</span>
                    <span style={{ marginLeft: '8px' }}>{foodBadge(req.foodType)}</span>
                  </div>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <span className="restore-hint">🔄 Tap to restore &amp; review bids</span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Completed */}
        {completedRequests.length > 0 && (
          <>
            <div className="section-title">Past Requests</div>
            {completedRequests.map(req => (
              <div key={req.id} className="card" style={{ opacity: 0.6 }}>
                <div className="card-header">
                  <span className="card-title">{req.eventName}</span>
                  {getStatusBadge(req.status)}
                </div>
              </div>
            ))}
          </>
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
