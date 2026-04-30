import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight } from 'lucide-react';

export const Group = ({ title, icon: Icon, color, children, isExpanded, onToggle }: any) => {
  return (
    <div className="bg-apple-card rounded-[2.5rem] border border-apple-border shadow-sm overflow-hidden mb-6 flex flex-col">
      <div className="bg-system-background">
        <button 
          onClick={onToggle}
          className="w-full flex items-center gap-4 text-left p-6 hover:bg-secondary-system-background transition-colors"
        >
          <div className={`w-12 h-12 rounded-2xl ${color} flex-shrink-0 flex items-center justify-center shadow-sm`}>
            <Icon size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-base text-system-label tracking-tight">{title}</h3>
            <p className="text-[10px] text-system-secondary-label font-bold uppercase tracking-widest mt-1">Management & Settings</p>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-system-secondary-label"
          >
            <ChevronRight size={20} />
          </motion.div>
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-apple-border bg-system-background/50 overflow-hidden"
          >
            <div className="p-4 flex flex-col gap-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Section = ({ id, title, subtitle, icon: Icon, color, isEnabled, onToggle, children, settings }: any) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="bg-system-background border border-apple-border rounded-[2rem] overflow-hidden transition-all shadow-sm">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div 
            onClick={() => setIsOpen(!isOpen)}
            className={`w-10 h-10 ${isOpen ? 'bg-secondary-system-background' : 'bg-secondary-system-background/50'} rounded-2xl flex-shrink-0 flex items-center justify-center ${color} transition-all cursor-pointer`}
          >
            <Icon size={20} />
          </div>
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
            <h5 className="text-sm font-black tracking-tight truncate text-system-label">{title}</h5>
            {subtitle && <p className="text-[9px] text-system-secondary-label uppercase font-black tracking-widest truncate">{subtitle}</p>}
          </div>
        </div>
        
        {onToggle !== undefined && (
          <button 
            onClick={() => onToggle(!isEnabled)}
            className={`flex-shrink-0 w-10 h-6 rounded-full relative transition-colors ${isEnabled ? 'bg-apple-blue' : 'bg-system-tertiary-label'}`}
          >
            <motion.div className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full" animate={{ x: isEnabled ? 16 : 0 }} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 pb-6"
          >
             <div className="pt-2 border-t border-apple-border/50">
               {children}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
