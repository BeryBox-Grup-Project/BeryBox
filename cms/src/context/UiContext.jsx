import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Warning } from '@phosphor-icons/react';

const UiContext = createContext(null);

function isWarningTone(tone) {
  return tone === 'error' || tone === 'warning';
}

function toastClass(tone) {
  if (isWarningTone(tone)) {
    return 'flex items-center gap-2.5 rounded-2xl border-2 border-error bg-error-container px-5 py-3 text-sm text-on-error-container shadow-lg';
  }
  if (tone === 'success') {
    return 'rounded-full bg-tertiary px-5 py-3 text-sm text-on-tertiary shadow-lg';
  }
  return 'rounded-full bg-inverse-surface px-5 py-3 text-sm text-inverse-on-surface shadow-lg';
}

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, tone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((rows) => [...rows, { id, message, tone }]);
    setTimeout(() => setToasts((rows) => rows.filter((row) => row.id !== id)), 4000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <UiContext.Provider value={value}>
      {children}
      <div className="fixed bottom-8 left-1/2 z-[50] flex -translate-x-1/2 flex-col gap-2">
        <AnimatePresence>
          {toasts.map((row) => (
            <motion.div
              key={row.id}
              role={isWarningTone(row.tone) ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className={toastClass(row.tone)}
            >
              {isWarningTone(row.tone) ? (
                <Warning size={22} weight="fill" className="shrink-0 text-error" aria-hidden />
              ) : null}
              <span>{row.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </UiContext.Provider>
  );
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside UiProvider');
  return ctx;
}
