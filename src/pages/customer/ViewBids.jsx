import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  acceptBid, cancelAcceptedBid, hideBid, unhideBid,
  expandRadius, cancelRequest, restoreRequest,
  getVendorsInRadius, getBidsForRequest, ADDON_SUGGESTIONS,
} from '../../utils/data';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function ViewBids() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refresh, requests, bids: allBids, vendors: allVendors } = useApp();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmedVendor, setConfirmedVendor] = useState(null);
  const [nearbyCount, setNearbyCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [addedons, setAddons] = useState([]);
  const [restoring, setRestoring] = useState(false);
  const [localBids, setLocalBids] = useState([]);
  const [bidsLoading, setBidsLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'customer') navigate('/');
  }, [user, navigate]);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const request = requests.find(r => r.id === id);

  // Fetch bids directly for THIS request — don't rely on stale global context
  useEffect(() => {
    let cancelled = false;
    async function loadBids() {
      const bids = await getBidsForRequest(id);
      if (!cancelled) {
        setLocalBids(bids || []);
        setBidsLoading(false);
      }
    }
    loadBids();
    return () => { cancelled = true; };
  }, [id]);

  // Re-fetch bids on every context refresh (every 3s)
  useEffect(() => {
    if (bidsLoading) return; // skip during initial load
    getBidsForRequest(id).then(bids => setLocalBids(bids || []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, allBids]);

  useEffect(() => {
    if (request) {
      getVendorsInRadius(request.lat, request.lng, request.currentRadius, request.foodType).then(v => setNearbyCount(v.length));
    }
  }, [request?.currentRadius, request?.lat, request?.lng, request?.foodType]);

  const allRequestBids = localBids;
  const visibleBids   = allRequestBids.filter(b => b.status !== 'skipped');
  const activeBids    = visibleBids.filter(b => b.status === 'pending');
  const hiddenBids    = visibleBids.filter(b => b.status === 'hidden');

  const findVendor = (vendorId) => allVendors.find(v => v.id === vendorId);
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

  const acceptedBid = request?.confirmedBidId
    ? allRequestBids.find((b) => b.id === request.confirmedBidId) || allRequestBids.find((b) => b.status === 'accepted')
    : allRequestBids.find((b) => b.status === 'accepted');
  const acceptedVendor = acceptedBid ? findVendor(acceptedBid.vendorId) : null;
  const displayVendor = confirmedVendor || acceptedVendor;

  const suggestions = ADDON_SUGGESTIONS[request?.foodType] || ADDON_SUGGESTIONS.veg;

  const handleAccept = async (bidId) => {
    setProcessing(true);
    const bid = visibleBids.find(b => b.id === bidId);
    const vendor = findVendor(bid.vendorId);
    const accepted = await acceptBid(bidId, addedons);
    if (accepted) {
      setConfirmedVendor(findVendor(accepted.vendorId) || vendor || null);
      setShowConfirm(true);
      // Immediately reflect accepted/rejected statuses in local state
      setLocalBids(prev => prev.map(b => ({
        ...b,
        status: b.id === bidId ? 'accepted' : (b.status === 'pending' ? 'rejected' : b.status),
      })));
    }
    refresh();
    setProcessing(false);
  };

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCancelBidConfirm, setShowCancelBidConfirm] = useState(false);

  const handleCancelSelectedBid = async () => {
    if (!acceptedBid || processing) return;
    setProcessing(true);
    await cancelAcceptedBid(id);
    // Immediately revert localBids: accepted → pending, rejected → pending
    setLocalBids(prev => prev.map(b => ({
      ...b,
      status: b.status === 'accepted' ? 'pending' : (b.status === 'rejected' ? 'pending' : b.status),
    })));
    setShowCancelBidConfirm(false);
    refresh();
    setProcessing(false);
  };

  const handleHide = async (bidId) => {
    await hideBid(bidId);
    // Immediately update local state — don't wait for context refresh
    setLocalBids(prev => prev.map(b => b.id === bidId ? { ...b, status: 'hidden' } : b));
    refresh(); // also sync context in background
  };

  const handleUnhide = async (bidId) => {
    await unhideBid(bidId);
    setLocalBids(prev => prev.map(b => b.id === bidId ? { ...b, status: 'pending' } : b));
    refresh();
  };

  const handleExpandRadius = async () => {
    await expandRadius(id);
    await refresh();
  };

  const handleCancel = async () => {
    if (processing) return;
    setProcessing(true);
    await cancelRequest(id);
    await refresh();
    setProcessing(false);
    setShowCancelConfirm(false);
    navigate('/customer');
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    await restoreRequest(id);
    await refresh();
    setRestoring(false);
  };

  const toggleAddon = (item) => {
    setAddons(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const addonTotal = suggestions
    .filter(s => addedons.includes(s.item))
    .reduce((sum, s) => sum + s.price * (request?.plates || 0), 0);

  const foodLabel = { veg: '🟢 Veg', nonveg: '🔴 Non-Veg', both: '🟠 Veg + Non-Veg' };

  return (
    <div className="app-container">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/customer')}>←</button>
        <h1>Request Details</h1>
      </div>

      <div className="page">
        {request ? (
          <>
            {/* Request Summary Card */}
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="card-meta">
                <div className="card-meta-item">
                  <span className="icon">🆔</span>
                  <span>{request.id?.split('_')[1]}</span>
                </div>
                <div className="card-meta-item">
                  <span className="icon">🍽️</span>
                  <span>{request.plates} plates · {foodLabel[request.foodType]}</span>
                </div>
                {request.status !== 'cancelled' && (
                  <div className="card-meta-item">
                    <span className="icon">📡</span>
                    <span>Search radius: {request.currentRadius} km · {nearbyCount} vendors in range</span>
                  </div>
                )}
              </div>

              {/* Mini Map */}
              {request.status !== 'cancelled' && (
                <div className="map-container" style={{ height: '150px', marginTop: '12px' }}>
                  <MapContainer
                    center={[request.lat, request.lng]}
                    zoom={11}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    dragging={false}
                    scrollWheelZoom={false}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[request.lat, request.lng]} />
                    <Circle
                      center={[request.lat, request.lng]}
                      radius={request.currentRadius * 1000}
                      pathOptions={{ color: '#E8590C', fillColor: '#E8590C', fillOpacity: 0.08, weight: 2, dashArray: '8 4' }}
                    />
                  </MapContainer>
                </div>
              )}
            </div>

            {/* ===== CANCELLED: Recovery UI ===== */}
            {request.status === 'cancelled' && (
              <div className="card" style={{ borderColor: 'var(--warning)', background: 'rgba(217,119,6,0.07)', textAlign: 'center', padding: '28px 20px' }}>
                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🗂️</div>
                <h3 style={{ color: 'var(--warning)', marginBottom: '8px' }}>Request Cancelled</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
                  This request was cancelled. You can restore it to review existing bids or wait for new ones.
                </p>
                {allRequestBids.length > 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '16px' }}>
                    {allRequestBids.length} bid{allRequestBids.length !== 1 ? 's' : ''} will be restored and available for review.
                  </p>
                )}
                <button
                  className="btn btn-primary btn-block"
                  onClick={handleRestore}
                  disabled={restoring}
                >
                  {restoring ? '⏳ Restoring...' : '🔄 Restore Request'}
                </button>
              </div>
            )}

            {/* ===== CONFIRMED ===== */}
            {request.status === 'confirmed' && acceptedBid && (
              <div className="card" style={{ borderColor: 'var(--success)', background: 'rgba(5, 150, 105, 0.08)' }}>
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
                  <h3 style={{ color: 'var(--success)', marginBottom: '4px' }}>Order Confirmed!</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {acceptedVendor?.name || 'Selected vendor'} will cater your event
                  </p>
                  {acceptedVendor?.phone && (
                    <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                      Vendor mobile:{' '}
                      <a href={`tel:${formatPhoneHref(acceptedVendor.phone)}`} style={{ color: 'var(--success)', fontWeight: 700, textDecoration: 'none' }}>
                        {formatPhone(acceptedVendor.phone)}
                      </a>
                    </p>
                  )}
                  <div style={{ marginTop: '12px' }}>
                    <span className="price-tag">₹{acceptedBid.totalPrice?.toLocaleString('en-IN')}</span>
                    <span className="price-per-plate"> · ₹{acceptedBid.pricePerPlate}/plate</span>
                  </div>

                  {request.customerAddons && request.customerAddons.length > 0 && (() => {
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
                    const addonTotalPrice = addonsWithPrice.reduce((sum, a) => sum + a.price * (request.plates || 0), 0);
                    return (
                      <div style={{
                        marginTop: '16px', padding: '14px', background: 'rgba(232,89,12,0.08)',
                        border: '1px solid rgba(232,89,12,0.28)', borderRadius: 'var(--radius-md)', textAlign: 'left'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                          <span style={{ fontSize: '1rem' }}>✨</span>
                          <span style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--primary-light)' }}>
                            Your Requested Extras
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
                        {addonTotalPrice > 0 && (
                          <div style={{
                            marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(232,89,12,0.2)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Estimated extras total</span>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary-light)' }}>
                              ₹{addonTotalPrice.toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '10px', marginBottom: 0 }}>
                          💬 Discuss and confirm pricing for these extras when you contact the vendor.
                        </p>
                      </div>
                    );
                  })()}

                  {!showCancelBidConfirm ? (
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ marginTop: '14px', opacity: 0.75 }}
                      onClick={() => setShowCancelBidConfirm(true)}
                      disabled={processing}
                    >
                      ✕ Cancel Order
                    </button>
                  ) : (
                    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <p style={{ fontSize: '0.83rem', color: 'var(--warning)', margin: 0, fontWeight: 600 }}>
                        ⚠️ What would you like to do?
                      </p>
                      {/* Option 1: Switch vendor — unconfirms, reopens other bids */}
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ width: '100%' }}
                        onClick={handleCancelSelectedBid}
                        disabled={processing}
                      >
                        {processing ? '⏳ Working…' : '🔄 Choose a Different Vendor'}
                      </button>
                      {/* Option 2: Cancel entire request — can be restored later */}
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ width: '100%' }}
                        onClick={async () => {
                          if (processing) return;
                          setProcessing(true);
                          await cancelRequest(id);
                          setLocalBids(prev => prev.map(b => ({ ...b, status: 'skipped' })));
                          setShowCancelBidConfirm(false);
                          refresh();
                          setProcessing(false);
                          navigate('/customer');
                        }}
                        disabled={processing}
                      >
                        {processing ? '⏳ Cancelling…' : '🗑️ Cancel Entire Request'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ width: '100%', opacity: 0.6 }}
                        onClick={() => setShowCancelBidConfirm(false)}
                        disabled={processing}
                      >
                        Keep Order
                      </button>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                        💡 Cancelled requests can be restored from your dashboard.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== SEARCHING ===== */}
            {request.status === 'searching' && (
              <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }} className="animate-pulse">🔍</div>
                <h3 style={{ marginBottom: '8px' }}>Searching for Vendors...</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  Looking within {request.currentRadius} km of your event
                </p>
                <button className="btn btn-secondary btn-sm" onClick={handleExpandRadius}>
                  📡 Expand to {request.currentRadius + 10} km
                </button>
              </div>
            )}

            {/* ===== AI ADD-ON SUGGESTIONS ===== */}
            {(request.status === 'bidding' || request.status === 'searching') && (
              <div className="addon-panel">
                <div className="addon-panel-header">
                  <span>✨ AI Add-on Suggestions</span>
                  <span className="addon-badge">Smart</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Enhance your order — tap to add extras per plate:
                </p>
                <div className="addon-grid">
                  {suggestions.map((s) => {
                    const selected = addedons.includes(s.item);
                    return (
                      <button
                        key={s.item}
                        className={`addon-chip ${selected ? 'selected' : ''}`}
                        onClick={() => toggleAddon(s.item)}
                      >
                        {selected ? '✓ ' : '+ '}{s.item}
                        <span className="addon-chip-price">+₹{s.price}/plate</span>
                      </button>
                    );
                  })}
                </div>
                {addedons.length > 0 && (
                  <div className="addon-total">
                    🛒 Add-ons total: <strong>₹{addonTotal.toLocaleString('en-IN')}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      (for {request.plates} plates)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ===== BIDS SECTION ===== */}
            {(request.status === 'bidding' || activeBids.length > 0) && request.status !== 'confirmed' && request.status !== 'cancelled' && (
              <>
                <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Bids Received ({bidsLoading ? '…' : activeBids.length})</span>
                  {hiddenBids.length > 0 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                      onClick={() => setShowHidden(p => !p)}
                    >
                      {showHidden ? '🙈 Hide them' : `👁 Show ${hiddenBids.length} hidden`}
                    </button>
                  )}
                </div>

                {bidsLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                    <div className="loading-spinner" />
                  </div>
                ) : activeBids.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '24px', opacity: 0.7 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Waiting for vendors to respond…
                    </p>
                  </div>
                ) : (
                  activeBids.map((bid, i) => {
                    const vendor = findVendor(bid.vendorId);
                    return (
                      <div key={bid.id} className="bid-card" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="vendor-info">
                          <div className="vendor-avatar">{vendor?.name?.charAt(0) || '?'}</div>
                          <div>
                            <div className="vendor-name">{vendor?.name || 'Vendor'}</div>
                            <div className="vendor-distance">
                              <span className="distance-badge">📍 {bid.distance?.toFixed(1) || '?'} km away</span>
                              {vendor?.rating && <span style={{ marginLeft: '8px', color: 'var(--warning)', fontSize: '0.8rem' }}>⭐ {vendor.rating}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="bid-details">
                          <div className="bid-detail-item">
                            <label>Per Plate</label>
                            <p style={{ color: 'var(--primary-light)' }}>₹{bid.pricePerPlate}</p>
                          </div>
                          <div className="bid-detail-item">
                            <label>Total</label>
                            <p>₹{bid.totalPrice?.toLocaleString('en-IN')}</p>
                          </div>
                          <div className="bid-detail-item" style={{ gridColumn: 'span 2' }}>
                            <label>Menu</label>
                            <p style={{ fontSize: '0.85rem' }}>{bid.menuDetails || 'Standard menu'}</p>
                          </div>
                        </div>

                        {bid.notes && (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px', fontStyle: 'italic' }}>
                            "{bid.notes}"
                          </p>
                        )}

                        <div className="card-actions">
                          <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => handleAccept(bid.id)} disabled={processing}>
                            ✓ Accept Bid
                          </button>
                          <button
                            className="btn btn-secondary btn-sm hide-btn"
                            style={{ flex: 1 }}
                            onClick={() => handleHide(bid.id)}
                            title="Hide this bid — you can un-hide it later"
                          >
                            👁 Hide
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Hidden Bids (shown when toggle is on) */}
                {showHidden && hiddenBids.length > 0 && (
                  <>
                    <div className="section-title" style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                      Hidden Bids
                    </div>
                    {hiddenBids.map((bid) => {
                      const vendor = findVendor(bid.vendorId);
                      return (
                        <div key={bid.id} className="bid-card hidden-bid">
                          <div className="vendor-info">
                            <div className="vendor-avatar" style={{ opacity: 0.6 }}>{vendor?.name?.charAt(0) || '?'}</div>
                            <div>
                              <div className="vendor-name" style={{ opacity: 0.7 }}>{vendor?.name || 'Vendor'}</div>
                              <div className="vendor-distance">
                                <span className="distance-badge">📍 {bid.distance?.toFixed(1) || '?'} km away</span>
                              </div>
                            </div>
                          </div>
                          <div className="bid-details">
                            <div className="bid-detail-item">
                              <label>Per Plate</label>
                              <p style={{ color: 'var(--text-muted)' }}>₹{bid.pricePerPlate}</p>
                            </div>
                            <div className="bid-detail-item">
                              <label>Total</label>
                              <p style={{ color: 'var(--text-muted)' }}>₹{bid.totalPrice?.toLocaleString('en-IN')}</p>
                            </div>
                          </div>
                          <div className="card-actions">
                            <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => handleAccept(bid.id)} disabled={processing}>
                              ✓ Accept
                            </button>
                            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleUnhide(bid.id)}>
                              👁 Un-hide
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {activeBids.length === 0 && allRequestBids.length > 0 && !showHidden && (
                  <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
                    <p style={{ color: 'var(--text-muted)' }}>
                      {hiddenBids.length > 0
                        ? `All active bids are hidden. Tap "Show ${hiddenBids.length} hidden" above to review them.`
                        : 'All bids have been reviewed.'}
                    </p>
                    <button className="btn btn-secondary btn-sm mt-md" onClick={handleExpandRadius}>
                      📡 Expand search to {request.currentRadius + 10} km
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Cancel button */}
            {request.status !== 'confirmed' && request.status !== 'cancelled' && (
              <button
                className="btn btn-danger btn-block btn-sm mt-lg"
                style={{ opacity: 0.7 }}
                onClick={() => setShowCancelConfirm(true)}
              >
                Cancel Request
              </button>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
            <div className="loading-spinner" style={{ marginBottom: '16px' }}></div>
          </div>
        )}
      </div>

      {/* Cancel-Request Confirm Overlay */}
      {showCancelConfirm && (
        <div className="overlay">
          <div className="overlay-content">
            <div className="overlay-icon">⚠️</div>
            <h2>Cancel Request?</h2>
            <p>This request will be paused. You can restore it anytime from your dashboard and review bids again.</p>
            <button
              className="btn btn-danger btn-block"
              onClick={handleCancel}
              disabled={processing}
              style={{ marginBottom: '10px' }}
            >
              {processing ? '⏳ Cancelling...' : 'Yes, Cancel Request'}
            </button>
            <button
              className="btn btn-secondary btn-block"
              onClick={() => setShowCancelConfirm(false)}
              disabled={processing}
            >
              No, Keep It
            </button>
          </div>
        </div>
      )}

      {/* Order Confirmed Overlay */}
      {showConfirm && (
        <div className="overlay">
          <div className="overlay-content">
            <div className="overlay-icon">🎉</div>
            <h2>Order Confirmed!</h2>
            <p><strong>{displayVendor?.name || 'Vendor'}</strong> will cater your event.</p>
            {displayVendor?.phone && (
              <p>
                Vendor mobile:{' '}
                <a href={`tel:${formatPhoneHref(displayVendor.phone)}`} style={{ color: 'var(--success)', fontWeight: 700, textDecoration: 'none' }}>
                  {formatPhone(displayVendor.phone)}
                </a>
              </p>
            )}
            <p>Your mobile: <strong>{formatPhone(user.phone)}</strong></p>
            {addedons.length > 0 && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                📝 Mention your add-ons ({addedons.join(', ')}) when you call the vendor.
              </p>
            )}
            <button className="btn btn-primary btn-block" onClick={() => { setShowConfirm(false); navigate('/customer'); }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
