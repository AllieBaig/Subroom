import { useState, useEffect, useMemo } from 'react';
import { AudioProvider } from './AudioContext';
import { PlaybackProvider } from './PlaybackContext';
import { SettingsProvider, useSettings } from './SettingsContext';
import { UIStateProvider, useUIState } from './UIStateContext';
import AudioEngine from './components/AudioEngine';
import OfflineIndicator from './components/OfflineIndicator';
import TabBar from './components/TabBar';
import LibraryView from './views/LibraryView';
import PlayerView from './views/PlayerView';
import SearchView from './views/SearchView';
import SettingsView from './views/SettingsView';
import MiniPlayer from './components/MiniPlayer';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, AlertCircle, RefreshCcw, ArrowLeft } from 'lucide-react';
import { GlobalSafetyManager, LoadingPlaceholder } from './components/Safety';
import { AnimationStyle } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ModalProvider } from './components/SafeModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function AppContent() {
  const { activeTab, setActiveTab, isLoading, initError, toast, swStatus, showToast, isOffline, activeTabRequest, clearTabRequest } = useUIState();
  const { settings } = useSettings();
  
  useEffect(() => {
    if (activeTabRequest) {
      setActiveTab(activeTabRequest as any);
      clearTabRequest();
    }
  }, [activeTabRequest, clearTabRequest, setActiveTab]);

  // Handle SW updates
  useEffect(() => {
    if (swStatus === 'waiting') {
      showToast("Update Ready: Reload to apply");
    }
  }, [swStatus, showToast]);

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

  const animationProps = useMemo(() => getAnimationProps(settings.animationStyle), [settings.animationStyle]);

  return (
    <div 
      className={`fixed inset-0 bg-system-background overflow-hidden flex flex-col pt-safe select-none h-[100dvh] transition-[padding,background] duration-500 ease-in-out ${settings.miniMode ? 'p-1' : ''} ${settings.bigTouchMode ? 'big-touch-mode' : ''}`}
    >
      <div className="flex-1 w-full max-w-[1400px] mx-auto relative overflow-hidden">
        <AudioEngine />
        <OfflineIndicator />
        
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className={cn(
                "fixed left-1/2 -translate-x-1/2 z-[200] bg-system-label text-system-background px-6 py-3 rounded-2xl text-xs font-bold shadow-2xl border border-apple-border/10 backdrop-blur-xl",
                settings.menuPosition === 'bottom' ? 'bottom-32 pb-safe' : 'top-28 pt-safe'
              )}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
        
        <main className="absolute inset-0 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex-1 px-4 flex items-center justify-center">
              <LoadingPlaceholder />
            </div>
          ) : initError ? (
            <div className="flex-1 flex items-center justify-center px-6">
              <div className={`w-full max-w-sm bg-secondary-system-background ${settings.miniMode ? 'rounded-2xl p-6' : 'rounded-[2.5rem] p-8'} border border-apple-border shadow-2xl text-center`}>
                <div className="w-16 h-16 bg-amber-100/10 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <AlertCircle size={32} />
                </div>
                <h2 className="text-xl font-black mb-2 text-system-label">Startup Error</h2>
                <p className="text-system-secondary-label text-sm mb-8 font-bold leading-relaxed">{initError}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full bg-system-label text-system-background h-14 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <RefreshCcw size={18} />
                  <span>Retry System</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 relative ios-scroll-area no-scrollbar">
              {/* Layout Specific Padding for Content Area */}
              <div className={cn(
                "min-h-full w-full max-w-7xl mx-auto flex flex-col",
                settings.menuPosition === 'top' ? 'pt-28 pb-40' : 'pt-10 pb-64'
              )}>
                {/* Main Tab Views Stacked */}
                <div className="flex-1 relative w-full h-full">
                  {/* Library View */}
                  <div className={cn(
                    "w-full h-full transition-opacity duration-300",
                    activeTab === 'library' ? 'relative opacity-100' : 'absolute inset-0 opacity-0 pointer-events-none'
                  )}>
                    <LibraryView />
                  </div>

                  {/* Search View */}
                  <div className={cn(
                    "w-full h-full transition-opacity duration-300",
                    activeTab === 'search' ? 'relative opacity-100' : 'absolute inset-0 opacity-0 pointer-events-none'
                  )}>
                    <SearchView />
                  </div>
                </div>
              </div>

              {/* Overlays (Sheets) */}
              <AnimatePresence>
                {activeTab === 'player' && (
                  <motion.div
                    key="player"
                    {...animationProps}
                    transition={{ duration: settings.animationStyle === 'off' ? 0 : 0.4, ease: [0.32, 0.72, 0, 1] }}
                    className="fixed inset-0 z-[300] bg-system-background ios-scroll-area no-scrollbar safe-area-bottom"
                  >
                    <PlayerView onBack={() => setActiveTab('library')} />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {activeTab === 'settings' && (
                  <motion.div
                    key="settings"
                    {...animationProps}
                    transition={{ duration: settings.animationStyle === 'off' ? 0 : 0.4, ease: [0.32, 0.72, 0, 1] }}
                    className="fixed inset-0 z-[310] bg-system-background ios-scroll-area no-scrollbar"
                  >
                    <div className="w-full px-6 py-12 pb-40 safe-area-top">
                      <div className="w-full max-w-7xl mx-auto flex items-center justify-between mb-10">
                        {settings.backButtonPosition === 'top' ? (
                          <button 
                            onClick={() => setActiveTab('library')}
                            className="w-12 h-12 bg-secondary-system-background border border-apple-border rounded-full flex items-center justify-center active:scale-95 transition-transform text-system-label"
                          >
                            <ArrowLeft size={20} />
                          </button>
                        ) : (
                          <div className="w-12 h-12" />
                        )}
                        <h2 className="text-xl font-black tracking-tight text-system-label">Settings</h2>
                        <div className="w-12 h-12" />
                      </div>
                      <SettingsView onBack={() => setActiveTab('library')} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mini Player */}
              <AnimatePresence>
                {activeTab !== 'player' && activeTab !== 'settings' && (
                  <div className={cn(
                    "fixed left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-[90] transition-all duration-500",
                    settings.menuPosition === 'bottom' 
                      ? (activeTab === 'library' && settings.libraryControlsPosition === 'bottom' ? 'bottom-48 mb-safe' : 'bottom-28 mb-safe') 
                      : 'bottom-10 mb-safe'
                  )}>
                    <MiniPlayer onExpand={() => setActiveTab('player')} />
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
        </main>
        
        {!isLoading && !initError && (
          <div className={cn(
            "fixed left-0 right-0 py-4 bg-system-background/80 backdrop-blur-2xl px-4 flex items-center justify-center z-[400] transition-all",
            settings.menuPosition === 'top' ? "top-0 border-b border-apple-border/5 pt-safe mt-safe" : "bottom-0 border-t border-apple-border/5 pb-safe mb-safe"
          )}>
            <div className="w-full max-w-md">
              <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <GlobalSafetyManager>
      <ModalProvider>
        <SettingsProvider>
          <UIStateProvider>
            <AudioProvider>
              <PlaybackProvider>
                <AppContent />
              </PlaybackProvider>
            </AudioProvider>
          </UIStateProvider>
        </SettingsProvider>
      </ModalProvider>
    </GlobalSafetyManager>
  );
}
