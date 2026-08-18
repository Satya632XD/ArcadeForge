import React, { useEffect, useState } from 'react';
import Link from './Link';
import { api } from '../api/client';
import { go } from '../api/router';

export default function Layout({ user, refreshAuth, children }) {
  const [balance, setBalance] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) api.wallet().then((x) => setBalance(x.balance)).catch(() => setBalance(null));
    else setBalance(null);
  }, [user]);

  async function logout() {
    await api.logout().catch(() => {});
    await refreshAuth();
    setOpen(false);
    go('/');
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><Link to="/">ArcadeForge<span>•</span></Link></div>
      <nav className="nav-links">
        <Link to="/games">Discover</Link>
        {user && <Link to="/create">Create</Link>}
        {user && <Link to="/dashboard">Studio</Link>}
      </nav>
      <div className="nav-actions">
        {user ? <>
          <Link to="/wallet" className="wallet-pill">◆ {balance === null ? '—' : balance.toLocaleString()} GC</Link>
          <button className="avatar-btn" onClick={() => setOpen((x) => !x)}>{user.displayName.slice(0, 1).toUpperCase()}</button>
          {open && <div className="menu-popover">
            <div className="menu-name">{user.displayName}</div>
            <Link to={`/profile/${user.username}`}>Profile</Link>
            <Link to="/wallet">Wallet</Link>
            <Link to="/account">Account settings</Link>
            <button onClick={logout}>Log out</button>
          </div>}
        </> : <>
          <Link to="/login" className="ghost-btn">Log in</Link>
          <Link to="/register" className="primary-btn">Sign up</Link>
        </>}
      </div>
    </header>
    <main>{children}</main>
    <footer><span>ArcadeForge</span><span>Code-first game publishing, sandboxed by design.</span></footer>
  </div>;
}
