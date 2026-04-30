
import { initDB } from '../db';

export interface IntegrityReport {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'critical';
  checks: {
    storage: boolean;
    database: boolean;
    audio: boolean;
    pwa: boolean;
    memory: boolean;
  };
  errors: string[];
}

class SafetyChecker {
  private static report: IntegrityReport = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      storage: false,
      database: false,
      audio: false,
      pwa: false,
      memory: true,
    },
    errors: []
  };

  static async runFullDiagnostics(): Promise<IntegrityReport> {
    console.log('[Safety] Starting full diagnostics...');
    
    // 1. Storage Check
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('safety_check', 'ok');
        localStorage.removeItem('safety_check');
        this.report.checks.storage = true;
      }
    } catch (e) {
      this.addError('LocalStorage inaccessible - persistent settings may fail');
    }

    // 2. Database Check
    try {
      if (typeof window !== 'undefined') {
        await initDB();
        this.report.checks.database = true;
      }
    } catch (e) {
      this.addError('IndexedDB failed to initialize track storage');
    }

    // 3. Audio Support Check
    try {
      if (typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) throw new Error('No AudioContext');
        
        const testAudio = new Audio();
        if (!testAudio.canPlayType) throw new Error('HTMLAudioElement broken');
        
        this.report.checks.audio = true;
      }
    } catch (e) {
      this.addError('Critical: Browser does not support required audio APIs');
    }

    // 4. PWA/Worker Check
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        this.report.checks.pwa = !!registration;
        if (!registration) {
          console.log('[Safety] Service worker not registered yet - normal for first load or cleared cache');
        }
      } catch (e) {
        // Non-critical
        console.warn('[Safety] Service worker check failed');
      }
    }

    // Determine final status
    // Critical only if storage, database, OR audio is broken
    const criticalFailure = !this.report.checks.storage || !this.report.checks.database || !this.report.checks.audio;
    
    if (criticalFailure) {
      this.report.status = 'critical';
    } else if (this.report.errors.length > 0) {
      this.report.status = 'degraded';
    } else {
      this.report.status = 'healthy';
    }

    console.log('[Safety] Diagnostics complete:', this.report.status, this.report.checks);
    return this.report;
  }

  private static addError(msg: string) {
    this.report.errors.push(msg);
    console.warn(`[Safety] ${msg}`);
  }

  static getReport() {
    return this.report;
  }

  static validateAudioElement(el: HTMLAudioElement | null, context: string): boolean {
    if (!el) {
      console.error(`[Safety] ${context}: Audio element is null`);
      return false;
    }
    if (el.error) {
      console.error(`[Safety] ${context}: Audio element error state:`, el.error);
      return false;
    }
    return true;
  }
}

export default SafetyChecker;
