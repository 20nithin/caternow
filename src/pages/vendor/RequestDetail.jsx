import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getRequest, createBid, vendorAcceptRequest, getDistance, MENU_CATALOGUE, ADDON_SUGGESTIONS } from '../../utils/data';
import { sanitizeText } from '../../utils/security';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ===== Menu Checklist Component =====
function MenuPicker({ selected, onChange }) {
  const categories = Object.entries(MENU_CATALOGUE);

  const toggle = (item) => {
    onChange(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  return (
    <div className="menu-picker">
      {categories.map(([cat, items]) => (
        <div key={cat} className="menu-category">
          <div className="menu-category-title">
            {cat === 'starters' ? '🥗 Starters' : cat === 'mains' ? '🍛 Mains' : cat === 'desserts' ? '🍮 Desserts' : '🥤 Beverages'}
          </div>
          <div className="menu-items-grid">
            {items.map(item => (
              <label key={item} className={`menu-item-chip ${selected.includes(item) ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.includes(item)}
                  onChange={() => toggle(item)}
                  style={{ display: 'none' }}
                />
                <span>{selected.includes(item) ? '✓ ' : ''}{item}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {selected.length > 0 && (
        <div className="menu-summary">
          <span>📋 {selected.length} item{selected.length !== 1 ? 's' : ''} selected</span>
        </div>
      )}
    </div>
  );
}

export default function VendorRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refresh, bids: allBids, requests } = useApp();

  const [pricePerPlate, setPricePerPlate] = useState('');
  const [selectedMenuItems, setSelectedMenuItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState(null);
  const [loadingRequest, setLoadingRequest] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'vendor') navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    const fromContext = requests.find((r) => r.id === id);
    if (fromContext) {
      setRequest(fromContext);
      setLoadingRequest(false);
    }
  }, [requests, id]);

  useEffect(() => {
    if (!id) {
      setRequest(null);
      setLoadingRequest(false);
      return;
    }

    const fromContext = requests.find((r) => r.id === id);
    if (!fromContext) setLoadingRequest(true);

    let isMounted = true;
    async function loadRequest() {
      const fresh = await getRequest(id);
      if (!isMounted) return;
      setRequest(fresh || fromContext || null);
      setLoadingRequest(false);
    }
    loadRequest();
    return () => { isMounted = false; };
  }, [id, requests]);

  useEffect(() => {
    if (!id) return undefined;
    const interval = setInterval(() => { refresh(); }, 2500);
    return () => clearInterval(interval);
  }, [id, refresh]);

  if (!user) return null;

  if (loadingRequest && !request) {
    return (
      <div className="app-container">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate('/vendor')}>{'<'}</button>
          <h1>Request Details</h1>
        </div>
        <div className="page">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
            <div className="loading-spinner" style={{ marginBottom: '16px' }}></div>
            <p style={{ color: 'var(--text-muted)' }}>Loading request...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="app-container">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate('/vendor')}>{'<'}</button>
          <h1>Request Not Found</h1>
        </div>
        <div className="page">
          <div className="empty-state">
            <div className="empty-icon">!</div>
            <h3>Request not found</h3>
            <p>This request may have been cancelled.</p>
          </div>
        </div>
      </div>
    );
  }

  const vendorId = user.id;
  const existingBid = allBids.find((b) => b.vendorId === vendorId && b.requestId === id);
  const distance = getDistance(user.lat || 12.9716, user.lng || 77.5946, request.lat, request.lng);
  const foodLabel = { veg: 'Veg', nonveg: 'Non-Veg', both: 'Veg + Non-Veg' };
  const canBid = request.status === 'searching' || request.status === 'bidding';
  const isBidAccepted = existingBid?.status === 'accepted';

  const effectivePrice = parseInt(pricePerPlate, 10) || 0;

  const formatPhone = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) return `+91 ${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2)}`;
    return phone || 'Not available';
  };
  const formatPhoneHref = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return digits || phone || '';
  };

  const handleSubmitBid = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!canBid) { setError('This request is no longer accepting bids.'); return; }
    if (!effectivePrice || effectivePrice < 50) { setError('Minimum price is ₹50 per plate'); return; }
    if (selectedMenuItems.length === 0) { setError('Please select at least one menu item'); return; }

    const menuDetails = selectedMenuItems.join(', ');

    setSubmitting(true);
    setError('');

    await vendorAcceptRequest(id, vendorId);

    const bid = await createBid({
      requestId: id,
      vendorId,
      vendorName: user.name || 'Vendor',
      pricePerPlate: effectivePrice,
      totalPrice: effectivePrice * request.plates,
      menuDetails,
      notes: sanitizeText(notes, 500),
      distance,
    });

    if (!bid) {
      setError('Unable to submit bid right now. Please try again.');
      setSubmitting(false);
      return;
    }

    await refresh();
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="app-container">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/vendor')}>{'<'}</button>
        <h1>Request Details</h1>
      </div>

      <div className="page">
        {/* Request Info Card */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header">
            <span className="card-title">Catering Request</span>
            <span className="distance-badge">{distance.toFixed(1)} km</span>
          </div>

          <div className="card-meta">
            <div className="card-meta-item">
              <span className="icon">#</span>
              <span>Req ID: {request.id?.split('_')[1]}</span>
            </div>
            <div className="card-meta-item">
              <span className="icon">🍽️</span>
              <span>{request.plates} plates · {foodLabel[request.foodType]}</span>
            </div>
          </div>

          <div className="map-container" style={{ height: '180px', marginTop: '16px' }}>
            <MapContainer center={[request.lat, request.lng]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[request.lat, request.lng]} />
              <Circle
                center={[request.lat, request.lng]}
                radius={request.currentRadius * 1000}
                pathOptions={{ color: '#E8590C', fillColor: '#E8590C', fillOpacity: 0.08, weight: 2, dashArray: '8 4' }}
              />
            </MapContainer>
          </div>
        </div>

        {/* Bid submitted state */}
        {(existingBid || submitted) && (
          <div className="card" style={{ borderColor: 'var(--success)', background: 'rgba(5, 150, 105, 0.08)' }}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
              <h3 style={{ color: 'var(--success)', marginBottom: '4px' }}>Bid Submitted</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {isBidAccepted
                  ? 'Customer accepted your bid. Please contact them to coordinate the order.'
                  : 'Your bid is under review. You will see the result when the customer responds.'}
              </p>
              {existingBid && (
                <div style={{ marginTop: '12px' }}>
                  <span className="price-tag">Rs {existingBid.totalPrice?.toLocaleString('en-IN')}</span>
                  <span className="price-per-plate"> | Rs {existingBid.pricePerPlate}/plate</span>
                </div>
              )}
              <div style={{ marginTop: '12px' }}>
                {existingBid && (
                  <span className={`badge ${existingBid.status === 'accepted' ? 'badge-confirmed' : existingBid.status === 'rejected' || existingBid.status === 'skipped' ? 'badge-cancelled' : 'badge-bidding'}`}>
                    {existingBid.status === 'accepted' ? 'Accepted' : existingBid.status === 'rejected' || existingBid.status === 'skipped' ? 'Not Selected' : 'Pending'}
                  </span>
                )}
              </div>
              {isBidAccepted && request.customerPhone && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '4px' }}>Customer mobile</div>
                  <a href={`tel:${formatPhoneHref(request.customerPhone)}`} style={{ color: 'var(--success)', fontWeight: 700, textDecoration: 'none' }}>
                    {formatPhone(request.customerPhone)}
                  </a>
                </div>
              )}

              {/* ── Customer Add-on Requests ── */}
              {isBidAccepted && request.customerAddons && request.customerAddons.length > 0 && (() => {
                // Look up price for each add-on from ADDON_SUGGESTIONS
                const allSuggestions = [
                  ...(ADDON_SUGGESTIONS.veg || []),
                  ...(ADDON_SUGGESTIONS.nonveg || []),
                  ...(ADDON_SUGGESTIONS.both || []),
                ];
                const uniqueSuggestions = allSuggestions.filter(
                  (s, idx, arr) => arr.findIndex(x => x.item === s.item) === idx
                );
                const addonsWithPrice = request.customerAddons.map(name => {
                  const match = uniqueSuggestions.find(s => s.item === name);
                  return { name, price: match?.price || 0 };
                });
                const addonTotal = addonsWithPrice.reduce((sum, a) => sum + a.price * (request.plates || 0), 0);
                return (
                  <div style={{
                    marginTop: '16px',
                    padding: '14px',
                    background: 'rgba(232,89,12,0.08)',
                    border: '1px solid rgba(232,89,12,0.28)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'left',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '1rem' }}>✨</span>
                      <span style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--primary-light)' }}>
                        Customer Requested Extras
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {addonsWithPrice.map(addon => (
                        <div key={addon.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>• {addon.name}</span>
                          {addon.price > 0 && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--primary-light)', fontWeight: 600 }}>
                              +₹{addon.price}/plate
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {addonTotal > 0 && (
                      <div style={{
                        marginTop: '10px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(232,89,12,0.2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Estimated extras total</span>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary-light)' }}>
                          ₹{addonTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '10px', marginBottom: 0 }}>
                      💬 Discuss and confirm pricing for these extras when you contact the customer.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Bid form */}
        {!existingBid && !submitted && canBid && (
          <>
            <div className="section-title">Submit Your Bid</div>
            <form onSubmit={handleSubmitBid}>

              {/* ===== PRICE PER PLATE ===== */}
              <div className="form-group">
                <label className="form-label">💰 Your Price per Plate</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)', fontWeight: 700, fontSize: '1rem', pointerEvents: 'none',
                  }}>₹</span>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 200"
                    min="50"
                    value={pricePerPlate}
                    onChange={(e) => setPricePerPlate(e.target.value)}
                    style={{ paddingLeft: '30px' }}
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Minimum ₹50/plate
                </p>
                {effectivePrice >= 50 && (
                  <div style={{
                    marginTop: '10px', padding: '10px 14px',
                    background: 'rgba(232,89,12,0.08)', border: '1px solid rgba(232,89,12,0.2)',
                    borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {request.plates} plates × ₹{effectivePrice}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--primary-light)', fontSize: '1rem' }}>
                      ₹{(effectivePrice * request.plates).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>

              {/* ===== MENU CHECKLIST ===== */}
              <div className="form-group">
                <label className="form-label">📋 Menu Offering — Select items</label>
                <MenuPicker selected={selectedMenuItems} onChange={setSelectedMenuItems} />
              </div>

              {/* Additional Notes */}
              <div className="form-group">
                <label className="form-label">Additional Notes (Optional)</label>
                <textarea
                  className="form-input"
                  placeholder="Any special offers, experience details, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {error && (
                <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>
              )}

              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting}>
                {submitting ? 'Submitting...' : '🚀 Submit Bid'}
              </button>

              <button type="button" className="btn btn-secondary btn-block mt-md" onClick={() => navigate('/vendor')}>
                Decline
              </button>
            </form>
          </>
        )}

        {!existingBid && !submitted && !canBid && (
          <div className="card" style={{ borderColor: 'var(--warning)' }}>
            <h3 style={{ marginBottom: '6px' }}>Request Closed</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              This request is currently in status: {request.status}
            </p>
            <button className="btn btn-secondary btn-block mt-md" onClick={() => navigate('/vendor')}>
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
