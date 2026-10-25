import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import Logo from '../components/Logo.jsx';

/** Split layout used by every logged-out page: brand panel + form. */
function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <section className="auth-art" aria-hidden="true">
        <Logo size={52} />
        <div>
          <h2>𝒴𝑜𝓊𝓇 𝓋𝒾𝒷𝑒.<br /> 𝒴𝑜𝓊𝓇 𝓉𝓇𝒾𝒷𝑒.</h2>
          <p>𝒮𝒽𝒶𝓇𝑒 𝓎𝑜𝓊𝓇 𝒾𝒹𝑒𝒶𝓈, 𝒸𝑜𝓃𝓃𝑒𝒸𝓉 𝓌𝒾𝓉𝒽 𝓎𝑜𝓊𝓇 𝓅𝑒𝑜𝓅𝓁𝑒, 𝒶𝓃𝒹 𝓀𝑒𝑒𝓅 𝑒𝓋𝑒𝓇𝓎 𝒸𝑜𝓃𝓋𝑒𝓇𝓈𝒶𝓉𝒾𝑜𝓃 𝒶𝓁𝒾𝓋𝑒..</p>
          <ul className="chips"><li>ℛℯ𝒶𝓁-𝓉𝒾𝓂ℯ 𝒸𝒽𝒶𝓉</li>
          <li>𝒞ℴ𝓂𝓂𝓊𝓃𝒾𝓉𝒾ℯ𝓈 ℴ𝒻 ℴ𝓃ℯ</li><li>𝒫𝓇𝒾𝓋𝒶𝓉ℯ 𝒷𝓎 𝒹ℯ𝒻𝒶𝓊𝓁𝓉</li></ul>
        </div>
      </section>
      <main className="auth-form">
        <div className="auth-card">
          <div className="auth-mobile-logo"><Logo size={36} /></div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
          <p className="muted small center-text">{footer}</p>
        </div>
      </main>
    </div>
  );
}

function PasswordField({ label = 'Password', value, onChange, autoComplete, hint }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">{label}
      <span className="pw">
        <input className="input" type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} minLength={8} required />
        <button type="button" className="link-btn" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
      </span>
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

/** Shared submit handling: busy flag + error message. */
function useSubmit(fn) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try { await fn(); } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  return { busy, error, submit };
}

export function Login() {
  const { authenticate } = useAuth();
  const [f, setF] = useState({ login: '', password: '' });
  const { busy, error, submit } = useSubmit(async () => authenticate((await api.post('/auth/login', f)).data));
  return (
    <Shell title="Welcome back" subtitle="Log in to see what's new." footer={<>New to Social-Feed? <Link to="/register">Create an account</Link></>}>
      <form className="stack" onSubmit={submit}>
        <label className="field">E-mail or username<input className="input" value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} autoComplete="username" autoFocus required /></label>
        <PasswordField value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary big" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <Link to="/forgot-password" className="small center-text">Forgot your password?</Link>
      </form>
    </Shell>
  );
}

export function Register() {
  const { authenticate } = useAuth();
  const ui = useUI();
  const [f, setF] = useState({ username: '', displayName: '', email: '', password: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const { busy, error, submit } = useSubmit(async () => {
    authenticate((await api.post('/auth/register', f)).data);
    ui.toast('success', 'Welcome! Check your inbox to verify your e-mail.');
  });
  return (
    <Shell title="Create your account" subtitle="It takes less than a minute." footer={<>Already have an account? <Link to="/login">Log in</Link></>}>
      <form className="stack" onSubmit={submit}>
        <label className="field">Username<input className="input" value={f.username} onChange={set('username')} pattern="[A-Za-z0-9_]{3,20}" title="3–20 letters, numbers or underscores" autoComplete="username" autoFocus required /></label>
        <label className="field">Display name <span className="muted">(optional)</span><input className="input" value={f.displayName} onChange={set('displayName')} maxLength={50} autoComplete="name" /></label>
        <label className="field">E-mail<input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" required /></label>
        <PasswordField value={f.password} onChange={set('password')} autoComplete="new-password" hint="At least 8 characters." />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary big" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const { busy, error, submit } = useSubmit(async () => setSent((await api.post('/auth/forgot-password', { email })).data.message));
  return (
    <Shell title="Reset your password" subtitle="We'll e-mail you a link to choose a new one." footer={<Link to="/login">Back to log in</Link>}>
      {sent ? <p className="notice" role="status">{sent}</p> : (
        <form className="stack" onSubmit={submit}>
          <label className="field">E-mail<input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary big" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const ui = useUI();
  const [password, setPassword] = useState('');
  const { busy, error, submit } = useSubmit(async () => {
    await api.post('/auth/reset-password', { token: params.get('token') || '', password });
    ui.toast('success', 'Password updated. Please log in.');
    nav('/login');
  });
  return (
    <Shell title="Choose a new password" footer={<Link to="/login">Back to log in</Link>}>
      <form className="stack" onSubmit={submit}>
        <PasswordField label="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hint="At least 8 characters. You'll be signed out on all devices." />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary big" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </Shell>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState('loading'); // loading | ok | error
  const [msg, setMsg] = useState('');
  const once = useRef(false); // a token works once: never call twice
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    api.post('/auth/verify-email', { token: params.get('token') || '' })
      .then(() => { setState('ok'); if (user) refreshUser(); })
      .catch((e) => { setState('error'); setMsg(errMsg(e)); });
  }, []); // eslint-disable-line
  return (
    <Shell title={state === 'ok' ? 'E-mail verified' : state === 'error' ? 'Link problem' : 'Verifying…'} footer={<Link to="/">Continue to Social-Feed</Link>}>
      {state === 'ok' && <p className="notice" role="status">Thanks! Your e-mail address is confirmed.</p>}
      {state === 'error' && <p className="error" role="alert">{msg} Log in and request a new link from Settings → Account.</p>}
    </Shell>
  );
}
