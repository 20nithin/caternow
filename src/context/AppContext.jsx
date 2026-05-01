import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { seedVendors, getUser, setUser as saveUser, logout as doLogout, getRequests, getBids, getVendors } from '../utils/data';
import { createSessionTimer } from '../utils/security';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [requests, setRequests] = useState([]);
  const [bids, setBids] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        await seedVendors();

        const u = getUser();
        if (u && (u.role === 'customer' || u.role === 'vendor')) {
          setUserState(u);
        } else if (u) {
          // Prevent redirect loops from malformed user objects in storage.
          doLogout();
          setUserState(null);
        }

        const [reqs, bds, vnds] = await Promise.all([
          getRequests(),
          getBids(),
          getVendors(),
        ]);
        setRequests(reqs || []);
        setBids(bds || []);
        setVendors(vnds || []);
      } catch (error) {
        console.error('App init failed:', error);
        // Keep app usable even if one data source fails.
        setRequests([]);
        setBids([]);
        setVendors([]);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const login = useCallback((userData) => {
    saveUser(userData);
    setUserState(userData);
  }, []);

  const logout = useCallback(() => {
    doLogout();
    setUserState(null);
  }, []);

  // Session timeout: auto-logout after 30 minutes of inactivity
  useEffect(() => {
    if (!user) return;
    const cleanup = createSessionTimer(() => {
      doLogout();
      setUserState(null);
    });
    return cleanup;
  }, [user]);

  const refresh = useCallback(async () => {
    const [reqs, bds, vnds] = await Promise.all([
      getRequests(),
      getBids(),
      getVendors(),
    ]);
    setRequests(reqs);
    setBids(bds);
    setVendors(vnds);
  }, []);

  const updateUser = useCallback((updates) => {
    const updated = { ...user, ...updates };
    saveUser(updated);
    setUserState(updated);
  }, [user]);

  const value = {
    user,
    login,
    logout,
    refresh,
    updateUser,
    requests,
    bids,
    vendors,
    loading,
  };

  if (loading) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }} className="animate-pulse">🍽️</div>
          <p style={{ color: 'var(--text-muted)' }}>Loading CaterNow...</p>
        </div>
      </div>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
