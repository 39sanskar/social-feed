import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const Ctx = createContext(null);
export const useUI = () => useContext(Ctx);

/**
 * Cross-cutting UI state: theme, accessibility, toasts and the three global
 * dialogs (compose, confirm, report). The dialogs themselves are rendered once
 * by <GlobalModals/>; any component opens them with e.g. ui.openCompose().
 */
export function UIProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('sf-theme') || 'system'); // system | light | dark
  const [bigText, setBigTextState] = useState(() => localStorage.getItem('sf-bigtext') === '1');
  const [toasts, setToasts] = useState([]);
  const [composeOpts, setComposeOpts] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);

  // theme: follows the OS when "system", and reacts if the OS setting changes
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => (document.documentElement.dataset.theme = theme === 'dark' || (theme === 'system' && mq.matches) ? 'dark' : 'light');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => document.documentElement.classList.toggle('big-text', bigText), [bigText]);

  const setTheme = (t) => { localStorage.setItem('sf-theme', t); setThemeState(t); };
  const setBigText = (v) => { localStorage.setItem('sf-bigtext', v ? '1' : '0'); setBigTextState(v); };

  const toast = useCallback((type, message) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  /** await ui.confirm({ title, body, confirmLabel, danger }) → true / false */
  const confirm = useCallback((opts) => new Promise((resolve) => setConfirmState({ opts, resolve })), []);

  return (
    <Ctx.Provider
      value={{
        theme, setTheme, bigText, setBigText,
        toasts, toast,
        composeOpts, openCompose: (o = {}) => setComposeOpts(o), closeCompose: () => setComposeOpts(null),
        confirmState, confirm, closeConfirm: (answer) => { confirmState?.resolve(answer); setConfirmState(null); },
        reportTarget, report: setReportTarget,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
