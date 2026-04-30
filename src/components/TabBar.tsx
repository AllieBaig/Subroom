import { ReactNode } from 'react';
import { useSettings } from '../SettingsContext';
import { useUIState, TabType } from '../UIStateContext';
import { Music, Settings as SettingsIcon, Search, PlayCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TabBarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function TabBar({ activeTab, setActiveTab }: TabBarProps) {
  const { settings } = useSettings();
  const tabs: { id: TabType | 'back', label: string, icon: any }[] = [
    { id: 'library', label: 'Library', icon: Music },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'player', label: 'Playing', icon: PlayCircle },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  if (settings.backButtonPosition === 'bottom' && activeTab !== 'library') {
    tabs.unshift({ id: 'back', label: 'Back', icon: ArrowLeft });
  }

  return (
    <div className={cn(
      "w-full bg-secondary-system-background/80 backdrop-blur-3xl border border-apple-border/20 rounded-[2rem] flex justify-around items-center z-50 transition-all shadow-xl",
      settings.miniMode ? "px-2 py-1 h-14" : "px-4 py-2 h-16",
      settings.bigTouchMode && !settings.miniMode && "h-20"
    )}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === 'back') {
                setActiveTab('library');
              } else {
                setActiveTab(tab.id);
              }
            }}
            className={cn(
              "relative flex flex-col items-center gap-0.5 transition-all duration-300 flex-1",
              isActive ? "text-apple-blue" : "text-system-secondary-label/60",
              tab.id === 'back' && "text-system-label"
            )}
          >
            <div className="p-1 px-4 rounded-full transition-all">
              <Icon size={isActive ? 24 : 22} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={`font-bold text-[10px] tracking-tight ${isActive ? 'text-apple-blue' : 'text-system-secondary-label'}`}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
