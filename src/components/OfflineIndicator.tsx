import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1001] px-4 py-2 bg-system-gray-6/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl flex items-center gap-2 pointer-events-none"
        >
          <WifiOff size={14} className="text-apple-blue" />
          <span className="text-[10px] font-black uppercase tracking-widest text-system-label">Offline Mode</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
