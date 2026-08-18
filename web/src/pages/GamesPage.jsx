import React, { useEffect, useState } from 'react';
import GameCard from '../components/GameCard';
import Status from '../components/Status';
import { api } from '../api/client';
import { go } from '../api/router';

export default function GamesPage() {
  const [q, setQ] = useState(new URLSearchParams(location.search).get('q') || '');
  const [sort, setSort] = useState(new URLSearchParams(location.search).get('sort') || 'newest');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  async function load(nextQ = q, nextSort = sort) {
    setLoading(true); setError(null);
    try { const p = new URLSearchParams({ sort: nextSort, limit: '24' }); if (nextQ.trim()) p.set('q', nextQ.trim()); const data = await api.games(p.toString()); setGames(data.games); } catch (e) { setError(e); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  return <div className="page container">
    <div className="page-title"><div><div className="eyebrow">DISCOVER</div><h1>Find your next game</h1></div></div>
    <form className="search-row" onSubmit={e => { e.preventDefault(); go(`/games?q=${encodeURIComponent(q)}&sort=${sort}`); load(); }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search games, creators, ideas..." />
      <select value={sort} onChange={e => { setSort(e.target.value); load(q, e.target.value); }}><option value="newest">Newest</option><option value="popular">Popular</option><option value="price_low">Lowest price</option><option value="price_high">Highest price</option></select>
      <button className="primary-btn">Search</button>
    </form>
    {error && <Status kind="error">{error.message}</Status>}
    {loading ? <div className="game-grid">{Array.from({length:8}).map((_,i)=><div key={i} className="skeleton game-skeleton" />)}</div> : games.length ? <div className="game-grid">{games.map(g => <GameCard key={g.id} game={g} />)}</div> : <div className="empty-state"><div className="empty-icon">⌁</div><h3>No games found</h3><p>Try a different search or be the creator who changes that.</p></div>}
  </div>;
}
