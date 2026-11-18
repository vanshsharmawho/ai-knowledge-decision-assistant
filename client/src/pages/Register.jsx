import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, session } from '../api.js';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token } = await api.register(form);
      session.set(token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Create your organization</h1>
        <p className="muted">Upload your PDFs and get an AI assistant you can embed on your website.</p>
        <label>
          Organization name
          <input value={form.name} onChange={set('name')} placeholder="Northfield University" required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={set('email')} required />
        </label>
        <label>
          Password <span className="muted small">(min 8 characters)</span>
          <input type="password" value={form.password} onChange={set('password')} minLength={8} required />
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="muted small">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
