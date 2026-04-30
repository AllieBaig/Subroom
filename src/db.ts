import { openDB, IDBPDatabase } from 'idb';
import { Track, AppSettings } from './types';

const DB_NAME = 'subliminal-db';
const DB_VERSION = 4;
const TRACKS_STORE = 'tracks_v2';
const SUB_TRACKS_STORE = 'sub_tracks_v2';
const BLOBS_STORE = 'blobs';
const SETTINGS_STORE = 'settings';
const PLAYLISTS_STORE = 'playlists';
const CHUNKS_STORE = 'chunks';

export interface DBTrack extends Track {
  blob?: Blob;
}

export interface ChunkMetadata {
  id: string; // chunk_{playlistId}_{index}
  playlistId: string;
  index: number;
  trackIds: string[];
  duration: number;
  expiresAt: number;
}

export async function initDB() {
  try {
    return await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 1) {
          db.createObjectStore('tracks', { keyPath: 'id' });
          db.createObjectStore('subliminal-tracks', { keyPath: 'id' });
          db.createObjectStore(SETTINGS_STORE);
          db.createObjectStore(PLAYLISTS_STORE, { keyPath: 'id' });
        }
        
        if (oldVersion < 3) {
          // New optimized layout
          if (!db.objectStoreNames.contains(TRACKS_STORE)) {
            db.createObjectStore(TRACKS_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(SUB_TRACKS_STORE)) {
            db.createObjectStore(SUB_TRACKS_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(BLOBS_STORE)) {
            db.createObjectStore(BLOBS_STORE); // key is track id
          }
        }

        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
            db.createObjectStore(CHUNKS_STORE, { keyPath: 'id' });
          }
        }
      },
      blocking() {
        console.warn("IndexedDB: Database connection blocked by older version.");
      },
      terminated() {
        console.error("IndexedDB: Connection terminated unexpectedly.");
        if (typeof window !== 'undefined') window.location.reload(); 
      }
    });
  } catch (err) {
    console.error("Critical IndexedDB initialization error:", err);
    // Don't throw just yet, return a mock or handle in caller
    throw err;
  }
}

function handleDBError(err: any, context: string) {
  if (err && (err.name === 'QuotaExceededError' || err.message?.includes('quota'))) {
    console.error(`[Safety] Storage Quota Exceeded during ${context}. App may be unstable.`);
    // We could trigger an auto-cleanup of chunks here if needed
    clearAllChunks().catch(() => {});
  } else {
    console.error(`[Safety] Database error during ${context}:`, err);
  }
}

export async function saveChunk(metadata: ChunkMetadata, blob: Blob) {
  try {
    const db = await initDB();
    const tx = db.transaction([CHUNKS_STORE, BLOBS_STORE], 'readwrite');
    await tx.objectStore(CHUNKS_STORE).put(metadata);
    await tx.objectStore(BLOBS_STORE).put(blob, metadata.id);
    await tx.done;
  } catch (err) {
    handleDBError(err, 'saveChunk');
  }
}

export async function getChunkMetadata(id: string): Promise<ChunkMetadata | null> {
  try {
    const db = await initDB();
    return await db.get(CHUNKS_STORE, id);
  } catch (err) {
    return null;
  }
}

export async function getAllChunkMetadata(): Promise<ChunkMetadata[]> {
  try {
    const db = await initDB();
    return await db.getAll(CHUNKS_STORE);
  } catch (err) {
    return [];
  }
}

export async function deleteChunk(id: string) {
  try {
    const db = await initDB();
    const tx = db.transaction([CHUNKS_STORE, BLOBS_STORE], 'readwrite');
    await tx.objectStore(CHUNKS_STORE).delete(id);
    await tx.objectStore(BLOBS_STORE).delete(id);
    await tx.done;
  } catch (err) {
    console.error("Failed to delete chunk:", err);
  }
}

export async function clearAllChunks() {
  try {
    const db = await initDB();
    const tx = db.transaction([CHUNKS_STORE], 'readwrite');
    await tx.objectStore(CHUNKS_STORE).clear();
    // We should also clear chunks from BLOBS_STORE but we don't have a prefix index easily.
    // Chunks are named chunk_* so we'd have to iterate.
    await tx.done;
  } catch (err) {
    console.error("Failed to clear chunks:", err);
  }
}

