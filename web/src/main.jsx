import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Layout from './components/Layout';
import { usePath, pathOnly } from './api/router';
import { api } from './api/client';
import HomePage from './pages/HomePage';
import GamesPage from './pages/GamesPage';
import { LoginPage, RegisterPage } from './pages/AuthPage';
import GameDetailPage from './pages/GameDetailPage';
import CreateEditPage from './pages/CreateEditPage';
import DashboardPage from './pages/DashboardPage';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';
import AccountPage from './pages/AccountPage';
import PlayPage from './pages/PlayPage';
import Status from './components/Status';
import './styles.css';

function App(){
  const path=usePath(); const [user,setUser]=useState(undefined);
  async function refreshAuth(){try{const x=await api.me();setUser(x.user)}catch{setUser(null)}}
  useEffect(()=>{refreshAuth()},[]);
  if(user===undefined)return <div className="boot"><div className="logo-mark">◆</div><div>Loading ArcadeForge…</div></div>;
  const p=pathOnly(path);
  let content;
  if(p==='/' ) content=<HomePage/>;
  else if(p==='/games') content=<GamesPage/>;
  else if(p==='/login') content=user?<Navigate to="/dashboard"/>:<LoginPage refreshAuth={refreshAuth}/>;
  else if(p==='/register') content=user?<Navigate to="/dashboard"/>:<RegisterPage refreshAuth={refreshAuth}/>;
  else if(p==='/dashboard') content=user?<DashboardPage/>:<Navigate to="/login"/>;
  else if(p==='/wallet') content=user?<WalletPage/>:<Navigate to="/login"/>;
  else if(p==='/account') content=user?<AccountPage/>:<Navigate to="/login"/>;
  else if(p==='/create') content=user?<CreateEditPage/>:<Navigate to="/login"/>;
  else if(p.startsWith('/edit/')) content=user?<CreateEditPage id={p.split('/')[2]}/>:<Navigate to="/login"/>;
  else if(p.startsWith('/play/')) content=user?<PlayPage id={p.split('/')[2]}/>:<Navigate to="/login"/>;
  else if(p.startsWith('/games/')) content=<GameDetailPage id={p.split('/')[2]} user={user}/>;
  else if(p.startsWith('/profile/')) content=<ProfilePage username={decodeURIComponent(p.split('/')[2])}/>;
  else content=<div className="container page"><Status kind="error">That page does not exist.</Status></div>;
  return <Layout user={user} refreshAuth={refreshAuth}>{content}</Layout>;
}

function Navigate({to}){useEffect(()=>{window.history.replaceState({},'',to);window.dispatchEvent(new PopStateEvent('popstate'))},[to]);return null}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
