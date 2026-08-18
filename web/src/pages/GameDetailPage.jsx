import React, { useEffect, useState } from 'react';
import Link from '../components/Link';
import Status from '../components/Status';
import GamePlayer from '../components/GamePlayer';
import { api } from '../api/client';
import { go } from '../api/router';

export default function GameDetailPage({ id, user }) {
  const [game, setGame] = useState(null); const [error,setError]=useState(null); const [editing,setEditing]=useState(false);
  useEffect(() => { api.game(id).then(x=>setGame(x.game)).catch(setError); }, [id]);
  if(error) return <div className="container page"><Status kind="error">{error.message}</Status></div>;
  if(!game) return <div className="container page"><div className="skeleton detail-skeleton" /></div>;
  const owner = user?.id === game.creatorId;
  return <div className="container page">
    <div className="detail-hero"><div className="detail-art">{game.title.slice(0,1)}</div><div className="detail-copy"><div className="eyebrow">{game.status === 'published' ? 'PUBLISHED GAME' : 'YOUR DRAFT'}</div><h1>{game.title}</h1><p>{game.description}</p><div className="game-meta large-meta"><span>by <Link className="text-link" to={`/profile/${game.creatorUsername}`}>@{game.creatorUsername}</Link></span><span>{game.playCount.toLocaleString()} plays</span><span>{game.playPrice ? `◆ ${game.playPrice} GC per play` : 'Free to play'}</span></div><div className="hero-actions">{game.status === 'published' ? <button className="primary-btn" onClick={()=>setEditing(true)}>Play game</button> : owner && <Link className="primary-btn" to={`/edit/${game.id}`}>Edit draft</Link>}{owner && <Link className="ghost-btn" to={`/edit/${game.id}`}>Manage</Link>}</div></div></div>
    {editing && <div className="player-modal"><div className="player-modal-inner"><button className="close-btn" onClick={()=>setEditing(false)}>×</button><GamePlayer gameId={game.id} /></div></div>}
    <div className="detail-grid"><section className="panel"><div className="panel-title"><h2>About this game</h2></div><p className="long-copy">{game.description || 'This creator has not added a description yet.'}</p></section><aside className="panel"><h3>Runtime</h3><p className="muted">Code runs in a sandboxed browser iframe. The game has no direct access to this platform’s database, filesystem, cookies, secrets, or private APIs.</p><div className="runtime-pill">Sandboxed JS · v1</div></aside></div>
  </div>;
}
