import React, { useEffect, useState } from 'react';
import { Database, HardDrive, Info } from 'lucide-react';

export default function StorageInfo() {
  const [usage, setUsage] = useState<number | null>(null);
  const [quota, setQuota] = useState<number | null>(null);

  useEffect(() => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(estimate => {
        setUsage(estimate.usage || 0);
        setQuota(estimate.quota || 0);
      });
    }
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (usage === null) return null;

  return (
    <div className="bg-system-background rounded-2xl border border-apple-border p-4 mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl bg-apple-blue/10 text-apple-blue flex items-center justify-center">
          <HardDrive size={16} />
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-system-label">Storage Usage</h4>
          <p className="text-[9px] text-system-secondary-label font-bold uppercase tracking-widest">Offline-First Cache</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-system-label">{formatSize(usage)} used</span>
        <span className="text-[10px] font-bold text-system-tertiary-label">of {formatSize(quota || 0)} available</span>
      </div>

      <div className="w-full h-1.5 bg-secondary-system-background rounded-full overflow-hidden">
        <div 
          className="h-full bg-apple-blue rounded-full transition-all duration-1000"
          style={{ width: `${Math.min(100, ((usage || 0) / (quota || 1)) * 100)}%` }}
        />
      </div>

      <div className="flex items-start gap-2 mt-4 text-[#8e8e93]">
        <Info size={12} className="flex-shrink-0 mt-0.5" />
        <p className="text-[10px] leading-relaxed font-bold">
          The app uses IndexedDB to store your music and layers locally for offline playback.
        </p>
      </div>
    </div>
  );
}
