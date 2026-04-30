export interface Track {
  id: string;
  name: string;
  url: string;
  artist?: string;
  artwork?: string;
  createdAt: number;
  lastPlayedAt?: number;
  isMissing?: boolean;
  duration?: number;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export type SortOption = 'date' | 'alphabetical' | 'recent';
export type GroupOption = 'none' | 'day' | 'week' | 'month' | 'alphabetical' | 'minutes' | 'numbers';
export type AnimationStyle = 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'random' | 'off';
export type HzInputMode = 'slider' | 'picker' | 'manual';

export interface SubliminalSettings {
  isEnabled: boolean;
  selectedTrackId: string | null;
  volume: number; // 0 to 0.3
  isLooping: boolean;
  delayMs: number;
  isPlaylistMode: boolean;
  sourcePlaylistId: string | null;
  gainDb: number;
  normalize: boolean;
  playInBackground: boolean;
}

export interface BinauralSettings {
  isEnabled: boolean;
  leftFreq: number;
  rightFreq: number;
  volume: number;
  gainDb: number;
  normalize: boolean;
  playInBackground: boolean;
  pitchSafeMode: boolean;
}

export interface NatureSettings {
  isEnabled: boolean;
  type: 'rain' | 'ocean' | 'forest' | 'wind' | 'fire' | 'stream';
  volume: number;
  gainDb: number;
  normalize: boolean;
  playInBackground: boolean;
}

export interface NoiseSettings {
  isEnabled: boolean;
  type: 'white' | 'pink' | 'brown';
  volume: number;
  gainDb: number;
  normalize: boolean;
  playInBackground: boolean;
}

export interface PhysicalSoundSettings {
  roomSize: 'small' | 'medium' | 'large' | 'cave';
  wallResonance: 'off' | 'low' | 'medium' | 'high';
  materialTexture: 'thin_wood' | 'empty_wood' | 'solid_wall' | 'open_space';
  resonanceDepth: number; // 0 to 1
  echoTailLength: number; // 0 to 1
  bangingIntensity?: 'soft' | 'medium' | 'hard'; // For Mental Toughness + Drumming
}

export interface DidgeridooSettings {
  isEnabled: boolean;
  volume: number;
  gainDb: number;
  playbackRate: number;
  frequency: number;
  depth: number;
  isLooping: boolean;
  normalize: boolean;
  playInBackground: boolean;
  pitchSafeMode: boolean;
  physical?: PhysicalSoundSettings;
}

export interface PureHzSettings {
  isEnabled: boolean;
  frequency: number;
  volume: number;
  isLooping: boolean;
  gainDb: number;
  normalize: boolean;
  playInBackground: boolean;
  pitchSafeMode: boolean;
}

export interface IsochronicSettings {
  isEnabled: boolean;
  frequency: number;
  pulseRate: number;
  volume: number;
  gainDb: number;
  normalize: boolean;
  playInBackground: boolean;
  pitchSafeMode: boolean;
}

export interface SolfeggioSettings {
  isEnabled: boolean;
  frequency: number;
  volume: number;
  gainDb: number;
  normalize: boolean;
  playInBackground: boolean;
  pitchSafeMode: boolean;
}

export interface SchumannSettings {
  isEnabled: boolean;
  frequency: number;
  volume: number;
  gainDb: number;
  normalize: boolean;
  playInBackground: boolean;
  pitchSafeMode: boolean;
}

export interface AudioTools {
  gainDb: number;
  normalizeTargetDb: number | null;
  playInBackground: boolean;
}

export interface PlaylistMemory {
  trackId: string;
  position: number;
  timestamp: number;
}

export interface VersionEntry {
  version: string;
  date: string;
  changes: {
    added?: string[];
    improved?: string[];
    fixed?: string[];
  };
}

export type Theme = 'light' | 'dark';
export type DarkModeStyle = 'soft-purple' | 'soft-blue';

export interface ShamanicSettings {
  isEnabled: boolean;
  volume: number;
  gainDb: number;
  frequency: number; // Pitch/Tone of drum
  depth: number; // Resonance/Intensity
  playbackRate: number; // Tempo/Speed
  isLooping: boolean;
  normalize: boolean;
  playInBackground: boolean;
  pitchSafeMode: boolean;
  physical?: PhysicalSoundSettings;
}

export interface MentalToughnessSettings {
  isEnabled: boolean;
  volume: number;
  gainDb: number;
  pitch: 'soft' | 'hard' | 'loud' | 'low';
  texture: 'empty_wood' | 'thin_wood' | 'double_thin' | 'hollow_wood' | 'tribal_wood';
  intensity: 'light' | 'medium' | 'strong' | 'deep';
  playbackRate: number; // Tempo/Speed
  frequency: number; // Hz Depth
  isLooping: boolean;
  normalize: boolean;
  playInBackground: boolean;
  pitchSafeMode: boolean;
  physical?: PhysicalSoundSettings;
}

export interface AppSettings {
  subliminal: SubliminalSettings;
  binaural: BinauralSettings;
  nature: NatureSettings;
  noise: NoiseSettings;
  didgeridoo: DidgeridooSettings;
  shamanic: ShamanicSettings;
  mentalToughness: MentalToughnessSettings;
  pureHz: PureHzSettings;
  isochronic: IsochronicSettings;
  solfeggio: SolfeggioSettings;
  schumann: SchumannSettings;
  audioTools: AudioTools;
  mainVolume: number;
  mainGainDb: number;
  playbackRate: number;
  fadeInOut: boolean;
  syncPlayback: boolean;
  library: {
    sort: SortOption;
    group: GroupOption;
    groupByMinutes: boolean;
  };
  appearance: {
    theme: Theme;
    followSystem: boolean;
    darkModeStyle: DarkModeStyle;
  };
  miniMode: boolean;
  hiddenLayersPosition: 'top' | 'bottom';
  loop: 'none' | 'one' | 'all';
  shuffle: boolean;
  playlistMemory: Record<string, PlaylistMemory>;
  menuPosition: 'top' | 'bottom';
  bigTouchMode: boolean;
  animationStyle: AnimationStyle;
  hzInputMode: HzInputMode;
  subliminalExpanded: boolean;
  showArtwork: boolean;
  alwaysHideArtworkByDefault: boolean;
  backButtonPosition: 'top' | 'bottom';
  libraryControlsPosition: 'top' | 'bottom';
  displayAlwaysOn: boolean;
  playbackMode: 'once' | 'loop';
  chunking: {
    activePlaylistId: string | null;
    currentChunkIndex: number;
    lastChunkPosition: number;
    currentTrackIndex: number | null;
    mode: 'heartbeat' | 'merge';
    sizeMinutes: number;
  };
  visibility: {
    audioLayers: boolean;
    appControl: boolean;
  };
  sleepTimer: {
    isEnabled: boolean;
    minutes: number;
    remainingSeconds: number | null;
  };
  versionHistory: VersionEntry[];
}
