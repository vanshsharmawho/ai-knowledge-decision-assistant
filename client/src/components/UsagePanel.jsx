import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function UsagePanel({ refreshKey }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.usage().then(setData).catch(() => setData(null));
  }, [refreshKey]);

  if (!data) return null;
  const t = data.totals;
  const tiles = [
    ['Questions asked', t.asked],
    ['Answered', t.answered],
    ['Not in knowledge base', t.unanswered],
    ['Needs human review', t.needsReview],
  ];

  return (
    <section className="stats">
      {tiles.map(([label, value]) => (
        <div className="stat" key={label}>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </section>
  );
}
