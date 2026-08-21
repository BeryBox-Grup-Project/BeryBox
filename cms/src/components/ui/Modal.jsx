import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

export function Modal({ open, onClose, title, description, children, footer }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-inverse-surface/45 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            className="w-full max-w-lg rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            onClick={(event) => event.stopPropagation()}
          >
            {title && (
              <h2 id="modal-title" className="font-headline text-xl text-on-surface">
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-sm text-on-surface-variant">{description}</p>}
            {children ? <div className="mt-4">{children}</div> : null}
            {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
