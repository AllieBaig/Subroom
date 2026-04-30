import React from 'react';
import { useAudio } from '../AudioContext';
import { useSettings } from '../SettingsContext';
import { useUIState } from '../UIStateContext';
import { Section } from '../components/SettingsUI';
import StorageInfo from '../components/StorageInfo';
import { 
  Download, Upload, Wrench, ChevronRight, History, Settings as SettingsIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AppManagement = () => {
  const { 
    exportAppData,
    importAppData
  } = useAudio();

  return (
    <Section
      id="management"
      title="Data Management"
      subtitle="Backup & Restore"
      icon={SettingsIcon} // Need to fix this import
      color="bg-apple-blue/10 text-apple-blue"
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <button 
            onClick={() => exportAppData()}
            className="flex-1 p-4 flex flex-col items-center gap-2 bg-system-background text-apple-blue border border-apple-border rounded-2xl font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all"
          >
            <Download size={16} />
            Export Data
          </button>

          <label className="flex-1 p-4 flex flex-col items-center gap-2 bg-system-background text-apple-blue border border-apple-border rounded-2xl font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all cursor-pointer">
            <Upload size={16} />
            Import Data
            <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files && importAppData(e.target.files[0])} />
          </label>
        </div>
      </div>
    </Section>
  );
};

export const AppMaintenance = () => {
  const { clearAppCache } = useAudio();
  const { resetUISettings } = useSettings();

  return (
    <Section
      id="maintenance"
      title="App Maintenance"
      subtitle="Cache & Reset"
      icon={Wrench}
      color="bg-amber-100 text-amber-600"
    >
      <div className="flex flex-col gap-4">
        <StorageInfo />
        
        <button 
          onClick={() => clearAppCache()}
          className="w-full p-4 flex items-center justify-between hover:bg-secondary-system-background transition-colors bg-system-background rounded-2xl border border-apple-border"
        >
          <div className="text-left">
            <p className="text-xs font-semibold text-system-label">Clear Cache</p>
            <p className="text-[9px] text-system-secondary-label font-bold uppercase tracking-widest">Removes temporary data</p>
          </div>
          <ChevronRight size={14} className="text-system-tertiary-label" />
        </button>

        <button 
          onClick={() => resetUISettings()}
          className="w-full p-4 flex items-center justify-between hover:bg-red-50 transition-colors bg-system-background rounded-2xl border border-red-100 text-red-500"
        >
          <p className="text-xs font-bold uppercase tracking-widest">Reset UI Settings</p>
          <ChevronRight size={14} className="opacity-40" />
        </button>
      </div>
    </Section>
  );
};
