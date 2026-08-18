import React from 'react';
import Link from './Link';

function hue(title) {
  let n = 0; for (let i = 0; i < title.length; i++) n = (n * 31 + title.charCodeAt(i)) % 360;
  return n;
}

export default function GameCard({ game }) {
  const color = hue(game.title);
  return <Link to={`/games/${game.id}`} className="game-card">
    <div className="game-art" style={{ background: `linear-gradient(135deg, hsl(${color} 70% 20%), hsl(${(color + 55) % 360} 70% 38%))` }}>
      <span>{game.title.slice(0, 1).toUpperCase()}</span>
      {game.playPrice > 0 && <small>◆ {game.playPrice} GC</small>}
    </div>
    <div className="game-card-body">
      <h3>{game.title}</h3>
      <p>{game.description || 'No description yet.'}</p>
      <div className="game-meta"><span>@{game.creatorUsername}</span><span>{game.playCount.toLocaleString()} plays</span></div>
    </div>
  </Link>;
}