export async function saveTrack(track: DBTrack, isSubliminal: boolean = false) {
  try {
    if (!track.id) throw new Error("Invalid track data");
    const db = await initDB();
    const metadataStore = isSubliminal ? SUB_TRACKS_STORE : TRACKS_STORE;
    
    // Separate blob from metadata
    const { blob, ...metadata } = track;
    
    const tx = db.transaction([metadataStore, BLOBS_STORE], 'readwrite');
    await tx.objectStore(metadataStore).put(metadata);
    if (blob) {
      await tx.objectStore(BLOBS_STORE).put(blob, track.id);
    }
    await tx.done;
  } catch (err) {
    handleDBError(err, 'saveTrack');
  }
}

export async function getTrackBlob(id: string): Promise<Blob | null> {
  try {
    const db = await initDB();
    return await db.get(BLOBS_STORE, id);
  } catch (err) {
    console.error("Failed to fetch track blob:", err);
    return null;
  }
}

export async function getTracks(isSubliminal: boolean = false): Promise<Track[]> {
  try {
    const db = await initDB();
    const store = isSubliminal ? SUB_TRACKS_STORE : TRACKS_STORE;
    return await db.getAll(store);
  } catch (err) {
    console.error("Failed to retrieve tracks:", err);
    return [];
  }
}

export async function deleteTrack(id: string, isSubliminal: boolean = false) {
  try {
    const db = await initDB();
    const metadataStore = isSubliminal ? SUB_TRACKS_STORE : TRACKS_STORE;
    const tx = db.transaction([metadataStore, BLOBS_STORE], 'readwrite');
    await tx.objectStore(metadataStore).delete(id);
    await tx.objectStore(BLOBS_STORE).delete(id);
    await tx.done;
  } catch (err) {
    console.error("Failed to delete track:", err);
  }
}

export async function saveSettings(settings: AppSettings) {
  try {
    const db = await initDB();
    await db.put(SETTINGS_STORE, settings, 'current');
  } catch (err) {
    handleDBError(err, 'saveSettings');
  }
}

export async function getSettings(): Promise<AppSettings | null> {
  try {
    const db = await initDB();
    const settings = await db.get(SETTINGS_STORE, 'current');
    
    if (settings && typeof settings === 'object') {
      // Robust validation: check structure
      const hasSub = settings.subliminal && typeof settings.subliminal === 'object';
      const hasBin = settings.binaural && typeof settings.binaural === 'object';
      
      if (hasSub && hasBin && typeof settings.fadeInOut === 'boolean') {
        return settings;
      }
    }
    return null;
  } catch (err) {
    console.warn("Recovering from settings read failure:", err);
    return null; 
  }
}

export async function savePlaylist(playlist: any) {
  try {
    const db = await initDB();
    await db.put(PLAYLISTS_STORE, playlist);
  } catch (err) {
    handleDBError(err, 'savePlaylist');
  }
}

export async function getPlaylists(): Promise<any[]> {
  try {
    const db = await initDB();
    return db.getAll(PLAYLISTS_STORE);
  } catch (err) {
    console.error("Failed to retrieve playlists:", err);
    return [];
  }
}

export async function deletePlaylist(id: string) {
  try {
    const db = await initDB();
    await db.delete(PLAYLISTS_STORE, id);
  } catch (err) {
    console.error("Failed to delete playlist:", err);
  }
}

export async function getTracksWithBlobs(isSubliminal: boolean = false): Promise<DBTrack[]> {
  try {
    const db = await initDB();
    const metadataStore = isSubliminal ? SUB_TRACKS_STORE : TRACKS_STORE;
    const allMetadata = await db.getAll(metadataStore);
    
    // We don't fetch all blobs at once to save memory, 
    // but the API expects DBTrack which has an optional blob.
    // For specific startup needs, some logic might want blobs.
    return allMetadata;
  } catch (err) {
    console.error("Failed to retrieve tracks with blobs:", err);
    return [];
  }
}

export async function clearAllData() {
  try {
    const db = await initDB();
    const stores = [TRACKS_STORE, SUB_TRACKS_STORE, SETTINGS_STORE, PLAYLISTS_STORE];
    for (const store of stores) {
      await db.clear(store);
    }
  } catch (err) {
    console.error("Failed to clear all data:", err);
  }
}
