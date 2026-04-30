import { useEffect, useRef, useMemo, useState } from 'react';
import { useAudio } from '../AudioContext';
import { usePlayback } from '../PlaybackContext';
import { useSettings } from '../SettingsContext';
import { useUIState } from '../UIStateContext';
import { NATURE_SOUNDS } from '../constants';
import { ChunkManager } from '../utils/ChunkManager';
import SafetyChecker from '../utils/SafetyChecker';
import * as db from '../db';

export default function AudioEngine() {
  const { 
    tracks, 
    subliminalTracks, 
    currentTrackIndex, 
    setCurrentTrackIndex,
    isPlaying, 
    playlists,
    setIsPlaying,
    playNext,
    playPrevious,
    seekTo,
    currentPlaybackList,
    playingPlaylistId,
    getTrackUrl,
    revokeTrackUrl,
    checkTrackPlayable,
    healSystem,
    seekRequest,
    clearSeekRequest
  } = useAudio();

  const { currentTime, setCurrentTime, setDuration, updateLayerProgress, layerProgress } = usePlayback();

  const [isRenderingChunk, setIsRenderingChunk] = useState(false);
  // Detect Foreground/Background
  const [isForeground, setIsForeground] = useState(typeof document !== 'undefined' ? document.visibilityState === 'visible' : true);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => setIsForeground(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const { settings, updateSettings, updateAudioTools } = useSettings();
  const { isLoading, showToast, isOffline, navigateTo, activeTabRequest, clearTabRequest } = useUIState();
  // Safety: Runtime health monitor
  const lastHealthCheck = useRef<number>(Date.now());
  const playStateAnomalies = useRef<number>(0);
  const lastKnownTime = useRef<number>(0);
  const stallCount = useRef<Record<string, number>>({});
  
  const currentTrack = currentTrackIndex !== null ? currentPlaybackList[currentTrackIndex] : null;

  // Soft Heal for specific elements without resetting everything
  const softHealElement = async (audio: HTMLAudioElement | null, type: 'main' | 'hz' | 'heartbeat', layerId?: string) => {
    if (!audio) return;
    console.warn(`[Safety] Attempting soft heal for ${type} ${layerId || ''}`);
    
    try {
      const currentPos = audio.currentTime;
      const wasPlaying = !audio.paused;
      
      if (type === 'main' && currentTrack) {
        const freshUrl = await getTrackUrl(currentTrack.id, true);
        if (freshUrl) {
          audio.src = freshUrl;
          audio.load();
          audio.currentTime = currentPos;
          if (wasPlaying || isPlaying) audio.play().catch(() => {});
        }
      } else if (type === 'heartbeat') {
        audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/wD/";
        audio.load();
        audio.play().catch(() => {});
      } else if (type === 'hz' && layerId) {
        // For Hz layers, we just nudge play or trigger a swap if stuck
        if (audio.paused && isPlaying) audio.play().catch(() => {});
        else {
          audio.currentTime = 0; // Reset stuck buffer
          audio.play().catch(() => {});
        }
      }
    } catch (e) {
      console.error(`[Safety] Soft heal failed for ${type}:`, e);
    }
  };

  useEffect(() => {
    const healthInterval = setInterval(() => {
      const now = Date.now();
      const visibility = typeof document !== 'undefined' ? document.visibilityState : 'visible';
      
      if (isPlaying && !isRenderingChunk) {
        const mainAudio = mainAudioRef.current;
        
        // 1. MAIN AUDIO CHECK
        if (mainAudio && mainAudio.src && !mainAudio.ended) {
          if (mainAudio.paused) {
             // If we should be playing but are paused (common iOS background stall)
             stallCount.current['main'] = (stallCount.current['main'] || 0) + 1;
             if (stallCount.current['main'] > 2) {
               console.warn('[Safety] Detected unexplained pause in playback, nudging...');
               mainAudio.play().catch(() => {});
             }
          } else {
            const currentTime = mainAudio.currentTime;
            if (currentTime === lastKnownTime.current && currentTime !== 0) {
              // Stall detected (position not advancing)
              playStateAnomalies.current++;
              console.warn(`[Safety] Audio stall detected (${playStateAnomalies.current}/5)`);
              
              if (playStateAnomalies.current >= 5) {
                console.error('[Safety] Critical stall - performing soft heal');
                softHealElement(mainAudio, 'main');
                playStateAnomalies.current = 0;
              } else if (playStateAnomalies.current >= 2) {
                mainAudio.play().catch(() => {}); // Nudge
              }
            } else {
              playStateAnomalies.current = 0;
            }
            lastKnownTime.current = currentTime;
          }
        }

        // 2. HEARTBEAT CHECK
        if (heartbeatAudioRef.current && heartbeatAudioRef.current.paused) {
          heartbeatAudioRef.current.play().catch(() => {
            softHealElement(heartbeatAudioRef.current, 'heartbeat');
          });
        }
      }
      
      lastHealthCheck.current = now;
    }, 10000); // Check every 10s
    
    return () => clearInterval(healthInterval);
  }, [isPlaying, isForeground, currentTrack, getTrackUrl, isRenderingChunk]);

  // Unified Safe Play Wrapper
  const safePlay = async (audio: HTMLAudioElement | null, context: string) => {
    if (!SafetyChecker.validateAudioElement(audio, context)) return;
    try {
      await audio!.play();
    } catch (e) {
      if (e instanceof Error && e.name === 'NotAllowedError') {
        // User interaction required - non-critical
        console.warn(`[Safety] Play blocked by browser policy (${context})`);
      } else {
        console.error(`[Safety] Play failed (${context}):`, e);
      }
    }
  };

  const chunkPlanRef = useRef<any>(null);
  const lastBgGenTime = useRef<Record<string, number>>({});
  const activeChunkIdRef = useRef<string | null>(null);
  const nextChunkIdRef = useRef<string | null>(null);
  const chunkUrlsRef = useRef<Record<string, string>>({});
  const chunkCleanupRef = useRef<Set<string>>(new Set());
  const trackOffsetsRef = useRef<{start: number, duration: number}[]>([]);
  const objectUrlRef = useRef<Set<string>>(new Set());

  const registerUrl = (url: string) => {
    if (url.startsWith('blob:')) {
      objectUrlRef.current.add(url);
    }
  };

  const cleanupUrls = () => {
    objectUrlRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlRef.current.clear();
  };

  useEffect(() => {
    return () => cleanupUrls();
  }, []);

  // Internal Audio Element Refs (Managed by lifecycle)
  const heartbeatAudioRef = useRef<HTMLAudioElement | null>(null);

  // Update Chunk Plan when Playlist changes
  useEffect(() => {
    if (!playingPlaylistId || currentPlaybackList.length === 0) {
      chunkPlanRef.current = null;
      return;
    }

    const updatePlan = async () => {
      const plan = await ChunkManager.createChunkPlan(playingPlaylistId, currentPlaybackList, settings.chunking.sizeMinutes);
      chunkPlanRef.current = plan;
      
      // Determine current chunk and position based on currentTrackIndex
      if (currentTrackIndex !== null) {
        let cumulativeTracks = 0;
        let cumulativeDuration = 0;
        let foundIdx = 0;
        let trackStartOffset = 0;

        for (let i = 0; i < plan.chunks.length; i++) {
          const chunk = plan.chunks[i];
          let chunkDuration = 0;
          let trackFoundInThisChunk = false;
          let offsetInChunk = 0;

          for (let j = 0; j < chunk.trackIds.length; j++) {
            const trackId = chunk.trackIds[j];
            const duration = await ChunkManager.getAudioDuration(trackId);
            
            if (cumulativeTracks === currentTrackIndex) {
              trackFoundInThisChunk = true;
              trackStartOffset = offsetInChunk;
            }
            
            offsetInChunk += duration;
            chunkDuration += duration;
            cumulativeTracks++;
          }

          if (trackFoundInThisChunk) {
            foundIdx = i;
            break;
          }
        }
        
        const isSameChunk = settings.chunking.activePlaylistId === playingPlaylistId && 
                            settings.chunking.currentChunkIndex === foundIdx;

        updateSettings({
          chunking: {
            ...settings.chunking,
            activePlaylistId: playingPlaylistId,
            currentChunkIndex: foundIdx,
            lastChunkPosition: trackStartOffset,
            currentTrackIndex: currentTrackIndex
          }
        });

        // Forced seek if same chunk
        if (isSameChunk && mainAudioRef.current) {
          mainAudioRef.current.currentTime = trackStartOffset;
        }
      }
    };
    updatePlan();
  }, [playingPlaylistId, currentPlaybackList.length, currentTrackIndex]);

  // Foreground Rendering Loop
  useEffect(() => {
    if (!isForeground || !chunkPlanRef.current || isRenderingChunk) return;

    const renderNextIfNeeded = async () => {
      const plan = chunkPlanRef.current;
      const { activePlaylistId, currentChunkIndex } = settings.chunking;
      
      if (activePlaylistId !== plan.playlistId) return;

      const currentId = `chunk_${activePlaylistId}_${currentChunkIndex}`;
      const nextIdx = (currentChunkIndex + 1) >= plan.chunks.length ? (settings.playbackMode === 'loop' ? 0 : -1) : currentChunkIndex + 1;
      
      // Check if current chunk exists
      const currentMeta = await db.getChunkMetadata(currentId);
      if (!currentMeta) {
        setIsRenderingChunk(true);
        const rendered = await ChunkManager.renderChunk(
          activePlaylistId!, 
          currentChunkIndex, 
          plan.chunks[currentChunkIndex].trackIds,
          settings.mainVolume,
          settings.mainGainDb
        );
        if (rendered) {
          await db.saveChunk({
            id: currentId,
            playlistId: activePlaylistId!,
            index: currentChunkIndex,
            trackIds: plan.chunks[currentChunkIndex].trackIds,
            duration: rendered.duration,
            expiresAt: Date.now() + 3600000
          }, rendered.blob);
        }
        setIsRenderingChunk(false);
        return;
      }

      // Pre-render next chunk
      if (nextIdx !== -1) {
        const nextId = `chunk_${activePlaylistId}_${nextIdx}`;
        const nextMeta = await db.getChunkMetadata(nextId);
        if (!nextMeta) {
          setIsRenderingChunk(true);
          const rendered = await ChunkManager.renderChunk(
            activePlaylistId!, 
            nextIdx, 
            plan.chunks[nextIdx].trackIds,
            settings.mainVolume,
            settings.mainGainDb
          );
          if (rendered) {
            await db.saveChunk({
              id: nextId,
              playlistId: activePlaylistId!,
              index: nextIdx,
              trackIds: plan.chunks[nextIdx].trackIds,
              duration: rendered.duration,
              expiresAt: Date.now() + 3600000
            }, rendered.blob);
          }
          setIsRenderingChunk(false);
        }
      }

      // Cleanup old chunks: Keep only current + next
      const chunksInDb = await db.getAllChunkMetadata();
      const nextId = nextIdx !== -1 ? `chunk_${activePlaylistId}_${nextIdx}` : null;
      for (const meta of chunksInDb) {
        if (meta.id !== currentId && meta.id !== nextId) {
          await db.deleteChunk(meta.id);
        }
      }
    };

    const interval = setInterval(renderNextIfNeeded, 5000);
    return () => clearInterval(interval);
  }, [isForeground, isRenderingChunk, settings.chunking, settings.playbackMode]);

  // Track current URL to revoke it later
  const lastMainUrlRef = useRef<string | null>(null);

  // Helper Functions for Sound Design
  const createReverb = (ctx: BaseAudioContext, duration: number, sampleRate: number) => {
    const reverb = ctx.createConvolver();
    const length = sampleRate * 3; // 3 second reverb
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2);
      impulseL[i] = (Math.random() * 2 - 1) * decay;
      impulseR[i] = (Math.random() * 2 - 1) * decay;
    }
    reverb.buffer = impulse;
    return reverb;
  };

  const applySoftReverbEffect = (ctx: BaseAudioContext, source: AudioNode, dest: AudioNode) => {
    const reverb = createReverb(ctx, 3, ctx.sampleRate);
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    dryGain.gain.setValueAtTime(0.7, ctx.currentTime);
    wetGain.gain.setValueAtTime(0.3, ctx.currentTime);
    
    source.connect(dryGain);
    source.connect(reverb);
    reverb.connect(wetGain);
    dryGain.connect(dest);
    wetGain.connect(dest);
  };

  const cleanupLastUrl = () => {
    if (lastMainUrlRef.current) {
      URL.revokeObjectURL(lastMainUrlRef.current);
      lastMainUrlRef.current = null;
    }
  };

  // Save chunk position periodically
  useEffect(() => {
    if (!isPlaying || !mainAudioRef.current) return;
    const interval = setInterval(() => {
      if (mainAudioRef.current) {
        updateSettings({
          chunking: {
            ...settings.chunking,
            lastChunkPosition: mainAudioRef.current.currentTime
          }
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, settings.chunking.activePlaylistId, settings.chunking.currentChunkIndex]);
  const [preparedUrl, setPreparedUrl] = useState<string | null>(null);
  const [preparedSubUrl, setPreparedSubUrl] = useState<string | null>(null);
  const mainAudioRef = useRef<HTMLAudioElement | null>(null);
  const subAudioRef = useRef<HTMLAudioElement | null>(null);
  const delayTimeoutRef = useRef<number | null>(null);
  const subPlaylistIndexRef = useRef<number>(0);
  const tracksPlayedInSessionRef = useRef<number>(0);
  const lastSkipTimeRef = useRef<number>(0);
  const skipCountRef = useRef<number>(0);

  // Binaural Web Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const leftOscRef = useRef<OscillatorNode | null>(null);
  const rightOscRef = useRef<OscillatorNode | null>(null);
  const binauralGainRef = useRef<GainNode | null>(null);
  
  // Audio Tools Refs
  const mainSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  const subSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const subSpecificGainRef = useRef<GainNode | null>(null);
  const toolGainRef = useRef<GainNode | null>(null);
  const toolCompressorRef = useRef<DynamicsCompressorNode | null>(null);

  // Noise & Nature Refs
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const natureAudioRef = useRef<HTMLAudioElement | null>(null);
  const natureSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const natureGainRef = useRef<GainNode | null>(null);
  const natureCompRef = useRef<DynamicsCompressorNode | null>(null);

  // Background HTML Audio Refs for iOS 16 Persistence - Double Buffered for Gapless
  const bgAudioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const bgAudioRefs2 = useRef<Record<string, HTMLAudioElement>>({});
  const activeBgRef = useRef<Record<string, 1 | 2>>({});
  const bgAudioUrls = useRef<Record<string, string>>({});
  const bgAudioParams = useRef<Record<string, string>>({});

  // Helper: Simple WAV Encoder
  const audioBufferToWav = (buffer: AudioBuffer) => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const numSamples = buffer.length;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = numSamples * blockAlign;
    const headerSize = 44;
    const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset + (i * blockAlign) + (channel * bytesPerSample), intSample, true);
      }
    }
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  // Helper: Generate Tone Blob
  const generateToneBlob = async (type: string, options: any) => {
    const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const duration = 30; // 30s for smoother looping and stability
    const sampleRate = 44100;
    const numChannels = type === 'binaural' ? 2 : 1;
    const ctx = new OfflineCtx(numChannels, sampleRate * duration, sampleRate);
    
    // Calculate baked gain (Volume % + Gain dB + Master Gain dB + Safety Headroom)
    const bakedGainValue = (options.volume || 1.0) * Math.pow(10, (options.gainDb || 0) / 20);
    const masterGainMultiplier = (options.masterGainDb !== undefined) ? Math.pow(10, options.masterGainDb / 20) : 1.0;
    const parallelSafety = options.safetyMultiplier || 1.0;
    const finalGainValue = bakedGainValue * masterGainMultiplier * parallelSafety;

    const masterGainNode = ctx.createGain();
    masterGainNode.gain.setValueAtTime(finalGainValue, 0);
    masterGainNode.connect(ctx.destination);

    // Fade In/Out for seamless looping if Pitch Safe Mode is on or active generally
    const applyFades = (node: GainNode) => {
      node.gain.setValueAtTime(0, 0);
      node.gain.linearRampToValueAtTime(1, 1.5); // 1.5s fade in
      node.gain.setValueAtTime(1, duration - 1.5);
      node.gain.linearRampToValueAtTime(0, duration); // 1.5s fade out
    };

    // Reverb Helper
    const applySoftReverb = (source: AudioNode, dest: AudioNode) => {
      const reverb = ctx.createConvolver();
      const length = sampleRate * 3; // 3 second reverb
      const impulse = ctx.createBuffer(2, length, sampleRate);
      const impulseL = impulse.getChannelData(0);
      const impulseR = impulse.getChannelData(1);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2);
        impulseL[i] = (Math.random() * 2 - 1) * decay;
        impulseR[i] = (Math.random() * 2 - 1) * decay;
      }
      reverb.buffer = impulse;
      
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      dryGain.gain.setValueAtTime(0.7, 0);
      wetGain.gain.setValueAtTime(0.3, 0);
      
      source.connect(dryGain);
      source.connect(reverb);
      reverb.connect(wetGain);
      dryGain.connect(dest);
      wetGain.connect(dest);
    };

    const isPitchRange = (freq: number) => freq >= 200 && freq <= 1900;
    const useSoftPitch = options.pitchSafeMode && isPitchRange(options.frequency || (type === 'binaural' ? (options.leftFreq + options.rightFreq) / 2 : 0));

    // Physical Sound Engine Helper
    const applyPhysicalReverb = (source: AudioNode, dest: AudioNode, phys: any) => {
      if (!phys) {
        source.connect(dest);
        return;
      }

      const { roomSize, wallResonance, materialTexture, resonanceDepth, echoTailLength } = phys;
      
      // 1. Create Impulse Response based on params
      let reverbLength = 0.5;
      switch(roomSize) {
        case 'small': reverbLength = 0.3; break;
        case 'medium': reverbLength = 1.0; break;
        case 'large': reverbLength = 2.5; break;
        case 'cave': reverbLength = 5.0; break;
      }
      reverbLength *= (0.5 + (echoTailLength || 0.5));

      const length = Math.ceil(sampleRate * reverbLength);
      const impulse = ctx.createBuffer(2, length, sampleRate);
      const impulseL = impulse.getChannelData(0);
      const impulseR = impulse.getChannelData(1);

      // 2. Texture Pre-filtering logic
      let filterFreq = 15000;
      let filterQ = 0.7;
      switch(materialTexture) {
        case 'thin_wood': filterFreq = 1800; filterQ = 4; break;
        case 'empty_wood': filterFreq = 900; filterQ = 7; break;
        case 'solid_wall': filterFreq = 5000; filterQ = 1.5; break;
        case 'open_space': filterFreq = 15000; filterQ = 0.6; break;
      }

      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 4);
        const noise = (Math.random() * 2 - 1);
        impulseL[i] = noise * decay;
        impulseR[i] = noise * decay;
      }

      const reverb = ctx.createConvolver();
      reverb.buffer = impulse;

      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      
      // Resonance Depth + Wall Resonance impact
      let resonanceMultiplier = 1.0;
      switch(wallResonance) {
        case 'off': resonanceMultiplier = 0.05; break;
        case 'low': resonanceMultiplier = 0.3; break;
        case 'medium': resonanceMultiplier = 0.7; break;
        case 'high': resonanceMultiplier = 1.1; break;
      }

      const wetAmount = 0.1 + (resonanceDepth * (options.pitchSafeMode ? 0.3 : 0.5)) * resonanceMultiplier;
      dryGain.gain.setValueAtTime(Math.max(0.1, 1.0 - wetAmount * 0.7), 0);
      wetGain.gain.setValueAtTime(wetAmount, 0);

      const textureFilter = ctx.createBiquadFilter();
      textureFilter.type = 'lowpass';
      textureFilter.frequency.setValueAtTime(filterFreq, 0);
      textureFilter.Q.setValueAtTime(filterQ, 0);

      source.connect(dryGain);
      source.connect(textureFilter);
      textureFilter.connect(reverb);
      reverb.connect(wetGain);
      
      dryGain.connect(dest);
      wetGain.connect(dest);
    };

    // Setup layer specific offline graph
    if (type === 'pureHz' || type === 'solfeggio' || type === 'schumann') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(options.frequency, 0);
      
      if (useSoftPitch) {
        // Soft Meditation Formula
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(options.frequency * 0.8, 0);
        filter.Q.setValueAtTime(1.0, 0);
        
        // Ambient Pad (Sub-harmonics for warmth)
        const subOsc = ctx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(options.frequency / 2, 0);
        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.15, 0);
        
        // Pink Noise Bed
        const pinkBuffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
        const pinkData = pinkBuffer.getChannelData(0);
        let b0, b1, b2, b3, b4, b5, b6;
        b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
        for (let i = 0; i < sampleRate * duration; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3102503;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.01; // Very subtle
          b6 = white * 0.115926;
        }
        const pinkSource = ctx.createBufferSource();
        pinkSource.buffer = pinkBuffer;
        pinkSource.loop = true;
        
        osc.connect(filter);
        subOsc.connect(subGain);
        subGain.connect(filter);
        
        const preReverbGain = ctx.createGain();
        preReverbGain.gain.setValueAtTime(0.06, 0);
        filter.connect(preReverbGain);
        pinkSource.connect(preReverbGain);
        
        applySoftReverb(preReverbGain, gain);
        applyFades(gain);
        
        subOsc.start(0);
        pinkSource.start(0);
      } else {
        gain.gain.setValueAtTime(0.08, 0); 
        osc.connect(gain);
      }

      gain.connect(masterGainNode);
      osc.start(0);
    } 
    else if (type === 'binaural') {
      const left = ctx.createOscillator();
      const right = ctx.createOscillator();
      const merger = ctx.createChannelMerger(2);
      const gain = ctx.createGain();
      left.frequency.setValueAtTime(options.leftFreq, 0);
      right.frequency.setValueAtTime(options.rightFreq, 0);
      
      if (useSoftPitch) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(options.leftFreq, options.rightFreq) * 0.9, 0);
        
        left.connect(merger, 0, 0);
        right.connect(merger, 0, 1);
        merger.connect(filter);
        
        const preReverbGain = ctx.createGain();
        preReverbGain.gain.setValueAtTime(0.06, 0);
        filter.connect(preReverbGain);
        
        applySoftReverb(preReverbGain, gain);
        applyFades(gain);
      } else {
        gain.gain.setValueAtTime(0.08, 0);
        left.connect(merger, 0, 0);
        right.connect(merger, 0, 1);
        merger.connect(gain);
      }

      gain.connect(masterGainNode);
      left.start(0);
      right.start(0);
    }
    else if (type === 'isochronic') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const outGain = ctx.createGain();
      const lfo = ctx.createOscillator();
      osc.frequency.setValueAtTime(options.frequency, 0);
      lfo.type = options.pitchSafeMode ? 'sine' : 'square'; // Softer LFO if safe mode
      lfo.frequency.setValueAtTime(options.pulseRate, 0);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.5, 0);
      const constant = ctx.createConstantSource();
      constant.offset.setValueAtTime(0.5, 0);
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      constant.connect(gain.gain);
      osc.connect(gain);
      
      if (useSoftPitch) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(options.frequency * 0.85, 0);
        gain.connect(filter);
        
        const preReverbGain = ctx.createGain();
        preReverbGain.gain.setValueAtTime(0.06, 0);
        filter.connect(preReverbGain);
        
        applySoftReverb(preReverbGain, outGain);
        applyFades(outGain);
      } else {
        outGain.gain.setValueAtTime(0.08, 0);
        gain.connect(outGain);
      }

      outGain.connect(masterGainNode);
      lfo.start(0);
      constant.start(0);
      osc.start(0);
    }
    else if (type === 'didgeridoo') {
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const outGain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      osc.type = 'sawtooth';
      sub.type = 'sine';
      osc.frequency.setValueAtTime(options.frequency, 0);
      sub.frequency.setValueAtTime(options.frequency, 0);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(options.frequency * 2.7 * (1 + options.depth), 0);
      filter.Q.setValueAtTime(15, 0);
      lfo.frequency.setValueAtTime(0.15, 0);
      lfoGain.gain.setValueAtTime(60 * options.depth, 0);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      osc.connect(filter);
      sub.connect(filter);
      
      if (options.pitchSafeMode) {
        // Didgeridoo is naturally low, but we can still soften it
        const softFilter = ctx.createBiquadFilter();
        softFilter.type = 'lowpass';
        softFilter.frequency.setValueAtTime(options.frequency * 2, 0);
        filter.connect(softFilter);
        
        const preReverbGain = ctx.createGain();
        preReverbGain.gain.setValueAtTime(0.05, 0);
        softFilter.connect(preReverbGain);
        
        applySoftReverb(preReverbGain, outGain);
        applyFades(outGain);
      } else {
        outGain.gain.setValueAtTime(0.06, 0);
        
        if (options.physical) {
          applyPhysicalReverb(filter, outGain, options.physical);
        } else {
          filter.connect(outGain);
        }
      }

      outGain.connect(masterGainNode);
      lfo.start(0);
      osc.start(0);
      sub.start(0);
    }
    else if (type === 'shamanic') {
      const bpm = 120 * options.playbackRate;
      const interval = 60 / bpm;
      const numHits = Math.floor(duration / interval);
      const drumGain = ctx.createGain();
      
      for (let i = 0; i < numHits; i++) {
        const time = i * interval;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = 'triangle';
        const startFreq = options.frequency * (options.pitchSafeMode ? 1.3 : 1.6);
        const endFreq = options.frequency;
        
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.05);
        
        g.gain.setValueAtTime(0, time);
        let peak = 0.35 * (1 + options.depth);
        const bIntensity = options.physical?.bangingIntensity;
        if (bIntensity === 'soft') peak *= 0.7;
        if (bIntensity === 'hard') peak *= 1.3;
        g.gain.linearRampToValueAtTime(peak, time + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(options.frequency * (options.pitchSafeMode ? 2 : 4), time);
        filter.Q.setValueAtTime(2, time);
        
        osc.connect(g);
        g.connect(filter);
        filter.connect(drumGain);
        
        osc.start(time);
        osc.stop(time + 0.6);
      }

      const outGain = ctx.createGain();
      if (options.pitchSafeMode) {
        const preReverbGain = ctx.createGain();
        preReverbGain.gain.setValueAtTime(1.0, 0);
        drumGain.connect(preReverbGain);
        applySoftReverb(preReverbGain, outGain);
        applyFades(outGain);
      } else {
        if (options.physical) {
          applyPhysicalReverb(drumGain, outGain, options.physical);
        } else {
          drumGain.connect(outGain);
        }
      }

      outGain.connect(masterGainNode);
    }
    else if (type === 'mentalToughness') {
      const bpm = 110 * (options.playbackRate || 1.0); // Rhythmic focus tempo
      const interval = 60 / bpm;
      const numHits = Math.floor(duration / interval);
      const mainGain = ctx.createGain();

      for (let i = 0; i < numHits; i++) {
        const time = i * interval;
        
        // Human Impact: Low fundamental + Noise click
        const osc = ctx.createOscillator();
        const noise = ctx.createBufferSource();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();

        // 1. Fundamental Tone (Hz Depth Integration)
        let baseFreq = options.frequency || 60;
        if (options.pitch === 'soft') baseFreq *= 0.8;
        if (options.pitch === 'low') baseFreq *= 0.6;
        if (options.pitch === 'hard') baseFreq *= 1.2;
        if (options.pitch === 'loud') baseFreq *= 1.4;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq * 2, time);
        osc.frequency.exponentialRampToValueAtTime(baseFreq, time + 0.08);

        // 2. Texture Click (Noise) + Realistic Wooden Resonance
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let j = 0; j < noiseData.length; j++) noiseData[j] = Math.random() * 2 - 1;
        noise.buffer = noiseBuffer;

        f.type = 'bandpass';
        let filterFreq = 400;
        let filterQ = 5;
        let decayTime = 0.25;

        switch(options.texture) {
          case 'empty_wood':
            filterFreq = 180;
            filterQ = 14; // High resonance for deep echo
            decayTime = 0.5;
            break;
          case 'thin_wood':
            filterFreq = 850;
            filterQ = 6; // Sharper resonance
            decayTime = 0.18;
            break;
          case 'double_thin':
            filterFreq = 450;
            filterQ = 10; // Richer resonance
            decayTime = 0.35;
            break;
          case 'hollow_wood':
            filterFreq = 220;
            filterQ = 12; // Deep hollow resonance
            decayTime = 0.45;
            break;
          case 'tribal_wood':
            filterFreq = 380;
            filterQ = 8;
            decayTime = 0.3;
            break;
        }

        f.frequency.setValueAtTime(filterFreq, time);
        f.Q.setValueAtTime(filterQ, time);

        // 3. Envelope
        let peak = 0.4;
        const bIntensity = options.physical?.bangingIntensity || options.intensity;
        if (bIntensity === 'soft' || options.intensity === 'light') peak *= 0.6;
        if (bIntensity === 'medium') peak *= 1.0;
        if (bIntensity === 'hard' || options.intensity === 'strong') peak *= 1.4;
        if (options.intensity === 'deep') peak *= 1.9;

        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(peak, time + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, time + (options.intensity === 'deep' ? decayTime * 1.5 : decayTime));

        osc.connect(g);
        noise.connect(f);
        f.connect(g);
        g.connect(mainGain);

        osc.start(time);
        noise.start(time);
        osc.stop(time + 0.6);
        noise.stop(time + 0.6);
      }

      applyFades(mainGain);
      
      const outGain = ctx.createGain();
      if (options.physical) {
        applyPhysicalReverb(mainGain, outGain, options.physical);
      } else {
        mainGain.connect(outGain);
      }
      outGain.connect(masterGainNode);
    }
    else if (type === 'noise') {
      const bufferSize = sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
      const output = buffer.getChannelData(0);
      
      if (options.noiseType === 'white') {
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
      } else if (options.noiseType === 'pink') {
        let b0, b1, b2, b3, b4, b5, b6;
        b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3102503;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          output[i] *= 0.11;
          b6 = white * 0.115926;
        }
      } else {
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          const out = (lastOut + (0.02 * white)) / 1.02;
          lastOut = out;
          output[i] = out * 3.5;
        }
      }
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.06, 0); 
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(masterGainNode);
      source.start(0);
    }

    const renderedBuffer = await ctx.startRendering();
    return audioBufferToWav(renderedBuffer);
  };

  // Per-layer Compressor Refs for Normalization
  const subCompRef = useRef<DynamicsCompressorNode | null>(null);
  const binCompRef = useRef<DynamicsCompressorNode | null>(null);
  const noiseCompRef = useRef<DynamicsCompressorNode | null>(null);
  const didgCompRef = useRef<DynamicsCompressorNode | null>(null);
  const pureHzCompRef = useRef<DynamicsCompressorNode | null>(null);

  const getSafetyMultiplier = () => {
    let activeCount = 0;
    if (isPlaying) activeCount++;
    if (settings.subliminal.isEnabled && (isPlaying || settings.subliminal.playInBackground)) activeCount++;
    if (settings.binaural.isEnabled && (isPlaying || settings.binaural.playInBackground)) activeCount++;
    if (settings.nature.isEnabled && (isPlaying || settings.nature.playInBackground)) activeCount++;
    if (settings.noise.isEnabled && (isPlaying || settings.noise.playInBackground)) activeCount++;
    if (settings.didgeridoo.isEnabled && (isPlaying || settings.didgeridoo.playInBackground)) activeCount++;
    if (settings.pureHz.isEnabled && (isPlaying || settings.pureHz.playInBackground)) activeCount++;
    if (settings.isochronic.isEnabled && (isPlaying || settings.isochronic.playInBackground)) activeCount++;
    if (settings.solfeggio.isEnabled && (isPlaying || settings.solfeggio.playInBackground)) activeCount++;
    if (settings.schumann.isEnabled && (isPlaying || settings.schumann.playInBackground)) activeCount++;
    if (settings.shamanic.isEnabled && (isPlaying || settings.shamanic.playInBackground)) activeCount++;
    if (settings.mentalToughness.isEnabled && (isPlaying || settings.mentalToughness.playInBackground)) activeCount++;
    
    if (activeCount <= 2) return 1.0;
    if (activeCount <= 4) return 0.75;
    if (activeCount <= 7) return 0.55;
    return 0.4; // Safety for 8-11 layers
  };

  const safetyMultiplier = useMemo(getSafetyMultiplier, [
    isPlaying, 
    settings.subliminal.isEnabled, settings.subliminal.playInBackground,
    settings.binaural.isEnabled, settings.binaural.playInBackground,
    settings.nature.isEnabled, settings.nature.playInBackground,
    settings.noise.isEnabled, settings.noise.playInBackground,
    settings.didgeridoo.isEnabled, settings.didgeridoo.playInBackground,
    settings.pureHz.isEnabled, settings.pureHz.playInBackground,
    settings.isochronic.isEnabled, settings.isochronic.playInBackground,
    settings.solfeggio.isEnabled, settings.solfeggio.playInBackground,
    settings.schumann.isEnabled, settings.schumann.playInBackground,
    settings.shamanic.isEnabled, settings.shamanic.playInBackground,
    settings.mentalToughness.isEnabled, settings.mentalToughness.playInBackground
  ]);

  // Master Gain & Limiter for Stable Parallel Mixing
  const masterGainRef = useRef<GainNode | null>(null);
  const masterLimiterRef = useRef<DynamicsCompressorNode | null>(null);

  // Recovery: Periodically ensure enabled background layers are playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      Object.entries(bgAudioRefs.current).forEach(([id, el]) => {
        const s = (settings as any)[id];
        if (s?.isEnabled && (isPlaying || s?.playInBackground)) {
           const otherEl = bgAudioRefs2.current[id];
           const isStalled = el.paused && (!otherEl || otherEl.paused);
           
           if (isStalled) {
              console.log(`[AudioEngine] Auto-recovering parallel layer: ${id}`);
              el.play().catch(() => {
                // If play fails, the element might be in an invalid state, but for Hz layers 
                // they usually recover on next loop swap. We'll just nudge.
              });
           }
        }
      });
      
      // Nature & Subliminal specific recovery
      if (natureAudioRef.current && settings.nature.isEnabled && (isPlaying || settings.nature.playInBackground)) {
        if (natureAudioRef.current.paused) natureAudioRef.current.play().catch(() => {});
      }
      
      if (subAudioRef.current && settings.subliminal.isEnabled && (isPlaying || settings.subliminal.playInBackground)) {
        if (subAudioRef.current.paused) subAudioRef.current.play().catch(() => {});
      }

      // Sync MediaSession PlaybackState (iOS Lock Screen stability)
      if ('mediaSession' in navigator) {
        const expectedState = isPlaying ? 'playing' : 'paused';
        if (navigator.mediaSession.playbackState !== expectedState) {
          navigator.mediaSession.playbackState = expectedState;
        }
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [isPlaying, settings]);

  // Didgeridoo Refs
  const didgOscRef = useRef<OscillatorNode | null>(null);
  const didgSubOscRef = useRef<OscillatorNode | null>(null);
  const didgFilterRef = useRef<BiquadFilterNode | null>(null);
  const didgGainRef = useRef<GainNode | null>(null);
  const didgLfoRef = useRef<OscillatorNode | null>(null);
  const shamanicSettingsRef = useRef(settings.shamanic);

  useEffect(() => {
    shamanicSettingsRef.current = settings.shamanic;
  }, [settings.shamanic]);

  // Shamanic Drumming Refs
  const shamanicGainRef = useRef<GainNode | null>(null);
  const shamanicIntervalRef = useRef<number | null>(null);

  // Pure Hz Refs
  const pureHzOscRef = useRef<OscillatorNode | null>(null);
  const pureHzGainRef = useRef<GainNode | null>(null);

  // Isochronic Refs
  const isoOscRef = useRef<OscillatorNode | null>(null);
  const isoGainRef = useRef<GainNode | null>(null);
  const isoLfoRef = useRef<OscillatorNode | null>(null);
  const isoLfoGainRef = useRef<GainNode | null>(null);
  const isoCompRef = useRef<DynamicsCompressorNode | null>(null);

  // Solfeggio Refs
  const solOscRef = useRef<OscillatorNode | null>(null);
  const solGainRef = useRef<GainNode | null>(null);
  const solCompRef = useRef<DynamicsCompressorNode | null>(null);

  const schumannOscRef = useRef<OscillatorNode | null>(null);
  const schumannGainRef = useRef<GainNode | null>(null);
  const schumannCompRef = useRef<DynamicsCompressorNode | null>(null);

  // Mental Toughness Refs
  const mentalToughnessGainRef = useRef<GainNode | null>(null);
  const mentalToughnessIntervalRef = useRef<number | null>(null);
  const mentalToughnessSettingsRef = useRef(settings.mentalToughness);

  useEffect(() => {
    mentalToughnessSettingsRef.current = settings.mentalToughness;
  }, [settings.mentalToughness]);

  // iOS Background Audio & Media Session Setup
  useEffect(() => {
    // Helper to ensure AudioContext is ready on any media session action
    const withResume = (fn: () => void) => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      fn();
    };

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => withResume(() => {
        setIsPlaying(true);
        if (mainAudioRef.current && mainAudioRef.current.paused) {
          mainAudioRef.current.play().catch(() => {});
        }
      }));
      navigator.mediaSession.setActionHandler('pause', () => {
        setIsPlaying(false);
        if (mainAudioRef.current) mainAudioRef.current.pause();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => withResume(() => playNext()));
      navigator.mediaSession.setActionHandler('previoustrack', () => withResume(() => playPrevious()));
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) seekTo(details.seekTime);
        if (details.fastSeek && mainAudioRef.current) {
          mainAudioRef.current.currentTime = details.seekTime || 0;
        }
      });
      
      // iOS 16 fallback seek handlers
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        if (mainAudioRef.current) seekTo(Math.max(0, mainAudioRef.current.currentTime - offset));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        if (mainAudioRef.current) seekTo(Math.min(mainAudioRef.current.duration, mainAudioRef.current.currentTime + offset));
      });
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
      }
    };
  }, [playNext, playPrevious, setIsPlaying, seekTo]);

  // Playlist Memory Tracker - Isolated from global UI updates
  useEffect(() => {
    if (!playingPlaylistId || isLoading || currentTrackIndex === null || !isPlaying) return;
    
    const playlist = playlists.find(p => p.id === playingPlaylistId);
    if (!playlist) return;

    const currentTrackId = playlist.trackIds[currentTrackIndex];
    if (!currentTrackId) return;

    // Use a timeout to throttle updates to once every 5 seconds
    const timer = setTimeout(() => {
      updateSettings({
        playlistMemory: {
          ...settings.playlistMemory,
          [playingPlaylistId]: {
            trackId: currentTrackId,
            position: currentTime,
            timestamp: Date.now()
          }
        }
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [playingPlaylistId, currentTrackIndex, Math.floor(currentTime / 5), isPlaying, isLoading, updateSettings, settings.playlistMemory, playlists]);

  // Sync Media Session Metadata & Playback State
  useEffect(() => {
    if ('mediaSession' in navigator) {
      // Sync Playback State for iPhone Lock Screen Widget
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      if (currentTrackIndex !== null && tracks[currentTrackIndex]) {
        const track = tracks[currentTrackIndex];
        const artworkUrl = track.artwork || `https://picsum.photos/seed/${track.id}/512/512`;
        
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.name,
          artist: track.artist || 'Subliminal Artist',
          album: 'Zen Journey',
          artwork: [
            { src: artworkUrl, sizes: '96x96', type: 'image/png' },
            { src: artworkUrl, sizes: '128x128', type: 'image/png' },
            { src: artworkUrl, sizes: '192x192', type: 'image/png' },
            { src: artworkUrl, sizes: '256x256', type: 'image/png' },
            { src: artworkUrl, sizes: '384x384', type: 'image/png' },
            { src: artworkUrl, sizes: '512x512', type: 'image/png' },
          ]
        });

        // Initialize Position State
        if (mainAudioRef.current && (navigator.mediaSession as any).setPositionState) {
          try {
            (navigator.mediaSession as any).setPositionState({
              duration: mainAudioRef.current.duration || 0,
              playbackRate: settings.playbackRate || 1,
              position: mainAudioRef.current.currentTime || 0,
            });
          } catch (e) {}
        }
      } else {
        // Find active Hz layer to show in metadata if no track is playing
        const activeLayer = Object.entries(settings).find(([key, val]: [string, any]) => 
          val?.isEnabled && val?.playInBackground && ['pureHz', 'binaural', 'isochronic', 'solfeggio', 'schumann', 'didgeridoo', 'shamanic', 'noise', 'nature', 'mentalToughness'].includes(key)
        );

        if (activeLayer) {
          const [id, s] = activeLayer;
          let title = id.charAt(0).toUpperCase() + id.slice(1);
          if (id === 'pureHz') title = 'Pure Hz';
          if (id === 'solfeggio') title = 'Solfeggio';
          if (id === 'schumann') title = 'Schumann Resonance';
          
          let subtitle = 'Active Ambient Layer';
          
          if (id === 'pureHz') subtitle = `${s.frequency}Hz Pure Tone`;
          else if (id === 'solfeggio') subtitle = `${s.frequency}Hz Solfeggio`;
          else if (id === 'schumann') subtitle = `${s.frequency}Hz Resonance`;
          else if (id === 'binaural') subtitle = `Binaural: ${s.leftFreq}Hz / ${s.rightFreq}Hz`;
          else if (id === 'isochronic') subtitle = `Isochronic: ${s.pulseRate}Hz Pulse`;
          
          const ambientArtwork = `https://picsum.photos/seed/meditation/512/512`;
          
          navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: subtitle,
            album: 'Silent Journey',
            artwork: [
              { src: ambientArtwork, sizes: '512x512', type: 'image/png' }
            ]
          });
        } else {
          // Clear metadata if nothing is active
          navigator.mediaSession.metadata = null;
        }
      }
    }
  }, [currentTrackIndex, tracks, settings, isPlaying]);

  // Update background layers volume with master gain
  useEffect(() => {
    const masterGainMultiplier = settings.audioTools.gainDb !== 0 ? Math.pow(10, settings.audioTools.gainDb / 20) : 1.0;

    const layers = ['pureHz', 'binaural', 'isochronic', 'solfeggio', 'schumann', 'didgeridoo', 'shamanic', 'noise', 'mentalToughness'];
    layers.forEach(id => {
      const el1 = bgAudioRefs.current[id];
      const el2 = bgAudioRefs2.current[id];
      const s = (settings as any)[id];
      if (s && el1 && el2) {
         // Background tones are BAKED with gain/volume, so we keep HTML volume at 1.0 for stability
         // However, we ensure they are initialized
         el1.volume = 1.0;
         el2.volume = 1.0;
      }
    });

    if (natureAudioRef.current) {
      const s = settings.nature;
      const layerGain = Math.pow(10, (s.gainDb || 0) / 20);
      const volume = s.volume * layerGain * masterGainMultiplier * safetyMultiplier;
      natureAudioRef.current.volume = Math.min(1.0, Math.max(0.0, volume));
    }
    
    if (subAudioRef.current) {
      const s = settings.subliminal;
      const layerGain = Math.pow(10, (s.gainDb || 0) / 20);
      const volume = s.volume * layerGain * masterGainMultiplier * safetyMultiplier;
      subAudioRef.current.volume = Math.min(1.0, Math.max(0.0, volume));
    }

    if (mainAudioRef.current) {
      const layerGain = Math.pow(10, (settings.audioTools.gainDb || 0) / 20);
      const volume = settings.mainVolume * layerGain * safetyMultiplier;
      mainAudioRef.current.volume = Math.min(1.0, Math.max(0.0, volume));
    }
  }, [settings.audioTools.gainDb, settings.mainVolume, settings.pureHz, settings.binaural, settings.isochronic, settings.solfeggio, settings.schumann, settings.didgeridoo, settings.shamanic, settings.noise, settings.nature, settings.mentalToughness, safetyMultiplier]);

  // Consolidate Audio Elements Lifecycle & iOS Unlock
  useEffect(() => {
    // 1. Initialize elements
    const mainAudio = new Audio();
    const subAudio = new Audio();
    const natureAudio = new Audio();
    const heartbeatAudio = new Audio();
    
    [mainAudio, subAudio, natureAudio, heartbeatAudio].forEach(a => {
      (a as any).playsInline = true;
      (a as any).webkitPlaysInline = true;
      a.preload = 'auto';
    });

    natureAudio.loop = true;
    
    // Heartbeat setup - Silent looping audio to keep session active on iOS 16
    heartbeatAudio.loop = true;
    heartbeatAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/wD/"; // Tiny silent WAV
    heartbeatAudio.volume = 0.001;

    mainAudioRef.current = mainAudio;
    subAudioRef.current = subAudio;
    natureAudioRef.current = natureAudio;
    heartbeatAudioRef.current = heartbeatAudio;

    // 2. Audio State & Metadata Listeners (Consolidated for stability)
    let lastPositionUpdate = 0;
    const onTimeUpdate = () => {
      const now = Date.now();
      if (mainAudio.duration) {
        setCurrentTime(mainAudio.currentTime);
      }
      
      // Throttle Media Session position updates for iPhone 8 / iOS 16 stability
      if ('mediaSession' in navigator && (navigator.mediaSession as any).setPositionState && isPlaying && (now - lastPositionUpdate > 1000)) {
        try {
          (navigator.mediaSession as any).setPositionState({
            duration: mainAudio.duration || 0,
            playbackRate: mainAudio.playbackRate || 1,
            position: mainAudio.currentTime || 0,
          });
          lastPositionUpdate = now;
        } catch (e) {}
      }
    };
    
    const onLoadedMetadata = () => {
      setDuration(mainAudio.duration);
    };

    const onError = async () => {
      const error = mainAudio.error;
      console.warn("[AudioEngine] Main audio error:", error?.code, error?.message);
      if (!isPlaying) return;
      
      // Recovery logic for revoked Blob URLs on iOS 16
      if (error?.code === 4 || error?.code === 3) {
         if (currentTrack) {
           const freshUrl = await getTrackUrl(currentTrack.id, true);
           if (freshUrl && mainAudioRef.current) {
             mainAudioRef.current.src = freshUrl;
             mainAudioRef.current.load();
             mainAudioRef.current.play().catch(() => {});
           }
         }
      }
    };

    const onEnded = () => {
      if (settings.chunking.mode === 'merge') return; // Handled by separate merge logic
      if (settings.playbackMode === 'loop') {
        mainAudio.currentTime = 0;
        mainAudio.play().catch(() => {});
      } else {
        playNext(true);
      }
    };

    mainAudio.addEventListener('timeupdate', onTimeUpdate);
    mainAudio.addEventListener('loadedmetadata', onLoadedMetadata);
    mainAudio.addEventListener('ended', onEnded);
    mainAudio.addEventListener('error', onError);

    // 3. iOS Safari Audio Unlock Helper
    const initCtx = () => {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
      return audioCtxRef.current;
    };

    const unlockAudio = () => {
      const ctx = initCtx();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
      
      // Prioritize main audio for session focus
      if (isPlaying) {
        mainAudio.play().catch(() => {});
        [subAudio, natureAudio, heartbeatAudio].forEach(a => {
           if (a.paused) a.play().catch(() => {});
        });
      } else {
        // Pre-warm main audio first
        mainAudio.play().then(() => { mainAudio.pause(); }).catch(() => {});
        [subAudio, natureAudio, heartbeatAudio].forEach(a => {
           a.play().then(() => { if (a !== heartbeatAudio) a.pause(); }).catch(() => {});
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setIsForeground(true);
        if (audioCtxRef.current) audioCtxRef.current.resume().catch(() => {});
        if (isPlaying && mainAudio.paused) mainAudio.play().catch(() => {});
      } else {
        setIsForeground(false);
      }
    };

    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('zen-audio-unlock', unlockAudio);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('zen-audio-unlock', unlockAudio);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      
      mainAudio.removeEventListener('timeupdate', onTimeUpdate);
      mainAudio.removeEventListener('loadedmetadata', onLoadedMetadata);
      mainAudio.removeEventListener('ended', onEnded);
      mainAudio.removeEventListener('error', onError);

      [mainAudio, subAudio, natureAudio, heartbeatAudio].forEach(a => {
        a.pause();
        a.src = '';
      });

      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
      
      mainAudioRef.current = null;
      subAudioRef.current = null;
      natureAudioRef.current = null;
      heartbeatAudioRef.current = null;
    };
  }, [playNext, isPlaying, settings.chunking.mode, settings.playbackMode, currentTrack]); // Added dependencies for correct listener context

  // Determine if we actually need Web Audio active
  const needsWebAudio = useMemo(() => {
    return (isPlaying && (
      !settings.subliminal.playInBackground ||
      !settings.binaural.playInBackground ||
      !settings.noise.playInBackground ||
      !settings.nature.playInBackground ||
      !settings.didgeridoo.playInBackground ||
      !settings.shamanic.playInBackground ||
      !settings.pureHz.playInBackground ||
      !settings.isochronic.playInBackground ||
      !settings.solfeggio.playInBackground ||
      !settings.mentalToughness.playInBackground
    )) || false;
  }, [isPlaying, settings]);

  // Audio Context Heartbeat & Battery Management
  useEffect(() => {
    const interval = setInterval(() => {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;

      if (needsWebAudio && isPlaying) {
        if (ctx.state === 'suspended') {
          console.log('[AudioEngine] Power Save: Resuming context for active layer');
          ctx.resume().catch(() => {});
        }
      } else {
        if (ctx.state === 'running') {
          console.log('[AudioEngine] Power Save: Suspending idle context');
          ctx.suspend().catch(() => {});
        }
      }
      
      // Playback State Nudge (iOS 16 Safety)
      if (isPlaying && mainAudioRef.current) {
        const audio = mainAudioRef.current;
        if (audio.paused && !audio.ended && audio.readyState > 2) {
          console.log('[AudioEngine] Heartbeat: Restoring interrupted playback');
          audio.play().catch(() => {});
        }
      }
    }, 10000); // 10s is enough for power saving check

    return () => clearInterval(interval);
  }, [isPlaying, needsWebAudio]);

  const createNoiseBuffer = (type: 'white' | 'pink' | 'brown') => {
    if (!audioCtxRef.current) return null;
    const ctx = audioCtxRef.current;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0, b1, b2, b3, b4, b5, b6;
      b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3102503;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11; // (roughly) apply gain
        b6 = white * 0.115926;
      }
    } else if (type === 'brown') {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const out = (lastOut + (0.02 * white)) / 1.02;
        lastOut = out;
        output[i] = out * 3.5; // (roughly) apply gain
      }
    }
    return buffer;
  };

  // Helper: Sync Background Layer with Gapless Looping (Double Buffering)
  const syncBgLayer = async (layerId: string, isLayerPlaying: boolean, type: string, params: any, volume: number, gainDb: number) => {
    if (isLayerPlaying) {
      if (!bgAudioRefs.current[layerId]) {
        const createEl = () => {
          const el = new Audio();
          (el as any).playsInline = true;
          (el as any).webkitPlaysInline = true;
          return el;
        };
        bgAudioRefs.current[layerId] = createEl();
        bgAudioRefs2.current[layerId] = createEl();
        activeBgRef.current[layerId] = 1;

        // Progress tracking on both
        [bgAudioRefs.current[layerId], bgAudioRefs2.current[layerId]].forEach(el => {
          el.addEventListener('timeupdate', () => {
            if (activeBgRef.current[layerId] === (el === bgAudioRefs.current[layerId] ? 1 : 2)) {
              // THROTTLE: Only update UI progress if foreground or every ~2s if background to keep it alive
              const now = Date.now();
              const lastUpdate = (el as any).lastProgressTime || 0;
              const throttleMs = document.visibilityState === 'visible' ? 250 : 2000;
              
              if (now - lastUpdate > throttleMs) {
                updateLayerProgress(layerId, {
                  currentTime: el.currentTime,
                  duration: el.duration || 30
                });
                (el as any).lastProgressTime = now;
              }
              
              // Gapless Logic: Trigger next buffer 0.5s before end (safer for iPhone 8)
              if (el.duration > 0 && el.currentTime > el.duration - 0.5) {
                 const otherIdx = activeBgRef.current[layerId] === 1 ? 2 : 1;
                 const otherEl = otherIdx === 1 ? bgAudioRefs.current[layerId] : bgAudioRefs2.current[layerId];
                 if (otherEl.paused) {
                   console.log(`[AudioEngine] Gapless Swap for ${layerId} to buffer ${otherIdx}`);
                   otherEl.currentTime = 0;
                   otherEl.play().catch(() => {});
                   activeBgRef.current[layerId] = otherIdx;
                   
                   // crossfade
                   const fadeOutEl = el;
                   const fadeInEl = otherEl;
                   let fadeStep = 0;
                   const steps = 10;
                   const fadeInterval = setInterval(() => {
                      fadeStep++;
                      const vol = 1.0;
                      fadeInEl.volume = (fadeStep / steps) * vol;
                      fadeOutEl.volume = (1 - (fadeStep / steps)) * vol;
                      if (fadeStep >= steps) {
                        clearInterval(fadeInterval);
                        fadeOutEl.pause();
                        fadeOutEl.currentTime = 0;
                      }
                   }, 30);
                 }
              }
            }
          });
          el.addEventListener('ended', () => {
            // Backup for timeupdate miss
            const otherIdx = el === bgAudioRefs.current[layerId] ? 2 : 1;
            const otherEl = otherIdx === 1 ? bgAudioRefs.current[layerId] : bgAudioRefs2.current[layerId];
            if (otherEl.paused) {
              otherEl.currentTime = 0;
              otherEl.play().catch(() => {});
              activeBgRef.current[layerId] = otherIdx;
            }
          });
        });
      }

    const activeIdx = activeBgRef.current[layerId];
    const el = activeIdx === 1 ? bgAudioRefs.current[layerId] : bgAudioRefs2.current[layerId];
    const otherEl = activeIdx === 1 ? bgAudioRefs2.current[layerId] : bgAudioRefs.current[layerId];

    // Master Gain Multiplier for baking
    const masterGainDb = settings.audioTools.gainDb;
    const masterGainMultiplier = masterGainDb !== 0 ? Math.pow(10, masterGainDb / 20) : 1.0;

    // Trigger regeneration if Hz, Volume, Gain, or Safety Multiplier changes
    const extendedParams = { 
      ...params, 
      volume, 
      gainDb, 
      masterGainDb,
      safetyMultiplier
    };
    const paramKey = JSON.stringify(extendedParams);
    
    if (bgAudioParams.current[layerId] !== paramKey) {
      // Debounce generation for slider smoothness on iPhone 8
      const now = Date.now();
      const lastGen = lastBgGenTime.current[layerId] || 0;
      if (now - lastGen < 350) return; // Wait for user to stop sliding
      
      lastBgGenTime.current[layerId] = now;
      
      if (bgAudioUrls.current[layerId]) URL.revokeObjectURL(bgAudioUrls.current[layerId]);
      
      const blob = await generateToneBlob(type, extendedParams);
      const url = URL.createObjectURL(blob);
      registerUrl(url); // Track for cleanup
      bgAudioUrls.current[layerId] = url;
      bgAudioParams.current[layerId] = paramKey;
      
      [bgAudioRefs.current[layerId], bgAudioRefs2.current[layerId]].forEach(a => {
        a.src = url;
        a.load();
      });
    }

    // Since gain is BAKED into the file, we keep the HTML element at 1.0 volume
    // This bypasses the unreliable iOS 16 <audio> volume property in background
    el.volume = 1.0;
    if (el.paused && otherEl.paused) {
      el.play().catch(() => {});
    }
    } else {
      const el1 = bgAudioRefs.current[layerId];
      const el2 = bgAudioRefs2.current[layerId];
      if (el1) el1.pause();
      if (el2) el2.pause();
      
      if (!isLayerPlaying) {
        if (el1) { el1.src = ''; el1.load(); }
        if (el2) { el2.src = ''; el2.load(); }
        if (bgAudioUrls.current[layerId]) {
          URL.revokeObjectURL(bgAudioUrls.current[layerId]);
          delete bgAudioUrls.current[layerId];
        }
        delete bgAudioParams.current[layerId];
        updateLayerProgress(layerId, { currentTime: 0, duration: 0 });
      }
    }
  };

  const setupNoise = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      
      setupAudioTools(); // Ensure master routing is ready

      if (!noiseGainRef.current) {
        const gain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();
        
        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        comp.connect(gain);
        
        // Connect to Master Gain instead of direct destination
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }
        
        noiseGainRef.current = gain;
        noiseCompRef.current = comp;
      }
    } catch (err) {
      console.error("Failed to setup noise context:", err);
    }
  };

  const setupBinaural = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      setupAudioTools(); // Ensure master routing is ready

      if (!leftOscRef.current || !rightOscRef.current) {
        // Create Nodes
        const leftOsc = ctx.createOscillator();
        const rightOsc = ctx.createOscillator();
        const merger = ctx.createChannelMerger(2);
        const gainNode = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);

        leftOsc.type = 'sine';
        rightOsc.type = 'sine';

        // Initial frequencies
        leftOsc.frequency.setValueAtTime(settings.binaural.leftFreq, ctx.currentTime);
        rightOsc.frequency.setValueAtTime(settings.binaural.rightFreq, ctx.currentTime);

        const isPitchRange = (freq: number) => freq >= 200 && freq <= 1900;
        const useSoftPitch = settings.binaural.pitchSafeMode && isPitchRange((settings.binaural.leftFreq + settings.binaural.rightFreq) / 2);

        // Route: Left -> Channel 0, Right -> Channel 1 (Explicit Stereo)
        leftOsc.connect(merger, 0, 0);
        rightOsc.connect(merger, 0, 1);

        if (useSoftPitch) {
           const filter = ctx.createBiquadFilter();
           filter.type = 'lowpass';
           filter.frequency.setValueAtTime(Math.min(settings.binaural.leftFreq, settings.binaural.rightFreq) * 0.9, ctx.currentTime);
           merger.connect(filter);
           
           const preReverbGain = ctx.createGain();
           preReverbGain.gain.setValueAtTime(1.0, ctx.currentTime);
           filter.connect(preReverbGain);
           
           applySoftReverbEffect(ctx, preReverbGain, comp);
        } else {
           merger.connect(comp);
        }
        
        comp.connect(gainNode);
        
        // Connect to Master Gain instead of direct destination
        if (masterGainRef.current) {
          gainNode.connect(masterGainRef.current);
        } else {
          gainNode.connect(ctx.destination);
        }

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        leftOsc.start();
        rightOsc.start();

        leftOscRef.current = leftOsc;
        rightOscRef.current = rightOsc;
        binauralGainRef.current = gainNode;
        binCompRef.current = comp;
      }
    } catch (err) {
      console.error("Binaural setup failed:", err);
    }
  };

  const setupDidgeridoo = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools();

      if (!didgOscRef.current) {
        const osc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const gain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);

        // Deep drone fundamental
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(settings.didgeridoo.frequency, ctx.currentTime);

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(settings.didgeridoo.frequency, ctx.currentTime);

        // Vocalizing filter
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180 * (1 + settings.didgeridoo.depth), ctx.currentTime);
        filter.Q.setValueAtTime(15, ctx.currentTime);

        // Slow modulation for "breath"
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.15, ctx.currentTime);
        lfoGain.gain.setValueAtTime(60 * settings.didgeridoo.depth, ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        osc.connect(filter);
        subOsc.connect(filter);

        if (settings.didgeridoo.pitchSafeMode) {
          const softFilter = ctx.createBiquadFilter();
          softFilter.type = 'lowpass';
          softFilter.frequency.setValueAtTime(settings.didgeridoo.frequency * 2, ctx.currentTime);
          filter.connect(softFilter);
          
          const preReverbGain = ctx.createGain();
          preReverbGain.gain.setValueAtTime(1.0, ctx.currentTime);
          softFilter.connect(preReverbGain);
          
          applySoftReverbEffect(ctx, preReverbGain, comp);
        } else {
          filter.connect(comp);
        }

        comp.connect(gain);
        
        // Connect to Master Gain
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }

        gain.gain.setValueAtTime(0, ctx.currentTime);

        osc.start();
        subOsc.start();
        lfo.start();

        didgOscRef.current = osc;
        didgSubOscRef.current = subOsc;
        didgFilterRef.current = filter;
        didgGainRef.current = gain;
        didgLfoRef.current = lfo;
      }
    } catch (err) {
      console.error("Didgeridoo setup failed:", err);
    }
  };

  const setupShamanic = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools();

      if (!shamanicGainRef.current) {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }

        shamanicGainRef.current = gain;

        let nextHitTime = ctx.currentTime;
        const scheduleDrum = () => {
          if (!shamanicGainRef.current) return;
          const s = shamanicSettingsRef.current;
          const bpm = 120 * s.playbackRate;
          const interval = 60 / bpm;

          while (nextHitTime < ctx.currentTime + 0.2) {
            const time = nextHitTime;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            
            osc.type = 'triangle';
            const f = s.frequency;
            osc.frequency.setValueAtTime(f * 1.6, time);
            osc.frequency.exponentialRampToValueAtTime(f, time + 0.05);
            
            g.gain.setValueAtTime(0, time);
            g.gain.linearRampToValueAtTime(0.35 * (1 + s.depth), time + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(f * 4, time);
            filter.Q.setValueAtTime(2, time);
            
            osc.connect(g);
            g.connect(filter);

            if (s.pitchSafeMode) {
              const preRev = ctx.createGain();
              preRev.gain.setValueAtTime(1.0, time);
              filter.connect(preRev);
              applySoftReverbEffect(ctx, preRev, shamanicGainRef.current!);
            } else {
              filter.connect(shamanicGainRef.current!);
            }
            
            osc.start(time);
            osc.stop(time + 0.6);

            nextHitTime += interval;
          }
        };

        shamanicIntervalRef.current = window.setInterval(scheduleDrum, 100);
      }
    } catch (err) {
      console.error("Shamanic setup failed:", err);
    }
  };

  const setupPureHz = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools();

      if (!pureHzOscRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);

        osc.type = 'sine'; // Always sine for pure tones
        osc.frequency.setValueAtTime(settings.pureHz.frequency, ctx.currentTime);

        const isPitchRange = (freq: number) => freq >= 200 && freq <= 1900;
        const useSoftPitch = settings.pureHz.pitchSafeMode && isPitchRange(settings.pureHz.frequency);

        if (useSoftPitch) {
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(settings.pureHz.frequency * 0.8, ctx.currentTime);
          
          const subOsc = ctx.createOscillator();
          subOsc.type = 'sine';
          subOsc.frequency.setValueAtTime(settings.pureHz.frequency / 2, ctx.currentTime);
          const subGain = ctx.createGain();
          subGain.gain.setValueAtTime(0.15, ctx.currentTime);
          
          osc.connect(filter);
          subOsc.connect(subGain);
          subGain.connect(filter);
          
          const preReverbGain = ctx.createGain();
          preReverbGain.gain.setValueAtTime(1.0, ctx.currentTime);
          filter.connect(preReverbGain);
          
          applySoftReverbEffect(ctx, preReverbGain, comp);
          subOsc.start();
        } else {
          osc.connect(comp);
        }
        
        comp.connect(gain);
        
        // Connect to Master Gain
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }

        gain.gain.setValueAtTime(0, ctx.currentTime);
        osc.start();

        pureHzOscRef.current = osc;
        pureHzGainRef.current = gain;
        pureHzCompRef.current = comp;
      }
    } catch (err) {
      console.error("Pure Hz setup failed:", err);
    }
  };

  const setupIsochronic = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools();

      if (!isoOscRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(settings.isochronic.frequency, ctx.currentTime);

        // Isochronic pulse (LFO on gain)
        lfo.type = settings.isochronic.pitchSafeMode ? 'sine' : 'square'; // Softer LFO if safe mode
        lfo.frequency.setValueAtTime(settings.isochronic.pulseRate, ctx.currentTime);
        
        // Connect LFO to Gain.gain via an offset
        lfoGain.gain.setValueAtTime(0.5, ctx.currentTime);
        const constantSource = ctx.createConstantSource();
        constantSource.offset.setValueAtTime(0.5, ctx.currentTime);
        constantSource.start();
        
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        constantSource.connect(gain.gain);

        const isPitchRange = (freq: number) => freq >= 200 && freq <= 1900;
        const useSoftPitch = settings.isochronic.pitchSafeMode && isPitchRange(settings.isochronic.frequency);

        if (useSoftPitch) {
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(settings.isochronic.frequency * 0.85, ctx.currentTime);
          osc.connect(filter);
          
          const preReverbGain = ctx.createGain();
          preReverbGain.gain.setValueAtTime(1.0, ctx.currentTime);
          filter.connect(preReverbGain);
          
          applySoftReverbEffect(ctx, preReverbGain, comp);
        } else {
          osc.connect(comp);
        }
        
        comp.connect(gain);
        
        // Connect to Master Gain
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }

        osc.start();
        lfo.start();

        isoOscRef.current = osc;
        isoGainRef.current = gain;
        isoLfoRef.current = lfo;
        isoLfoGainRef.current = lfoGain;
        isoCompRef.current = comp;
      }
    } catch (err) {
      console.error("Isochronic setup failed:", err);
    }
  };

  const setupSolfeggio = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools();

      if (!solOscRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(settings.solfeggio.frequency, ctx.currentTime);

        const isPitchRange = (freq: number) => freq >= 200 && freq <= 1900;
        const useSoftPitch = settings.solfeggio.pitchSafeMode && isPitchRange(settings.solfeggio.frequency);

        if (useSoftPitch) {
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(settings.solfeggio.frequency * 0.8, ctx.currentTime);
          
          const subOsc = ctx.createOscillator();
          subOsc.type = 'sine';
          subOsc.frequency.setValueAtTime(settings.solfeggio.frequency / 2, ctx.currentTime);
          const subGain = ctx.createGain();
          subGain.gain.setValueAtTime(0.15, ctx.currentTime);
          
          osc.connect(filter);
          subOsc.connect(subGain);
          subGain.connect(filter);
          
          const preReverbGain = ctx.createGain();
          preReverbGain.gain.setValueAtTime(1.0, ctx.currentTime);
          filter.connect(preReverbGain);
          
          applySoftReverbEffect(ctx, preReverbGain, comp);
          subOsc.start();
        } else {
          osc.connect(comp);
        }
        
        comp.connect(gain);
        
        // Connect to Master Gain
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }

        gain.gain.setValueAtTime(0, ctx.currentTime);
        osc.start();

        solOscRef.current = osc;
        solGainRef.current = gain;
        solCompRef.current = comp;
      }
    } catch (err) {
      console.error("Solfeggio setup failed:", err);
    }
  };

  const setupSchumann = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools();

      if (!schumannOscRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        comp.threshold.setValueAtTime(-24, ctx.currentTime);
        comp.ratio.setValueAtTime(12, ctx.currentTime);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(settings.schumann.frequency, ctx.currentTime);

        // Always use a soft meditational setup for Schumann to prevent harshness in low end
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(settings.schumann.frequency * 8, ctx.currentTime); // Allow harmonics but keep it warm
        
        const preReverbGain = ctx.createGain();
        preReverbGain.gain.setValueAtTime(1.0, ctx.currentTime);
        
        osc.connect(filter);
        filter.connect(preReverbGain);
        
        applySoftReverbEffect(ctx, preReverbGain, comp);
        
        comp.connect(gain);
        
        // Connect to Master Gain
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }

        gain.gain.setValueAtTime(0, ctx.currentTime);
        osc.start();

        schumannOscRef.current = osc;
        schumannGainRef.current = gain;
        schumannCompRef.current = comp;
      }
    } catch (err) {
      console.error("Schumann setup failed:", err);
    }
  };

  const setupMentalToughness = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools();

      if (!mentalToughnessGainRef.current) {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        
        if (masterGainRef.current) {
          gain.connect(masterGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }

        mentalToughnessGainRef.current = gain;

        let nextHitTime = ctx.currentTime;
        const schedule = () => {
          if (!mentalToughnessGainRef.current) return;
          const s = mentalToughnessSettingsRef.current;
          const bpm = 110 * s.playbackRate;
          const interval = 60 / bpm;

          while (nextHitTime < ctx.currentTime + 0.2) {
            const time = nextHitTime;
            const osc = ctx.createOscillator();
            const noise = ctx.createBufferSource();
            const g = ctx.createGain();
            const f = ctx.createBiquadFilter();

            const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let j = 0; j < noiseData.length; j++) noiseData[j] = Math.random() * 2 - 1;
            noise.buffer = noiseBuffer;

            let baseFreq = s.frequency;
            if (s.pitch === 'soft') baseFreq *= 0.8;
            if (s.pitch === 'low') baseFreq *= 0.6;
            if (s.pitch === 'hard') baseFreq *= 1.2;
            if (s.pitch === 'loud') baseFreq *= 1.4;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(baseFreq * 2, time);
            osc.frequency.exponentialRampToValueAtTime(baseFreq, time + 0.08);

            // Use Realistic Wooden Impact Logic for Foreground scheduler
            const isWood = ['empty_wood', 'thin_wood', 'double_thin', 'hollow_wood', 'tribal_wood'].includes(s.texture);
            f.type = isWood ? 'bandpass' : 'lowpass';
            
            let filterFreq = s.frequency;
            let filterQ = 2;
            let decayTime = 0.25;

            switch(s.texture as any) {
              case 'empty_wood':
                filterFreq = 180;
                filterQ = 14;
                decayTime = 0.55;
                break;
              case 'thin_wood':
                filterFreq = 850;
                filterQ = 6;
                decayTime = 0.2;
                break;
              case 'double_thin':
                filterFreq = 450;
                filterQ = 10;
                decayTime = 0.38;
                break;
              case 'hollow_wood':
                filterFreq = 220;
                filterQ = 12;
                decayTime = 0.48;
                break;
              case 'tribal_wood':
                filterFreq = 120;
                filterQ = 8;
                decayTime = 0.65;
                break;
              default:
                filterFreq = 400;
                filterQ = 4;
                decayTime = 0.25;
            }

            f.frequency.setValueAtTime(filterFreq, time);
            f.Q.setValueAtTime(filterQ, time);

            let peak = 0.45;
            if (s.intensity === 'light') { peak = 0.25; decayTime *= 0.7; }
            if (s.intensity === 'strong') { peak = 0.75; decayTime *= 1.2; }
            if (s.intensity === 'deep') { peak = 0.95; decayTime *= 1.5; }

            g.gain.setValueAtTime(0, time);
            g.gain.linearRampToValueAtTime(peak, time + 0.005);
            g.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

            osc.connect(g);
            noise.connect(f);
            f.connect(g);

            if (s.pitchSafeMode) {
              const preRev = ctx.createGain();
              preRev.gain.setValueAtTime(1.0, time);
              g.connect(preRev);
              applySoftReverbEffect(ctx, preRev, mentalToughnessGainRef.current!);
            } else {
              g.connect(mentalToughnessGainRef.current!);
            }

            osc.start(time);
            noise.start(time);
            osc.stop(time + decayTime);
            noise.stop(time + decayTime);

            nextHitTime += interval;
          }
        };

        mentalToughnessIntervalRef.current = window.setInterval(schedule, 100);
      }
    } catch (err) {
      console.error("Mental Toughness setup failed:", err);
    }
  };

  const setupNature = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      setupAudioTools(); // Ensure master routing is ready

      if (natureAudioRef.current && !natureSourceRef.current) {
        natureSourceRef.current = ctx.createMediaElementSource(natureAudioRef.current);
        natureGainRef.current = ctx.createGain();
        natureCompRef.current = ctx.createDynamicsCompressor();
        
        natureCompRef.current.threshold.setValueAtTime(-24, ctx.currentTime);
        natureCompRef.current.ratio.setValueAtTime(12, ctx.currentTime);
        
        natureSourceRef.current.connect(natureCompRef.current);
        natureCompRef.current.connect(natureGainRef.current);
        
        // Connect to Master Gain
        if (masterGainRef.current) {
          natureGainRef.current.connect(masterGainRef.current);
        } else {
          natureGainRef.current.connect(ctx.destination);
        }
      }
    } catch (err) {
      console.error("Nature setup failed:", err);
    }
  };

  // Handle Seek Request
  useEffect(() => {
    if (seekRequest !== null && mainAudioRef.current) {
      if (settings.chunking.mode === 'merge' && chunkPlanRef.current) {
        const plan = chunkPlanRef.current;
        const chunk = plan.chunks[settings.chunking.currentChunkIndex];
        
        let offset = 0;
        // Find offset of the current track within the chunk
        // This is a bit complex because we need to know WHICH track the user is seeking on
        // But usually seekTo is called on the CURRENTLY displayed track.
        // So we can use currentTrackIndex to find the current track's offset in the chunk.
        
        let tracksBeforeChunk = 0;
        for (let i = 0; i < settings.chunking.currentChunkIndex; i++) {
          tracksBeforeChunk += plan.chunks[i].trackIds.length;
        }
        const indexInChunk = currentTrackIndex! - tracksBeforeChunk;
        
        const calcOffset = async () => {
          let trackOffset = 0;
          for (let i = 0; i < indexInChunk; i++) {
            trackOffset += await ChunkManager.getAudioDuration(chunk.trackIds[i]);
          }
          console.log(`[AudioEngine] Seeking in merged chunk. Track offset: ${trackOffset}, Seek val: ${seekRequest}`);
          mainAudioRef.current!.currentTime = trackOffset + seekRequest;
          clearSeekRequest();
        };
        calcOffset();
      } else {
        mainAudioRef.current.currentTime = seekRequest;
        clearSeekRequest();
      }
    }
  }, [seekRequest, settings.chunking]);

  // Resolve Main URL
  useEffect(() => {
    if (currentTrack && !currentTrack.isMissing) {
      getTrackUrl(currentTrack.id).then(url => {
        setPreparedUrl(url);
      });
    } else {
      setPreparedUrl(null);
    }
  }, [currentTrack?.id, getTrackUrl]);

  // Unified sourcing: Check both lists for the subliminal track
  const subTrack = useMemo(() => {
    // If playlist mode is on, we derive track from the selected playlist and our internal index
    if (settings.subliminal.isPlaylistMode && settings.subliminal.sourcePlaylistId) {
      const playlist = playlists.find(p => p.id === settings.subliminal.sourcePlaylistId);
      if (playlist && playlist.trackIds.length > 0) {
        // Ensure index is within bounds
        const trackId = playlist.trackIds[subPlaylistIndexRef.current % playlist.trackIds.length];
        return (tracks.find(t => t.id === trackId) || (subliminalTracks || []).find((t: any) => t.id === trackId));
      }
    }
    
    return (subliminalTracks || []).find((t: any) => t.id === settings.subliminal.selectedTrackId) || 
           tracks.find(t => t.id === settings.subliminal.selectedTrackId);
  }, [subliminalTracks, tracks, settings.subliminal.selectedTrackId, settings.subliminal.isPlaylistMode, settings.subliminal.sourcePlaylistId, playlists]);

  // Resolve Sub URL
  useEffect(() => {
    if (subTrack && !subTrack.isMissing) {
      getTrackUrl(subTrack.id).then(url => {
        setPreparedSubUrl(url);
      });
    } else {
      setPreparedSubUrl(null);
    }
  }, [subTrack?.id, getTrackUrl]);

  // Reset Subliminal Index on mode/playlist change
  useEffect(() => {
    subPlaylistIndexRef.current = 0;
  }, [settings.subliminal.sourcePlaylistId, settings.subliminal.isPlaylistMode]);


  // Handle Subliminal Source Sync
  useEffect(() => {
    if (subAudioRef.current && subTrack && preparedSubUrl) {
      if (subAudioRef.current.src !== preparedSubUrl) {
        subAudioRef.current.src = preparedSubUrl;
        subAudioRef.current.load();
      }
    }
  }, [subTrack, preparedSubUrl]);

  const setupAudioTools = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      // 1. Setup Master Routing (The Final Gate)
      if (!masterGainRef.current) {
        masterGainRef.current = ctx.createGain();
        masterLimiterRef.current = ctx.createDynamicsCompressor();
        
        // Safety Limiter to prevent clipping across all layers
        const limiter = masterLimiterRef.current;
        limiter.threshold.setValueAtTime(-1.0, ctx.currentTime);
        limiter.knee.setValueAtTime(0, ctx.currentTime);
        limiter.ratio.setValueAtTime(20, ctx.currentTime);
        limiter.attack.setValueAtTime(0.001, ctx.currentTime);
        limiter.release.setValueAtTime(0.1, ctx.currentTime);
        
        masterGainRef.current.connect(limiter);
        limiter.connect(ctx.destination);
        
        // Default master gain is 1.0 (individual layers have their own gains)
        masterGainRef.current.gain.setValueAtTime(1.0, ctx.currentTime);
      }
      
      // 2. Setup Tool Routing (Playlist & Subliminal)
      if (!toolGainRef.current) {
        toolGainRef.current = ctx.createGain();
        toolCompressorRef.current = ctx.createDynamicsCompressor();
        
        const comp = toolCompressorRef.current;
        comp.threshold.setValueAtTime(settings.audioTools.normalizeTargetDb !== null ? settings.audioTools.normalizeTargetDb : 0, ctx.currentTime);
        comp.knee.setValueAtTime(0, ctx.currentTime);
        comp.ratio.setValueAtTime(20, ctx.currentTime);
        comp.attack.setValueAtTime(0.003, ctx.currentTime);
        comp.release.setValueAtTime(0.25, ctx.currentTime);
        
        toolGainRef.current.connect(comp);
        // Connect tool chain to master gain
        comp.connect(masterGainRef.current);
      }
      
      if (mainAudioRef.current && !mainSourceRef.current && !settings.audioTools.playInBackground) {
        mainSourceRef.current = ctx.createMediaElementSource(mainAudioRef.current);
        if (!mainGainRef.current) {
          mainGainRef.current = ctx.createGain();
        }
        mainSourceRef.current.connect(mainGainRef.current);
        mainGainRef.current.connect(toolGainRef.current);
      }
      
      if (subAudioRef.current && !subSourceRef.current && !settings.subliminal.playInBackground) {
        subSourceRef.current = ctx.createMediaElementSource(subAudioRef.current);
        
        if (!subSpecificGainRef.current) {
          subSpecificGainRef.current = ctx.createGain();
        }
        if (!subCompRef.current) {
          subCompRef.current = ctx.createDynamicsCompressor();
          subCompRef.current.threshold.setValueAtTime(-24, ctx.currentTime);
          subCompRef.current.ratio.setValueAtTime(12, ctx.currentTime);
        }
        
        subSourceRef.current.connect(subCompRef.current);
        subCompRef.current.connect(subSpecificGainRef.current);
        subSpecificGainRef.current.connect(toolGainRef.current);
      }
    } catch (err) {
      console.error("Audio tools setup failed:", err);
    }
  };

  // Handle Audio Tools Real-time Updates - Throttled for stability on iPhone 8
  const lastAppliedGainRef = useRef<number>(-999);
  const gainThrottleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      
      const updateNodes = () => {
        // Update Master Gain - Applying to ALL layers via masterGainRef
        if (masterGainRef.current) {
          const gainDb = Math.max(-60, Math.min(0, settings.audioTools.gainDb));
          const gainValue = Math.pow(10, gainDb / 20);
          masterGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, 0.05);
          lastAppliedGainRef.current = settings.audioTools.gainDb;
        }
        
        // Update Main Volume
        if (mainGainRef.current && !settings.audioTools.playInBackground) {
          mainGainRef.current.gain.setTargetAtTime(settings.mainVolume, ctx.currentTime, 0.05);
        }

        // Update Subliminal Specific Gain & Normalize
        if (subSpecificGainRef.current) {
          const subGainValue = Math.pow(10, settings.subliminal.gainDb / 20);
          subSpecificGainRef.current.gain.setTargetAtTime(subGainValue, ctx.currentTime, 0.05);
        }
        if (subCompRef.current) {
          const threshold = settings.subliminal.normalize ? -24 : 0;
          subCompRef.current.threshold.setTargetAtTime(threshold, ctx.currentTime, 0.1);
        }
        
        // Update Normalization Compressor (Master)
        if (toolCompressorRef.current) {
          const targetDb = settings.audioTools.normalizeTargetDb !== null ? settings.audioTools.normalizeTargetDb : 0;
          toolCompressorRef.current.threshold.setTargetAtTime(targetDb, ctx.currentTime, 0.1);
        }
      };

      if (gainThrottleTimeoutRef.current) {
        clearTimeout(gainThrottleTimeoutRef.current);
      }

      // If it's a big jump or first time, update immediately
      if (Math.abs(lastAppliedGainRef.current - settings.audioTools.gainDb) > 2) {
        updateNodes();
      } else {
        // Otherwise throttle for smoothness and to prevent layout/engine thrashing
        gainThrottleTimeoutRef.current = window.setTimeout(updateNodes, 50);
      }
    }
    return () => {
      if (gainThrottleTimeoutRef.current) clearTimeout(gainThrottleTimeoutRef.current);
    };
  }, [settings.audioTools.gainDb, settings.audioTools.normalizeTargetDb, settings.subliminal.gainDb, settings.subliminal.normalize, settings.mainVolume, settings.audioTools.playInBackground]);

  // Handle Background Toggles (Main/Sub) - Flush to un-hijack from Web Audio if needed
  useEffect(() => {
    if (mainAudioRef.current && mainSourceRef.current) {
      const curTime = mainAudioRef.current.currentTime;
      const wasPlaying = isPlaying;
      
      // We must neutralize the source ref and refresh the element to detach from Web Audio
      mainSourceRef.current.disconnect();
      mainSourceRef.current = null;
      mainGainRef.current = null;
      
      mainAudioRef.current.pause();
      mainAudioRef.current.src = "";
      mainAudioRef.current.load();
      
      setTimeout(() => {
        if (mainAudioRef.current && preparedUrl) {
          mainAudioRef.current.src = preparedUrl;
          mainAudioRef.current.currentTime = curTime;
          if (wasPlaying) mainAudioRef.current.play().catch(() => {});
        }
      }, 100);
    }
  }, [settings.audioTools.playInBackground]);

  useEffect(() => {
    if (subAudioRef.current && subSourceRef.current) {
      subSourceRef.current.disconnect();
      subSourceRef.current = null;
      subSpecificGainRef.current = null;
      
      subAudioRef.current.pause();
      subAudioRef.current.src = "";
      subAudioRef.current.load();
      
      setTimeout(() => {
        if (subAudioRef.current && preparedSubUrl) {
          subAudioRef.current.src = preparedSubUrl;
          if (isPlaying) subAudioRef.current.play().catch(() => {});
        }
      }, 100);
    }
  }, [settings.subliminal.playInBackground]);

  // Invalidate chunks if critical settings change
  useEffect(() => {
    // We only invalidate if in merge mode
    if (settings.chunking.mode === 'merge') {
      const invalidate = async () => {
        console.log("[AudioEngine] Invaliding chunks due to gainDb change");
        const chunks = await db.getAllChunkMetadata();
        for (const c of chunks) await db.deleteChunk(c.id);
        
        // If we were playing, we need to reload the current chunk source
        if (isPlaying && mainAudioRef.current) {
          activeChunkIdRef.current = null; // Force reload in applySources effect
        }
      };
      invalidate();
    }
  }, [settings.mainGainDb]);

  // Main Audio Playback Loop - Chunk or Direct Path
  useEffect(() => {
    if (!mainAudioRef.current) return;
    const audio = mainAudioRef.current;

    const handleTimeUpdate = async () => {
      // Chunk Transition Logic (Only if Merge Mode)
      if (settings.chunking.mode === 'merge' && audio.duration > 0 && audio.currentTime > audio.duration - 0.5) {
        // Prepare next chunk transition
        const { activePlaylistId, currentChunkIndex } = settings.chunking;
        const plan = chunkPlanRef.current;
        if (!plan || activePlaylistId !== plan.playlistId) return;

        const nextIdx = (currentChunkIndex + 1) >= plan.chunks.length ? (settings.playbackMode === 'loop' ? 0 : -1) : currentChunkIndex + 1;
        
        if (nextIdx === -1) {
          setIsPlaying(false);
          return;
        }

        const nextId = `chunk_${activePlaylistId}_${nextIdx}`;
        const nextBlob = await db.getTrackBlob(nextId);
        
        if (nextBlob) {
          console.log(`[AudioEngine] Transitioning to next chunk: ${nextId}`);
          const oldChunkId = `chunk_${activePlaylistId}_${currentChunkIndex}`;
          
          cleanupLastUrl();
          const url = URL.createObjectURL(nextBlob);
          lastMainUrlRef.current = url;
          audio.src = url;
          audio.load();
          audio.play().catch(console.error);

          // Calculate new track index
          let newTrackIdx = 0;
          for (let i = 0; i < nextIdx; i++) {
            newTrackIdx += plan.chunks[i].trackIds.length;
          }
          setCurrentTrackIndex(newTrackIdx);
          activeChunkIdRef.current = nextId;

          // Re-calculate track offsets for the next chunk
          const nextChunk = plan.chunks[nextIdx];
          const offsets = [];
          let currentOffset = 0;
          for (const tid of nextChunk.trackIds) {
            const d = await ChunkManager.getAudioDuration(tid);
            offsets.push({ start: currentOffset, duration: d });
            currentOffset += d;
          }
          trackOffsetsRef.current = offsets;

          updateSettings({
            chunking: {
              ...settings.chunking,
              currentChunkIndex: nextIdx,
              lastChunkPosition: 0,
              currentTrackIndex: newTrackIdx
            }
          });

          await db.deleteChunk(oldChunkId);
        }
      }

      if (settings.chunking.mode === 'merge') {
        const offsets = trackOffsetsRef.current;
        if (offsets.length === 0 && chunkPlanRef.current) {
          const chunk = chunkPlanRef.current.chunks[settings.chunking.currentChunkIndex];
          if (chunk) {
             const calc = async () => {
               const newOffsets = [];
               let currentOffset = 0;
               for (const tid of chunk.trackIds) {
                 const d = await ChunkManager.getAudioDuration(tid);
                 newOffsets.push({ start: currentOffset, duration: d });
                 currentOffset += d;
               }
               trackOffsetsRef.current = newOffsets;
             };
             calc();
          }
        }

        if (offsets.length > 0) {
          let found = false;
          for (let i = 0; i < offsets.length; i++) {
            const { start, duration: d } = offsets[i];
            if (audio.currentTime >= start && audio.currentTime < start + d) {
              setCurrentTime(audio.currentTime - start);
              setDuration(d);
              found = true;
              
              // Also sync track index if changed
              const plan = chunkPlanRef.current;
              if (plan) {
                let absoluteIdx = 0;
                for (let j = 0; j < settings.chunking.currentChunkIndex; j++) {
                  absoluteIdx += plan.chunks[j].trackIds.length;
                }
                absoluteIdx += i;
                if (absoluteIdx !== currentTrackIndex) {
                  setCurrentTrackIndex(absoluteIdx);
                }
              }
              break;
            }
          }
          if (!found && offsets.length > 0) {
             const last = offsets[offsets.length - 1];
             setCurrentTime(audio.currentTime - last.start);
             setDuration(last.duration);
          }
        } else {
          setCurrentTime(audio.currentTime);
          setDuration(audio.duration);
        }
      } else {
        setCurrentTime(audio.currentTime);
        setDuration(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    
    // Auto Play Next in Heartbeat Mode
    const handleEnded = () => {
      if (settings.chunking.mode === 'heartbeat') {
        playNext(true);
      }
    };
    audio.addEventListener('ended', handleEnded);

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    // Initial volume
    audio.volume = settings.mainVolume;

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [isPlaying, settings.chunking, settings.playbackMode, settings.loop, playNext, settings.mainVolume]);

  // Handle Main Track Source Change (Mode Aware)
  useEffect(() => {
    if (!mainAudioRef.current) return;
    const audio = mainAudioRef.current;
    
    const applySources = async () => {
      if (settings.chunking.mode === 'merge') {
        const { activePlaylistId, currentChunkIndex, lastChunkPosition } = settings.chunking;
        if (!activePlaylistId) {
          audio.pause();
          audio.src = "";
          return;
        }

        const chunkId = `chunk_${activePlaylistId}_${currentChunkIndex}`;
        if (activeChunkIdRef.current === chunkId) return;

        const blob = await db.getTrackBlob(chunkId);
        if (blob) {
          cleanupLastUrl();
          const url = URL.createObjectURL(blob);
          lastMainUrlRef.current = url;
          audio.src = url;
          audio.currentTime = lastChunkPosition;
          audio.load();
          if (isPlaying) audio.play().catch(console.error);
          activeChunkIdRef.current = chunkId;

          // Pre-calculate track offsets for this chunk
          const plan = chunkPlanRef.current;
          if (plan) {
            const chunk = plan.chunks[currentChunkIndex];
            const offsets = [];
            let currentOffset = 0;
            for (const tid of chunk.trackIds) {
              const d = await ChunkManager.getAudioDuration(tid);
              offsets.push({ start: currentOffset, duration: d });
              currentOffset += d;
            }
            trackOffsetsRef.current = offsets;
            console.log(`[AudioEngine] Calculated ${offsets.length} track offsets for chunk ${currentChunkIndex}`);
          }
        }
      } else {
        // Heartbeat / Standard Mode: Use track URLs directly
        if (preparedUrl) {
          if (audio.src !== preparedUrl) {
            console.log(`[AudioEngine] Setting direct source: ${preparedUrl}`);
            audio.src = preparedUrl;
            audio.load();
            if (isPlaying) audio.play().catch(console.error);
            activeChunkIdRef.current = null; // Clear chunk tracking
          }
        } else {
          // No track prepared, but we might be in middle of something
          if (!isPlaying && !currentTrack) {
            audio.pause();
            audio.src = "";
          }
        }
      }
    };
    
    applySources();
  }, [settings.chunking.activePlaylistId, settings.chunking.currentChunkIndex, settings.chunking.mode, isPlaying, preparedUrl]);

  // Handle Main Play/Pause and MediaSession State
  useEffect(() => {
    if (!mainAudioRef.current) return;

    const resumeContext = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    };

    if (isPlaying) {
      if (currentTrack?.isMissing) {
        setIsPlaying(false);
        showToast("Track file missing. Please relink.");
        return;
      }
      
      resumeContext();
      setupAudioTools();
      
      if (mainAudioRef.current && currentTrack && mainAudioRef.current.paused) {
        resumeContext();
        mainAudioRef.current.play().catch(e => {
          console.error("Playback error:", e);
          if (e.name === 'NotAllowedError') {
            showToast("Tap screen to enable audio");
          }
          setIsPlaying(false);
        });
      }
      
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    } else {
      if (mainAudioRef.current) mainAudioRef.current.pause();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
  }, [isPlaying, currentTrack, settings.audioTools.playInBackground]);

  // Handle Subliminal Playback State (Independent from Main if Background is ON)
  useEffect(() => {
    if (!subAudioRef.current) return;
    
    const isLayerPlaying = (isPlaying || settings.subliminal.playInBackground) && settings.subliminal.isEnabled;
    const audio = subAudioRef.current;

    if (isLayerPlaying && subTrack && preparedSubUrl && !subTrack.isMissing) {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }

      const playSub = () => {
        if (audio.src !== preparedSubUrl) {
          audio.src = preparedSubUrl;
          audio.load();
        }
        audio.loop = settings.subliminal.isPlaylistMode ? false : settings.subliminal.isLooping;
        
        // Background support for Subliminal - Parallel Stable Mode
        if (settings.subliminal.playInBackground || isPlaying) {
          if (subSourceRef.current) {
             try { subSourceRef.current.disconnect(); } catch (e) {}
          }
          const gainValue = settings.subliminal.volume * Math.pow(10, settings.subliminal.gainDb / 20) * safetyMultiplier;
          audio.volume = Math.min(1, Math.max(0, gainValue));
        } else {
          setupAudioTools();
          if (subSourceRef.current && subCompRef.current) {
            subSourceRef.current.connect(subCompRef.current);
          }
          audio.volume = 1.0;
        }

        if (audio.paused) {
          audio.play().catch(console.error);
        }
      };

      if (isPlaying) {
        delayTimeoutRef.current = window.setTimeout(playSub, settings.subliminal.delayMs);
      } else {
        playSub();
      }
    } else {
      audio.pause();
      if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
    }
    
    return () => {
        if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
    };
  }, [isPlaying, settings.subliminal.isEnabled, settings.subliminal.playInBackground, settings.subliminal.isLooping, settings.subliminal.isPlaylistMode, subTrack, preparedSubUrl]);

  // Handle Binaural Layer
  useEffect(() => {
    const isBg = settings.binaural.playInBackground;
    const isLayerPlaying = settings.binaural.isEnabled && (isPlaying || isBg);
    const sync = async () => {
      await syncBgLayer('binaural', isLayerPlaying, 'binaural', { 
        leftFreq: settings.binaural.leftFreq, 
        rightFreq: settings.binaural.rightFreq,
        pitchSafeMode: settings.binaural.pitchSafeMode
      }, settings.binaural.volume, settings.binaural.gainDb);
    };
    sync();
  }, [isPlaying, settings.binaural.isEnabled, settings.binaural.playInBackground, settings.binaural.leftFreq, settings.binaural.rightFreq, settings.binaural.volume, settings.binaural.gainDb, settings.fadeInOut, settings.binaural.pitchSafeMode]);

  // Handle Noise Layer
  useEffect(() => {
    const isBg = settings.noise.playInBackground;
    const isLayerPlaying = settings.noise.isEnabled && (isPlaying || isBg);

    const sync = async () => {
      syncBgLayer('noise', isLayerPlaying, 'noise', { noiseType: settings.noise.type }, settings.noise.volume, settings.noise.gainDb);
    };
    sync();
  }, [isPlaying, settings.noise.isEnabled, settings.noise.playInBackground, settings.noise.type, settings.noise.volume, settings.noise.gainDb, settings.fadeInOut]);

  // Handle Didgeridoo Layer
  useEffect(() => {
    const isBg = settings.didgeridoo.playInBackground;
    const isLayerPlaying = settings.didgeridoo.isEnabled && settings.didgeridoo.isLooping && (isPlaying || isBg);
    const sync = async () => {
      await syncBgLayer('didgeridoo', isLayerPlaying, 'didgeridoo', { 
        frequency: settings.didgeridoo.frequency,
        depth: settings.didgeridoo.depth,
        pitchSafeMode: settings.didgeridoo.pitchSafeMode
      }, settings.didgeridoo.volume, settings.didgeridoo.gainDb);
    };
    sync();
  }, [isPlaying, settings.didgeridoo.isEnabled, settings.didgeridoo.playInBackground, settings.didgeridoo.frequency, settings.didgeridoo.depth, settings.didgeridoo.volume, settings.didgeridoo.gainDb, settings.fadeInOut, settings.didgeridoo.pitchSafeMode]);

  // Handle Shamanic Layer
  useEffect(() => {
    const isBg = settings.shamanic.playInBackground;
    const isLayerPlaying = settings.shamanic.isEnabled && settings.shamanic.isLooping && (isPlaying || isBg);
    const sync = async () => {
      await syncBgLayer('shamanic', isLayerPlaying, 'shamanic', { 
        frequency: settings.shamanic.frequency, 
        depth: settings.shamanic.depth,
        playbackRate: settings.shamanic.playbackRate,
        pitchSafeMode: settings.shamanic.pitchSafeMode
      }, settings.shamanic.volume, settings.shamanic.gainDb);
    };
    sync();
  }, [isPlaying, settings.shamanic.isEnabled, settings.shamanic.playInBackground, settings.shamanic.frequency, settings.shamanic.depth, settings.shamanic.playbackRate, settings.shamanic.volume, settings.shamanic.gainDb, settings.fadeInOut, settings.shamanic.pitchSafeMode]);

  // Handle Pure Hz Layer
  useEffect(() => {
    const isBg = settings.pureHz.playInBackground;
    const isLayerPlaying = settings.pureHz.isEnabled && settings.pureHz.isLooping && (isPlaying || isBg);
    const sync = async () => {
      await syncBgLayer('pureHz', isLayerPlaying, 'pureHz', { frequency: settings.pureHz.frequency, pitchSafeMode: settings.pureHz.pitchSafeMode }, settings.pureHz.volume, settings.pureHz.gainDb);
    };
    sync();
  }, [isPlaying, settings.pureHz.isEnabled, settings.pureHz.playInBackground, settings.pureHz.frequency, settings.pureHz.volume, settings.pureHz.gainDb, settings.fadeInOut, settings.pureHz.pitchSafeMode]);

  // Handle Isochronic Layer
  useEffect(() => {
    const isBg = settings.isochronic.playInBackground;
    const isLayerPlaying = settings.isochronic.isEnabled && (isPlaying || isBg);
    const sync = async () => {
      await syncBgLayer('isochronic', isLayerPlaying, 'isochronic', { 
        frequency: settings.isochronic.frequency, 
        pulseRate: settings.isochronic.pulseRate,
        pitchSafeMode: settings.isochronic.pitchSafeMode
      }, settings.isochronic.volume, settings.isochronic.gainDb);
    };
    sync();
  }, [isPlaying, settings.isochronic.isEnabled, settings.isochronic.playInBackground, settings.isochronic.frequency, settings.isochronic.pulseRate, settings.isochronic.volume, settings.isochronic.gainDb, settings.fadeInOut, settings.isochronic.pitchSafeMode]);

  // Handle Solfeggio Layer
  useEffect(() => {
    const isBg = settings.solfeggio.playInBackground;
    const isLayerPlaying = settings.solfeggio.isEnabled && (isPlaying || isBg);
    const sync = async () => {
      await syncBgLayer('solfeggio', isLayerPlaying, 'solfeggio', { frequency: settings.solfeggio.frequency, pitchSafeMode: settings.solfeggio.pitchSafeMode }, settings.solfeggio.volume, settings.solfeggio.gainDb);
    };
    sync();
  }, [isPlaying, settings.solfeggio.isEnabled, settings.solfeggio.playInBackground, settings.solfeggio.frequency, settings.solfeggio.volume, settings.solfeggio.gainDb, settings.fadeInOut, settings.solfeggio.pitchSafeMode]);

  // Handle Schumann Layer
  useEffect(() => {
    const isBg = settings.schumann.playInBackground;
    const isLayerPlaying = settings.schumann.isEnabled && (isPlaying || isBg);
    const sync = async () => {
      await syncBgLayer('schumann', isLayerPlaying, 'pureHz', { frequency: settings.schumann.frequency, pitchSafeMode: settings.schumann.pitchSafeMode }, settings.schumann.volume, settings.schumann.gainDb);
    };
    sync();
  }, [isPlaying, settings.schumann.isEnabled, settings.schumann.playInBackground, settings.schumann.frequency, settings.schumann.volume, settings.schumann.gainDb, settings.fadeInOut, settings.schumann.pitchSafeMode]);

  // Handle Mental Toughness Layer
  useEffect(() => {
    const isBg = settings.mentalToughness.playInBackground;
    const isLayerPlaying = settings.mentalToughness.isEnabled && settings.mentalToughness.isLooping && (isPlaying || isBg);
    const sync = async () => {
      await syncBgLayer('mentalToughness', isLayerPlaying, 'mentalToughness', { 
        frequency: settings.mentalToughness.frequency, 
        pitch: settings.mentalToughness.pitch,
        texture: settings.mentalToughness.texture,
        intensity: settings.mentalToughness.intensity,
        pitchSafeMode: settings.mentalToughness.pitchSafeMode
      }, settings.mentalToughness.volume, settings.mentalToughness.gainDb);
    };
    sync();
  }, [isPlaying, settings.mentalToughness.isEnabled, settings.mentalToughness.playInBackground, settings.mentalToughness.frequency, settings.mentalToughness.pitch, settings.mentalToughness.texture, settings.mentalToughness.intensity, settings.mentalToughness.volume, settings.mentalToughness.gainDb, settings.fadeInOut, settings.mentalToughness.pitchSafeMode]);

  // Handle Display Always On (WakeLock)
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && settings.displayAlwaysOn && isPlaying) {
        try {
          if (wakeLockRef.current) return; // Already active
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('[AudioEngine] Wake Lock is active');
          
          wakeLockRef.current.addEventListener('release', () => {
            console.log('[AudioEngine] Wake Lock released by system');
            wakeLockRef.current = null;
          });
        } catch (err) {
          console.warn(`[AudioEngine] Wake Lock request failed: ${err.name}, ${err.message}`);
          wakeLockRef.current = null;
        }
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
          console.log('[AudioEngine] Wake Lock released intentionally');
        } catch (err) {
          console.warn(`[AudioEngine] Wake Lock release failed: ${err.message}`);
        }
      }
    };

    if (settings.displayAlwaysOn && isPlaying) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && settings.displayAlwaysOn && isPlaying) {
        requestWakeLock();
      }
      
      // Recovery logic for iOS: if we return to the app and audio is supposed to be playing but context is suspended
      if (document.visibilityState === 'visible' && isPlaying && audioCtxRef.current) {
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
        // Force resume all <audio> elements too
        Object.values(bgAudioRefs.current).forEach(a => a.play().catch(() => {}));
        Object.values(bgAudioRefs2.current).forEach(a => a.play().catch(() => {}));
        if (natureAudioRef.current) natureAudioRef.current.play().catch(() => {});
        if (subAudioRef.current) subAudioRef.current.play().catch(() => {});
        if (mainAudioRef.current) mainAudioRef.current.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [settings.displayAlwaysOn, isPlaying]);

  // Handle Didgeridoo Real-time Updates (Frequency)
  useEffect(() => {
    if (didgOscRef.current && didgSubOscRef.current && didgFilterRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      didgOscRef.current.frequency.setTargetAtTime(settings.didgeridoo.frequency, ctx.currentTime, 0.2);
      didgSubOscRef.current.frequency.setTargetAtTime(settings.didgeridoo.frequency, ctx.currentTime, 0.2);
      
      // Update filter to follow frequency for consistent timbre
      const filterBase = settings.didgeridoo.frequency * 2.7;
      didgFilterRef.current.frequency.setTargetAtTime(filterBase * (1 + settings.didgeridoo.depth), ctx.currentTime, 0.2);
    }
  }, [settings.didgeridoo.frequency, settings.didgeridoo.depth]);

  // Handle Nature Layer
  useEffect(() => {
    const isBg = settings.nature.playInBackground;
    const isLayerPlaying = settings.nature.isEnabled && (isPlaying || isBg);
    const layerId = 'nature';

    if (isLayerPlaying) {
      setupNature();
      const audio = natureAudioRef.current!;
      const sound = NATURE_SOUNDS.find(s => s.id === settings.nature.type);
      
      if (sound) {
        if (audio.src !== sound.url) {
          audio.src = sound.url;
          audio.load();
          
          const onProgress = () => {
            const now = Date.now();
            const lastUpdate = (audio as any).lastProgressTime || 0;
            const throttleMs = document.visibilityState === 'visible' ? 250 : 5000;

            if (now - lastUpdate > throttleMs) {
              updateLayerProgress(layerId, {
                currentTime: audio.currentTime,
                duration: audio.duration || 0
              });
              (audio as any).lastProgressTime = now;
            }
          };
          audio.addEventListener('timeupdate', onProgress);
        }
        
        if (isBg) {
          // If playing in background, we avoid Web Audio routing for maximum reliability on iOS 16
          // We must disconnect if it was connected
          if (natureSourceRef.current) {
            try { natureSourceRef.current.disconnect(); } catch (e) {}
          }
          const gainValue = settings.nature.volume * Math.pow(10, settings.nature.gainDb / 20) * safetyMultiplier;
          audio.volume = Math.min(1, Math.max(0, gainValue));
        } else {
          // Normal mode: Reconnect to Web Audio graph
          if (natureSourceRef.current && natureGainRef.current) {
            natureSourceRef.current.connect(natureCompRef.current!);
          }
          audio.volume = 1.0; // Control per-layer via GainNode
          
          if (natureGainRef.current && audioCtxRef.current) {
            const ctx = audioCtxRef.current;
            const fadeTime = settings.fadeInOut ? 3 : 0.1;
            const gainValue = settings.nature.volume * Math.pow(10, settings.nature.gainDb / 20) * safetyMultiplier;
            const threshold = settings.nature.normalize ? -24 : 0;
            if (natureCompRef.current) natureCompRef.current.threshold.setTargetAtTime(threshold, ctx.currentTime, 0.1);
            natureGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, fadeTime / 2);
          }
        }

        if (audio.paused && (isPlaying || isBg)) audio.play().catch(console.error);
      }
    } else {
      if (natureAudioRef.current) {
        updateLayerProgress(layerId, { currentTime: 0, duration: 0 });
        if (natureGainRef.current && audioCtxRef.current && !isBg) {
          const ctx = audioCtxRef.current;
          const fadeTime = settings.fadeInOut ? 3 : 0.1;
          natureGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, fadeTime / 2);
          setTimeout(() => {
            if (!settings.nature.isEnabled && natureAudioRef.current) natureAudioRef.current.pause();
          }, fadeTime * 1000);
        } else {
          natureAudioRef.current.pause();
        }
      }
    }
  }, [isPlaying, settings.nature.isEnabled, settings.nature.playInBackground, settings.nature.type, settings.nature.volume, settings.nature.gainDb, settings.nature.normalize, settings.fadeInOut]);

  // Heartbeat & Stability Sync
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      // 1. Recover AudioContext if suspended
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended' && isPlaying) {
        audioCtxRef.current.resume().catch(() => {});
      }

      // 2. Heartbeat: Keep silent audio playing to prevent iOS from suspending session
      if (heartbeatAudioRef.current && heartbeatAudioRef.current.paused && isPlaying) {
        heartbeatAudioRef.current.play().catch(() => {});
      }

      // 2. Ensure active background layers are actually playing
      Object.entries(bgAudioRefs.current).forEach(([id, el]) => {
        const layerSettings = (settings as any)[id];
        if (layerSettings?.isEnabled && layerSettings?.playInBackground && el.paused) {
          console.log(`[AudioEngine] Heartbeat: Resuming stalled background layer: ${id}`);
          el.play().catch(() => {});
        }
      });

      // 3. Main Audio recovery if stalled
      if (currentTrack && mainAudioRef.current && mainAudioRef.current.paused && isPlaying) {
        // Only attempt if not already in an error state
        if (!mainAudioRef.current.error) {
           mainAudioRef.current.play().catch(() => {});
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack, settings]);

  // Handle Volume Balance
  useEffect(() => {
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const fadeTime = 0.1;

      if (mainGainRef.current) {
        const gainValue = settings.mainVolume; // Slider 0-1
        mainGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, fadeTime);
      }
      
      if (subSpecificGainRef.current) {
        // Respect both volume and gain(dB) for Web Audio
        const gainValue = settings.subliminal.volume * Math.pow(10, settings.subliminal.gainDb / 20);
        subSpecificGainRef.current.gain.setTargetAtTime(gainValue, ctx.currentTime, fadeTime);
      }
    }

    // Handle HTML Audio Element Volume directly
    // This ensures Gain dB works even when Web Audio is suspended or bypassed
    const masterGainMultiplier = settings.audioTools.gainDb !== 0 ? Math.pow(10, settings.audioTools.gainDb / 20) : 1.0;

    if (mainAudioRef.current) {
      if (settings.audioTools.playInBackground) {
        const finalVolume = settings.mainVolume * masterGainMultiplier * safetyMultiplier;
        mainAudioRef.current.volume = Math.min(1.0, Math.max(0.0, finalVolume));
      } else {
        // Use 1.0 because volume is handled by WebAudio gain node
        mainAudioRef.current.volume = 1.0; 
      }
    }

    if (subAudioRef.current) {
      const subGainMultiplier = Math.pow(10, settings.subliminal.gainDb / 20);
      if (settings.subliminal.playInBackground) {
        const finalVolume = settings.subliminal.volume * subGainMultiplier * masterGainMultiplier * safetyMultiplier;
        subAudioRef.current.volume = Math.min(1.0, Math.max(0.0, finalVolume));
      } else {
        subAudioRef.current.volume = 1.0;
      }
    }
  }, [settings.mainVolume, settings.subliminal.volume, settings.subliminal.gainDb, settings.audioTools.gainDb, settings.audioTools.playInBackground, settings.subliminal.playInBackground, currentTrack]);

  // Handle Playback Rate
  useEffect(() => {
    if (mainAudioRef.current) {
      mainAudioRef.current.playbackRate = settings.playbackRate;
    }
  }, [settings.playbackRate, currentTrack]);

  // Sync Subliminal with Main Track if enabled
  useEffect(() => {
    if (isPlaying && settings.syncPlayback && settings.subliminal.isEnabled && mainAudioRef.current && subAudioRef.current && !settings.subliminal.isPlaylistMode) {
      const syncInterval = setInterval(() => {
        if (mainAudioRef.current && subAudioRef.current && subAudioRef.current.readyState >= 2) {
          const mainTime = mainAudioRef.current.currentTime;
          const subTime = subAudioRef.current.currentTime;
          const duration = subAudioRef.current.duration;
          
          if (duration > 0) {
             const targetTime = mainTime % duration;
             const diff = Math.abs(targetTime - subTime);
             
             // Only sync if they drift by more than 0.5s to avoid stutter
             if (diff > 0.5) {
               subAudioRef.current.currentTime = targetTime;
             }
          }
        }
      }, 2000);
      return () => clearInterval(syncInterval);
    }
  }, [isPlaying, settings.syncPlayback, settings.subliminal.isEnabled, settings.subliminal.isPlaylistMode]);

  // Handle Subliminal Looping State
  useEffect(() => {
    if (subAudioRef.current) {
      subAudioRef.current.loop = settings.subliminal.isPlaylistMode ? false : settings.subliminal.isLooping;
    }
  }, [settings.subliminal.isLooping, settings.subliminal.isPlaylistMode]);

  // Audio Context Heartbeat & Playback Safety
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      // 1. Context Nudge
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        console.log('[AudioEngine] Heartbeat: Resuming suspended context');
        audioCtxRef.current.resume().catch(() => {});
      }
      
      // 2. Playback Safety: If supposed to be playing but both are paused, attempt nudge
      // Enhanced for iOS 16: Check readyState and stalled state
      if (mainAudioRef.current && isPlaying) {
         const { paused, readyState, networkState, error } = mainAudioRef.current;
         
         if (paused) {
            console.warn('[AudioEngine] Heartbeat: Playback desync detected, nudging...');
            mainAudioRef.current.play().catch(() => {});
         }
         
         // If stuck in a "stalled" but not paused state with no meta
         if (readyState < 1 && networkState === 2) { // 2 = NETWORK_LOADING
            console.warn('[AudioEngine] Heartbeat: Media stuck in loading state, reloading...');
            mainAudioRef.current.load();
         }
      }
      
      // 3. MediaSession State Sync
      if ('mediaSession' in navigator && isPlaying) {
        navigator.mediaSession.playbackState = 'playing';
      }
    }, 3000); // 3s heartbeats for tight sync on iPhone 8
    
    return () => clearInterval(interval);
  }, [isPlaying]);

  return null;
}
