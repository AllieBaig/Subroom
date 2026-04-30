import React, { useState, useMemo } from 'react';
import { useAudio } from '../AudioContext';
import { usePlayback } from '../PlaybackContext';
import { useSettings } from '../SettingsContext';
import { useUIState } from '../UIStateContext';
import { NATURE_SOUNDS, FREQUENCY_PRESETS } from '../constants';
import { AnimationStyle } from '../types';
import { 
  Play, Pause, SkipBack, SkipForward, 
  Volume2, Activity, Wind, CloudRain, 
  ChevronDown, Check, X, 
  Moon, Sliders, ChevronRight,
  Zap, Repeat, Repeat1, Shuffle, Monitor,
  MoreHorizontal, Ear, Focus as FocusIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { ArtworkImage } from '../components/ArtworkImage';

import { PickerWheel } from '../components/PickerWheel';

import { AudioLayerLibrary } from '../components/AudioLayerLibrary';

interface PlayerViewProps {
  onBack?: () => void;
}

const WaveformAnimation = ({ isPlaying }: { isPlaying: boolean }) => {
  const { currentTime } = usePlayback();
  return (
    <motion.div 
      key="waveform"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full max-w-[280px] h-32 flex items-center justify-center gap-1.5 overflow-hidden"
    >
      {[...Array(24)].map((_, i) => (
        <motion.div
          key={i}
          animate={{ 
            scaleY: isPlaying ? [1.5, 6, 3, 8, 2][(i + Math.floor(currentTime)) % 5] : 1,
            opacity: isPlaying ? [0.2, 0.5, 0.3, 0.6, 0.4][(i + Math.floor(currentTime)) % 5] : 0.1
          }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-1 h-2 bg-apple-blue rounded-full origin-center"
        />
      ))}
    </motion.div>
  );
};

const PlaybackControls = ({ settings, seekTo }: { settings: any, seekTo: (t: number) => void }) => {
  const { currentTime, duration } = usePlayback();
  
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex flex-col gap-2 ${!settings.showArtwork ? 'mb-8' : ''}`}>
      <div className="relative h-6 flex items-center">
        <input 
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(e) => seekTo(parseFloat(e.target.value))}
          className={`w-full ${settings.bigTouchMode ? (settings.showArtwork ? 'h-2' : 'h-3') : (settings.showArtwork ? 'h-1' : 'h-2')} bg-secondary-system-background rounded-full appearance-none cursor-pointer accent-system-label`}
        />
      </div>
      <div className={`flex justify-between font-bold text-system-secondary-label tabular-nums ${settings.bigTouchMode ? (!settings.showArtwork ? 'text-sm' : 'text-[11px]') : (!settings.showArtwork ? 'text-xs' : 'text-[10px]')}`}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};

const PresetButton = ({ icon: Icon, label, color, onClick }: any) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center gap-3 p-5 bg-system-background border border-apple-border rounded-[2.5rem] hover:bg-secondary-system-background active:scale-95 transition-all shadow-sm"
  >
    <div className={`w-12 h-12 flex-shrink-0 ${color} text-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/5`}>
      <Icon size={22} />
    </div>
    <span className="text-[10px] font-bold uppercase tracking-widest text-system-secondary-label truncate w-full text-center">{label}</span>
  </button>
);

export default function PlayerView({ onBack }: PlayerViewProps) {
  const { 
    tracks, 
    subliminalTracks,
    playlists,
    currentTrackIndex, 
    isPlaying, 
    setIsPlaying, 
    seekTo,
    playNext,
    playPrevious,
    userPlayNext,
    userPlayPrevious,
    toggleShuffle,
    toggleLoop,
    userTogglePlayback,
    playingPlaylistId,
    currentPlaybackList,
    addTrack
  } = useAudio();

  const { 
    settings, 
    updateSettings,
    updateSubliminalSettings,
    updateBinauralSettings,
    updateNatureSettings,
    updateNoiseSettings,
    updateSleepTimer,
    updateAudioTools
  } = useSettings();
  const { showToast } = useUIState();

  const { currentTime, duration, progress } = usePlayback();

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const toggleGroup = (groupId: string) => {
    setExpandedGroup(prev => prev === groupId ? null : groupId);
  };

  const currentTrack = currentTrackIndex !== null ? currentPlaybackList[currentTrackIndex] : null;

  // Fallback for Hz-only sessions
  const trackName = currentTrack?.name || "Ambient Session";
  const artistName = currentTrack?.artist || "Zen Layers Active";
  const artworkSrc = currentTrack?.artwork || "";

  const currentPlaylist = playingPlaylistId ? playlists.find(p => p.id === playingPlaylistId) : null;

  const activeLayersLabel = useMemo(() => {
    const layers = [
      settings.subliminal.isEnabled && "Subliminal",
      settings.binaural.isEnabled && "Binaural",
      settings.nature.isEnabled && settings.nature.type,
      settings.noise.isEnabled && `${settings.noise.type} Noise`,
      settings.didgeridoo.isEnabled && "Didgeridoo",
      settings.pureHz.isEnabled && `${settings.pureHz.frequency}Hz`,
      settings.isochronic.isEnabled && "Isochronic",
      settings.solfeggio.isEnabled && "Solfeggio",
      settings.schumann.isEnabled && "Schumann",
      settings.shamanic.isEnabled && "Shamanic",
      settings.mentalToughness.isEnabled && "Mental Toughness"
    ].filter(Boolean);

    if (layers.length === 0) return "Standard Audio";
    if (layers.length === 1) return layers[0].toString();
    return `${layers[0]} + ${layers.length - 1} more`;
  }, [settings]);

  const currentPosition = currentTrackIndex !== null ? `${currentTrackIndex + 1}/${currentPlaybackList.length}` : (activeLayersLabel !== "Standard Audio" ? "Layer Only" : "");

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const applyPreset = (mode: 'sleep' | 'focus' | 'relax') => {
    if (mode === 'sleep') {
      updateSubliminalSettings({ isEnabled: true, volume: 0.08 });
      updateBinauralSettings({ isEnabled: true, leftFreq: 150, rightFreq: 152, volume: 0.03 });
      updateNatureSettings({ isEnabled: true, type: 'rain', volume: 0.4 });
      updateNoiseSettings({ isEnabled: false });
    } else if (mode === 'focus') {
      updateSubliminalSettings({ isEnabled: true, volume: 0.12 });
      updateBinauralSettings({ isEnabled: true, leftFreq: 200, rightFreq: 214, volume: 0.06 });
      updateNatureSettings({ isEnabled: false });
      updateNoiseSettings({ isEnabled: true, type: 'white', volume: 0.15 });
    } else if (mode === 'relax') {
      updateSubliminalSettings({ isEnabled: true, volume: 0.1 });
      updateBinauralSettings({ isEnabled: true, leftFreq: 200, rightFreq: 208, volume: 0.05 });
      updateNatureSettings({ isEnabled: true, type: 'ocean', volume: 0.5 });
      updateNoiseSettings({ isEnabled: false });
    }
  };

  const getAnimationProps = (style: AnimationStyle) => {
    if (style === 'off' || !style) return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    
    let currentStyle: AnimationStyle = style;
    if (style === 'random') {
      const styles: AnimationStyle[] = ['slide-up', 'slide-down', 'slide-left', 'slide-right'];
      currentStyle = styles[Math.floor(Math.random() * styles.length)];
    }

    switch (currentStyle) {
      case 'slide-up': return { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };
      case 'slide-down': return { initial: { y: '-100%' }, animate: { y: 0 }, exit: { y: '-100%' } };
      case 'slide-left': return { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } };
      case 'slide-right': return { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } };
      default: return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    }
  };

  const getPanelAnimationProps = () => {
    if (settings.animationStyle === 'off') return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    
    // Panel always slides from top or bottom based on setting
    if (settings.hiddenLayersPosition === 'top') {
      return { initial: { y: '-100%' }, animate: { y: 0 }, exit: { y: '-100%' } };
    }
    return { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };
  };

  const animationProps = useMemo(() => getAnimationProps(settings.animationStyle), [settings.animationStyle]);
  const panelAnimationProps = useMemo(() => getPanelAnimationProps(), [settings.hiddenLayersPosition, settings.animationStyle]);

  const hasAnyLayerEnabled = useMemo(() => {
    return settings.subliminal.isEnabled || 
           settings.binaural.isEnabled || 
           settings.nature.isEnabled || 
           settings.noise.isEnabled || 
           settings.didgeridoo.isEnabled || 
           settings.pureHz.isEnabled || 
           settings.isochronic.isEnabled || 
           settings.solfeggio.isEnabled;
  }, [settings]);

  if (!currentTrack && !hasAnyLayerEnabled) return null;

  return (
    <div className={cn(
      "h-full flex flex-col select-none relative w-full max-w-2xl mx-auto bg-system-background overflow-hidden",
      settings.menuPosition === 'bottom' ? (settings.bigTouchMode ? 'pb-28' : 'pb-24') : (settings.bigTouchMode ? 'pb-8' : 'pb-6')
    )}>
      {/* 1. Header (Fixed Height) */}
      <header className={`w-full flex items-center justify-between ${settings.bigTouchMode ? 'px-8 h-20' : 'px-6 h-16'} flex-shrink-0 z-10 bg-system-background`}>
        {settings.backButtonPosition === 'top' ? (
          <button 
            onClick={onBack}
            className={`${settings.bigTouchMode ? 'w-14 h-14' : 'w-10 h-10'} -ml-2 flex items-center justify-center text-system-label hover:bg-secondary-system-background rounded-full transition-colors`}
          >
            <ChevronDown size={settings.bigTouchMode ? 32 : 28} />
          </button>
        ) : (
          <div className="w-10" />
        )}
        <div className="flex flex-col items-center">
          <h1 className={`font-bold uppercase tracking-[0.25em] text-system-secondary-label ${settings.bigTouchMode ? 'text-[10px]' : 'text-[9px]'}`}>
            {currentPlaylist ? currentPlaylist.name : 'Now Playing'}
          </h1>
          {currentPlaylist && (
            <span className="text-[8px] font-bold text-apple-blue mt-0.5 uppercase tracking-widest">{currentPosition}</span>
          )}
        </div>
        <button className={`${settings.bigTouchMode ? 'w-14 h-14' : 'w-10 h-10'} -mr-2 flex items-center justify-center text-system-label hover:bg-secondary-system-background rounded-full transition-colors`}>
          <MoreHorizontal size={settings.bigTouchMode ? 28 : 24} />
        </button>
      </header>

      {/* Main Container - Non-Scrolling flex column */}
      <main className="flex-1 flex flex-col items-center px-8 overflow-hidden">
        
        {/* 2. Visual Area (Flexible) */}
        <div className="flex-1 w-full flex items-center justify-center relative min-h-[200px] py-4">
          <AnimatePresence mode="wait">
            {settings.showArtwork ? (
              <motion.div 
                key="artwork"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: isPlaying ? 1 : 0.92 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  "aspect-square bg-apple-card rounded-[2.5rem] shadow-[0_24px_48px_rgba(0,0,0,0.12)] border border-apple-border overflow-hidden relative shadow-2xl transition-all duration-500",
                  settings.bigTouchMode ? 'w-full max-w-[320px]' : 'w-full max-w-[260px]'
                )}
              >
                <ArtworkImage 
                  src={artworkSrc} 
                  className="w-full h-full" 
                  iconSize={settings.bigTouchMode ? 120 : 100} 
                />
              </motion.div>
            ) : (
              <div key="waveform-holder" className="flex items-center justify-center h-full">
                <WaveformAnimation isPlaying={isPlaying} />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* 3, 4, 5. Title Area (Fixed Height to prevent shift) */}
        <div className={cn(
          "w-full flex flex-col items-center justify-center text-center flex-shrink-0 mb-6",
          settings.bigTouchMode ? "h-36" : "h-32"
        )}>
          <div className="w-full overflow-hidden mb-1">
            <h2 className={cn(
              "font-[900] tracking-tight text-system-label truncate px-2 transition-all duration-300",
              settings.bigTouchMode ? "text-3xl" : "text-2xl"
            )}>
              {trackName}
            </h2>
          </div>
          <div className="w-full overflow-hidden mb-4">
            <p className={cn(
              "text-system-secondary-label font-bold truncate px-2 transition-all duration-300",
              settings.bigTouchMode ? "text-lg" : "text-base"
            )}>
              {artistName}
            </p>
          </div>
          
          <button 
            onClick={() => setIsPanelOpen(true)}
            className={cn(
              "inline-flex items-center gap-2.5 bg-secondary-system-background hover:bg-secondary-system-background/80 rounded-full transition-all active:scale-95 border border-apple-border max-w-[90%] flex-shrink-0",
              settings.bigTouchMode ? 'px-6 py-3' : 'px-5 py-2'
            )}
          >
            <div className="flex gap-1 flex-shrink-0">
              {settings.subliminal.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-apple-blue" />}
              {settings.binaural.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
              {settings.nature.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
              {settings.noise.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
              {settings.didgeridoo.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-amber-800" />}
              {settings.pureHz.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
              {settings.isochronic.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
              {settings.solfeggio.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
              {settings.schumann.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              {settings.shamanic.isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-red-900" />}
            </div>
            <span className={cn("font-black uppercase tracking-wider text-system-secondary-label truncate", settings.bigTouchMode ? "text-[10px]" : "text-[8px]")}>
              {activeLayersLabel}
            </span>
          </button>
        </div>

        {/* 6, 7. Progress Area (Fixed Bottom Focus) */}
        <div className="w-full max-w-md flex-shrink-0 mb-8">
          <PlaybackControls settings={settings} seekTo={seekTo} />
        </div>

        {/* 8. Controls Area (Fixed Height Bottom) */}
        <div className={cn(
          "w-full flex items-center justify-between flex-shrink-0 mb-4",
          settings.bigTouchMode ? "px-2" : "px-0"
        )}>
          <button 
            onClick={() => updateSettings({ playbackMode: settings.playbackMode === 'once' ? 'loop' : 'once' })}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              settings.playbackMode === 'loop' ? 'text-apple-blue' : 'text-system-tertiary-label'
            )}
          >
            {settings.playbackMode === 'loop' ? <Repeat size={20} /> : <Repeat1 size={20} />}
            <span className="text-[7px] font-black uppercase tracking-widest leading-none">
              {settings.playbackMode === 'loop' ? 'Loop' : 'Once'}
            </span>
          </button>

          <div className="flex items-center gap-8">
            <button 
              onClick={() => userPlayPrevious()} 
              className="p-2 text-system-label active:scale-90 transition-all"
            >
              <SkipBack size={settings.bigTouchMode ? 40 : 32} fill="currentColor" stroke="none" />
            </button>
            
            <button 
              onClick={() => userTogglePlayback()}
              className={cn(
                "bg-system-label text-system-background rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all outline-none border-none",
                settings.bigTouchMode ? 'w-20 h-20' : 'w-16 h-16'
              )}
            >
              {isPlaying ? (
                <Pause size={settings.bigTouchMode ? 36 : 28} fill="currentColor" stroke="none" />
              ) : (
                <Play size={settings.bigTouchMode ? 36 : 28} fill="currentColor" stroke="none" className="ml-1" />
              )}
            </button>
            
            <button 
              onClick={() => userPlayNext()} 
              className="p-2 text-system-label active:scale-90 transition-all"
            >
              <SkipForward size={settings.bigTouchMode ? 40 : 32} fill="currentColor" stroke="none" />
            </button>
          </div>

          <button 
            onClick={() => toggleShuffle()}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              settings.shuffle ? 'text-orange-500' : 'text-system-tertiary-label'
            )}
          >
            <Shuffle size={20} />
            <span className="text-[7px] font-black uppercase tracking-widest leading-none">Shuf</span>
          </button>
        </div>
      </main>

      {/* Bottom Back Button Overlay (Fixed) */}
      {settings.backButtonPosition === 'bottom' && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-[50]">
          <button 
            onClick={onBack}
            className={`${settings.bigTouchMode ? 'w-16 h-16' : 'w-12 h-12'} bg-secondary-system-background border border-apple-border rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all text-system-label`}
          >
            <ChevronDown size={settings.bigTouchMode ? 32 : 24} />
          </button>
        </div>
      )}

      <AnimatePresence>
        {isPanelOpen && (
          <div className="fixed inset-0 z-[200]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPanelOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            />
            
            <motion.div 
              key="layer-panel"
              {...panelAnimationProps}
              transition={{ duration: settings.animationStyle === 'off' ? 0 : 0.4, ease: [0.32, 0.72, 0, 1] }}
              className={`absolute left-0 right-0 max-w-2xl mx-auto bg-system-background shadow-[0_-8px_40px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[85vh] z-[210] ${settings.hiddenLayersPosition === 'top' ? 'top-0 rounded-b-[3rem]' : 'bottom-0 rounded-t-[3rem]'}`}
            >
              <div className={`w-12 h-1 bg-secondary-system-background rounded-full mx-auto ${settings.hiddenLayersPosition === 'top' ? 'mt-6 mb-1' : 'mt-3 mb-1'}`} />
              
              <div className={`px-8 border-b border-apple-border flex items-center justify-between ${settings.bigTouchMode ? 'py-6' : 'py-4'}`}>
                <h3 className={`font-bold tracking-tight text-system-label ${settings.bigTouchMode ? 'text-2xl' : 'text-xl'}`}>Audio Layers</h3>
                <button 
                  onClick={() => setIsPanelOpen(false)}
                  className={`${settings.bigTouchMode ? 'w-12 h-12' : 'w-10 h-10'} -mr-2 flex items-center justify-center text-system-secondary-label hover:bg-secondary-system-background rounded-full`}
                >
                  <X size={24} />
                </button>
              </div>

              <div className={`flex-1 overflow-y-auto no-scrollbar pb-32 space-y-8 ${settings.bigTouchMode ? 'p-10' : 'p-6'}`}>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-system-secondary-label px-2">Quick Presets</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <PresetButton icon={Moon} label="Sleep" color="bg-apple-blue" onClick={() => applyPreset('sleep')} />
                    <PresetButton icon={Zap} label="Focus" color="bg-orange-500" onClick={() => applyPreset('focus')} />
                    <PresetButton icon={FocusIcon} label="Relax" color="bg-green-500" onClick={() => applyPreset('relax')} />
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => toggleGroup('layers')}
                    className="w-full flex items-center justify-between p-4 bg-secondary-system-background border border-apple-border rounded-2xl shadow-sm transition-all active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-apple-blue/10 text-apple-blue rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
                        <Ear size={20} />
                      </div>
                      <h3 className="text-sm font-black tracking-tight text-system-label">1. Audio Layers</h3>
                    </div>
                    <ChevronRight size={18} className={`text-system-tertiary-label transition-transform duration-300 ${expandedGroup === 'layers' ? 'rotate-90 text-apple-blue' : ''}`} />
                  </button>

                    <AnimatePresence>
                      {expandedGroup === 'layers' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden space-y-3 pt-1 px-1"
                        >
                          <AudioLayerLibrary />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => toggleGroup('playback')}
                    className="w-full flex items-center justify-between p-4 bg-secondary-system-background border border-apple-border rounded-2xl shadow-sm transition-all active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
                        <Repeat size={20} />
                      </div>
                      <h3 className="text-sm font-black tracking-tight text-system-label">2. Playback & Control</h3>
                    </div>
                    <ChevronRight size={18} className={`text-system-tertiary-label transition-transform duration-300 ${expandedGroup === 'playback' ? 'rotate-90 text-indigo-500' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {expandedGroup === 'playback' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pt-1"
                      >
                          <div className="bg-secondary-system-background border border-apple-border p-6 rounded-[2rem] flex flex-col gap-6">
                            <div className="space-y-4">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-system-secondary-label px-1">Playback Strategy</p>
                              <div className="bg-system-background p-1 rounded-2xl flex items-center h-10 border border-apple-border">
                                <button 
                                  onClick={() => updateSettings({ chunking: { ...settings.chunking, mode: 'heartbeat' } })}
                                  className={`flex-1 h-full rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${settings.chunking.mode === 'heartbeat' ? 'bg-secondary-system-background text-red-600 shadow-sm' : 'text-system-secondary-label'}`}
                                >
                                  Heartbeat
                                </button>
                                <button 
                                  onClick={() => updateSettings({ chunking: { ...settings.chunking, mode: 'merge' } })}
                                  className={`flex-1 h-full rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${settings.chunking.mode === 'merge' ? 'bg-secondary-system-background text-red-600 shadow-sm' : 'text-system-secondary-label'}`}
                                >
                                  Merge
                                </button>
                              </div>

                              {settings.chunking.mode === 'merge' && (
                                <div className="flex items-center justify-between px-2 pt-1">
                                  <span className="text-[9px] font-black text-system-secondary-label uppercase">Chunk Size</span>
                                  <select
                                    value={settings.chunking.sizeMinutes}
                                    onChange={(e) => updateSettings({ chunking: { ...settings.chunking, sizeMinutes: parseInt(e.target.value) } })}
                                    className="bg-system-background border border-apple-border rounded-lg text-[10px] font-black px-2 py-1 outline-none"
                                  >
                                    {[5, 10, 15, 20].map(mins => (
                                      <option key={mins} value={mins}>{mins} Min</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>

                            <div className="space-y-3 pt-2 border-t border-apple-border/30">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-system-secondary-label px-1">Loop Mode</p>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => updateSettings({ loop: settings.loop === 'all' ? 'none' : 'all' })}
                                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border transition-all ${settings.loop === 'all' ? 'bg-blue-500 border-blue-500 text-white shadow-md' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                                >
                                  <Repeat size={16} />
                                  <span className="text-[9px] font-black uppercase">Playlist</span>
                                </button>
                                <button 
                                  onClick={() => updateSettings({ loop: settings.loop === 'one' ? 'none' : 'one' })}
                                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border transition-all ${settings.loop === 'one' ? 'bg-blue-500 border-blue-500 text-white shadow-md' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                                >
                                  <Repeat1 size={16} />
                                  <span className="text-[9px] font-black uppercase">Single</span>
                                </button>
                                <button 
                                  onClick={() => toggleShuffle()}
                                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border transition-all ${settings.shuffle ? 'bg-orange-500 border-orange-500 text-white shadow-md' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                                >
                                  <Shuffle size={16} />
                                  <span className="text-[9px] font-black uppercase">Shuffle</span>
                                </button>
                              </div>
                              <div className="flex bg-secondary-system-background rounded-2xl p-1 border border-apple-border mt-1">
                                <button 
                                  onClick={() => updateSettings({ playbackMode: 'once' })}
                                  className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${settings.playbackMode === 'once' ? 'bg-system-background text-indigo-600 shadow-sm' : 'text-system-secondary-label'}`}
                                >
                                  Play Once
                                </button>
                                <button 
                                  onClick={() => updateSettings({ playbackMode: 'loop' })}
                                  className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${settings.playbackMode === 'loop' ? 'bg-system-background text-indigo-600 shadow-sm' : 'text-system-secondary-label'}`}
                                >
                                  Loop Playlist
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-col gap-3">
                              <button 
                                onClick={() => updateSettings({ displayAlwaysOn: !settings.displayAlwaysOn })}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${settings.displayAlwaysOn ? 'bg-amber-500/10 border-amber-500/20' : 'bg-system-background border-apple-border'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <Monitor size={16} className={settings.displayAlwaysOn ? 'text-amber-500' : 'text-system-secondary-label'} />
                                  <span className={`text-[10px] font-black uppercase tracking-tight ${settings.displayAlwaysOn ? 'text-amber-600' : 'text-system-label'}`}>Always ON</span>
                                </div>
                                <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.displayAlwaysOn ? 'bg-amber-500' : 'bg-system-tertiary-label'}`}>
                                  <motion.div className="absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full" animate={{ x: settings.displayAlwaysOn ? 16 : 0 }} />
                                </div>
                              </button>

                              <div className={`flex flex-col gap-4 p-4 rounded-2xl border transition-all ${settings.sleepTimer.isEnabled ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-system-background border-apple-border'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Moon size={16} className={settings.sleepTimer.isEnabled ? 'text-indigo-500' : 'text-system-secondary-label'} />
                                    <span className={`text-[10px] font-black uppercase tracking-tight ${settings.sleepTimer.isEnabled ? 'text-indigo-600' : 'text-system-label'}`}>Sleep Timer</span>
                                  </div>
                                  <button 
                                    onClick={() => updateSleepTimer({ isEnabled: !settings.sleepTimer.isEnabled, remainingSeconds: !settings.sleepTimer.isEnabled ? settings.sleepTimer.minutes * 60 : null })}
                                    className={`w-8 h-4 rounded-full relative transition-colors ${settings.sleepTimer.isEnabled ? 'bg-indigo-500' : 'bg-system-tertiary-label'}`}
                                  >
                                    <motion.div className="absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full" animate={{ x: settings.sleepTimer.isEnabled ? 16 : 0 }} />
                                  </button>
                                </div>
                                <div className="flex items-center gap-3">
                                  <input 
                                    type="number" value={settings.sleepTimer.minutes}
                                    onChange={(e) => updateSleepTimer({ minutes: Math.max(1, parseInt(e.target.value) || 1) })}
                                    className="w-16 h-8 bg-system-background rounded-lg border-none text-[11px] font-black text-center focus:ring-1 focus:ring-indigo-500"
                                  />
                                  <span className="text-[9px] font-bold text-system-secondary-label uppercase">Min</span>
                                  {settings.sleepTimer.isEnabled && settings.sleepTimer.remainingSeconds !== null && (
                                    <span className="ml-auto text-[10px] font-black text-indigo-500 tabular-nums">
                                      {Math.floor(settings.sleepTimer.remainingSeconds / 60)}:{(settings.sleepTimer.remainingSeconds % 60).toString().padStart(2, '0')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-3">
                   <button 
                    onClick={() => toggleGroup('tools')}
                    className="w-full flex items-center justify-between p-4 bg-secondary-system-background border border-apple-border rounded-2xl shadow-sm transition-all active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-apple-blue/10 text-apple-blue rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
                        <Sliders size={20} />
                      </div>
                      <h3 className="text-sm font-black tracking-tight text-system-label">3. Audio Tools</h3>
                    </div>
                    <ChevronRight size={18} className={`text-system-tertiary-label transition-transform duration-300 ${expandedGroup === 'tools' ? 'rotate-90 text-apple-blue' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {expandedGroup === 'tools' && (
                       <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pt-1"
                       >
                          <div className="bg-secondary-system-background border border-apple-border p-6 rounded-[2rem] flex flex-col gap-6">
                              <div className="space-y-4">
                                 <div className="flex justify-between items-center px-1">
                                    <div className="flex flex-col">
                                       <span className="text-[10px] font-black text-system-label uppercase tracking-widest">Master Gain (dB)</span>
                                       <span className="text-[9px] font-bold text-apple-blue">{settings.audioTools.gainDb} dB</span>
                                    </div>
                                    <input 
                                       type="number"
                                       value={settings.audioTools.gainDb}
                                       onChange={(e) => updateAudioTools({ gainDb: Math.min(0, Math.max(-60, parseInt(e.target.value) || 0)) })}
                                       className="w-12 h-6 bg-system-background border border-apple-border rounded-md text-[10px] font-black text-center"
                                    />
                                 </div>
                                 <input 
                                    type="range" min={-60} max={0} step={1} value={settings.audioTools.gainDb}
                                    onChange={(e) => updateAudioTools({ gainDb: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-apple-border rounded-full appearance-none accent-system-label"
                                 />
                              </div>

                              <div className="flex items-center justify-between p-4 bg-system-background rounded-2xl border border-apple-border">
                                 <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-system-label uppercase tracking-widest">Always play in background</span>
                                    <span className="text-[9px] font-bold text-system-secondary-label">Recommended for iOS stability</span>
                                 </div>
                                 <button 
                                    onClick={() => updateAudioTools({ playInBackground: !settings.audioTools.playInBackground })}
                                    className={`w-10 h-6 rounded-full relative transition-colors ${settings.audioTools.playInBackground ? 'bg-apple-blue' : 'bg-system-tertiary-label'}`}
                                 >
                                    <motion.div className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full" animate={{ x: settings.audioTools.playInBackground ? 16 : 0 }} />
                                 </button>
                              </div>

                              <div className="flex items-center justify-between p-4 bg-system-background rounded-2xl border border-apple-border">
                                 <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-system-label uppercase tracking-widest">Master Normalization</span>
                                    <span className="text-[9px] font-bold text-system-secondary-label">{settings.audioTools.normalizeTargetDb !== null ? `Peak ${settings.audioTools.normalizeTargetDb}dB` : 'Off'}</span>
                                 </div>
                                 <button 
                                    onClick={() => updateAudioTools({ normalizeTargetDb: settings.audioTools.normalizeTargetDb === null ? -10 : null })}
                                    className={`w-10 h-6 rounded-full relative transition-colors ${settings.audioTools.normalizeTargetDb !== null ? 'bg-apple-blue' : 'bg-system-tertiary-label'}`}
                                 >
                                    <motion.div className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full" animate={{ x: settings.audioTools.normalizeTargetDb !== null ? 16 : 0 }} />
                                 </button>
                              </div>

                              <div className="space-y-3">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-system-secondary-label px-1">Global Playback Speed</p>
                                <div className="flex gap-2">
                                  {[1, 1.5, 2, 2.5].map(rate => (
                                    <button
                                      key={rate}
                                      onClick={() => updateSettings({ playbackRate: rate })}
                                      className={`flex-1 py-3 rounded-2xl text-[10px] font-black transition-all border ${settings.playbackRate === rate ? 'bg-system-label text-system-background border-system-label shadow-sm' : 'bg-system-background text-system-secondary-label border-apple-border'}`}
                                    >
                                      {rate}x
                                    </button>
                                  ))}
                                </div>
                              </div>
                          </div>
                       </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
