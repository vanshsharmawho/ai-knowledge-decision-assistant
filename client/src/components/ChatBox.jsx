import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const OUTCOME_LABEL = {
  POSITIVE: { text: 'All required conditions met', cls: 'ok' },
  NEGATIVE: { text: 'A required condition is not met', cls: 'bad' },
  NEEDS_REVIEW: { text: 'Needs human review', cls: 'warn' },
  INFORMATIONAL: { text: 'Informational', cls: 'info' },
};

function condClass(c) {
  if (c.met === true) return 'ok';
  if (c.met === false) return 'bad';
  return valueClass(c.value);
}

function valueClass(v) {
  if (v === 'YES') return 'ok';
  if (v === 'NO') return 'bad';
  if (v === 'UNKNOWN') return 'warn';
  return 'info';
}

function DecisionView({ decision, open }) {
  const o = OUTCOME_LABEL[decision.outcome] || OUTCOME_LABEL.INFORMATIONAL;
  return (
    <details className="decision" open={open}>
      <summary>
        <span>{open ? `Decision: ${decision.goal}` : 'Why this answer?'}</span>
        <span className={`pill ${o.cls}`}>{o.text}</span>
      </summary>
      <ul>
        {decision.conditions.map((c) => (
          <li key={c.id}>
            <div className="cond-head">
              <span className="cond-id">{c.id}</span>
              <span className="cond-type">{c.type}</span>
              <span className={`pill ${condClass(c)}`}>
                {typeof c.value === 'number' ? c.value.toFixed(2) : c.value}
              </span>
              {c.met === true && <span className="cond-by">requirement met</span>}
              {c.met === false && <span className="cond-by">requirement not met</span>}
              <span className="cond-by">{c.decidedBy === 'rule-engine' ? 'rule engine' : c.decidedBy}</span>
            </div>
            <div className="cond-q">{c.question}</div>
            {c.reason && <div className="cond-reason">{c.reason}</div>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function TraceView({ trace, latencyMs }) {
  return (
    <details className="trace">
      <summary>Pipeline trace · {(latencyMs / 1000).toFixed(1)}s</summary>
      <ol>
        {trace.map((t, i) => (
          <li key={i} className={t.error ? 'err' : ''}>
            <span>{t.stage}</span>
            <span className="muted">
              {t.ms} ms
              {t.result ? ` · ${t.result}` : ''}
              {t.hits !== undefined ? ` · ${t.hits} hits` : ''}
              {t.score !== undefined ? ` · score ${Number(t.score).toFixed(2)}` : ''}
              {t.conditions !== undefined ? ` · ${t.conditions} conditions` : ''}
              {t.outcome ? ` · ${t.outcome}` : ''}
              {t.error ? ` · ${t.error}` : ''}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

export default function ChatBox({ token, debug = false, onAsked, suggestions = [] }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  async function ask(text) {
    const question = (text ?? input).trim();
    if (!question) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setBusy(true);
    try {
      const res = await api.ask(token, question, debug);
      setMessages((m) => [...m, { role: 'assistant', ...res }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', status: 'error', answer: err.message }]);
    } finally {
      setBusy(false);
      onAsked?.();
    }
  }

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Ask a question about this organization's documents.</p>
            {suggestions.map((s) => (
              <button key={s} className="suggestion" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="msg user">
              {m.text}
            </div>
          ) : (
            <div key={i} className={`msg assistant ${m.status}`}>
              {m.status === 'not_found' && <div className="tag warn">Not in the knowledge base</div>}
              {m.status === 'needs_review' && <div className="tag warn">Needs human review</div>}
              {m.status === 'error' && <div className="tag bad">Error</div>}
              <div className="answer">{m.answer}</div>
              {m.decision && <DecisionView decision={m.decision} open={debug} />}
              {m.references?.length > 0 && (
                <div className="refs">
                  <div className="refs-title">Sources</div>
                  {m.references.map((r) => (
                    <div key={r.display} className="ref">
                      📄 {r.display}
                    </div>
                  ))}
                </div>
              )}
              {debug && m.trace && <TraceView trace={m.trace} latencyMs={m.latencyMs} />}
            </div>
          )
        )}
        {busy && <div className="msg assistant thinking">Searching documents and checking conditions…</div>}
        <div ref={endRef} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
          maxLength={1000}
          disabled={busy}
        />
        <button className="btn primary" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
