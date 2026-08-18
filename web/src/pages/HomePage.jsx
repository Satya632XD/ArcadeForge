import React, { useEffect, useState } from 'react';
import Link from '../components/Link';
import GameCard from '../components/GameCard';
import Status from '../components/Status';
import { api } from '../api/client';

export default function HomePage() {
  const [games, setGames] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => { api.games('sort=popular&limit=8').then(x => setGames(x.games)).catch(setError); }, []);
  return <div className="home">
    <section className="hero">
      <div>
        <div className="eyebrow">THE CODE-FIRST GAME PLATFORM</div>
        <h1>Build it. Publish it.<br /><span>Let people play.</span></h1>
        <p>ArcadeForge turns JavaScript game code into shareable browser games, with creator tools and server-authoritative economy from day one.</p>
        <div className="hero-actions"><Link to="/games" className="primary-btn large">Explore games</Link><Link to="/create" className="ghost-btn large">Create a game</Link></div>
      </div>
      <div className="hero-console"><div className="console-top"><span></span><span></span><span></span><b>runtime.js</b></div><pre>{`GameAPI.ready();\n\nconst canvas = document.createElement('canvas');\ncanvas.width = 720;\ncanvas.height = 420;\ndocument.body.appendChild(canvas);\n\n// your game lives here ✨`}</pre><div className="console-glow" /></div>
    </section>
    <section className="section-heading"><div><div className="eyebrow">DISCOVER</div><h2>Games people are playing</h2></div><Link to="/games" className="text-link">See all →</Link></section>
    {error ? <Status kind="error">Could not load games.</Status> : <div className="game-grid">{games.map(g => <GameCard key={g.id} game={g} />)}</div>}
    {!games.length && !error && <div className="empty-state">No published games yet. Be the first creator.</div>}
    <section className="feature-strip"><div><span>01</span><h3>Write JavaScript</h3><p>No visual editor in v1. You own the code.</p></div><div><span>02</span><h3>Ship instantly</h3><p>Draft, publish, unpublish and iterate from Studio.</p></div><div><span>03</span><h3>Earn fairly</h3><p>Paid plays route through the server ledger and 85/15 split.</p></div></section>
  </div>;
}
