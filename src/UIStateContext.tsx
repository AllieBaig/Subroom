import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { CURRENT_VERSION } from './constants/history';

export type TabType = 'library' | 'search' | 'player' | 'settings';

interface UIStateContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  initError: string | null;
  setInitError: (error: string | null) => void;
  toast: string | null;
  showToast: (message: string) => void;
  isOffline: boolean;
  swStatus: 'active' | 'waiting' | 'installing' | 'none';
  swSupported: boolean;
  activeTabRequest: string | null;
  clearTabRequest: () => void;
  navigateTo: (tab: string) => void;
}

const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = localStorage.getItem('subliminal_active_tab');
    if (saved === 'library' || saved === 'search' || saved === 'player' || saved === 'settings') {
      return saved as TabType;
    }
    return 'library';
  });

  useEffect(() => {
    localStorage.setItem('subliminal_active_tab', activeTab);
  }, [activeTab]);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [activeTabRequest, setActiveTabRequest] = useState<string | null>(null);
  const [swStatus, setSwStatus] = useState<'active' | 'waiting' | 'installing' | 'none'>('none');
  const swSupported = 'serviceWorker' in navigator;

  const lastToastRef = useRef<string | null>(null);
  const showToast = useCallback((message: string) => {
    if (message === lastToastRef.current) return;
    lastToastRef.current = message;
    
    setToast(message);
    setTimeout(() => {
      setToast(prev => prev === message ? null : prev);
      if (lastToastRef.current === message) lastToastRef.current = null;
    }, 4000);
  }, []);

  const navigateTo = useCallback((tab: string) => setActiveTabRequest(tab), []);
  const clearTabRequest = useCallback(() => setActiveTabRequest(null), []);

  useEffect(() => {
    let debounceTimer: number | null = null;
    let lastState: boolean | null = null;

    const updateNetworkStatus = () => {
      const isCurrentlyOffline = !navigator.onLine;
      
      if (lastState === isCurrentlyOffline) return;
      
      if (debounceTimer) window.clearTimeout(debounceTimer);
      
      debounceTimer = window.setTimeout(() => {
        setIsOffline(isCurrentlyOffline);
        
        // Only show toast after first transition
        if (lastState !== null) {
          showToast(isCurrentlyOffline ? 'System Offline' : 'System Online');
        }
        lastState = isCurrentlyOffline;
      }, 1500); // 1.5s debounce for unstable networks/Safari glitches
    };

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      if (debounceTimer) window.clearTimeout(debounceTimer);
    };
  }, [showToast]);

  // Monitor Service Worker Status
  useEffect(() => {
    if (!swSupported) return;
    
    // Defensive: Version Check & Cache Busting
    const lastVersion = localStorage.getItem('app_version');
    if (lastVersion && lastVersion !== CURRENT_VERSION) {
      console.log("System Update: Version migrated to " + CURRENT_VERSION);
      // We no longer clear localStorage here to prevent data loss of imported audio/settings.
      // Selective clearing of temp state if needed:
      localStorage.removeItem('app_boot_crash_count');
      localStorage.removeItem('app_crash_log');
    }
    localStorage.setItem('app_version', CURRENT_VERSION);

    const updateStatus = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          setSwStatus('none');
          return;
        }

        if (registration.installing) {
          setSwStatus('installing');
        } else if (registration.waiting) {
          setSwStatus('waiting');
        } else if (registration.active) {
          setSwStatus('active');
        }

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  setSwStatus('waiting');
                } else {
                  setSwStatus('active');
                }
              }
            };
          }
        };
      } catch (err) {
        console.error('[SW] Status check failed:', err);
      }
    };

    updateStatus();
    navigator.serviceWorker.addEventListener('controllerchange', updateStatus);
    const interval = setInterval(updateStatus, 5000);
    return () => {
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', updateStatus);
    };
  }, [swSupported]);

  return (
    <UIStateContext.Provider value={{
      activeTab,
      setActiveTab,
      isLoading,
      setIsLoading,
      initError,
      setInitError,
      toast,
      showToast,
      isOffline,
      swStatus,
      swSupported,
      activeTabRequest,
      clearTabRequest,
      navigateTo
    }}>
      {children}
    </UIStateContext.Provider>
  );
}

export function useUIState() {
  const context = useContext(UIStateContext);
  if (context === undefined) {
    throw new Error('useUIState must be used within a UIStateProvider');
  }
  return context;
}
