import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

/** "…" dropdown. Items are plain <button role="menuitem">. Closes on outside click, Esc and after choosing. */
export default function Menu({ label = 'More options', icon = 'more', trigger, triggerClass = 'icon-btn', children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button className={triggerClass} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{trigger || <Icon name={icon} />}</button>
      {open && <div className="menu-list" role="menu" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}
