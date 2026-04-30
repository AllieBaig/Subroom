import React, { useState } from 'react';
import { useAudio } from '../AudioContext';
import { useSettings } from '../SettingsContext';
import { useUIState } from '../UIStateContext';
import { NATURE_SOUNDS, AUDIO_ACCEPT_STRING, SUPPORTED_AUDIO_FORMATS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ChevronDown, 
  Check, 
  Plus, 
  Trash2, 
  Ear, 
  Activity, 
  Wind, 
  CloudRain, 
  Download, 
  Settings as SettingsIcon, 
  Music, 
  RotateCw, 
  RotateCcw, 
  ShieldCheck, 
  Link, 
  Upload, 
  Sliders, 
  Flame, 
  Droplets, 
  Waves, 
  Trees, 
  History, 
  Sun, 
  Moon, 
  Monitor, 
  Palette, 
  Timer, 
  Repeat, 
  Repeat1, 
  Focus as FocusIcon, 
  Wrench, 
  Terminal,
  Layers,
  ArrowLeft
} from 'lucide-react';

import { PickerWheel } from '../components/PickerWheel';
import { AppearanceSettings } from '../components/AppearanceSettings';
import { PlaybackControl } from '../components/PlaybackControl';
import { AudioLayerLibrary } from '../components/AudioLayerLibrary';
import { AppManagement, AppMaintenance } from './AppManagement';
import { Group, Section } from '../components/SettingsUI';
import { SystemIntegrityView } from '../components/SystemIntegrityView';

