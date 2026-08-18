import React from 'react';
import GamePlayer from '../components/GamePlayer';
import Link from '../components/Link';

export default function PlayPage({id}){return <div className="play-page"><div className="play-top"><Link to={`/games/${id}`} className="ghost-btn">← Back</Link><span>ArcadeForge Runtime</span></div><GamePlayer gameId={id}/></div>}
