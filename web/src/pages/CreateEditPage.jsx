import React, { useEffect, useState } from 'react';
import Link from '../components/Link';
import Status from '../components/Status';
import { api } from '../api/client';
import { go } from '../api/router';

const starter = `const canvas = document.createElement('canvas');\ncanvas.width = 720;\ncanvas.height = 420;\ncanvas.style.width = '100%';\ndocument.body.appendChild(canvas);\nconst ctx = canvas.getContext('2d');\nlet x = 360;\nfunction loop(t) {\n  ctx.fillStyle = '#0b1020'; ctx.fillRect(0,0,canvas.width,canvas.height);\n  ctx.fillStyle = '#7df0b4'; ctx.beginPath(); ctx.arc(x,210,32,0,Math.PI*2); ctx.fill();\n  x = 360 + Math.sin(t / 600) * 250;\n  requestAnimationFrame(loop);\n}\nrequestAnimationFrame(loop);`;

export default function CreateEditPage({ id }) {
  const edit = Boolean(id);
  const [form, setForm] = useState({ title: '', description: '', sourceCode: starter });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('draft');

  useEffect(() => {
    if (!id) return;
    api.game(id)
      .then(({ game }) => {
        setForm({ title: game.title, description: game.description, sourceCode: game.sourceCode || '' });
        setStatus(game.status);
      })
      .catch(setError);
  }, [id]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      const data = edit ? await api.updateGame(id, form) : await api.createGame(form);
      setMessage('Saved.');
      if (!edit) go(`/edit/${data.game.id}`);
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setSaving(true);
    setError(null);
    try {
      if (status === 'published') {
        await api.unpublish(id);
        setStatus('draft');
        setMessage('Unpublished.');
      } else {
        await api.publish(id);
        setStatus('published');
        setMessage('Published.');
      }
    } catch (publishError) {
      setError(publishError);
    } finally {
      setSaving(false);
    }
  }

  if (error && edit && !form.title) {
    return <div className="container page"><Status kind="error">{error.message}</Status></div>;
  }

  return <div className="container page editor-page">
    <div className="page-title">
      <div>
        <div className="eyebrow">CREATOR STUDIO</div>
        <h1>{edit ? 'Edit game' : 'Create a game'}</h1>
        <p>Write browser JavaScript. Save it as a draft, then publish when it is ready.</p>
      </div>
      <Link to="/dashboard" className="ghost-btn">Back to Studio</Link>
    </div>
    <form onSubmit={save} className="editor-layout">
      <section className="panel editor-form">
        <Field label="Title">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength="100" required />
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength="5000" rows="5" />
        </Field>
        <p className="muted">Published games are always free to launch and play.</p>
        {error && <Status kind="error">{error.message}</Status>}
        {message && <Status kind="success">{message}</Status>}
        <div className="form-actions">
          <button className="primary-btn" disabled={saving}>{saving ? 'Saving...' : 'Save game'}</button>
          {edit && <button type="button" className="ghost-btn" disabled={saving} onClick={publish}>{status === 'published' ? 'Unpublish' : 'Publish'}</button>}
        </div>
      </section>
      <section className="panel code-panel">
        <div className="code-header">
          <div><h2>JavaScript</h2><span>max 200 KB - runs only inside the sandbox</span></div>
          <span className={`status-dot ${status}`}>{status}</span>
        </div>
        <textarea className="code-editor" spellCheck="false" value={form.sourceCode} onChange={(event) => setForm({ ...form, sourceCode: event.target.value })} />
      </section>
    </form>
  </div>;
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
