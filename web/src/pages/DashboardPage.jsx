import React, { useEffect, useState } from 'react';
import Link from '../components/Link';
import GameCard from '../components/GameCard';
import Status from '../components/Status';
import { api } from '../api/client';

export default function DashboardPage() {
  const [games, setGames] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    Promise.all([api.myGames(), api.earnings(), api.meProfile()])
      .then(([gamesData, earningsData, profileData]) => {
        setGames(gamesData.games);
        setEarnings(earningsData);
        setProfile(profileData.profile);
      })
      .catch(setError);
  }, []);

  return <div className="container page">
    <div className="page-title">
      <div>
        <div className="eyebrow">CREATOR STUDIO</div>
        <h1>Welcome back, {profile?.displayName || 'creator'}</h1>
        <p>Manage your code, publish games, and track creator earnings.</p>
      </div>
      <Link to="/create" className="primary-btn">+ New game</Link>
    </div>
    {error && <Status kind="error">{error.message}</Status>}
    <div className="stats-grid">
      <div className="stat-card"><span>Games</span><b>{games.length}</b></div>
      <div className="stat-card"><span>Total plays</span><b>{games.reduce((total, game) => total + game.playCount, 0).toLocaleString()}</b></div>
      <div className="stat-card"><span>Creator earnings</span><b>GC {(earnings?.totalEarned || 0).toLocaleString()}</b></div>
    </div>
    <section className="section-heading"><div><div className="eyebrow">YOUR CATALOG</div><h2>Your games</h2></div></section>
    {games.length
      ? <div className="game-grid">{games.map((game) => <div key={game.id} className="studio-card-wrap"><GameCard game={game} /><Link to={`/edit/${game.id}`} className="studio-edit">Edit</Link></div>)}</div>
      : <div className="empty-state"><h3>Your first game is waiting.</h3><p>Start with the included canvas starter and make it yours.</p><Link to="/create" className="primary-btn">Create game</Link></div>}
    {earnings && <section className="panel earnings-panel">
      <div className="panel-title"><div><div className="eyebrow">EARNINGS</div><h2>Creator revenue by game</h2></div></div>
      <div className="earnings-list">
        {earnings.games.length
          ? earnings.games.map((game) => <div className="earning-row" key={game.id}><div><b>{game.title}</b></div><strong>GC {game.earned.toLocaleString()}</strong></div>)
          : <div className="muted">No creator revenue yet.</div>}
      </div>
    </section>}
  </div>;
}
