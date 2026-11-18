import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, session } from '../api.js';
import DocumentsPanel from '../components/DocumentsPanel.jsx';
import AssistantPanel from '../components/AssistantPanel.jsx';
import UsagePanel from '../components/UsagePanel.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [error, setError] = useState('');
  const [usageKey, setUsageKey] = useState(0);

  useEffect(() => {
    api
      .me()
      .then((d) => setOrg(d.organization))
      .catch((err) => {
        if (err.status === 401) navigate('/login');
        else setError(err.message);
      });
  }, [navigate]);

  function logout() {
    session.clear();
    navigate('/login');
  }

  if (error) return <div className="page"><div className="alert error">{error}</div></div>;
  if (!org) return <div className="page muted">Loading…</div>;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="eyebrow">Organization</div>
          <h1>{org.name}</h1>
          <div className="muted small">{org.email}</div>
        </div>
        <button className="btn" onClick={logout}>
          Log out
        </button>
      </header>

      <UsagePanel refreshKey={usageKey} />
      <DocumentsPanel />
      <AssistantPanel onAsked={() => setUsageKey((k) => k + 1)} />
    </div>
  );
}