export default function SettingsView({ onBack }: { onBack?: () => void }) {
  const { 
    tracks,
    playlists,
    subliminalTracks, 
    addSubliminalTrack, 
    removeSubliminalTrack,
    exportAppData,
    importAppData,
    relinkTrack,
    clearAppCache,
    healSystem,
    resetServiceWorker,
    clearCacheStorage,
    clearDatabase,
    fullAppReset
  } = useAudio();

  const {
    settings,
    updateSubliminalSettings,
    updateBinauralSettings,
    updateNatureSettings,
    updateNoiseSettings,
    updateDidgeridooSettings,
    updatePureHzSettings,
    updateIsochronicSettings,
    updateSolfeggioSettings,
    updateLibrarySettings,
    updateAppearanceSettings,
    updateVisibilitySettings,
    updateAudioTools,
    updateSettings,
    updateSleepTimer,
    resetUISettings
  } = useSettings();

  const { showToast, swStatus, swSupported } = useUIState();

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  if (!settings) return null;

  const hzOptions = Array.from({ length: 1901 - 20 }, (_, i) => 20 + i);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        // Accordion behavior: only one group open at a time
        next.clear();
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleSection = (id: string) => {
    if (id === 'subliminal') {
      updateSettings({ subliminalExpanded: !settings.subliminalExpanded });
    } else {
      setExpandedSection(expandedSection === id ? null : id);
    }
  };

  const isSectionExpanded = (id: string) => {
    if (id === 'subliminal') return settings.subliminalExpanded;
    return expandedSection === id;
  };

  const handleSubliminalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addSubliminalTrack(e.target.files[0]);
    }
  };

  const VersionHistorySection = () => {
    const isExpanded = expandedGroups.has('history');
    return (
      <div className="bg-apple-card rounded-[2rem] border border-apple-border shadow-sm overflow-hidden mb-8">
        <button 
          onClick={() => toggleGroup('history')}
          className="w-full flex items-center gap-4 text-left p-5 hover:bg-secondary-system-background transition-colors"
        >
          <div className="w-10 h-10 rounded-2xl bg-secondary-system-background text-system-secondary-label flex-shrink-0 flex items-center justify-center">
            <History size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-system-label">App Version History</h3>
            <p className="text-[10px] text-system-secondary-label font-bold uppercase tracking-wider">Ver {settings.versionHistory[0]?.version || '0.0.0'}</p>
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
              <div className="p-6 flex flex-col gap-8">
                {settings.versionHistory.map((entry, idx) => (
                  <div key={entry.version} className="relative pl-6 border-l border-apple-border last:border-0 pb-2">
                    <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-apple-blue shadow-[0_0_0_4px_var(--system-background)]" />
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-black tracking-tight text-system-label">v{entry.version}</span>
                      <span className="text-[9px] font-bold text-system-secondary-label bg-secondary-system-background px-2 py-0.5 rounded-full uppercase tracking-widest">{entry.date}</span>
                      {idx === 0 && <span className="text-[8px] font-black bg-apple-blue text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">New</span>}
                    </div>
                    
                    <div className="flex flex-col gap-4">
                      {entry.changes.added && entry.changes.added.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1.5">Added</p>
                          <ul className="space-y-1">
                            {entry.changes.added.map((c, i) => (
                              <li key={i} className="text-[11px] font-medium text-system-label leading-snug flex gap-2">
                                <span className="text-system-secondary-label inline-block">•</span>
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {entry.changes.improved && entry.changes.improved.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-apple-blue uppercase tracking-widest mb-1.5">Improved</p>
                          <ul className="space-y-1">
                            {entry.changes.improved.map((c, i) => (
                              <li key={i} className="text-[11px] font-medium text-system-label leading-snug flex gap-2">
                                <span className="text-system-secondary-label">•</span>
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {entry.changes.fixed && entry.changes.fixed.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1.5">Fixed</p>
                          <ul className="space-y-1">
                            {entry.changes.fixed.map((c, i) => (
                              <li key={i} className="text-[11px] font-medium text-system-label leading-snug flex gap-2">
                                <span className="text-system-secondary-label">•</span>
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex flex-col pb-12 w-full max-w-7xl mx-auto">
      <SystemIntegrityView />
      <VersionHistorySection />

      <PlaybackControl 
        isExpanded={expandedGroups.has('playback')}
        onToggle={() => toggleGroup('playback')}
      />

      <Group 
        title="Audio Layers" 
        icon={Layers} 
        color="bg-emerald-500/10 text-emerald-600"
        isExpanded={expandedGroups.has('audio')}
        onToggle={() => toggleGroup('audio')}
      >
        <div className="flex flex-col gap-2 p-1">
          <AudioLayerLibrary />
        </div>
      </Group>

      <Group
        title="App Control"
        icon={SettingsIcon}
        color="bg-gray-700/10 text-gray-700"
        isExpanded={expandedGroups.has('control')}
        onToggle={() => toggleGroup('control')}
      >
        <div className="flex flex-col gap-2">
          <AppManagement />
          <AppMaintenance />
          
          {swSupported && (
            <Section
              id="advanced"
              title="Advanced System"
              subtitle="Recovery Tools"
              icon={Terminal}
              color="bg-red-500/10 text-red-600"
            >
              <div className="flex flex-col gap-3">
                <button onClick={resetServiceWorker} className="w-full p-4 border border-apple-border rounded-xl text-xs font-bold uppercase hover:bg-secondary-system-background text-system-label active:scale-[0.98] transition-all">Unregister SW</button>
                <button onClick={fullAppReset} className="w-full p-4 bg-red-500 text-white font-bold text-xs uppercase rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all">Full Factory Reset</button>
              </div>
            </Section>
          )}

          <div className="bg-apple-blue/5 p-4 rounded-2xl border border-apple-blue/10 flex items-center justify-between mt-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Activity size={10} className="text-apple-blue" />
                <p className="text-[13px] font-extrabold text-apple-blue">System Stabilization</p>
              </div>
              <p className="text-[9px] text-system-secondary-label font-bold uppercase tracking-[0.05em] mt-0.5">Clears caches & re-syncs media state</p>
            </div>
            <button 
              onClick={healSystem}
              className="bg-apple-blue text-white py-1.5 px-4 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-transform"
            >
              Heal
            </button>
          </div>
        </div>
      </Group>

      <AppearanceSettings 
        isExpanded={expandedGroups.has('appearance')}
        onToggle={() => toggleGroup('appearance')}
      />
    </div>
  );
}
