import { useEffect, useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getRequestsForVendor, upsertVendorProfile } from '../../utils/data';

export default function VendorDashboard() {
  const { user, refresh, bids: allBids } = useApp();
  const navigate = useNavigate();
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'vendor') navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;

    async function loadRequests() {
      await upsertVendorProfile(user);
      const reqs = await getRequestsForVendor(user.id);
      setIncomingRequests(reqs);
      setLoading(false);
    }

    loadRequests();
  }, [user, allBids]);

  useEffect(() => {
    const interval = setInterval(async () => {
      await refresh();
      if (user) {
        const reqs = await getRequestsForVendor(user.id);
        setIncomingRequests(reqs);
        setLastRefreshed(new Date());
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [refresh, user]);

  const handleManualRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refresh();
    if (user) {
      const reqs = await getRequestsForVendor(user.id);
      setIncomingRequests(reqs);
      setLastRefreshed(new Date());
    }
    setRefreshing(false);
  };

  if (!user) return null;

  const vendorId = user.id;
  const myBids = allBids.filter((b) => b.vendorId === vendorId);
  const pendingBids = myBids.filter((b) => b.status === 'pending');
  const wonBids = myBids.filter((b) => b.status === 'accepted');

  const biddedRequestIds = myBids.map((b) => b.requestId);
  const newRequests = incomingRequests.filter((r) => !biddedRequestIds.includes(r.id));

  const getStatusBadge = (status) => {
    const map = {
      pending: { cls: 'badge-bidding', label: 'Pending' },
      accepted: { cls: 'badge-confirmed', label: 'Won' },
      rejected: { cls: 'badge-cancelled', label: 'Rejected' },
      skipped: { cls: 'badge-cancelled', label: 'Skipped' },
    };

    const s = map[status] || { cls: 'badge-pending', label: status };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  return (
    <div className="app-container">
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <div className="logo" style={{ fontSize: '1.1rem' }}>
            <span className="logo-icon" style={{ fontSize: '1.4rem' }}>🍽️</span>
            <span className="logo-text">CaterNow Vendor</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'3px' }}>
            <span style={{
              width:'7px', height:'7px', borderRadius:'50%',
              background:'var(--success)', display:'inline-block',
              animation:'pulse 2s infinite'
            }} />
            <span style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>
              Auto-refreshes every 5 s
              {lastRefreshed && ` · last at ${lastRefreshed.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`}
            </span>
          </div>
        </div>
      </div>

      <div className="page">
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{newRequests.length}</div>
            <div className="stat-label">New</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{pendingBids.length}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{wonBids.length}</div>
            <div className="stat-label">Won</div>
          </div>
        </div>

        {newRequests.length > 0 && (
          <>
            <div className="section-title">Incoming Requests</div>
            {newRequests.map((req, i) => (
              <div
                key={req.id}
                className="card"
                style={{ cursor: 'pointer', animationDelay: `${i * 0.05}s` }}
                onClick={() => navigate(`/vendor/request/${req.id}`)}
              >
                <div className="card-header">
                  <span className="card-title">Catering Order #{req.id?.split('_')[1]?.slice(-4)}</span>
                  <span className="distance-badge">{req.distance?.toFixed(1)} km</span>
                </div>
                <div className="card-meta">
                  <div className="card-meta-item">
                    <span className="icon">#</span>
                    <span>{req.plates} plates</span>
                    <span className={`badge ${req.foodType === 'veg' ? 'badge-veg' : req.foodType === 'nonveg' ? 'badge-nonveg' : 'badge-both'}`} style={{ marginLeft: '8px' }}>
                      {req.foodType === 'veg' ? 'Veg' : req.foodType === 'nonveg' ? 'Non-Veg' : 'Both'}
                    </span>
                  </div>
                </div>
                <div className="card-actions">
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); navigate(`/vendor/request/${req.id}`); }}>
                    View and Bid
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {newRequests.length === 0 && myBids.length === 0 && !loading && (
          <div className="empty-state">
            <div className="empty-icon">...</div>
            <h3>No requests nearby</h3>
            <p>When customers near you create catering requests, they will appear here.</p>
          </div>
        )}

        {myBids.length > 0 && (
          <>
            <div className="section-title">My Bids</div>
            {myBids.map((bid) => (
              <div
                key={bid.id}
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/vendor/request/${bid.requestId}`)}
              >
                <div className="card-header">
                  <span className="card-title">Catering Order #{bid.requestId?.split('_')[1]?.slice(-4)}</span>
                  {getStatusBadge(bid.status)}
                </div>
                <div className="card-meta">
                  <div className="card-meta-item">
                    <span className="icon">₹</span>
                    <span>{bid.pricePerPlate}/plate | Total ₹{bid.totalPrice?.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="bottom-nav">
        <NavLink to="/vendor" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <span className="nav-icon">🏠</span>
          <span>Dashboard</span>
        </NavLink>
        <button className="nav-item" onClick={handleManualRefresh} disabled={refreshing}>
          <span className="nav-icon" style={{ display:'inline-block', transition:'transform 0.4s', transform: refreshing ? 'rotate(360deg)' : 'none' }}>🔄</span>
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
        <NavLink to="/vendor/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">👤</span>
          <span>Profile</span>
        </NavLink>
      </div>
    </div>
  );
}
