import { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react';

interface LayerProgress {
  currentTime: number;
  duration: number;
}

interface PlaybackContextType {
  currentTime: number;
  duration: number;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  // Progress normalized (0-100)
  progress: number;
  layerProgress: Record<string, LayerProgress>;
  updateLayerProgress: (layerId: string, progress: LayerProgress) => void;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [currentTime, setCurrentTimeState] = useState(0);
  const [duration, setDurationState] = useState(0);
  const [layerProgress, setLayerProgress] = useState<Record<string, LayerProgress>>({});
  
  // Throttle updates for performance
  const lastUpdateRef = useRef<number>(0);
  
  const setCurrentTime = useCallback((time: number) => {
    const now = Date.now();
    if (now - lastUpdateRef.current > 100 || Math.abs(time - currentTime) > 1) {
      setCurrentTimeState(time);
      lastUpdateRef.current = now;
    }
  }, [currentTime]);

  const setDuration = useCallback((d: number) => {
    setDurationState(d);
  }, []);

  const updateLayerProgress = useCallback((layerId: string, progress: LayerProgress) => {
    setLayerProgress(prev => {
      // Small optimization: only update if changed significantly
      const current = prev[layerId];
      if (current && Math.abs(current.currentTime - progress.currentTime) < 0.2) {
        return prev;
      }
      return { ...prev, [layerId]: progress };
    });
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <PlaybackContext.Provider value={{
      currentTime,
      duration,
      setCurrentTime,
      setDuration,
      progress,
      layerProgress,
      updateLayerProgress
    }}>
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const context = useContext(PlaybackContext);
  if (context === undefined) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
}
