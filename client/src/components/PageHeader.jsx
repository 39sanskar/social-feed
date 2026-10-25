import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';

/** Sticky title bar with an optional back button and right-hand actions. */
export default function PageHeader({ title, subtitle, back = false, children }) {
  const nav = useNavigate();
  return (
    <header className="page-head">
      {back && <button className="icon-btn" onClick={() => nav(-1)} aria-label="Go back"><Icon name="back" /></button>}
      <div className="grow"><h1>{title}</h1>{subtitle && <p className="muted small">{subtitle}</p>}</div>
      {children}
    </header>
  );
}
