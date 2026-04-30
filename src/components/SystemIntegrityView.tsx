
import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2, ChevronRight, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SafetyChecker, { IntegrityReport } from '../utils/SafetyChecker';

export const SystemIntegrityView = () => {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setReport(SafetyChecker.getReport());
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-amber-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getIcon = (val: boolean) => {
    return val ? <CheckCircle2 size={14} className="text-green-500" /> : <AlertCircle size={14} className="text-red-500" />;
  };

  if (!report) return null;

  return (
    <div className="bg-apple-card rounded-[2rem] border border-apple-border shadow-sm overflow-hidden mb-8">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-4 text-left p-5 hover:bg-secondary-system-background transition-colors"
      >
        <div className={`w-10 h-10 rounded-2xl bg-secondary-system-background ${getStatusColor(report.status)} flex-shrink-0 flex items-center justify-center`}>
          <ShieldCheck size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-system-label">System Integrity</h3>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${getStatusColor(report.status)}`}>
            Status: {report.status}
          </p>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          className="flex-shrink-0"
        >
          <ChevronRight size={18} className="text-system-secondary-label" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-apple-border bg-secondary-system-background/30 overflow-hidden"
          >
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-system-background/50 p-3 rounded-2xl border border-apple-border flex items-center justify-between">
                  <span className="text-[10px] font-bold text-system-secondary-label uppercase">Storage</span>
                  {getIcon(report.checks.storage)}
                </div>
                <div className="bg-system-background/50 p-3 rounded-2xl border border-apple-border flex items-center justify-between">
                  <span className="text-[10px] font-bold text-system-secondary-label uppercase">Database</span>
                  {getIcon(report.checks.database)}
                </div>
                <div className="bg-system-background/50 p-3 rounded-2xl border border-apple-border flex items-center justify-between">
                  <span className="text-[10px] font-bold text-system-secondary-label uppercase">Audio API</span>
                  {getIcon(report.checks.audio)}
                </div>
                <div className="bg-system-background/50 p-3 rounded-2xl border border-apple-border flex items-center justify-between">
                  <span className="text-[10px] font-bold text-system-secondary-label uppercase">Offline Registry</span>
                  {getIcon(report.checks.pwa)}
                </div>
              </div>

              {report.errors.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[9px] font-black text-red-600 uppercase tracking-widest pl-1">Diagnostic Logs</p>
                  <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 space-y-2">
                    {report.errors.map((err, i) => (
                      <div key={i} className="flex gap-2 text-[10px] font-medium text-red-700 leading-tight">
                        <span className="opacity-50">•</span>
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 px-1">
                    <Activity size={10} className="text-apple-blue" />
                    <span className="text-[9px] font-black text-apple-blue uppercase tracking-widest">Health Monitor</span>
                 </div>
                 <p className="text-[11px] text-system-secondary-label leading-relaxed px-1">
                    Automated background safety agents are active. They will attempt to restart the audio engine if a stall is detected.
                 </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
