import { useState } from 'react';
import api, { errMsg } from '../api';
import { useUI } from '../context/UIContext.jsx';
import Composer from './Composer.jsx';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';

const REASONS = [
  ['spam', 'Spam or scam'], ['abuse', 'Abusive or hateful'], ['harassment', 'Harassment or bullying'],
  ['violence', 'Violence or threats'], ['sensitive', 'Sensitive content not labelled'], ['other', 'Something else'],
];

function ReportForm({ target, onClose }) {
  const ui = useUI();
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/reports', { ...target, reason, details });
      ui.toast('success', data.message);
      onClose();
    } catch (err) { ui.toast('error', errMsg(err)); setBusy(false); }
  };
  return (
    <form className="stack" onSubmit={send}>
      <fieldset className="radios">
        <legend className="sr-only">Reason</legend>
        {REASONS.map(([v, label]) => <label key={v} className="check"><input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} /> {label}</label>)}
      </fieldset>
      <label className="field">Details (optional)<textarea className="input" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} /></label>
      <div className="row gap-s end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</button></div>
    </form>
  );
}

/** The app's global dialogs and toast stack: rendered once (in Layout), opened through useUI(). */
export default function GlobalModals() {
  const ui = useUI();
  const c = ui.confirmState?.opts;
  return (
    <>
      <Modal open={!!ui.composeOpts} onClose={ui.closeCompose} title={ui.composeOpts?.parent ? 'Reply' : ui.composeOpts?.quoteOf ? 'Quote post' : 'New post'}>
        {ui.composeOpts && <Composer {...ui.composeOpts} autoFocus onDone={ui.closeCompose} />}
      </Modal>

      <Modal open={!!c} onClose={() => ui.closeConfirm(false)} title={c?.title || ''}>
        <p className="muted">{c?.body}</p>
        <div className="row gap-s end" style={{ marginTop: 18 }}>
          <button className="btn" onClick={() => ui.closeConfirm(false)}>Cancel</button>
          <button className={`btn ${c?.danger ? 'danger' : 'primary'}`} onClick={() => ui.closeConfirm(true)}>{c?.confirmLabel || 'Confirm'}</button>
        </div>
      </Modal>

      <Modal open={!!ui.reportTarget} onClose={() => ui.report(null)} title="Report">
        {ui.reportTarget && <ReportForm target={ui.reportTarget} onClose={() => ui.report(null)} />}
      </Modal>

      <div className="toasts" aria-live="polite">
        {ui.toasts.map((t) => <div key={t.id} className={`toast ${t.type}`}><Icon name={t.type === 'error' ? 'x' : 'check'} size={16} /> {t.message}</div>)}
      </div>
    </>
  );
}
