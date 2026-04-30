import React, { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';

// --- Context ---

interface ModalContextType {
  confirm: (options: { title: string; subtitle?: string; confirmLabel?: string; cancelLabel?: string; isDestructive?: boolean }) => Promise<boolean>;
  prompt: (options: { title: string; subtitle?: string; placeholder?: string; initialValue?: string; confirmLabel?: string }) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextType | null>(null);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal must be used within a ModalProvider');
  return context;
};

export const ModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [confirmOptions, setConfirmOptions] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    resolve: (val: boolean) => void;
  } | null>(null);

  const [promptOptions, setPromptOptions] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    placeholder?: string;
    initialValue?: string;
    confirmLabel?: string;
    resolve: (val: string | null) => void;
  } | null>(null);

  const confirm = useCallback((options: any) => {
    return new Promise<boolean>((resolve) => {
      setConfirmOptions({ ...options, isOpen: true, resolve });
    });
  }, []);

  const prompt = useCallback((options: any) => {
    return new Promise<string | null>((resolve) => {
      setPromptOptions({ ...options, isOpen: true, resolve });
    });
  }, []);

  return (
    <ModalContext.Provider value={{ confirm, prompt }}>
      {children}
      <SafeConfirmModal 
        isOpen={!!confirmOptions?.isOpen}
        onClose={() => {
          confirmOptions?.resolve(false);
          setConfirmOptions(null);
        }}
        onConfirm={() => {
          confirmOptions?.resolve(true);
          setConfirmOptions(null);
        }}
        title={confirmOptions?.title || ''}
        subtitle={confirmOptions?.subtitle}
        confirmLabel={confirmOptions?.confirmLabel}
        cancelLabel={confirmOptions?.cancelLabel}
        isDestructive={confirmOptions?.isDestructive}
      />
      <SafeInputModal 
        isOpen={!!promptOptions?.isOpen}
        onClose={() => {
          promptOptions?.resolve(null);
          setPromptOptions(null);
        }}
        onConfirm={(val) => {
          promptOptions?.resolve(val);
          setPromptOptions(null);
        }}
        title={promptOptions?.title || ''}
        subtitle={promptOptions?.subtitle}
        placeholder={promptOptions?.placeholder}
        initialValue={promptOptions?.initialValue}
        confirmLabel={promptOptions?.confirmLabel}
      />
    </ModalContext.Provider>
  );
};

// --- Components ---
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface SafeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * A bulletproof iOS-safe modal system.
 * Renders via Portal at root level, avoids parent transforms,
 * and uses only stable animations (opacity/translate) to prevent 
 * input focus issues on mobile devices.
 */
export const SafeModal = ({ isOpen, onClose, title, subtitle, children }: SafeModalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
          style={{ isolation: 'isolate' }}
        >
          {/* Overlay - Background only, handles clicks carefully */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
          />

          {/* Modal Container - Hardware accelerated but NO SCALE transforms */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-apple-card rounded-[2.5rem] shadow-2xl border border-apple-border overflow-hidden pointer-events-auto"
          >
            <div className="p-8 pb-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-2xl font-extrabold tracking-tight text-system-label mb-1">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-[11px] text-system-secondary-label font-bold uppercase tracking-widest leading-relaxed">
                      {subtitle}
                    </p>
                  )}
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 -mr-2 text-system-tertiary-label hover:text-system-label active:scale-95 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-8 pt-2">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    modalRoot
  );
};

interface SafeInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  subtitle?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
}

/**
 * Specialized Modal for text inputs to ensure perfect iOS stability.
 * Uses internal state to prevent re-renders of the main app while typing.
 */
export const SafeInputModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  placeholder = "Enter value...",
  initialValue = "",
  confirmLabel = "Confirm"
}: SafeInputModalProps) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync initial value when modal opens
  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      // Delayed focus for iOS stability
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        if (initialValue) {
          inputRef.current?.select();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialValue]);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onConfirm(trimmed);
      onClose();
    }
  };

  return (
    <SafeModal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="flex flex-col gap-6">
        <input 
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') onClose();
          }}
          placeholder={placeholder}
          className="w-full bg-secondary-system-background text-system-label rounded-2xl p-5 text-lg font-bold outline-none border border-apple-border focus:ring-0 focus:border-apple-blue shadow-inner-sm transition-all"
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />

        <div className="flex gap-3 mt-2">
          <button 
            onClick={onClose}
            className="flex-1 py-4.5 rounded-2xl bg-secondary-system-background text-system-secondary-label font-bold uppercase text-[11px] tracking-widest transition-all active:scale-[0.98]"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!value.trim()}
            className="flex-[1.5] py-4.5 rounded-2xl bg-apple-blue text-white font-bold uppercase text-[11px] tracking-widest transition-all active:scale-[0.98] disabled:opacity-30 shadow-lg shadow-apple-blue/20"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </SafeModal>
  );
};

interface SafeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

/**
 * Specialized Modal for confirmations.
 */
export const SafeConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false
}: SafeConfirmModalProps) => {
  return (
    <SafeModal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-4.5 rounded-2xl bg-secondary-system-background text-system-secondary-label font-bold uppercase text-[11px] tracking-widest transition-all active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-4.5 rounded-2xl ${isDestructive ? 'bg-red-500 shadow-red-500/20' : 'bg-system-label shadow-system-label/20'} text-system-background font-bold uppercase text-[11px] tracking-widest transition-all active:scale-[0.98] shadow-lg`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </SafeModal>
  );
};
