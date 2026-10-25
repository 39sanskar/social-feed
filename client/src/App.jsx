import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { LogoMark } from './components/Logo.jsx';
import Layout from './components/Layout.jsx';
import { Login, Register, ForgotPassword, ResetPassword, VerifyEmail } from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import Explore, { Search, Tag } from './pages/Explore.jsx';
import PostPage from './pages/PostPage.jsx';
import Profile, { Connections } from './pages/Profile.jsx';
import Bookmarks from './pages/Bookmarks.jsx';
import Lists, { ListDetail } from './pages/Lists.jsx';
import Notifications from './pages/Notifications.jsx';
import Messages from './pages/Messages.jsx';
import Settings from './pages/Settings.jsx';

// Splash shown while the saved session is being restored
const Boot = () => <div className="boot"><LogoMark size={72} /></div>;

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Boot />;
  return user ? children : <Navigate to="/login" replace />;
}
function Guest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Boot />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      {/* public */}
      <Route path="/login" element={<Guest><Login /></Guest>} />
      <Route path="/register" element={<Guest><Register /></Guest>} />
      <Route path="/forgot-password" element={<Guest><ForgotPassword /></Guest>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* signed-in app shell */}
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Home />} />
        <Route path="explore" element={<Explore />} />
        <Route path="search" element={<Search />} />
        <Route path="tag/:tag" element={<Tag />} />
        <Route path="post/:id" element={<PostPage />} />
        <Route path="u/:username" element={<Profile />} />
        <Route path="u/:username/followers" element={<Connections kind="followers" />} />
        <Route path="u/:username/following" element={<Connections kind="following" />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="messages" element={<Messages />} />
        <Route path="bookmarks" element={<Bookmarks />} />
        <Route path="lists" element={<Lists />} />
        <Route path="lists/:id" element={<ListDetail />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
