import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { NOTIF_TEXT, compact } from '../utils.js';
import Avatar from './Avatar.jsx';
import GlobalModals from './GlobalModals.jsx';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import Menu from './Menu.jsx';
import SearchBox from './SearchBox.jsx';
import UserRow from './UserRow.jsx';

const Badge = ({ n }) => (n > 0 ? <b className="badge" aria-label={`${n} unread`}>{n > 99 ? '99+' : n}</b> : null);

function RightRail() {
  const [trending, setTrending] = useState(null);
  const [people, setPeople] = useState(null);
  useEffect(() => {
    api.get('/search/trending').then((r) => setTrending(r.data)).catch(() => setTrending([]));
    api.get('/users/suggestions').then((r) => setPeople(r.data)).catch(() => setPeople([]));
  }, []);
  return (
    <aside className="side" aria-label="Discover">
      <SearchBox />
      <section className="panel">
        <h2>Trending</h2>
        {trending === null && <div className="skeleton line" />}
        {trending?.length === 0 && <p className="muted small">Nothing is trending yet. Tags used by several people in the last 24 hours show up here.</p>}
        {trending?.slice(0, 5).map((t) => (
          <Link key={t.tag} to={`/tag/${t.tag}`} className="trend"><strong>#{t.tag}</strong><span className="muted small">{compact(t.posts)} posts</span></Link>
        ))}
        {trending?.length > 5 && <Link to="/explore?tab=trending" className="more">Show more</Link>}
      </section>
      <section className="panel">
        <h2>Who to follow</h2>
        {people?.length === 0 && <p className="muted small">You're following everyone. Check back later!</p>}
        {people?.slice(0, 3).map((u) => <UserRow key={u._id} u={u} showBio={false} message={false} />)}
        <Link to="/explore?tab=people" className="more">Show more</Link>
      </section>
    </aside>
  );
}

/** App shell: left navigation (bottom bar on phones), main column, right rail. */
export default function Layout() {
  const { user, logout, unread, msgUnread, liveNotification } = useAuth();
  const ui = useUI();
  const nav = useNavigate();
  const dark = document.documentElement.dataset.theme === 'dark';

  // realtime notification → toast
  useEffect(() => {
    if (liveNotification) ui.toast('info', `@${liveNotification.sender.username} ${NOTIF_TEXT[liveNotification.type]}`);
  }, [liveNotification]); // eslint-disable-line

  // add a post made anywhere in the app to the page you're looking at is handled by each page via the `post:created` event
  const links = [
    ['/', 'home', 'Home', 0, true],
    ['/explore', 'compass', 'Explore'],
    ['/notifications', 'bell', 'Notifications', unread],
    ['/messages', 'mail', 'Messages', msgUnread],
    ['/bookmarks', 'bookmark', 'Bookmarks'],
    ['/lists', 'list', 'Lists'],
    [`/u/${user.username}`, 'user', 'Profile'],
    ['/settings', 'settings', 'Settings'],
  ];

  return (
    <div className="app">
      <a href="#main" className="skip">Skip to content</a>
      <nav className="rail" aria-label="Main">
        <Link to="/" className="rail-logo" aria-label="Social-Feed home"><Logo /></Link>
        {links.map(([to, icon, label, n, end]) => (
          <NavLink key={to} to={to} end={end} className="nav-link">
            <span className="nav-icon"><Icon name={icon} size={22} /><Badge n={n} /></span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
        <button className="btn primary big compose-btn" onClick={() => ui.openCompose()}><Icon name="plus" size={20} /><span>Post</span></button>
        <div className="rail-foot">
          <button className="icon-btn" onClick={() => ui.setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}><Icon name={dark ? 'sun' : 'moon'} /></button>
          <Menu label="Account menu" trigger={<><Avatar user={user} size={36} /><span className="me-name"><strong>{user.displayName || user.username}</strong><span className="muted small">@{user.username}</span></span></>} triggerClass="me-chip">
            <button role="menuitem" onClick={() => nav(`/u/${user.username}`)}><Icon name="user" size={16} /> View profile</button>
            <button role="menuitem" onClick={() => nav('/settings')}><Icon name="settings" size={16} /> Settings</button>
            <button role="menuitem" className="danger" onClick={logout}><Icon name="logout" size={16} /> Log out @{user.username}</button>
          </Menu>
        </div>
      </nav>

      <main id="main" className="main"><Outlet /></main>
      <RightRail />

      {/* phone layout: bottom tab bar + floating compose button */}
      <nav className="bottom-nav" aria-label="Quick navigation">
        {links.filter(([to]) => ['/', '/explore', '/messages', '/notifications'].includes(to) || to.startsWith('/u/')).map(([to, icon, label, n, end]) => (
          <NavLink key={to} to={to} end={end} aria-label={label}><span className="nav-icon"><Icon name={icon} size={24} /><Badge n={n} /></span></NavLink>
        ))}
      </nav>
      <button className="fab" onClick={() => ui.openCompose()} aria-label="New post"><Icon name="plus" size={26} /></button>
      <GlobalModals />
    </div>
  );
}
