import React from 'react';
import { useSettings } from '../SettingsContext';
import { Group, Section } from './SettingsUI';
import { 
  Timer, Repeat, Repeat1, Shuffle, Monitor, Activity, 
  Clock, Play, Zap, ShieldCheck 
} from 'lucide-react';
import { motion } from 'motion/react';

interface PlaybackControlProps {
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const PlaybackControl = ({ isExpanded = false, onToggle = () => {} }: PlaybackControlProps) => {
  const { settings, updateSettings, updateSleepTimer } = useSettings();

  return (
    <Group 
      title="Playback Control" 
      icon={Play} 
      color="bg-orange-500/10 text-orange-600"
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <div className="flex flex-col gap-3">
        {/* Playback Mode Selection */}
        <Section
          id="playback-mode"
          title="Playback Strategy"
          subtitle={settings.chunking.mode === 'heartbeat' ? 'Heartbeat Mode' : 'Merge Mode'}
          icon={Activity}
          color="bg-red-500/10 text-red-600"
        >
          <div className="flex flex-col gap-4">
            <div className="bg-secondary-system-background p-1 rounded-2xl flex items-center h-10 border border-apple-border">
              <button 
                onClick={() => updateSettings({ chunking: { ...settings.chunking, mode: 'heartbeat' } })}
                className={`flex-1 h-full rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${settings.chunking.mode === 'heartbeat' ? 'bg-system-background text-red-600 shadow-sm' : 'text-system-secondary-label'}`}
              >
                Heartbeat
              </button>
              <button 
                onClick={() => updateSettings({ chunking: { ...settings.chunking, mode: 'merge' } })}
                className={`flex-1 h-full rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${settings.chunking.mode === 'merge' ? 'bg-system-background text-red-600 shadow-sm' : 'text-system-secondary-label'}`}
              >
                Merge
              </button>
            </div>

            {settings.chunking.mode === 'heartbeat' ? (
              <p className="text-[10px] text-system-secondary-label leading-relaxed px-1">
                Maintains reliable background playback on iOS. Pure Heartbeat is silent; it supports main audio.
              </p>
            ) : (
              <div className="space-y-3 px-1">
                <p className="text-[10px] text-system-secondary-label leading-relaxed">
                  Merges playlist tracks into chunks for seamless transitions.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-system-secondary-label uppercase">Chunk Size</span>
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
              </div>
            )}
          </div>
        </Section>

        {/* Playback Timing */}
        <Section
          id="timing"
          title="Timing & Speed"
          subtitle="Timer & Rate"
          icon={Timer}
          color="bg-indigo-500/10 text-indigo-600"
        >
          <div className="flex flex-col gap-6">
            {/* Speed */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-system-secondary-label">Playback Speed</label>
              <div className="grid grid-cols-4 gap-2">
                {[0.8, 1.0, 1.2, 1.5].map(speed => (
                  <button
                    key={speed}
                    onClick={() => updateSettings({ playbackRate: speed })}
                    className={`py-2 rounded-xl border text-[10px] font-black transition-all ${settings.playbackRate === speed ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Loop Options */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-system-secondary-label">Loop Options</label>
              <div className="flex gap-2">
                 <button 
                   onClick={() => updateSettings({ loop: settings.loop === 'all' ? 'none' : 'all' })}
                   className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border transition-all ${settings.loop === 'all' ? 'bg-indigo-500 border-indigo-500 text-white shadow-md' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                 >
                   <Repeat size={16} />
                   <span className="text-[9px] font-black uppercase">All</span>
                 </button>
                 <button 
                   onClick={() => updateSettings({ loop: settings.loop === 'one' ? 'none' : 'one' })}
                   className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl border transition-all ${settings.loop === 'one' ? 'bg-indigo-500 border-indigo-500 text-white shadow-md' : 'bg-system-background border-apple-border text-system-secondary-label'}`}
                 >
                   <Repeat1 size={16} />
                   <span className="text-[9px] font-black uppercase">One</span>
                 </button>
                 <button 
                   onClick={() => updateSettings({ shuffle: !settings.shuffle })}
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

            {/* Sleep Timer */}
            <div className="flex flex-col gap-4 p-4 bg-secondary-system-background/50 rounded-2xl border border-apple-border">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <Clock size={16} className={settings.sleepTimer.isEnabled ? 'text-indigo-500' : 'text-system-secondary-label'} />
                   <span className="text-xs font-bold text-system-label">Sleep Timer</span>
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
                   type="number"
                   value={settings.sleepTimer.minutes}
                   onChange={(e) => updateSleepTimer({ minutes: Math.max(1, parseInt(e.target.value) || 1) })}
                   className="w-16 h-8 bg-system-background rounded-lg border-none text-[11px] font-black text-center focus:ring-1 focus:ring-indigo-500"
                 />
                 <span className="text-[9px] font-bold text-system-secondary-label uppercase">Min</span>
               </div>
            </div>
          </div>
        </Section>

        {/* Display */}
        <Section
          id="display"
          title="Display Settings"
          subtitle="Always ON"
          icon={Monitor}
          color="bg-amber-500/10 text-amber-600"
          isEnabled={settings.displayAlwaysOn}
          onToggle={(v: boolean) => updateSettings({ displayAlwaysOn: v })}
        >
          <p className="text-[10px] text-system-secondary-label">Prevent screen from sleeping during playback.</p>
        </Section>
      </div>
    </Group>
  );
};
