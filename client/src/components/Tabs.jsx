/** Accessible tab bar (role=tablist). Arrow keys move between tabs. */
export default function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  const move = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next[0]);
    e.currentTarget.parentElement.querySelectorAll('[role=tab]')[tabs.indexOf(next)]?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map(([id, text], i) => (
        <button key={id} role="tab" aria-selected={value === id} tabIndex={value === id ? 0 : -1} className={value === id ? 'on' : ''} onClick={() => onChange(id)} onKeyDown={(e) => move(e, i)}>
          <span>{text}</span>
        </button>
      ))}
    </div>
  );
}
