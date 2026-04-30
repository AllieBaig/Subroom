import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { AppSettings } from './types';
import * as db from './db';
import { APP_HISTORY } from './constants/history';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  updateSubliminalSettings: (newSettings: Partial<AppSettings['subliminal']>) => void;
  updateBinauralSettings: (newSettings: Partial<AppSettings['binaural']>) => void;
  updateNatureSettings: (newSettings: Partial<AppSettings['nature']>) => void;
  updateNoiseSettings: (newSettings: Partial<AppSettings['noise']>) => void;
  updateDidgeridooSettings: (newSettings: Partial<AppSettings['didgeridoo']>) => void;
  updateShamanicSettings: (newSettings: Partial<AppSettings['shamanic']>) => void;
  updatePureHzSettings: (newSettings: Partial<AppSettings['pureHz']>) => void;
  updateIsochronicSettings: (newSettings: Partial<AppSettings['isochronic']>) => void;
  updateSolfeggioSettings: (newSettings: Partial<AppSettings['solfeggio']>) => void;
  updateSchumannSettings: (newSettings: Partial<AppSettings['schumann']>) => void;
  updateMentalToughnessSettings: (newSettings: Partial<AppSettings['mentalToughness']>) => void;
  updateLibrarySettings: (newSettings: Partial<AppSettings['library']>) => void;
  updateAppearanceSettings: (newSettings: Partial<AppSettings['appearance']>) => void;
  updateVisibilitySettings: (newSettings: Partial<AppSettings['visibility']>) => void;
  updateAudioTools: (newSettings: Partial<AppSettings['audioTools']>) => void;
  updateSleepTimer: (newSettings: Partial<AppSettings['sleepTimer']>) => void;
  resetUISettings: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  subliminal: {
    isEnabled: true,
    selectedTrackId: null,
    volume: 0.1,
    isLooping: true,
    delayMs: 0,
    isPlaylistMode: false,
    sourcePlaylistId: null,
    gainDb: 0,
    normalize: false,
    playInBackground: false,
  },
  binaural: {
    isEnabled: false,
    leftFreq: 200,
    rightFreq: 210,
    volume: 0.05,
    gainDb: 0,
    normalize: false,
    playInBackground: false,
    pitchSafeMode: false,
  },
  nature: {
    isEnabled: false,
    type: 'rain',
    volume: 0.5,
    gainDb: 0,
    normalize: false,
    playInBackground: false,
  },
  noise: {
    isEnabled: false,
    type: 'white',
    volume: 0.2,
    gainDb: 0,
    normalize: false,
    playInBackground: false,
  },
  didgeridoo: {
    isEnabled: false,
    volume: 0.3,
    gainDb: -6,
    playbackRate: 1.0,
    frequency: 65,
    depth: 0.5,
    isLooping: true,
    normalize: false,
    playInBackground: false,
    pitchSafeMode: false,
    physical: {
      roomSize: 'medium',
      wallResonance: 'medium',
      materialTexture: 'solid_wall',
      resonanceDepth: 0.3,
      echoTailLength: 0.2
    },
  },
  shamanic: {
    isEnabled: false,
    volume: 0.4,
    gainDb: -6,
    playbackRate: 1.0,
    frequency: 70, // Warm low drum tone
    depth: 0.4,
    isLooping: true,
    normalize: false,
    playInBackground: false,
    pitchSafeMode: false,
    physical: {
      roomSize: 'medium',
      wallResonance: 'low',
      materialTexture: 'empty_wood',
      resonanceDepth: 0.4,
      echoTailLength: 0.3,
      bangingIntensity: 'medium'
    },
  },
  mentalToughness: {
    isEnabled: false,
    volume: 0.3,
    gainDb: -6,
    pitch: 'hard',
    texture: 'empty_wood',
    intensity: 'medium',
    playbackRate: 1.0,
    frequency: 60,
    isLooping: true,
    normalize: false,
    playInBackground: false,
    pitchSafeMode: false,
    physical: {
      roomSize: 'large',
      wallResonance: 'medium',
      materialTexture: 'solid_wall',
      resonanceDepth: 0.5,
      echoTailLength: 0.4,
      bangingIntensity: 'medium'
    },
  },
  pureHz: {
    isEnabled: false,
    frequency: 432,
    volume: 0.05,
    isLooping: true,
    gainDb: 0,
    normalize: false,
    playInBackground: false,
    pitchSafeMode: false,
  },
  isochronic: {
    isEnabled: false,
    frequency: 432,
    pulseRate: 7.83,
    volume: 0.1,
    gainDb: -6,
    normalize: false,
    playInBackground: false,
    pitchSafeMode: false,
  },
  solfeggio: {
    isEnabled: false,
    frequency: 528,
    volume: 0.1,
    gainDb: -6,
    normalize: false,
    playInBackground: false,
    pitchSafeMode: false,
  },
  schumann: {
    isEnabled: false,
    frequency: 7.83,
    volume: 0.1,
    gainDb: -6,
    normalize: false,
    playInBackground: false,
    pitchSafeMode: false,
  },
  audioTools: {
    gainDb: 0,
    normalizeTargetDb: null,
    playInBackground: false,
  },
  mainVolume: 1.0,
  mainGainDb: 0,
  playbackRate: 1.0,
  fadeInOut: true,
  syncPlayback: true,
  library: {
    sort: 'recent',
    group: 'alphabetical',
    groupByMinutes: false,
  },
  appearance: {
    theme: 'light',
    followSystem: true,
    darkModeStyle: 'soft-purple',
  },
  miniMode: false,
  hiddenLayersPosition: 'bottom',
  loop: 'none',
  shuffle: false,
  playlistMemory: {},
  menuPosition: 'bottom',
  bigTouchMode: false,
  animationStyle: 'slide-up',
  hzInputMode: 'slider',
  subliminalExpanded: false,
  showArtwork: false,
  alwaysHideArtworkByDefault: true,
  backButtonPosition: 'bottom',
  libraryControlsPosition: 'bottom',
  displayAlwaysOn: false,
  playbackMode: 'once',
  chunking: {
    activePlaylistId: null,
    currentChunkIndex: 0,
    lastChunkPosition: 0,
    currentTrackIndex: null,
    mode: 'heartbeat',
    sizeMinutes: 3
  },
  visibility: {
    audioLayers: true,
    appControl: true
  },
  sleepTimer: {
    isEnabled: false,
    minutes: 30,
    remainingSeconds: null
  },
  versionHistory: APP_HISTORY
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Load from Storage (Priority: localStorage for speed, IndexedDB for reliability)
  useEffect(() => {
    async function load() {
      // Try localStorage first
      const local = localStorage.getItem('subliminal_settings_v3');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setSettings({ ...parsed, versionHistory: APP_HISTORY });
        } catch (e) {
          console.warn('[Settings] LocalStorage corruption, falling back to IDB');
        }
      }

      // Check IDB as source of truth/backup
      const saved = await db.getSettings();
      if (saved) {
        setSettings({ ...saved, versionHistory: APP_HISTORY });
        // Sync to localStorage
        localStorage.setItem('subliminal_settings_v3', JSON.stringify(saved));
      }
    }
    load();
  }, []);

  // Save to Storage
  useEffect(() => {
    // Aggressive dual storage to prevent data loss on iPhone 8
    localStorage.setItem('subliminal_settings_v3', JSON.stringify(settings));
    db.saveSettings(settings);
  }, [settings]);

  // Theme support
  useEffect(() => {
    const applyTheme = () => {
      const { theme, followSystem, darkModeStyle } = settings.appearance;
      let targetTheme = theme;

      if (followSystem) {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        targetTheme = isDark ? 'dark' : 'light';
      }

      if (targetTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', darkModeStyle);
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    };

    applyTheme();

    if (settings.appearance.followSystem) {
      const matcher = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      matcher.addEventListener('change', listener);
      return () => matcher.removeEventListener('change', listener);
    }
  }, [settings.appearance]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const updateSubliminalSettings = useCallback((newSub: Partial<AppSettings['subliminal']>) => {
    setSettings(prev => ({ ...prev, subliminal: { ...prev.subliminal, ...newSub } }));
  }, []);

  const updateBinauralSettings = useCallback((newBin: Partial<AppSettings['binaural']>) => {
    setSettings(prev => ({ ...prev, binaural: { ...prev.binaural, ...newBin } }));
  }, []);

  const updateNatureSettings = useCallback((newNat: Partial<AppSettings['nature']>) => {
    setSettings(prev => ({ ...prev, nature: { ...prev.nature, ...newNat } }));
  }, []);

  const updateNoiseSettings = useCallback((newNoi: Partial<AppSettings['noise']>) => {
    setSettings(prev => ({ ...prev, noise: { ...prev.noise, ...newNoi } }));
  }, []);

  const updateDidgeridooSettings = useCallback((newDid: Partial<AppSettings['didgeridoo']>) => {
    setSettings(prev => ({ ...prev, didgeridoo: { ...prev.didgeridoo, ...newDid } }));
  }, []);
  
  const updateShamanicSettings = useCallback((newSha: Partial<AppSettings['shamanic']>) => {
    setSettings(prev => ({ ...prev, shamanic: { ...prev.shamanic, ...newSha } }));
  }, []);

  const updatePureHzSettings = useCallback((newHz: Partial<AppSettings['pureHz']>) => {
    setSettings(prev => ({ ...prev, pureHz: { ...prev.pureHz, ...newHz } }));
  }, []);

  const updateIsochronicSettings = useCallback((newIso: Partial<AppSettings['isochronic']>) => {
    setSettings(prev => ({ ...prev, isochronic: { ...prev.isochronic, ...newIso } }));
  }, []);

  const updateSolfeggioSettings = useCallback((newSol: Partial<AppSettings['solfeggio']>) => {
    setSettings(prev => ({ ...prev, solfeggio: { ...prev.solfeggio, ...newSol } }));
  }, []);

  const updateSchumannSettings = useCallback((newSch: Partial<AppSettings['schumann']>) => {
    setSettings(prev => ({ ...prev, schumann: { ...prev.schumann, ...newSch } }));
  }, []);

  const updateMentalToughnessSettings = useCallback((newMT: Partial<AppSettings['mentalToughness']>) => {
    setSettings(prev => ({ ...prev, mentalToughness: { ...prev.mentalToughness, ...newMT } }));
  }, []);

  const updateLibrarySettings = useCallback((newLib: Partial<AppSettings['library']>) => {
    setSettings(prev => ({ ...prev, library: { ...prev.library, ...newLib } }));
  }, []);

  const updateAppearanceSettings = useCallback((newApp: Partial<AppSettings['appearance']>) => {
    setSettings(prev => ({ ...prev, appearance: { ...prev.appearance, ...newApp } }));
  }, []);

  const updateVisibilitySettings = useCallback((newVisibility: Partial<AppSettings['visibility']>) => {
    setSettings(prev => ({ ...prev, visibility: { ...prev.visibility, ...newVisibility } }));
  }, []);

  const updateAudioTools = useCallback((newTools: Partial<AppSettings['audioTools']>) => {
    setSettings(prev => ({ ...prev, audioTools: { ...prev.audioTools, ...newTools } }));
  }, []);

  const updateSleepTimer = useCallback((newSleep: Partial<AppSettings['sleepTimer']>) => {
    setSettings(prev => ({ ...prev, sleepTimer: { ...prev.sleepTimer, ...newSleep } }));
  }, []);

  const resetUISettings = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      miniMode: false,
      hiddenLayersPosition: 'bottom',
      menuPosition: 'bottom',
      bigTouchMode: false,
      animationStyle: 'slide-up',
      hzInputMode: 'slider',
    }));
  }, []);

  return (
    <SettingsContext.Provider value={{
      settings,
      updateSettings,
      updateSubliminalSettings,
      updateBinauralSettings,
      updateNatureSettings,
      updateNoiseSettings,
      updateDidgeridooSettings,
      updateShamanicSettings,
      updatePureHzSettings,
      updateIsochronicSettings,
      updateSolfeggioSettings,
      updateSchumannSettings,
      updateMentalToughnessSettings,
      updateLibrarySettings,
      updateAppearanceSettings,
      updateVisibilitySettings,
      updateAudioTools,
      updateSleepTimer,
      resetUISettings
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
