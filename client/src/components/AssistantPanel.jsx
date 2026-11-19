import { useEffect, useState } from 'react';
import { api } from '../api.js';
import ChatBox from './ChatBox.jsx';

function CopyField({ label, value, multiline }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; user can select manually */
    }
  }
  return (
    <div className="copy-field">
      <div className="copy-label">
        <span>{label}</span>
        <button className="btn sm" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      {multiline ? <textarea readOnly value={value} rows={3} /> : <input readOnly value={value} />}
    </div>
  );
}

export default function AssistantPanel({ onAsked }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    api.getAssistant().then(setInfo).catch((e) => setError(e.message));
  }, []);

  async function regenerate() {
    setConfirming(false);
    try {
      setInfo(await api.regenerateAssistant());
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <section className="card"><div className="alert error">{error}</div></section>;
  if (!info) return null;

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Your assistant</h2>
          <p className="muted small">Anyone with this link can ask questions. Only your documents are used.</p>
        </div>
        <div className="row">
          <a className="btn" href={info.url} target="_blank" rel="noreferrer">
            Open assistant ↗
          </a>
          {confirming ? (
            <>
              <span className="small">Old link stops working.</span>
              <button className="btn danger sm" onClick={regenerate}>
                Regenerate
              </button>
              <button className="btn sm" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => setConfirming(true)}>
              Regenerate link
            </button>
          )}
        </div>
      </div>

      <CopyField label="Assistant URL" value={info.url} />
      <CopyField label="Embed with an iframe" value={info.embed.iframe} multiline />
      <CopyField label="Or embed as a floating chat button (script)" value={info.embed.script} multiline />

      <h3>Try it here</h3>
      <p className="muted small">Test questions with the pipeline details shown (decisions, timings).</p>
      <div className="try-box">
        <ChatBox token={info.token} debug onAsked={onAsked} />
      </div>
    </section>
  );
}
