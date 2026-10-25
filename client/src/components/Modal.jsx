import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

/**
 * Accessible dialog built on the native <dialog> element: focus is trapped,
 * Esc closes it, the page behind is inert and screen readers announce it.
 * Children only mount while open, so forms reset every time.
 */
export default function Modal({ open, onClose, title, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label={title}>
      {open && (
        <div className="modal-body">
          <header className="modal-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
