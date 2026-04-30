import { useAudio } from '../AudioContext';
import { useSettings } from '../SettingsContext';
import { usePlayback } from '../PlaybackContext';
import { Play, Pause, SkipForward, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { ArtworkImage } from '../components/ArtworkImage';

interface MiniPlayerProps {
  onExpand: () => void;
}

export default function MiniPlayer({ onExpand }: MiniPlayerProps) {
  const { currentTrackIndex, isPlaying, userTogglePlayback, currentPlaybackList } = useAudio();
  const { settings } = useSettings();
  
  const hasAnyLayerEnabled = settings.subliminal.isEnabled || 
                             settings.binaural.isEnabled || 
                             settings.nature.isEnabled || 
                             settings.noise.isEnabled || 
                             settings.didgeridoo.isEnabled || 
                             settings.pureHz.isEnabled || 
                             settings.isochronic.isEnabled || 
                             settings.solfeggio.isEnabled;

  const currentTrack = currentTrackIndex !== null ? currentPlaybackList[currentTrackIndex] : null;

  if (!currentTrack && !hasAnyLayerEnabled) return null;

  const trackName = currentTrack?.name || "Zen Session";
  const artistName = currentTrack?.artist || "Ambient Layers Active";
  const artworkSrc = currentTrack?.artwork || "";

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className={`fixed ${settings.miniMode ? 'bottom-20' : 'bottom-28'} left-4 right-4 z-40`}
      onClick={onExpand}
    >
      <div className="bg-secondary-system-background/80 backdrop-blur-2xl border-none shadow-sm rounded-xl p-2 flex flex-col gap-1 active:scale-[0.98] transition-transform overflow-hidden relative">
        <div className="flex items-center gap-3">
          {/* Artwork */}
          <div className="w-10 h-10 rounded-lg bg-system-background flex-shrink-0 overflow-hidden shadow-inner-sm">
            <ArtworkImage src={artworkSrc} className="w-full h-full" iconSize={16} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="text-[13px] font-bold text-system-label truncate tracking-tight">{trackName}</h4>
            <p className="text-[11px] font-medium text-system-secondary-label truncate mt-0.5">{artistName}</p>
          </div>

          {/* Controls */}
          <div className="flex items-center pr-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                userTogglePlayback();
              }}
              className="w-10 h-10 flex items-center justify-center text-system-label active:opacity-50 transition-opacity"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" stroke="none" /> : <Play size={20} fill="currentColor" stroke="none" />}
            </button>
          </div>
        </div>
        
        {/* Progress Bar (Isolated) */}
        <MiniProgressBar />
      </div>
    </motion.div>
  );
}

function MiniProgressBar() {
  const { progress } = usePlayback();
  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-system-tertiary-label/10">
      <motion.div 
        className="h-full bg-apple-blue"
        initial={false}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: "linear" }}
      />
    </div>
  );
}
