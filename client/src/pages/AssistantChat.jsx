import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import ChatBox from '../components/ChatBox.jsx';

/** Public assistant page. Loaded directly or inside an iframe; no login. */
export default function AssistantChat() {
  const { token } = useParams();
  const [org, setOrg] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .assistantInfo(token)
      .then(setOrg)
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="widget">
        <div className="widget-error">
          <h2>Assistant unavailable</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  if (!org) return <div className="widget muted center">Loading…</div>;

  return (
    <div className="widget">
      <header className="widget-head">
        <div className="dot" />
        <div>
          <div className="strong">{org.name}</div>
          <div className="small muted">AI assistant · answers from {org.name}'s documents</div>
        </div>
      </header>
      <ChatBox token={token} />
    </div>
  );
}
