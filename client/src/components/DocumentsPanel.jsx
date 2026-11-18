import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const fmtSize = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

export default function DocumentsPanel() {
  const [docs, setDocs] = useState([]);
  const [limits, setLimits] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // {type, text}
  const [confirmId, setConfirmId] = useState(null);
  const fileRef = useRef();
  const replaceRef = useRef();
  const [replaceId, setReplaceId] = useState(null);

  async function load() {
    try {
      const d = await api.listDocuments();
      setDocs(d.documents);
      setLimits(d.limits);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }
  useEffect(() => {
    load();
  }, []);

  function checkLocally(file) {
    if (!/\.pdf$/i.test(file.name)) return 'Only PDF files can be uploaded.';
    if (limits && file.size > limits.maxMbPerPdf * 1024 * 1024) {
      return `File is too large (${fmtSize(file.size)}). Maximum is ${limits.maxMbPerPdf} MB per PDF.`;
    }
    return null;
  }

  async function upload(file, replaceDocumentId) {
    const problem = checkLocally(file);
    if (problem) return setMessage({ type: 'error', text: problem });
    setBusy(true);
    setMessage({ type: 'info', text: `Processing ${file.name}… (reading pages, building the search index)` });
    try {
      const { document } = await api.uploadDocument(file, replaceDocumentId);
      setMessage({
        type: 'success',
        text: `${document.filename} is ready: ${document.pageCount} pages, ${document.chunkCount} searchable chunks.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
      setReplaceId(null);
      await load();
    }
  }

  async function remove(id) {
    setConfirmId(null);
    try {
      await api.deleteDocument(id);
      setMessage({ type: 'success', text: 'Document deleted.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  const full = limits && limits.documentsUsed >= limits.maxDocuments;

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Knowledge base</h2>
          {limits && (
            <p className="muted small">
              {limits.documentsUsed} / {limits.maxDocuments} documents · max {limits.maxPagesPerPdf} pages and{' '}
              {limits.maxMbPerPdf} MB per PDF
            </p>
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              if (e.target.files[0]) upload(e.target.files[0]);
              e.target.value = '';
            }}
          />
          <button className="btn primary" disabled={busy || full} onClick={() => fileRef.current.click()}>
            {busy ? 'Uploading…' : full ? 'Limit reached' : 'Upload PDF'}
          </button>
        </div>
      </div>

      <input
        ref={replaceRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          if (e.target.files[0] && replaceId) upload(e.target.files[0], replaceId);
          e.target.value = '';
        }}
      />

      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      {docs.length === 0 ? (
        <p className="empty">No documents yet. Upload a PDF to build your assistant's knowledge base.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>File</th>
              <th>Pages</th>
              <th>Size</th>
              <th>Status</th>
              <th>Uploaded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td className="strong">{d.filename}</td>
                <td>{d.pageCount}</td>
                <td>{fmtSize(d.sizeBytes)}</td>
                <td>
                  <span className={`badge ${d.status}`}>{d.status}</span>
                  {d.error && <div className="muted small">{d.error}</div>}
                </td>
                <td className="muted small">{new Date(d.uploadedAt).toLocaleString()}</td>
                <td className="actions">
                  {confirmId === d.id ? (
                    <>
                      <span className="small">Delete?</span>
                      <button className="btn danger sm" onClick={() => remove(d.id)}>
                        Yes
                      </button>
                      <button className="btn sm" onClick={() => setConfirmId(null)}>
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn sm"
                        disabled={busy}
                        onClick={() => {
                          setReplaceId(d.id);
                          replaceRef.current.click();
                        }}
                      >
                        Replace
                      </button>
                      <button className="btn sm" disabled={busy} onClick={() => setConfirmId(d.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
