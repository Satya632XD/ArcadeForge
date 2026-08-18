import React, { useState } from 'react';
import Link from '../components/Link';
import Status from '../components/Status';
import { api } from '../api/client';
import { go } from '../api/router';

export function LoginPage({ refreshAuth }) {
  const [form, setForm] = useState({ identifier: '', password: '' }); const [error, setError] = useState(null); const [busy, setBusy] = useState(false);
  async function submit(e) { e.preventDefault(); setBusy(true); setError(null); try { await api.login(form); await refreshAuth(); go('/dashboard'); } catch(e) { setError(e); } finally { setBusy(false); } }
  return <AuthShell title="Welcome back" subtitle="Sign in and get back to building."><form className="stack-form" onSubmit={submit}><Field label="Username or email"><input autoComplete="username" value={form.identifier} onChange={e=>setForm({...form,identifier:e.target.value})} required /></Field><Field label="Password"><input type="password" autoComplete="current-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required /></Field>{error&&<Status kind="error">{error.message}</Status>}<button className="primary-btn wide" disabled={busy}>{busy?'Signing in…':'Log in'}</button></form><div className="auth-foot">New here? <Link to="/register" className="text-link">Create an account</Link></div></AuthShell>;
}

export function RegisterPage({ refreshAuth }) {
  const [form, setForm] = useState({username:'',email:'',displayName:'',password:''}); const [error,setError]=useState(null); const [busy,setBusy]=useState(false);
  async function submit(e) { e.preventDefault(); setBusy(true); setError(null); try { await api.register(form); await refreshAuth(); go('/dashboard'); } catch(e) { setError(e); } finally { setBusy(false); } }
  return <AuthShell title="Create your account" subtitle="Your creator profile starts here."><form className="stack-form" onSubmit={submit}><Field label="Username"><input autoComplete="username" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="your_handle" required /></Field><Field label="Email"><input type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required /></Field><Field label="Display name"><input value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})} required /></Field><Field label="Password"><input type="password" autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} minLength="8" required /></Field>{error&&<Status kind="error">{error.message}</Status>}<button className="primary-btn wide" disabled={busy}>{busy?'Creating…':'Create account'}</button></form><div className="auth-foot">Already have an account? <Link to="/login" className="text-link">Log in</Link></div></AuthShell>;
}

function AuthShell({title,subtitle,children}) { return <div className="auth-page"><div className="auth-card"><div className="eyebrow">ARCADEFORGE</div><h1>{title}</h1><p>{subtitle}</p>{children}</div></div>; }
function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label>; }
