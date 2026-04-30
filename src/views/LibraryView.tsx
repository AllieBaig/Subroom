import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useAudio } from '../AudioContext';
import { useSettings } from '../SettingsContext';
import { useUIState } from '../UIStateContext';
import { 
  Upload, Plus, Trash2, Share, SortAsc, 
  LayoutGrid, List, Calendar, CheckCircle2, 
  Circle, X, FolderPlus, ListPlus, Zap,
  AlertCircle, Link, ArrowLeft, MoreVertical, Edit2, Check,
  Play, Pause, Search, ChevronRight
} from 'lucide-react';
import { Track, SortOption, GroupOption } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { AUDIO_ACCEPT_STRING, SUPPORTED_AUDIO_FORMATS } from '../constants';
import { useModal } from '../components/SafeModal';

import { ArtworkImage } from '../components/ArtworkImage';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function LibraryView() {
  const modal = useModal();
  const { 
    tracks, 
    addTrack, 
    removeTrack, 
    setCurrentTrackIndex, 
    setIsPlaying, 
    currentTrackIndex, 
    playlists,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    addTracksToPlaylist,
    removeTracksFromPlaylist,
    relinkTrack,
    renamePlaylist,
    playingPlaylistId,
    setPlayingPlaylistId,
    resumePlaylist,
    isPlaying,
    userPlayTrack,
    currentPlaybackList
  } = useAudio();

  const { settings, updateLibrarySettings, updateSubliminalSettings } = useSettings();
  const { showToast, navigateTo } = useUIState();

  const [view, setView] = useState<'tracks' | 'playlists' | 'playlist_detail'>('tracks');
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [showBulkAddMenu, setShowBulkAddMenu] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'add' | 'move'>('add');
  const [playlistSort, setPlaylistSort] = useState<'none' | 'recent' | 'alphabetical' | 'date'>('none');
  const [showPlaylistSettings, setShowPlaylistSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportTargetMenu, setShowImportTargetMenu] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const handleCreatePlaylist = async (initialTrackIds: string[] = []) => {
    const name = await modal.prompt({
      title: "New Playlist",
      subtitle: "Enter a name for your collection",
      placeholder: "Playlist Name",
      confirmLabel: "Create"
    });
    if (name) {
      const pid = await createPlaylist(name, initialTrackIds);
      return pid;
    }
    return null;
  };

  const handleRenamePlaylist = async (id: string, currentName: string) => {
    const name = await modal.prompt({
      title: "Rename Playlist",
      subtitle: "Enter a new name for this playlist",
      initialValue: currentName,
      confirmLabel: "Save"
    });
    if (name) {
      await renamePlaylist(id, name);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      if (playlists.length > 0) {
        setPendingFiles(filesArray);
        setShowImportTargetMenu(true);
      } else {
        for (const file of filesArray) {
          await addTrack(file);
        }
      }
    }
  };

  const processImport = async (targetPlaylistId?: string) => {
    let pid = targetPlaylistId;
    if (targetPlaylistId === 'new') {
      pid = (await handleCreatePlaylist()) || undefined;
      if (!pid) return; // Cancelled
    }

    for (const file of pendingFiles) {
      await addTrack(file, pid);
    }
    setPendingFiles([]);
    setShowImportTargetMenu(false);
    if (pid && pid !== 'new') {
      setActivePlaylistId(pid);
      setView('playlist_detail');
    }
  };

  const toggleSelectAll = (ids: string[]) => {
    const allSelected = ids.every(id => selectedTrackIds.has(id));
    const next = new Set(selectedTrackIds);
    if (allSelected) {
      ids.forEach(id => next.delete(id));
    } else {
      ids.forEach(id => next.add(id));
    }
    setSelectedTrackIds(next);
  };

  const toggleTrackSelection = useCallback((id: string) => {
    setSelectedTrackIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sortedTracks = useMemo(() => {
    let sorted = [...tracks];
    const { sort } = settings.library;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      sorted = sorted.filter(t => 
        t.name.toLowerCase().includes(q) || 
        (t.artist && t.artist.toLowerCase().includes(q))
      );
    }

    if (sort === 'alphabetical') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'date' || sort === 'recent') {
      sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return sorted;
  }, [tracks, settings.library.sort, searchQuery]);

  const groupedTracks = useMemo(() => {
    const { group, groupByMinutes } = settings.library;
    
    const groups: { [key: string]: Track[] } = {};
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const minMs = 60 * 1000;

    sortedTracks.forEach(track => {
      let label = 'Other';
      const diff = now - (track.createdAt || 0);
      const diffMins = Math.floor(diff / minMs);
      
      // Check if it's recently played (last 24h)
      const isRecentlyPlayed = track.lastPlayedAt && (now - track.lastPlayedAt < dayMs);

      if (isRecentlyPlayed) {
        label = 'Recently Played';
      } else if ((groupByMinutes && diffMins < 20) || group === 'minutes') {
        if (diffMins < 5) label = 'Last 5 mins';
        else if (diffMins < 10) label = 'Last 10 mins';
        else if (diffMins < 15) label = 'Last 15 mins';
        else if (diffMins < 20) label = 'Last 20 mins';
        else if (group === 'minutes') label = 'Earlier';
        else {
          applyNormalGrouping();
        }
      } else {
        applyNormalGrouping();
      }

      function applyNormalGrouping() {
        if (group === 'none') {
          label = '';
        } else if (group === 'alphabetical') {
          const firstChar = track.name[0]?.toUpperCase() || '#';
          if (/[A-Z]/.test(firstChar)) label = firstChar;
          else if (/[0-9]/.test(firstChar)) label = '0-9';
          else label = '#';
        } else if (group === 'numbers') {
          const firstChar = track.name[0];
          if (/[0-9]/.test(firstChar)) label = '0-9';
          else label = 'Other';
        } else if (group === 'day') {
          if (diff < dayMs) label = 'Today';
          else if (diff < 2 * dayMs) label = 'Yesterday';
          else label = new Date(track.createdAt).toLocaleDateString(undefined, { weekday: 'long' });
        } else if (group === 'week') {
          if (diff < 7 * dayMs) label = 'This Week';
          else label = 'Earlier';
        } else if (group === 'month') {
          label = new Date(track.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        }
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(track);
    });

    const entries = Object.entries(groups);
    const timeLabels = ['Recently Played', 'Last 5 mins', 'Last 10 mins', 'Last 15 mins', 'Last 20 mins'];
    
    entries.sort(([a], [b]) => {
      // Time labels always first
      const aIdx = timeLabels.indexOf(a);
      const bIdx = timeLabels.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;

      if (group === 'alphabetical') {
        if (a === '#') return 1;
        if (b === '#') return -1;
        if (a === '0-9') return 1;
        if (b === '0-9') return -1;
        return a.localeCompare(b);
      }
      
      if (group === 'minutes' && (a === 'Earlier' || b === 'Earlier')) {
        return a === 'Earlier' ? 1 : -1;
      }

      return 0; // Maintain sortedTracks order
    });

    return entries.map(([label, items]) => ({ label, items }));
  }, [sortedTracks, settings.library.group, settings.library.groupByMinutes]);

  const handleBulkAddToPlaylist = async (pid: string) => {
    const ids = Array.from(selectedTrackIds);
    const targetPlaylistId = editingPlaylistId || activePlaylistId;
    
    if (bulkActionType === 'move' && targetPlaylistId) {
      await addTracksToPlaylist(ids, pid);
      await removeTracksFromPlaylist(ids, targetPlaylistId);
      showToast(`Moved ${ids.length} tracks to "${playlists.find(p => p.id === pid)?.name}"`);
    } else {
      await addTracksToPlaylist(ids, pid);
    }
    
    setIsSelectMode(false);
    setSelectedTrackIds(new Set());
    setEditingPlaylistId(null);
    setShowBulkAddMenu(false);
  };

  const handleBulkRemoveFromPlaylist = async () => {
    const targetPlaylistId = editingPlaylistId || activePlaylistId;
    if (!targetPlaylistId) return;
    
    const ids = Array.from(selectedTrackIds);
    const pName = playlists.find(p => p.id === targetPlaylistId)?.name;
    
    if (await modal.confirm({
      title: "Remove Tracks",
      subtitle: `Remove ${ids.length} tracks from "${pName}"?`,
      confirmLabel: "Remove",
      isDestructive: true
    })) {
      await removeTracksFromPlaylist(ids, targetPlaylistId);
      setIsSelectMode(false);
      setSelectedTrackIds(new Set());
      setEditingPlaylistId(null);
      showToast(`Removed ${ids.length} tracks from selection`);
    }
  };

  const handleBulkCreatePlaylist = async () => {
    await handleCreatePlaylist(Array.from(selectedTrackIds));
    setIsSelectMode(false);
    setSelectedTrackIds(new Set());
  };

  const sortedPlaylists = useMemo(() => {
    let list = [...playlists];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    
    if (playlistSort === 'alphabetical') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (playlistSort === 'date' || playlistSort === 'recent') {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return list;
  }, [playlists, searchQuery, playlistSort]);

  const controls = (
    <div className={cn(
      "flex items-center gap-2",
      settings.libraryControlsPosition === 'bottom' && "px-4 py-3 bg-system-background/80 backdrop-blur-2xl border-t border-apple-border fixed bottom-[83px] left-0 right-0 z-[110] safe-area-bottom shadow-[0_-10px_30px_rgba(0,0,0,0.03)]"
    )}>
      {(view === 'tracks' || view === 'playlists') && (view === 'tracks' ? tracks.length > 0 : playlists.length > 0) && (
        <>
          <button 
            onClick={() => setShowSortMenu(!showSortMenu)}
            className={cn(
              "p-2 rounded-full transition-all",
              showSortMenu ? 'bg-apple-blue/10 text-apple-blue' : 'text-system-tertiary-label',
              settings.libraryControlsPosition === 'bottom' && "flex-1 flex justify-center bg-secondary-system-background h-11 items-center rounded-2xl"
            )}
          >
            <div className="flex items-center gap-2">
              <SortAsc size={20} />
              {settings.libraryControlsPosition === 'bottom' && <span className="text-[10px] font-black uppercase tracking-widest">Sort</span>}
            </div>
          </button>
          <button 
            onClick={() => {
              if (view === 'playlists') setView('tracks'); // Transition to tracks to allow select
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedTrackIds(new Set());
            }}
            className={cn(
              "text-[13px] font-bold px-4 py-1.5 rounded-full transition-all",
              isSelectMode ? 'bg-apple-blue text-white' : 'text-apple-blue',
              settings.libraryControlsPosition === 'bottom' && "flex-1 flex justify-center bg-secondary-system-background h-11 items-center rounded-2xl"
            )}
          >
            {isSelectMode ? 'Cancel' : 'Select'}
          </button>
        </>
      )}
      {!isSelectMode && (
        <label className={cn(
          "flex items-center justify-center cursor-pointer active:scale-95 transition-transform",
          settings.libraryControlsPosition === 'bottom' ? "w-auto flex-1 bg-apple-blue text-white h-11 rounded-2xl shadow-sm" : "w-10 h-10 rounded-full"
        )}>
          <div className="flex items-center gap-2">
            <Plus size={settings.libraryControlsPosition === 'bottom' ? 20 : 24} className={settings.libraryControlsPosition === 'bottom' ? "text-white" : "text-apple-blue"} />
            {settings.libraryControlsPosition === 'bottom' && <span className="text-[10px] font-black uppercase tracking-widest">Import</span>}
          </div>
          <input type="file" multiple accept={AUDIO_ACCEPT_STRING} className="hidden" onChange={handleFileUpload} />
        </label>
      )}
    </div>
  );

  return (
    <div className={cn(
      "flex flex-col w-full max-w-7xl mx-auto px-4 pb-40",
      settings.libraryControlsPosition === 'bottom' && "pt-6"
    )}>
      <header className="flex flex-col bg-system-background pb-6 gap-8">
        <div className="flex justify-between items-center px-1">
          <h1 className="text-3xl font-[900] tracking-tight text-system-label flex items-center gap-3">
            Library
            {isSelectMode && selectedTrackIds.size > 0 && (
              <span className="text-sm font-bold text-apple-blue bg-apple-blue/5 px-3 py-1 rounded-full animate-in fade-in zoom-in duration-300">
                {selectedTrackIds.size} Selected
              </span>
            )}
          </h1>
          {settings.libraryControlsPosition === 'top' && controls}
        </div>

        <div className="flex gap-6 px-1">
          <button 
            onClick={() => { setView('tracks'); setIsSelectMode(false); setSelectedTrackIds(new Set()); setEditingPlaylistId(null); setActivePlaylistId(null); }}
            className={`text-[15px] font-[800] transition-opacity ${view === 'tracks' ? 'text-apple-blue opacity-100' : 'text-system-tertiary-label opacity-60 hover:opacity-100'}`}
          >
            Tracks
          </button>
          <button 
            onClick={() => { setView('playlists'); setIsSelectMode(false); setSelectedTrackIds(new Set()); setEditingPlaylistId(null); setActivePlaylistId(null); }}
            className={`text-[15px] font-[800] transition-opacity ${view === 'playlists' || view === 'playlist_detail' ? 'text-apple-blue opacity-100' : 'text-system-tertiary-label opacity-60 hover:opacity-100'}`}
          >
            Playlists
          </button>
        </div>
      </header>

      {settings.libraryControlsPosition === 'bottom' && !isSelectMode && (
        <div className="z-[110]">
          {controls}
        </div>
      )}

      {showSortMenu && (view === 'tracks' || view === 'playlists') && !isSelectMode && (
        <div className={`bg-apple-card border border-apple-border flex flex-col shadow-sm animate-in fade-in slide-in-from-top-2 mx-2 mb-6 ${settings.miniMode ? 'rounded-2xl p-3 gap-3' : 'rounded-3xl p-4 gap-4'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-system-secondary-label">Sort {view === 'tracks' ? 'Tracks' : 'Playlists'}</span>
            <div className="flex bg-secondary-system-background rounded-xl p-1">
              {(['recent', 'alphabetical', 'date'] as SortOption[]).map(s => (
                <button
                  key={s}
                  onClick={() => view === 'tracks' ? updateLibrarySettings({ sort: s }) : setPlaylistSort(s)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${(view === 'tracks' ? settings.library.sort : playlistSort) === s ? 'bg-system-background shadow-sm text-apple-blue' : 'text-system-secondary-label'}`}
                >
                  {s === 'recent' ? 'Recent' : s === 'alphabetical' ? 'A-Z' : 'Date'}
                </button>
              ))}
            </div>
          </div>
          {view === 'tracks' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-system-secondary-label">Group Tracks</span>
                <div className="flex bg-secondary-system-background rounded-xl p-1 overflow-x-auto no-scrollbar max-w-[70%]">
                  {(['none', 'alphabetical', 'numbers', 'minutes', 'day', 'week', 'month'] as GroupOption[]).map(g => (
                    <button
                      key={g}
                      onClick={() => updateLibrarySettings({ group: g })}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap ${settings.library.group === g ? 'bg-system-background shadow-sm text-apple-blue' : 'text-system-secondary-label'}`}
                    >
                      {g === 'minutes' ? 'Minutes' : g === 'numbers' ? '0-9' : g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              <button 
                onClick={() => updateLibrarySettings({ groupByMinutes: !settings.library.groupByMinutes })}
                className="flex items-center justify-between px-2"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-system-secondary-label">Auto Group Recent Imports</span>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.library.groupByMinutes ? 'bg-apple-blue' : 'bg-system-tertiary-label'}`}>
                  <motion.div className="absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full" animate={{ x: settings.library.groupByMinutes ? 16 : 0 }} />
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'playlist_detail' && activePlaylistId ? (
        <div className="ios-fixed-layer z-[120] flex flex-col ios-scroll-area no-scrollbar pb-32">
           <PlaylistDetailView 
            playlist={playlists.find(p => p.id === activePlaylistId)!}
            tracks={tracks}
            onBack={() => {
              setView('playlists');
              setActivePlaylistId(null);
              setIsSelectMode(false);
              setSelectedTrackIds(new Set());
            }}
            onTrackPlay={(id) => {
              const p = playlists.find(p => p.id === activePlaylistId);
              if (p) {
                const idx = p.trackIds.findIndex(tid => tid === id);
                if (idx !== -1) {
                  userPlayTrack(idx, activePlaylistId);
                  navigateTo('player');
                }
              }
            }}
            onRename={(id, name) => renamePlaylist(id, name)}
            onDelete={(id) => {
              deletePlaylist(id);
              setView('playlists');
            }}
            onRemoveTrack={(tid: string) => removeTracksFromPlaylist([tid], activePlaylistId!)}
            onAddToPlaylist={addTrackToPlaylist}
            isSelectMode={isSelectMode}
            onEnterSelect={(val: boolean) => setIsSelectMode(val)}
            selectedTrackIds={selectedTrackIds}
            onToggleSelection={(tid) => toggleTrackSelection(tid)}
            sort={playlistSort}
            onSort={setPlaylistSort}
            showSettings={showPlaylistSettings}
            onToggleSettings={() => setShowPlaylistSettings(!showPlaylistSettings)}
            playlists={playlists}
            settings={settings}
            resumePlaylist={resumePlaylist}
            playingPlaylistId={playingPlaylistId}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
          />
        </div>
      ) : view === 'tracks' ? (
        tracks.length === 0 ? (
          <EmptyState onFileUpload={handleFileUpload} />
        ) : sortedTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 px-12 text-center gap-4">
             <div className="w-16 h-16 bg-secondary-system-background rounded-2xl flex items-center justify-center text-system-tertiary-label">
                <Search size={32} />
             </div>
             <p className="text-sm font-medium text-system-secondary-label">No tracks found matching "{searchQuery}"</p>
             <button 
               onClick={() => setSearchQuery('')}
               className="text-xs font-bold text-apple-blue uppercase tracking-widest"
             >
               Clear Search
             </button>
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 ${isSelectMode ? 'pb-32' : 'pb-8'} mt-4`}>
            {groupedTracks.map((group, gIdx) => (
              <div key={gIdx} className="flex flex-col gap-2 relative">
                {group.label && (
                  <button 
                    onClick={() => toggleSelectAll(group.items.map(t => t.id))}
                    className="flex items-center justify-between py-2 -mx-2 px-2 hover:bg-gray-50 transition-colors rounded-xl group/header"
                  >
                    <h3 className="text-[11px] font-bold uppercase tracking-[.25em] text-apple-text-secondary group-hover/header:text-apple-blue transition-colors">
                      {group.label}
                    </h3>
                    <div className="flex items-center gap-3">
                      {isSelectMode && (
                        <span className="text-[10px] font-bold text-apple-blue uppercase tracking-widest bg-apple-blue/5 px-2 py-0.5 rounded-full">
                          {group.items.filter(t => selectedTrackIds.has(t.id)).length}/{group.items.length}
                        </span>
                      )}
                      <span className="opacity-0 group-hover/header:opacity-100 text-[9px] font-bold text-apple-blue uppercase tracking-widest transition-opacity">
                        {group.items.every(t => selectedTrackIds.has(t.id)) ? 'Deselect group' : 'Select group'}
                      </span>
                    </div>
                  </button>
                )}
                {group.items.map((track) => {
                  const trueIndex = tracks.findIndex(t => t.id === track.id);
                  const isActuallyPlaying = currentTrackIndex !== null && currentPlaybackList[currentTrackIndex]?.id === track.id;
                  
                  return (
                    <TrackItem 
                      key={track.id} 
                      track={track} 
                      isActive={isActuallyPlaying}
                      isSelectMode={isSelectMode}
                      isSelected={selectedTrackIds.has(track.id)}
                      onSelect={() => toggleTrackSelection(track.id)}
                      onPlay={() => {
                        if (isSelectMode) {
                          toggleTrackSelection(track.id);
                        } else {
                          userPlayTrack(trueIndex, null);
                          navigateTo('player');
                        }
                      }}
                      onRemove={() => removeTrack(track.id)}
                      playlists={playlists}
                      onAddToPlaylist={(pid) => addTrackToPlaylist(track.id, pid)}
                      searchQuery={searchQuery}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )
      ) : (
        <PlaylistView 
          playlists={sortedPlaylists} 
          onCreate={() => handleCreatePlaylist()}
          onDelete={async (id: string) => {
            const p = playlists.find(p => p.id === id);
            if (await modal.confirm({
              title: "Delete Playlist",
              subtitle: `Are you sure you want to delete "${p?.name}"? This action cannot be undone.`,
              confirmLabel: "Delete",
              isDestructive: true
            })) {
              await deletePlaylist(id);
              showToast("Playlist deleted");
            }
          }}
          onRename={(id: string, name: string) => handleRenamePlaylist(id, name)}
          tracks={tracks}
          onTrackPlay={(id) => {
            const idx = tracks.findIndex(t => t.id === id);
            if (idx !== -1) {
              userPlayTrack(idx, null);
              navigateTo('player');
            }
          }}
          onOpen={(id) => {
            setActivePlaylistId(id);
            setView('playlist_detail');
          }}
          isSelectMode={isSelectMode}
          editingPlaylistId={editingPlaylistId}
          selectedTrackIds={selectedTrackIds}
          onToggleSelection={(tid: string, pid: string) => {
            if (!isSelectMode) {
               setIsSelectMode(true);
               setEditingPlaylistId(pid);
               setSelectedTrackIds(new Set([tid]));
            } else if (editingPlaylistId === pid) {
               toggleTrackSelection(tid);
            } else {
               // Switching playlist focus
               setEditingPlaylistId(pid);
               setSelectedTrackIds(new Set([tid]));
            }
          }}
          onEnterSelect={(pid: string) => {
            setIsSelectMode(true);
            setEditingPlaylistId(pid);
            setSelectedTrackIds(new Set());
          }}
          searchQuery={searchQuery}
        />
      )}

      {/* Import Target Menu Overlay */}
      <AnimatePresence>
        {showImportTargetMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowImportTargetMenu(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-xl bg-white rounded-t-[2.5rem] p-8 pb-12 shadow-2xl flex flex-col gap-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                   <h2 className="text-xl font-black tracking-tight">Import {pendingFiles.length} Tracks</h2>
                   <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest mt-1">Select Destination</p>
                </div>
                <button 
                  onClick={() => setShowImportTargetMenu(false)}
                  className="p-2 bg-gray-50 rounded-full text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto no-scrollbar py-2">
                <button
                  onClick={() => processImport()}
                  className="w-full flex items-center justify-between p-5 bg-gray-50 hover:bg-black hover:text-white rounded-2xl transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-apple-blue/10 flex items-center justify-center text-apple-blue group-hover:bg-white/20 group-hover:text-white transition-colors">
                      <Music size={20} />
                    </div>
                    <span className="font-bold text-[15px]">Library Only</span>
                  </div>
                  <ChevronRight size={18} className="opacity-30" />
                </button>

                <div className="h-[0.5px] bg-black/[0.03] my-2" />

                <button
                  onClick={() => processImport('new')}
                  className="w-full flex items-center justify-between p-5 bg-apple-blue/5 hover:bg-apple-blue transition-all group text-apple-blue hover:text-white rounded-2xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-apple-blue/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <Plus size={20} />
                    </div>
                    <span className="font-bold text-[15px]">Import into New Playlist</span>
                  </div>
                  <ChevronRight size={18} className="opacity-30" />
                </button>

                {playlists.map(p => (
                  <button
                    key={p.id}
                    onClick={() => processImport(p.id)}
                    className="w-full flex items-center justify-between p-5 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                        <ListPlus size={20} />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-[15px]">{p.name}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{p.trackIds.length} tracks</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="opacity-30" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Action Bar - Minimal & Fluid */}
      <AnimatePresence>
        {isSelectMode && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-28 left-4 right-4 z-[100] flex flex-col gap-4 px-6 py-6 bg-black/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-white"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{selectedTrackIds.size} Selected</span>
              <div className="flex gap-5">
                <button 
                  onClick={() => {
                    let allIds: string[] = [];
                    const list = editingPlaylistId ? (playlists.find(p => p.id === editingPlaylistId)?.trackIds || []) : (activePlaylistId ? (playlists.find(p => p.id === activePlaylistId)?.trackIds || []) : tracks.map(t => t.id));
                    const allSelected = list.length > 0 && list.every(id => selectedTrackIds.has(id));
                    if (allSelected) {
                      const next = new Set(selectedTrackIds);
                      list.forEach(id => next.delete(id));
                      setSelectedTrackIds(next);
                    } else {
                      setSelectedTrackIds(new Set([...Array.from(selectedTrackIds), ...list]));
                    }
                  }}
                  className="text-[10px] font-bold text-apple-blue uppercase tracking-[0.1em]"
                >
                  {((editingPlaylistId ? (playlists.find(p => p.id === editingPlaylistId)?.trackIds) : (activePlaylistId ? (playlists.find(p => p.id === activePlaylistId)?.trackIds) : tracks.map(t => t.id)))?.every(id => selectedTrackIds.has(id))) ? 'Deselect All' : 'Select All'}
                </button>
                <button 
                  onClick={() => { setIsSelectMode(false); setSelectedTrackIds(new Set()); }}
                  className="text-[10px] font-bold text-white/60 uppercase tracking-[0.1em]"
                >
                  Cancel
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              <button 
                onClick={() => { if (selectedTrackIds.size > 0) { setBulkActionType('add'); setShowBulkAddMenu(!showBulkAddMenu); } }}
                disabled={selectedTrackIds.size === 0}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-20"
              >
                <ListPlus size={20} />
                <span className="text-[9px] font-bold uppercase tracking-tight">{(editingPlaylistId || activePlaylistId) ? 'Copy' : 'Add'}</span>
              </button>
              
              {(editingPlaylistId || activePlaylistId) && (
                <button 
                  onClick={() => { if (selectedTrackIds.size > 0) { setBulkActionType('move'); setShowBulkAddMenu(!showBulkAddMenu); } }}
                  disabled={selectedTrackIds.size === 0}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <Share size={20} />
                  <span className="text-[9px] font-bold uppercase tracking-tight">Move</span>
                </button>
              )}

              {(editingPlaylistId || activePlaylistId) ? (
                <button 
                  onClick={handleBulkRemoveFromPlaylist}
                  disabled={selectedTrackIds.size === 0}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                >
                  <Trash2 size={20} />
                  <span className="text-[9px] font-bold uppercase tracking-tight">Remove</span>
                </button>
              ) : (
                <button 
                  onClick={handleBulkCreatePlaylist}
                  disabled={selectedTrackIds.size === 0}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-20"
                >
                  <FolderPlus size={20} />
                  <span className="text-[9px] font-bold uppercase tracking-tight">New List</span>
                </button>
              )}

              <button 
                onClick={async () => {
                   if (await modal.confirm({
                     title: "Delete Tracks",
                     subtitle: `Delete ${selectedTrackIds.size} tracks from device?`,
                     confirmLabel: "Delete",
                     isDestructive: true
                   })) {
                      for (const id of Array.from(selectedTrackIds)) await removeTrack(id);
                      setIsSelectMode(false);
                      setSelectedTrackIds(new Set());
                   }
                }}
                disabled={selectedTrackIds.size === 0}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors text-red-400 disabled:opacity-20"
              >
                <Trash2 size={20} />
                <span className="text-[9px] font-bold uppercase tracking-tight">Delete</span>
              </button>
            </div>

            <AnimatePresence>
              {showBulkAddMenu && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 10 }}
                  className="absolute bottom-full mb-6 left-0 right-0 bg-white rounded-[2.5rem] p-6 text-black z-50 border border-black/5 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-6 px-1">
                    <h3 className="font-bold text-lg tracking-tight">Select Playlist</h3>
                    <button onClick={() => setShowBulkAddMenu(false)} className="text-gray-400 p-2"><X size={20} /></button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto no-scrollbar">
                    {playlists.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => handleBulkAddToPlaylist(p.id)}
                        className="w-full text-left px-5 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl flex items-center justify-between font-bold text-sm transition-all active:scale-[0.98]"
                      >
                        <span>{p.name}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">{p.trackIds.length} tracks</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const EmptyState = ({ onFileUpload }: any) => (
  <div className="py-24 px-12 flex flex-col items-center justify-center text-center gap-6">
    <div className="w-20 h-20 bg-secondary-system-background rounded-full flex items-center justify-center text-system-tertiary-label">
       <Upload size={40} />
    </div>
    <div className="max-w-xs">
      <h3 className="font-bold text-xl text-system-label">Your Library is Empty</h3>
      <p className="text-sm text-system-secondary-label mt-2">Upload your favorite tracks to begin your mindful audio session.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {SUPPORTED_AUDIO_FORMATS.map(f => (
          <span key={f} className="text-[9px] font-bold text-system-secondary-label bg-secondary-system-background px-2 py-0.5 rounded-md uppercase tracking-wider">{f}</span>
        ))}
      </div>
    </div>
    <label className="mt-4 px-8 py-3 bg-system-label text-system-background rounded-full text-xs font-bold tracking-tight active:scale-95 transition-transform cursor-pointer group shadow-lg shadow-black/10">
      Add High-Quality Audio
      <input type="file" multiple accept={AUDIO_ACCEPT_STRING} className="hidden" onChange={onFileUpload} />
    </label>
    <p className="mt-4 text-[10px] text-system-secondary-label font-medium">Compatible with iPhone Files & Dropbox</p>
  </div>
);

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <>{text}</>;
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <span key={i} className="text-apple-blue font-bold">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

const TrackItem = React.memo(({ track, isActive, onPlay, onRemove, playlists, onAddToPlaylist, isSelectMode, isSelected, onSelect, searchQuery }: any) => {
  const [showActions, setShowActions] = useState(false);
  const { updateSubliminalSettings, settings } = useSettings();
  const { showToast } = useUIState();
  const { relinkTrack } = useAudio();

  return (
    <div className={cn(
      "group flex flex-col transition-all duration-200",
      track.isMissing && "opacity-40"
    )}>
      <div className="flex items-center gap-4 px-4 h-[72px] leading-tight flex-shrink-0 border-b border-apple-border/30">
        {isSelectMode && (
          <button 
            onClick={onSelect}
            disabled={track.isMissing}
            className={`flex-shrink-0 transition-transform duration-200 ${isSelected ? 'scale-110 text-apple-blue' : 'scale-100 text-system-tertiary-label'}`}
          >
            {isSelected ? <CheckCircle2 size={22} fill="currentColor" stroke="white" /> : <Circle size={22} />}
          </button>
        )}
        
        <button 
          onClick={() => !track.isMissing && onPlay()} 
          className="flex-1 flex items-center gap-4 text-left min-w-0 h-full py-3"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary-system-background flex items-center justify-center overflow-hidden relative shadow-sm border border-apple-border/50">
             <ArtworkImage src={track.artwork} className="w-full h-full" iconSize={16} />
             {isActive && <div className="absolute inset-0 bg-apple-blue/10 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-apple-blue shadow-[0_0_8px_rgba(0,122,255,0.6)]" /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`font-bold truncate text-[14px] ${isActive ? 'text-apple-blue' : 'text-system-label'}`}>
              <HighlightText text={track.name} highlight={searchQuery} />
            </h4>
            <p className="text-[12px] text-system-secondary-label font-bold uppercase tracking-widest truncate mt-0.5">
              <HighlightText text={track.artist || 'Unknown Artist'} highlight={searchQuery} />
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          {!isSelectMode && (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
              className={`p-2 rounded-full transition-colors ${showActions ? 'bg-secondary-system-background text-system-label' : 'text-system-tertiary-label hover:text-system-label'}`}
            >
              <MoreVertical size={18} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showActions && !isSelectMode && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-gray-50/50"
          >
            <div className="px-14 py-4 flex flex-col gap-4">
               {/* Simplified actions */}
               <button 
                  onClick={() => { updateSubliminalSettings({ selectedTrackId: track.id, isEnabled: true }); setShowActions(false); showToast(`Added layer: ${track.name}`); }}
                  className="flex items-center gap-3 text-[12px] font-semibold text-apple-blue active:opacity-50"
               >
                  <Zap size={14} /> Use as Subliminal
               </button>
               <button 
                  onClick={() => { onRemove(); setShowActions(false); }}
                  className="flex items-center gap-3 text-[12px] font-semibold text-red-500 active:opacity-50"
               >
                  <Trash2 size={14} /> Remove Track
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});


const formatTotalDuration = (trackIds: string[], tracks: any[]) => {
  const totalSeconds = trackIds.reduce((acc, tid) => {
    const t = tracks.find(mt => mt.id === tid);
    return acc + (t?.duration || 0);
  }, 0);
  
  if (totalSeconds === 0) return '0m';
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m total`;
  }
  return `${minutes}m total`;
};

const PlaylistView = ({ playlists, onCreate, onDelete, onRename, tracks, onTrackPlay, isSelectMode, editingPlaylistId, selectedTrackIds, onToggleSelection, onEnterSelect, onOpen, searchQuery }: any) => {
  const modal = useModal();
  const { settings } = useSettings();
  const { showToast } = useUIState();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  return (
    <div className={`flex flex-col gap-4 w-full max-w-7xl mx-auto pb-12`}>
      <button 
        onClick={onCreate}
        className={`w-full bg-gray-50 border-none rounded-2xl flex items-center gap-4 transition-all active:scale-[0.98] ${isSelectMode ? 'hidden' : 'p-4'}`}
      >
        <div className="w-10 h-10 rounded-lg bg-apple-blue/10 flex items-center justify-center text-apple-blue">
          <Plus size={20} />
        </div>
        <span className="font-bold text-[14px]">Create New Playlist</span>
      </button>

      <div className="flex flex-col">
        {playlists.map((playlist: any) => {
          const isEditingThis = isSelectMode && editingPlaylistId === playlist.id;
          const isMenuOpen = activeMenuId === playlist.id;
          
          return (
            <div key={playlist.id} className="group relative h-[88px] flex flex-col justify-center">
              <div className={`flex items-center gap-4 py-4 px-1 transition-opacity h-[87.5px] ${isSelectMode && !isEditingThis ? 'opacity-40' : 'opacity-100'}`}>
                  <button 
                    onClick={() => !isSelectMode && onOpen(playlist.id)}
                    className="flex-shrink-0 w-12 h-12 rounded-xl bg-secondary-system-background flex items-center justify-center overflow-hidden border border-apple-border active:scale-95 transition-transform"
                  >
                     {playlist.trackIds.length > 0 ? (
                       <ArtworkImage src={tracks.find((t: any) => t.id === playlist.trackIds[0])?.artwork} className="w-full h-full" iconSize={20} />
                     ) : (
                       <div className="grid grid-cols-2 grid-rows-2 w-full h-full p-1 gap-[2px]">
                          {[0,1,2,3].map(i => <div key={i} className="bg-secondary-system-background rounded-[2px]" />)}
                       </div>
                     )}
                  </button>

                <button 
                  onClick={() => !isSelectMode && onOpen(playlist.id)}
                  className="flex-1 min-w-0 text-left cursor-default"
                >
                  <h3 className="font-bold text-[15px] truncate text-system-label">
                    <HighlightText text={playlist.name} highlight={searchQuery} />
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[12px] text-system-secondary-label font-medium tracking-tight">{playlist.trackIds.length} tracks</p>
                    <span className="text-gray-300">•</span>
                    <p className="text-[12px] text-system-secondary-label font-medium tracking-tight">{formatTotalDuration(playlist.trackIds, tracks)}</p>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  {playlist.trackIds.length > 0 && (
                    <button 
                      onClick={() => onEnterSelect(playlist.id)}
                      className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${isEditingThis ? 'bg-apple-blue text-white' : 'text-apple-blue bg-apple-blue/5 hover:bg-apple-blue/10'}`}
                    >
                      {isEditingThis ? 'Editing' : 'Select'}
                    </button>
                  )}
                  
                  {!isSelectMode && (
                    <div className="relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : playlist.id); }}
                        className={`p-2 rounded-full transition-colors ${isMenuOpen ? 'bg-secondary-system-background text-system-label' : 'text-system-tertiary-label hover:text-system-label'}`}
                      >
                        <MoreVertical size={20} />
                      </button>

                      <AnimatePresence>
                        {isMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 top-full mt-2 w-48 bg-apple-card rounded-2xl shadow-2xl border border-apple-border z-50 py-2 overflow-hidden"
                            >
                              <button 
                                onClick={() => { 
                                  onRename(playlist.id, playlist.name);
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary-system-background text-[13px] font-bold text-left text-system-label"
                              >
                                <Edit2 size={16} className="text-system-secondary-label" />
                                Rename
                              </button>
                              <button 
                                onClick={async () => {
                                  if (await modal.confirm({
                                    title: "Delete Playlist",
                                    subtitle: `Are you sure you want to delete "${playlist.name}"? This action cannot be undone.`,
                                    confirmLabel: "Delete",
                                    isDestructive: true
                                  })) {
                                    onDelete(playlist.id);
                                    showToast(`Deleted "${playlist.name}"`);
                                  }
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary-system-background text-[13px] font-bold text-red-500 text-left"
                              >
                                <Trash2 size={16} className="text-red-400" />
                                Delete
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {!isSelectMode && (
                    <button onClick={() => onOpen(playlist.id)} className="p-2 text-system-tertiary-label">
                      <ChevronRight size={20} />
                    </button>
                  )}
                </div>
              </div>
              <div className="h-[0.5px] bg-apple-border ml-16" />
            </div>
          );
        })}
      </div>
    </div>
  );
};
const PlaylistDetailView = ({ 
  playlist, 
  tracks, 
  onBack, 
  onTrackPlay, 
  onRename, 
  onDelete, 
  isSelectMode, 
  onEnterSelect,
  selectedTrackIds,
  onToggleSelection,
  sort,
  onSort,
  showSettings,
  onToggleSettings,
  resumePlaylist,
  playingPlaylistId,
  currentTrackIndex,
  isPlaying,
  settings
}: any) => {
  const activeTrackRef = React.useRef<HTMLDivElement>(null);
  const modal = useModal();
  
  const sortedTracks = useMemo(() => {
    let list = playlist.trackIds.map((tid: string) => tracks.find((t: any) => t.id === tid)).filter(Boolean);
    if (sort === 'alphabetical') list.sort((a: any, b: any) => a.name.localeCompare(b.name));
    else if (sort === 'date') list.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    else if (sort === 'recent') list = [...list].reverse();
    return list;
  }, [playlist.trackIds, tracks, sort]);

  useEffect(() => {
    if (activeTrackRef.current && playingPlaylistId === playlist.id) {
       activeTrackRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTrackIndex, playingPlaylistId, playlist.id]);

  return (
    <div className="flex flex-col min-h-full animate-in fade-in slide-in-from-right duration-300">
      <header className="bg-system-background flex flex-col gap-4 pt-4 pb-2">
        <div className="flex items-center justify-between px-2">
          <button onClick={onBack} className="p-2 text-apple-blue font-bold flex items-center gap-1 active:opacity-50">
            <ArrowLeft size={20} />
            <span className="text-[15px]">Library</span>
          </button>
          
          <div className="flex gap-1 relative">
            {!isSelectMode && (
              <div className="relative">
                <button 
                  onClick={onToggleSettings}
                  className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-secondary-system-background text-system-label' : 'text-system-tertiary-label'}`}
                >
                  <MoreVertical size={20} />
                </button>

                <AnimatePresence>
                  {showSettings && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={onToggleSettings} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-apple-card rounded-2xl shadow-2xl border border-apple-border z-50 py-2 overflow-hidden"
                      >
                        <button 
                          onClick={() => {
                            onRename(playlist.id, playlist.name);
                            onToggleSettings();
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary-system-background text-[13px] font-bold text-left text-system-label"
                        >
                          <Edit2 size={16} className="text-system-secondary-label" />
                          Rename
                        </button>
                        
                        <div className="h-px bg-apple-border mx-2 my-1" />
                        
                        <div className="px-4 py-2">
                          <p className="text-[10px] font-bold text-system-tertiary-label uppercase tracking-widest mb-2">Sort Order</p>
                          {(['recent', 'alphabetical', 'date'] as SortOption[]).map(s => (
                            <button
                              key={s}
                              onClick={() => {
                                onSort(s);
                                onToggleSettings();
                              }}
                              className={`w-full flex items-center justify-between py-1.5 text-[12px] font-bold ${sort === s ? 'text-apple-blue' : 'text-system-secondary-label'}`}
                            >
                              {s === 'recent' ? 'Recent' : s === 'alphabetical' ? 'A-Z' : 'Date Added'}
                              {sort === s && <Check size={14} />}
                            </button>
                          ))}
                        </div>

                        <div className="h-px bg-apple-border mx-2 my-1" />

                        <button 
                          onClick={async () => {
                            onToggleSettings();
                            if (await modal.confirm({
                              title: "Delete Playlist",
                              subtitle: `Delete "${playlist.name}"? This will not delete the actual audio files.`,
                              confirmLabel: "Delete",
                              isDestructive: true
                            })) {
                              onDelete(playlist.id);
                            }
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary-system-background text-[13px] font-bold text-red-500 text-left"
                        >
                          <Trash2 size={16} className="text-red-400" />
                          Delete Playlist
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
            {isSelectMode ? (
              <button 
                onClick={() => {
                  if (isSelectMode) {
                    onEnterSelect(false); // Map false to toggle off
                  }
                }} 
                className="text-apple-blue text-[15px] font-bold px-3 active:opacity-50"
              >
                Done
              </button>
            ) : (
              <button onClick={() => onEnterSelect(true)} className="text-apple-blue text-[15px] font-bold px-3 active:opacity-50">Select</button>
            )}
          </div>
        </div>

        <div className="px-6 pb-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-system-label">{playlist.name}</h1>
          <p className="text-[13px] text-system-secondary-label font-medium mt-0.5">{playlist.trackIds.length} tracks • {formatTotalDuration(playlist.trackIds, tracks)}</p>
          
          <div className="flex gap-3 mt-5">
            <button 
              onClick={() => {
                if (playlist.trackIds.length > 0) {
                  onTrackPlay(playlist.trackIds[0]);
                }
              }}
              className="flex-1 bg-secondary-system-background text-system-label h-12 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform font-bold"
            >
              <Play size={18} fill="currentColor" /> Play
            </button>
            <button 
              onClick={() => resumePlaylist(playlist.id)}
              className="flex-1 bg-secondary-system-background text-system-label h-12 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform font-bold"
            >
              <Zap size={18} fill="currentColor" /> Resume
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col pb-44 px-4 mt-6">
        {sortedTracks.map((track: any) => {
          const isSelected = selectedTrackIds.has(track.id);
          const isActuallyPlaying = playingPlaylistId === playlist.id && 
                                   currentTrackIndex !== null && 
                                   playlist.trackIds[currentTrackIndex] === track.id;

          return (
            <div key={track.id} ref={isActuallyPlaying ? activeTrackRef : null} className="group h-[64px] flex flex-col justify-center">
              <div className="flex items-center gap-3 py-3 px-1 leading-tight h-[63.5px]">
                {isSelectMode && (
                  <button 
                    onClick={() => onToggleSelection(track.id)}
                    className={`flex-shrink-0 transition-transform duration-200 ${isSelected ? 'scale-110 text-apple-blue' : 'scale-100 text-gray-200'}`}
                  >
                    {isSelected ? <CheckCircle2 size={22} fill="currentColor" stroke="white" /> : <Circle size={22} />}
                  </button>
                )}
                
                <button 
                  onClick={() => !isSelectMode && onTrackPlay(track.id)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden relative">
                    <ArtworkImage src={track.artwork} className="w-full h-full" iconSize={16} />
                    {isActuallyPlaying && <div className="absolute inset-0 bg-apple-blue/10 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-apple-blue" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-bold truncate text-[14px] ${isActuallyPlaying ? 'text-apple-blue' : 'text-system-label'}`}>{track.name}</h4>
                    <p className="text-[12px] text-system-secondary-label font-medium truncate mt-0.5">{track.artist || 'Unknown Artist'}</p>
                  </div>
                </button>

                {!isSelectMode && (
                  <button className="p-2 text-system-tertiary-label opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical size={18} />
                  </button>
                )}
              </div>
              <div className="h-[0.5px] bg-apple-border ml-[52px]" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Music = ({ className, size }: { className?: string, size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);
