'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'automodz-install-dismissed';

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {}
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS has no beforeinstallprompt - show add-to-home-screen hint
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      const t = setTimeout(() => { setShowIOS(true); setVisible(true); }, 4000);
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onPrompt); };
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setVisible(false);
    setDeferred(null);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="fixed left-4 right-4 z-50 max-w-md mx-auto rounded-2xl p-4"
          style={{ bottom: 'calc(var(--bottom-nav-h) + 12px)', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-grad)' }}>
              <Download size={17} style={{ color: 'var(--on-accent)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>
                Get the AutoModz app
              </p>
              {showIOS ? (
                <p className="text-xs font-body mt-1 flex items-center gap-1 flex-wrap" style={{ color: 'var(--steel)' }}>
                  Tap <Share size={12} className="inline" /> then
                  <PlusSquare size={12} className="inline" /> “Add to Home Screen”
                </p>
              ) : (
                <p className="text-xs font-body mt-1" style={{ color: 'var(--steel)' }}>
                  One tap to install - book & track services like a native app.
                </p>
              )}
            </div>
            <button onClick={dismiss} className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
              style={{ background: 'var(--dark)', color: 'var(--steel)' }}>
              <X size={13} />
            </button>
          </div>
          {!showIOS && deferred && (
            <button onClick={install} className="btn-ember w-full py-2.5 mt-3 text-sm">Install App</button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
