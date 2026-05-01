import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { upsertVendorProfile } from '../../utils/data';
import { sanitizeText } from '../../utils/security';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function LocationPicker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position ? <Marker position={position} /> : null;
}

export default function VendorRegister() {
  const [step, setStep] = useState('details'); // details | location
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [foodType, setFoodType] = useState('both'); // veg | nonveg | both
  const [position, setPosition] = useState(null);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useApp();
  
  const phone = location.state?.phone;

  useEffect(() => {
    if (!phone) {
      navigate('/vendor/login');
    }
  }, [phone, navigate]);

  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    if (!businessName.trim() || !ownerName.trim()) {
      setError('Business Name and Owner Name are required');
      return;
    }
    setError('');
    
    // Attempt auto-detect location
    setDetecting(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
          setDetecting(false);
          setStep('location');
        },
        () => {
          setPosition([12.9716, 77.5946]); // Bangalore fallback
          setDetecting(false);
          setStep('location');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setPosition([12.9716, 77.5946]);
      setDetecting(false);
      setStep('location');
    }
  };

  const handleFinalSubmit = async () => {
    if (!position) return;
    setLoading(true);
    setError('');

    const vendorData = {
      phone,
      id: `v_${phone}`,
      name: sanitizeText(ownerName, 60),
      businessName: sanitizeText(businessName, 80),
      email: sanitizeText(email, 100),
      foodType,
      lat: position[0],
      lng: position[1],
      radius: 50,
      role: 'vendor'
    };

    const persisted = await upsertVendorProfile(vendorData);
    
    if (persisted) {
      login(vendorData);
      navigate('/vendor');
    } else {
      setError('Failed to create vendor account. Please try again.');
      setLoading(false);
    }
  };

  if (!phone) return null;

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '24px' }}>
      <div className="text-center" style={{ marginBottom: '24px', marginTop: '20px' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '8px' }}>Partner with CaterNow 👨‍🍳</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Complete your business profile to get catering requests.
        </p>
      </div>

      {step === 'details' && (
        <form onSubmit={handleDetailsSubmit} className="animate-fade-in card" style={{ padding: '24px' }}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>Verified Phone</label>
            <input
              className="form-input"
              value={`+91 ${phone}`}
              disabled
              style={{ opacity: 0.7, background: 'var(--bg-card)' }}
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '4px' }}>✓ Secured and verified</p>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>Business / Brand Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Royal Caterers"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>Owner's Full Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Rahul Sharma"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>Business Email (Optional)</label>
            <input
              type="email"
              className="form-input"
              placeholder="For formal communications"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>Food Type Served *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`btn ${foodType === 'veg' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setFoodType('veg')}
              >
                Veg Only 🟢
              </button>
              <button
                type="button"
                className={`btn ${foodType === 'both' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setFoodType('both')}
              >
                Both 🟠
              </button>
            </div>
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'center' }}>{error}</p>}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={detecting}>
            {detecting ? 'Detecting Location...' : 'Next: Setup Location →'}
          </button>
        </form>
      )}

      {step === 'location' && (
        <div className="animate-fade-in card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Set Service Base 📍</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Drag the map or tap to place the pin precisely on your business location. We use this to route nearby requests to you.
          </p>

          <div className="map-container" style={{ height: '300px', marginBottom: '24px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1.5px solid var(--border)' }}>
            {position && (
              <MapContainer
                center={position}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationPicker position={position} setPosition={setPosition} />
              </MapContainer>
            )}
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'center' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setStep('details')}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleFinalSubmit} disabled={loading}>
              {loading ? 'Creating Account...' : 'Complete Setup ✅'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
