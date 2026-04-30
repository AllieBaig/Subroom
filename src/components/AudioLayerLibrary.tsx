import React, { useState, useEffect } from 'react';
import { useSettings } from '../SettingsContext';
import { useAudio } from '../AudioContext';
import { LayerAccordion, HzSelector, PhysicalSoundEngineUI } from './LayerUI';
import { NATURE_SOUNDS } from '../constants';
import { 
  Volume2, Activity, CloudRain, Wind, 
  Music as MusicIcon, Zap, Sliders, Ear,
  ChevronDown, ChevronRight, Waves, Radio
} from 'lucide-react';
import { PickerWheel } from './PickerWheel';

export const AudioLayerLibrary = () => {
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
    updateSchumannSettings,
    updateShamanicSettings,
    updateMentalToughnessSettings,
    updateSettings
  } = useSettings();

  const { playlists, tracks } = useAudio();
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(() => {
    return localStorage.getItem('last_expanded_layer_id');
  });

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('expanded_audio_groups');
    return saved ? JSON.parse(saved) : { main: true, frequency: false, soundscape: true };
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      localStorage.setItem('expanded_audio_groups', JSON.stringify(next));
      return next;
    });
  };

  const toggleLayer = (id: string) => {
    const next = expandedLayerId === id ? null : id;
    setExpandedLayerId(next);
    if (next) localStorage.setItem('last_expanded_layer_id', next);
    else localStorage.removeItem('last_expanded_layer_id');
  };

  const applyLayerPreset = (layer: string, preset: 'soft' | 'night' | 'focus') => {
    // Shared preset logic
    const updateFnMap: any = {
      main: (s: any) => updateSettings({ mainVolume: s.volume, mainGainDb: s.gainDb }),
      subliminal: updateSubliminalSettings,
      binaural: updateBinauralSettings,
      nature: updateNatureSettings,
      noise: updateNoiseSettings,
      didgeridoo: updateDidgeridooSettings,
      pureHz: updatePureHzSettings,
      isochronic: updateIsochronicSettings,
      solfeggio: updateSolfeggioSettings,
      schumann: updateSchumannSettings,
      shamanic: updateShamanicSettings,
      mentalToughness: updateMentalToughnessSettings
    };

    const updateFn = updateFnMap[layer];
    if (!updateFn) return;

    if (preset === 'soft') {
      updateFn({ volume: 0.15, gainDb: -12, normalize: true });
    } else if (preset === 'night') {
      updateFn({ volume: 0.1, gainDb: -18, normalize: true });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* GROUP 0: MAIN AUDIO */}
      <div className="space-y-3">
        <button 
          onClick={() => toggleGroup('main')}
          className="flex items-center gap-3 w-full px-1 py-1 group active:opacity-70 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-apple-blue/10 flex items-center justify-center text-apple-blue group-hover:scale-105 transition-transform">
            <MusicIcon size={16} />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-system-label">Main Audio</h3>
            <p className="text-[9px] font-bold text-system-tertiary-label uppercase">Primary Playlist Channel</p>
          </div>
          {expandedGroups.main ? <ChevronDown size={14} className="text-system-tertiary-label" /> : <ChevronRight size={14} className="text-system-tertiary-label" />}
        </button>

        {expandedGroups.main && (
          <div className="flex flex-col gap-3 pl-1 animate-in slide-in-from-top-2 duration-300">
            <LayerAccordion 
              id="main_channel" icon={Sliders} label="Output Master" 
              isEnabled={true} 
              onToggle={() => {}} // Always enabled
              isExpanded={expandedLayerId === 'main_channel'}
              onAccordionToggle={() => toggleLayer('main_channel')}
              vol={settings.mainVolume}
              setVol={(v: number) => updateSettings({ mainVolume: v })}
              gainDb={settings.mainGainDb}
              setGainDb={(v: number) => updateSettings({ mainGainDb: v })}
              color="text-apple-blue"
              subtitle="Main Stream"
              onApplyPreset={(p: any) => applyLayerPreset('main', p)}
              hideToggle
            >
              <div className="space-y-4">
                <p className="text-[10px] font-medium text-system-secondary-label leading-relaxed">
                  Controls the primary playback volume and gain for your main playlist tracks.
                </p>
              </div>
            </LayerAccordion>
          </div>
        )}
      </div>

      {/* GROUP 1: FREQUENCY */}
      <div className="space-y-3">
        <button 
          onClick={() => toggleGroup('frequency')}
          className="flex items-center gap-3 w-full px-1 py-1 group active:opacity-70 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-105 transition-transform">
            <Radio size={16} />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-system-label">Frequency</h3>
            <p className="text-[9px] font-bold text-system-tertiary-label uppercase">Hz-based layers</p>
          </div>
          {expandedGroups.frequency ? <ChevronDown size={14} className="text-system-tertiary-label" /> : <ChevronRight size={14} className="text-system-tertiary-label" />}
        </button>

        {expandedGroups.frequency && (
          <div className="flex flex-col gap-3 pl-1 animate-in slide-in-from-top-2 duration-300">
            {/* Binaural */}
            <LayerAccordion 
              id="binaural" icon={Activity} label="Binaural Beats" 
              isEnabled={settings.binaural.isEnabled} 
              onToggle={(v: boolean) => updateBinauralSettings({ isEnabled: v })}
              isExpanded={expandedLayerId === 'binaural'}
              onAccordionToggle={() => toggleLayer('binaural')}
              vol={settings.binaural.volume}
              setVol={(v: number) => updateBinauralSettings({ volume: v })}
              gainDb={settings.binaural.gainDb}
              setGainDb={(v: number) => updateBinauralSettings({ gainDb: v })}
              normalize={settings.binaural.normalize}
              setNormalize={(v: boolean) => updateBinauralSettings({ normalize: v })}
              playInBackground={settings.binaural.playInBackground}
              setPlayInBackground={(v: boolean) => updateBinauralSettings({ playInBackground: v })}
              pitchSafeMode={settings.binaural.pitchSafeMode}
              setPitchSafeMode={(v: boolean) => updateBinauralSettings({ pitchSafeMode: v })}
              color="text-purple-500"
              subtitle={`${settings.binaural.leftFreq}Hz / ${settings.binaural.rightFreq}Hz`}
              onApplyPreset={(p: any) => applyLayerPreset('binaural', p)}
            >
              <div className="flex flex-col gap-6">
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <div className="flex justify-between items-center px-1">
                          <span className="text-[9px] font-black text-system-tertiary-label uppercase">Left (Hz)</span>
                       </div>
                       <HzSelector 
                         value={settings.binaural.leftFreq} 
                         onChange={(v) => updateBinauralSettings({ leftFreq: v })} 
                         color="purple"
                       />
                    </div>
                    <div className="space-y-2">
                       <div className="flex justify-between items-center px-1">
                          <span className="text-[9px] font-black text-system-tertiary-label uppercase">Right (Hz)</span>
                       </div>
                       <HzSelector 
                         value={settings.binaural.rightFreq} 
                         onChange={(v) => updateBinauralSettings({ rightFreq: v })} 
                         color="purple"
                       />
                    </div>
                 </div>
              </div>
            </LayerAccordion>

            {/* Pure Hz */}
            <LayerAccordion 
              id="pureHz" icon={Activity} label="Pure Hz" 
              isEnabled={settings.pureHz.isEnabled} 
              onToggle={(v: boolean) => updatePureHzSettings({ isEnabled: v })}
              isExpanded={expandedLayerId === 'pureHz'}
              onAccordionToggle={() => toggleLayer('pureHz')}
              vol={settings.pureHz.volume}
              setVol={(v: number) => updatePureHzSettings({ volume: v })}
              gainDb={settings.pureHz.gainDb}
              setGainDb={(v: number) => updatePureHzSettings({ gainDb: v })}
              normalize={settings.pureHz.normalize}
              setNormalize={(v: boolean) => updatePureHzSettings({ normalize: v })}
              playInBackground={settings.pureHz.playInBackground}
              setPlayInBackground={(v: boolean) => updatePureHzSettings({ playInBackground: v })}
              pitchSafeMode={settings.pureHz.pitchSafeMode}
              setPitchSafeMode={(v: boolean) => updatePureHzSettings({ pitchSafeMode: v })}
              color="text-rose-600"
              subtitle={`${settings.pureHz.frequency}Hz`}
              onApplyPreset={(p: any) => applyLayerPreset('pureHz', p)}
            >
              <HzSelector 
                value={settings.pureHz.frequency} 
                onChange={(v) => updatePureHzSettings({ frequency: v })} 
                color="rose"
              />
            </LayerAccordion>

            {/* Isochronic */}
            <LayerAccordion 
              id="isochronic" icon={Zap} label="Isochronic Tones" 
              isEnabled={settings.isochronic.isEnabled} 
              onToggle={(v: boolean) => updateIsochronicSettings({ isEnabled: v })}
              isExpanded={expandedLayerId === 'isochronic'}
              onAccordionToggle={() => toggleLayer('isochronic')}
              vol={settings.isochronic.volume}
              setVol={(v: number) => updateIsochronicSettings({ volume: v })}
              gainDb={settings.isochronic.gainDb}
              setGainDb={(v: number) => updateIsochronicSettings({ gainDb: v })}
              normalize={settings.isochronic.normalize}
              setNormalize={(v: boolean) => updateIsochronicSettings({ normalize: v })}
              playInBackground={settings.isochronic.playInBackground}
              setPlayInBackground={(v: boolean) => updateIsochronicSettings({ playInBackground: v })}
              pitchSafeMode={settings.isochronic.pitchSafeMode}
              setPitchSafeMode={(v: boolean) => updateIsochronicSettings({ pitchSafeMode: v })}
              color="text-blue-600"
              subtitle={`${settings.isochronic.frequency}Hz pulse`}
              onApplyPreset={(p: any) => applyLayerPreset('isochronic', p)}
            >
              <div className="space-y-4">
                 <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Carrier Frequency (Hz)</p>
                 <HzSelector 
                   value={settings.isochronic.frequency} 
                   onChange={(v) => updateIsochronicSettings({ frequency: v })} 
                   color="blue"
                 />
                 <div className="space-y-2">
                    <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Pulse Rate (Hz)</p>
                    <HzSelector 
                      value={settings.isochronic.pulseRate} 
                      onChange={(v) => updateIsochronicSettings({ pulseRate: v })} 
                      color="blue"
                    />
                 </div>
              </div>
            </LayerAccordion>

            {/* Solfeggio */}
            <LayerAccordion 
              id="solfeggio" icon={Ear} label="Solfeggio Layers" 
              isEnabled={settings.solfeggio.isEnabled} 
              onToggle={(v: boolean) => updateSolfeggioSettings({ isEnabled: v })}
              isExpanded={expandedLayerId === 'solfeggio'}
              onAccordionToggle={() => toggleLayer('solfeggio')}
              vol={settings.solfeggio.volume}
              setVol={(v: number) => updateSolfeggioSettings({ volume: v })}
              gainDb={settings.solfeggio.gainDb}
              setGainDb={(v: number) => updateSolfeggioSettings({ gainDb: v })}
              normalize={settings.solfeggio.normalize}
              setNormalize={(v: boolean) => updateSolfeggioSettings({ normalize: v })}
              playInBackground={settings.solfeggio.playInBackground}
              setPlayInBackground={(v: boolean) => updateSolfeggioSettings({ playInBackground: v })}
              pitchSafeMode={settings.solfeggio.pitchSafeMode}
              setPitchSafeMode={(v: boolean) => updateSolfeggioSettings({ pitchSafeMode: v })}
              color="text-emerald-600"
              subtitle={`${settings.solfeggio.frequency}Hz Healing`}
              onApplyPreset={(p: any) => applyLayerPreset('solfeggio', p)}
            >
              <HzSelector 
                value={settings.solfeggio.frequency} 
                onChange={(v) => updateSolfeggioSettings({ frequency: v })} 
                color="emerald"
              />
            </LayerAccordion>

            {/* Schumann Resonance */}
            <LayerAccordion 
              id="schumann" icon={Waves} label="Schumann Resonance" 
              isEnabled={settings.schumann.isEnabled} 
              onToggle={(v: boolean) => updateSchumannSettings({ isEnabled: v })}
              isExpanded={expandedLayerId === 'schumann'}
              onAccordionToggle={() => toggleLayer('schumann')}
              vol={settings.schumann.volume}
              setVol={(v: number) => updateSchumannSettings({ volume: v })}
              gainDb={settings.schumann.gainDb}
              setGainDb={(v: number) => updateSchumannSettings({ gainDb: v })}
              normalize={settings.schumann.normalize}
              setNormalize={(v: boolean) => updateSchumannSettings({ normalize: v })}
              playInBackground={settings.schumann.playInBackground}
              setPlayInBackground={(v: boolean) => updateSchumannSettings({ playInBackground: v })}
              pitchSafeMode={settings.schumann.pitchSafeMode}
              setPitchSafeMode={(v: boolean) => updateSchumannSettings({ pitchSafeMode: v })}
              color="text-blue-500"
              subtitle={`${settings.schumann.frequency}Hz Resonance`}
              onApplyPreset={(p: any) => applyLayerPreset('schumann', p)}
            >
              <div className="space-y-4">
                <HzSelector 
                  value={settings.schumann.frequency} 
                  onChange={(v) => updateSchumannSettings({ frequency: v })} 
                  color="blue"
                />
                <div className="grid grid-cols-5 gap-1 pt-2">
                  {[7.83, 14.3, 20.8, 27.3, 33.8].map(hz => (
                    <button 
                      key={hz}
                      onClick={() => updateSchumannSettings({ frequency: hz })}
                      className={`py-1.5 rounded-lg text-[8px] font-black tracking-tight transition-all border ${settings.schumann.frequency === hz ? 'bg-blue-500 text-white border-blue-500' : 'bg-secondary-system-background text-system-secondary-label border-transparent'}`}
                    >
                      {hz}Hz
                    </button>
                  ))}
                </div>
              </div>
            </LayerAccordion>
          </div>
        )}
      </div>

      {/* GROUP 2: SOUNDSCAPE */}
      <div className="space-y-3">
        <button 
          onClick={() => toggleGroup('soundscape')}
          className="flex items-center gap-3 w-full px-1 py-1 group active:opacity-70 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:scale-105 transition-transform">
            <Waves size={16} />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-system-label">Soundscape</h3>
            <p className="text-[9px] font-bold text-system-tertiary-label uppercase">Ambient + Human layers</p>
          </div>
          {expandedGroups.soundscape ? <ChevronDown size={14} className="text-system-tertiary-label" /> : <ChevronRight size={14} className="text-system-tertiary-label" />}
        </button>

        {expandedGroups.soundscape && (
          <div className="flex flex-col gap-3 pl-1 animate-in slide-in-from-top-2 duration-300">
            {/* Subliminal */}
            <LayerAccordion 
              id="subliminal" icon={Volume2} label="Subliminal Audio" 
              isEnabled={settings.subliminal.isEnabled} 
              onToggle={(v: boolean) => updateSubliminalSettings({ isEnabled: v })}
              isExpanded={expandedLayerId === 'subliminal'}
              onAccordionToggle={() => toggleLayer('subliminal')}
              vol={settings.subliminal.volume}
              setVol={(v: number) => updateSubliminalSettings({ volume: v })}
              gainDb={settings.subliminal.gainDb}
              setGainDb={(v: number) => updateSubliminalSettings({ gainDb: v })}
              normalize={settings.subliminal.normalize}
              setNormalize={(v: boolean) => updateSubliminalSettings({ normalize: v })}
              playInBackground={settings.subliminal.playInBackground}
              setPlayInBackground={(v: boolean) => updateSubliminalSettings({ playInBackground: v })}
              color="text-apple-blue"
              subtitle={settings.subliminal.isPlaylistMode ? 'Playlist Mode' : 'Track Mode'}
              onApplyPreset={(p: any) => applyLayerPreset('subliminal', p)}
            >
              <div className="flex flex-col gap-6">
                <div className="bg-secondary-system-background p-1 rounded-xl flex items-center h-8">
                  <button 
                    onClick={() => updateSubliminalSettings({ isPlaylistMode: false })}
                    className={`flex-1 h-full text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${!settings.subliminal.isPlaylistMode ? 'bg-system-background shadow-sm text-apple-blue' : 'text-system-secondary-label'}`}
                  >
                    Track
                  </button>
                  <button 
                    onClick={() => updateSubliminalSettings({ isPlaylistMode: true })}
                    className={`flex-1 h-full text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${settings.subliminal.isPlaylistMode ? 'bg-system-background shadow-sm text-apple-blue' : 'text-system-secondary-label'}`}
                  >
                    Playlist
                  </button>
                </div>

                {!settings.subliminal.isPlaylistMode && settings.subliminal.sourcePlaylistId && (
                  <div className="flex flex-col gap-3">
                    {(() => {
                      const sourcePlaylist = playlists.find(p => p.id === settings.subliminal.sourcePlaylistId);
                      if (!sourcePlaylist || sourcePlaylist.trackIds.length === 0) return null;

                      const pickerItems = sourcePlaylist.trackIds.map(tid => ({
                        id: tid,
                        label: tracks.find(mt => mt.id === tid)?.name || 'Unknown Track'
                      }));

                      return (
                        <PickerWheel 
                          items={pickerItems}
                          selectedValue={settings.subliminal.selectedTrackId}
                          onValueChange={(id) => updateSubliminalSettings({ selectedTrackId: id })}
                          height={140}
                          itemHeight={36}
                        />
                      );
                    })()}
                  </div>
                )}
              </div>
            </LayerAccordion>

            {/* Nature */}
            <LayerAccordion 
              id="nature" icon={CloudRain} label="Nature Ambience" 
              isEnabled={settings.nature.isEnabled} 
              onToggle={(v: boolean) => updateNatureSettings({ isEnabled: v })}
              isExpanded={expandedLayerId === 'nature'}
              onAccordionToggle={() => toggleLayer('nature')}
              vol={settings.nature.volume}
              setVol={(v: number) => updateNatureSettings({ volume: v })}
              gainDb={settings.nature.gainDb}
              setGainDb={(v: number) => updateNatureSettings({ gainDb: v })}
              normalize={settings.nature.normalize}
              setNormalize={(v: boolean) => updateNatureSettings({ normalize: v })}
              playInBackground={settings.nature.playInBackground}
              setPlayInBackground={(v: boolean) => updateNatureSettings({ playInBackground: v })}
              color="text-green-500"
              subtitle={settings.nature.type}
              onApplyPreset={(p: any) => applyLayerPreset('nature', p)}
            >
              <div className="grid grid-cols-3 gap-2">
                {NATURE_SOUNDS.map(sound => (
                  <button 
                    key={sound.id}
                    onClick={() => updateNatureSettings({ type: sound.id as any })}
                    className={`py-2 px-1 rounded-xl text-[9px] font-bold uppercase transition-all border ${settings.nature.type === sound.id ? 'bg-green-500 text-white border-green-500 shadow-sm' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                  >
                    {sound.name}
                  </button>
                ))}
              </div>
            </LayerAccordion>

            {/* Noise */}
            <LayerAccordion 
              id="noise" icon={Wind} label="Noise Colors" 
              isEnabled={settings.noise.isEnabled} 
              onToggle={(v: boolean) => updateNoiseSettings({ isEnabled: v })}
              isExpanded={expandedLayerId === 'noise'}
              onAccordionToggle={() => toggleLayer('noise')}
              vol={settings.noise.volume}
              setVol={(v: number) => updateNoiseSettings({ volume: v })}
              gainDb={settings.noise.gainDb}
              setGainDb={(v: number) => updateNoiseSettings({ gainDb: v })}
              normalize={settings.noise.normalize}
              setNormalize={(v: boolean) => updateNoiseSettings({ normalize: v })}
              playInBackground={settings.noise.playInBackground}
              setPlayInBackground={(v: boolean) => updateNoiseSettings({ playInBackground: v })}
              color="text-orange-500"
              subtitle={`${settings.noise.type} noise`}
              onApplyPreset={(p: any) => applyLayerPreset('noise', p)}
            >
              <div className="grid grid-cols-3 gap-2">
                  {['white', 'pink', 'brown'].map(type => (
                    <button 
                      key={type}
                      onClick={() => updateNoiseSettings({ type: type as any })}
                      className={`py-2 px-1 rounded-xl text-[9px] font-bold uppercase transition-all border ${settings.noise.type === type ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
            </LayerAccordion>

            {/* Didgeridoo */}
            <LayerAccordion 
              id="didgeridoo" icon={MusicIcon} label="Didgeridoo" 
              isEnabled={settings.didgeridoo.isEnabled} 
              onToggle={(v: boolean) => updateDidgeridooSettings({ isEnabled: v })}
              isExpanded={expandedLayerId === 'didgeridoo'}
              onAccordionToggle={() => toggleLayer('didgeridoo')}
              vol={settings.didgeridoo.volume}
              setVol={(v: number) => updateDidgeridooSettings({ volume: v })}
              gainDb={settings.didgeridoo.gainDb}
              setGainDb={(v: number) => updateDidgeridooSettings({ gainDb: v })}
              normalize={settings.didgeridoo.normalize}
              setNormalize={(v: boolean) => updateDidgeridooSettings({ normalize: v })}
              playInBackground={settings.didgeridoo.playInBackground}
              setPlayInBackground={(v: boolean) => updateDidgeridooSettings({ playInBackground: v })}
              pitchSafeMode={settings.didgeridoo.pitchSafeMode}
              setPitchSafeMode={(v: boolean) => updateDidgeridooSettings({ pitchSafeMode: v })}
              color="text-amber-800"
              subtitle={`${Math.round(settings.didgeridoo.frequency)}Hz Drone`}
              onApplyPreset={(p: any) => applyLayerPreset('didgeridoo', p)}
            >
              <div className="space-y-4">
                 <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Target Frequency (Hz)</p>
                 <HzSelector 
                   value={settings.didgeridoo.frequency} 
                   onChange={(v) => updateDidgeridooSettings({ 
                     frequency: v,
                     playbackRate: v / 65 
                   })} 
                   color="amber"
                 />
                 <div className="space-y-2">
                    <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Resonance Depth</p>
                    <div className="px-2">
                      <input 
                        type="range" min={0.0} max={1.0} step={0.05}
                        value={settings.didgeridoo.depth}
                        onChange={(e) => updateDidgeridooSettings({ depth: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-apple-border rounded-full appearance-none accent-amber-800"
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[8px] font-bold text-system-tertiary-label uppercase">Narrow</span>
                        <span className="text-[10px] font-black text-amber-800 tabular-nums">{(settings.didgeridoo.depth * 100).toFixed(0)}%</span>
                        <span className="text-[8px] font-bold text-system-tertiary-label uppercase">Deep</span>
                      </div>
                    </div>
                 </div>

                 <div className="pt-4 border-t border-apple-border/30">
                   <PhysicalSoundEngineUI 
                     phys={settings.didgeridoo.physical} 
                     onChange={(v) => updateDidgeridooSettings({ physical: v })} 
                     color="amber"
                   />
                 </div>
              </div>
            </LayerAccordion>

            {/* Shamanic Drumming */}
            <LayerAccordion 
              id="shamanic" icon={MusicIcon} label="Shamanic Drumming" 
              isEnabled={settings.shamanic.isEnabled} 
              onToggle={(v: boolean) => updateShamanicSettings({ isEnabled: v })}
              isExpanded={expandedLayerId === 'shamanic'}
              onAccordionToggle={() => toggleLayer('shamanic')}
              vol={settings.shamanic.volume}
              setVol={(v: number) => updateShamanicSettings({ volume: v })}
              gainDb={settings.shamanic.gainDb}
              setGainDb={(v: number) => updateShamanicSettings({ gainDb: v })}
              normalize={settings.shamanic.normalize}
              setNormalize={(v: boolean) => updateShamanicSettings({ normalize: v })}
              playInBackground={settings.shamanic.playInBackground}
              setPlayInBackground={(v: boolean) => updateShamanicSettings({ playInBackground: v })}
              pitchSafeMode={settings.shamanic.pitchSafeMode}
              setPitchSafeMode={(v: boolean) => updateShamanicSettings({ pitchSafeMode: v })}
              color="text-red-900"
              subtitle={`${Math.round(settings.shamanic.frequency)}Hz Tribal`}
              onApplyPreset={(p: any) => applyLayerPreset('shamanic', p)}
            >
              <div className="space-y-4">
                 <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Drum Tone Frequency (Hz)</p>
                 <HzSelector 
                   value={settings.shamanic.frequency} 
                   onChange={(v) => updateShamanicSettings({ 
                     frequency: v 
                   })} 
                   color="red"
                 />
                 <div className="space-y-2">
                    <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Tempo / Intensity</p>
                    <div className="px-2">
                      <input 
                        type="range" min={0.5} max={4.0} step={0.1}
                        value={settings.shamanic.playbackRate}
                        onChange={(e) => updateShamanicSettings({ playbackRate: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-apple-border rounded-full appearance-none accent-red-900"
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[8px] font-bold text-system-tertiary-label uppercase">Slow</span>
                        <span className="text-[10px] font-black text-red-900 tabular-nums">{settings.shamanic.playbackRate.toFixed(1)}x</span>
                        <span className="text-[8px] font-bold text-system-tertiary-label uppercase">Fast</span>
                      </div>
                    </div>
                 </div>

                 <div className="pt-4 border-t border-apple-border/30">
                   <PhysicalSoundEngineUI 
                     phys={settings.shamanic.physical} 
                     onChange={(v) => updateShamanicSettings({ physical: v })} 
                     color="red"
                   />
                 </div>
              </div>
            </LayerAccordion>

            {/* Mental Toughness */}
            <LayerAccordion 
              id="mentalToughness" icon={Activity} label="Mental Toughness" 
              isEnabled={settings.mentalToughness.isEnabled} 
              onToggle={(v: boolean) => updateMentalToughnessSettings({ isEnabled: v })}
              isExpanded={expandedLayerId === 'mentalToughness'}
              onAccordionToggle={() => toggleLayer('mentalToughness')}
              vol={settings.mentalToughness.volume}
              setVol={(v: number) => updateMentalToughnessSettings({ volume: v })}
              gainDb={settings.mentalToughness.gainDb}
              setGainDb={(v: number) => updateMentalToughnessSettings({ gainDb: v })}
              normalize={settings.mentalToughness.normalize}
              setNormalize={(v: boolean) => updateMentalToughnessSettings({ normalize: v })}
              playInBackground={settings.mentalToughness.playInBackground}
              setPlayInBackground={(v: boolean) => updateMentalToughnessSettings({ playInBackground: v })}
              pitchSafeMode={settings.mentalToughness.pitchSafeMode}
              setPitchSafeMode={(v: boolean) => updateMentalToughnessSettings({ pitchSafeMode: v })}
              color="text-indigo-600"
              subtitle={`${settings.mentalToughness.pitch} ${settings.mentalToughness.texture}`}
              onApplyPreset={(p: any) => applyLayerPreset('mentalToughness', p)}
            >
              <div className="flex flex-col gap-6">
                <div className="space-y-4">
                   <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Hz Frequency Depth</p>
                   <HzSelector 
                     value={settings.mentalToughness.frequency} 
                     onChange={(v) => updateMentalToughnessSettings({ frequency: v })} 
                     color="indigo"
                   />
                </div>

                <div className="space-y-3">
                  <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Pitch Style</p>
                  <div className="grid grid-cols-4 gap-2">
                    {['soft', 'hard', 'loud', 'low'].map(p => (
                      <button 
                        key={p}
                        onClick={() => updateMentalToughnessSettings({ pitch: p as any })}
                        className={`py-2 px-1 rounded-xl text-[9px] font-bold uppercase transition-all border ${settings.mentalToughness.pitch === p ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Impact Texture</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'empty_wood', label: 'Empty Wood' },
                      { id: 'thin_wood', label: 'Thin Wood' },
                      { id: 'double_thin', label: 'Double Thin' },
                      { id: 'hollow_wood', label: 'Hollow Wood' },
                      { id: 'tribal_wood', label: 'Tribal Wood' }
                    ].map(t => (
                      <button 
                        key={t.id}
                        onClick={() => updateMentalToughnessSettings({ texture: t.id as any })}
                        className={`py-2 px-1 rounded-xl text-[8px] font-bold uppercase transition-all border ${settings.mentalToughness.texture === t.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Tempo / Speed</p>
                  <div className="px-2">
                    <input 
                      type="range" min={0.5} max={4.0} step={0.1}
                      value={settings.mentalToughness.playbackRate}
                      onChange={(e) => updateMentalToughnessSettings({ playbackRate: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-apple-border rounded-full appearance-none accent-indigo-600"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[8px] font-bold text-system-tertiary-label uppercase">Slow</span>
                      <span className="text-[10px] font-black text-indigo-600 tabular-nums">{settings.mentalToughness.playbackRate.toFixed(1)}x</span>
                      <span className="text-[8px] font-bold text-system-tertiary-label uppercase">Fast</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[9px] font-black text-system-tertiary-label uppercase tracking-widest pl-1">Banging Intensity</p>
                  <div className="grid grid-cols-4 gap-2">
                    {['light', 'medium', 'strong', 'deep'].map(i => (
                      <button 
                        key={i}
                        onClick={() => updateMentalToughnessSettings({ intensity: i as any })}
                        className={`py-2 px-1 rounded-xl text-[9px] font-bold uppercase transition-all border ${settings.mentalToughness.intensity === i ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-apple-border/30">
                  <PhysicalSoundEngineUI 
                    phys={settings.mentalToughness.physical} 
                    onChange={(v) => updateMentalToughnessSettings({ physical: v })} 
                    color="indigo"
                  />
                </div>
              </div>
            </LayerAccordion>
          </div>
        )}
      </div>
    </div>
  );
};
