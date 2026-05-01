import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { createRequest, getVendorsInRadius } from '../../utils/data';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
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
  return position ? (
    <>
      <Marker position={position} />
      <Circle
        center={position}
        radius={10000}
        pathOptions={{
          color: '#E8590C',
          fillColor: '#E8590C',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: '8 4',
        }}
      />
    </>
  ) : null;
}

export default function NewRequest() {
  const { user, refresh } = useApp();
  const navigate = useNavigate();
  const [plates, setPlates] = useState('');
  const [foodType, setFoodType] = useState('veg');
  const [position, setPosition] = useState(null);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [vendorCount, setVendorCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'customer') navigate('/');
  }, [user, navigate]);

  // Get user location on load
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
        () => setPosition([12.9716, 77.5946]) // Default to Bangalore
      );
    } else {
      setPosition([12.9716, 77.5946]);
    }
  }, []);

  // Update vendor count when position changes
  useEffect(() => {
    if (position) {
      getVendorsInRadius(position[0], position[1], 10, foodType).then(vendors => {
        setVendorCount(vendors.length);
      });
    }
  }, [position, foodType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // Prevent double-submit

    if (!plates || parseInt(plates) < 10) return setError('Minimum 10 plates required');
    if (!position) return setError('Please select a location on the map');

    setSubmitting(true);
    
    // Set defaults for removed fields
    const defaultName = `Catering Request #${Math.floor(1000 + Math.random() * 9000)}`;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    const defaultDate = tomorrow.toISOString().slice(0, 16); // format for datetime-local compatibility

    const req = await createRequest({
      eventName: defaultName,
      eventDate: defaultDate,
      plates: parseInt(plates),
      foodType,
      menuNotes: '',
      lat: position[0],
      lng: position[1],
      customerPhone: user.phone,
    });

    if (!req) {
      setError('Unable to create request. Please check your input and try again.');
      setSubmitting(false);
      return;
    }

    await refresh();
    setSubmitting(false);
    navigate(`/customer/request/${req.id}`);
  };

  if (!user) return null;

  return (
    <div className="app-container">
      {/* Header */}
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/customer')}>←</button>
        <h1>New Request</h1>
      </div>

      <div className="page">
        <form onSubmit={handleSubmit}>

          {/* Number of Plates */}
          <div className="form-group">
            <label className="form-label">Number of Plates</label>
            <input
              type="number"
              className="form-input"
              placeholder="Minimum 10 plates"
              min="10"
              value={plates}
              onChange={(e) => setPlates(e.target.value)}
            />
          </div>

          {/* Food Type */}
          <div className="form-group">
            <label className="form-label">Food Type</label>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-option ${foodType === 'veg' ? 'active' : ''}`}
                onClick={() => setFoodType('veg')}
              >
                🟢 Veg
              </button>
              <button
                type="button"
                className={`toggle-option ${foodType === 'nonveg' ? 'active' : ''}`}
                onClick={() => setFoodType('nonveg')}
              >
                🔴 Non-Veg
              </button>
              <button
                type="button"
                className={`toggle-option ${foodType === 'both' ? 'active' : ''}`}
                onClick={() => setFoodType('both')}
              >
                🟠 Both
              </button>
            </div>
          </div>


          {/* Map Location */}
          <div className="form-group">
            <label className="form-label">Event Location</label>
            <p className="map-hint">📍 Tap on the map to set your event location</p>
            <div className="map-container">
              {position && (
                <MapContainer
                  center={position}
                  zoom={12}
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
            {position && (
              <p className="map-hint" style={{ color: 'var(--success)', marginTop: '8px' }}>
                ✓ Location set · {vendorCount} vendor{vendorCount !== 1 ? 's' : ''} within 10 km
              </p>
            )}
          </div>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>
          )}

          {/* Submit */}
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting}>
            {submitting ? '⏳ Sending...' : '🚀 Send to Nearby Vendors'}
          </button>
        </form>
      </div>
    </div>
  );
}
