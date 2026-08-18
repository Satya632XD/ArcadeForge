import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import Status from './Status';

function buildSrcDoc(sourceCode, title) {
  const safeTitle = String(title).replace(/[<&>"']/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; connect-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#05060a;color:white;font-family:system-ui}canvas{display:block;max-width:100%;max-height:100%}</style></head><body><script>
const parentWindow = window.parent;
window.addEventListener('message', (event) => {
  if (event.source !== parentWindow) return;
  if (!event.data || event.data.type !== 'GAME_CONTEXT') return;
  window.__ARCADEFORGE__ = Object.freeze(event.data.payload);
});
const gameApi = Object.freeze({
  ready() { parentWindow.postMessage({ type: 'GAME_READY' }, '*'); },
  resize() { parentWindow.postMessage({ type: 'GAME_RESIZE', height: Math.min(1600, Math.max(300, document.documentElement.scrollHeight)) }, '*'); }
});
window.GameAPI = gameApi;
try {
${sourceCode}
} catch (error) {
  document.body.innerHTML = '<div style="padding:24px;color:#ffb8c0">Game error: ' + String(error.message || error).replace(/[&<>]/g,'') + '</div>';
  parentWindow.postMessage({ type: 'GAME_ERROR', message: String(error.message || error) }, '*');
}
gameApi.ready();
</script></body></html>`;
}

export default function GamePlayer({ gameId }) {
  const frame = useRef(null);
  const [state, setState] = useState({ loading: true, error: null, game: null, session: null });
  const srcDoc = useMemo(() => state.game ? buildSrcDoc(state.game.sourceCode, state.game.title) : '', [state.game]);

  useEffect(() => {
    let alive = true;
    api.launch(gameId).then((data) => { if (alive) setState({ loading: false, error: null, game: data.game, session: data.playSession }); })
      .catch((error) => { if (alive) setState({ loading: false, error, game: null, session: null }); });
    return () => { alive = false; };
  }, [gameId]);

  useEffect(() => {
    function onMessage(event) {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      if (event.data?.type === 'GAME_READY') {
        frame.current.contentWindow.postMessage({
          type: 'GAME_CONTEXT',
          payload: { gameId, playSessionId: state.session?.id, gameTitle: state.game?.title }
        }, '*');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [gameId, state.session, state.game]);

  useEffect(() => () => {
    if (state.session?.id) api.endSession(gameId, state.session.id).catch(() => {});
  }, [gameId, state.session]);

  if (state.loading) return <div className="player-shell"><div className="skeleton player-skeleton" /></div>;
  if (state.error) return <Status kind="error">{state.error.message}</Status>;
  return <div className="player-shell">
    <iframe ref={frame} title={state.game.title} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={srcDoc} />
  </div>;
}
