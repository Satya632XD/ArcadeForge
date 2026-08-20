import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import Status from './Status';

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; connect-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'">`;

function buildHarnessScript(jsCode) {
  return `<script>
const parentWindow = window.parent;
window.addEventListener('message', function(event) {
  if (event.source !== parentWindow) return;
  if (!event.data || event.data.type !== 'GAME_CONTEXT') return;
  window.__ARCADEFORGE__ = Object.freeze(event.data.payload);
});
const gameApi = Object.freeze({
  ready: function() { parentWindow.postMessage({ type: 'GAME_READY' }, '*'); },
  resize: function() { parentWindow.postMessage({ type: 'GAME_RESIZE', height: Math.min(1600, Math.max(300, document.documentElement.scrollHeight)) }, '*'); }
});
window.GameAPI = gameApi;

try {
${jsCode}
} catch (error) {
  var msg = String((error && error.message) || error).replace(/[&<>]/g, '');
  document.body.innerHTML = '<div style="padding:24px;color:#ffb8c0;font-family:sans-serif">Game error: ' + msg + '</div>';
  parentWindow.postMessage({ type: 'GAME_ERROR', message: msg }, '*');
}
gameApi.ready();
<\/script>`;
}

function buildLegacySrcDoc(sourceCode, title) {
  const safeTitle = String(title || '').replace(/[<&>"']/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title>${CSP_META}<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#05060a;color:white;font-family:system-ui}canvas{display:block;max-width:100%;max-height:100%}</style></head><body>${buildHarnessScript(sourceCode || '')}</body></html>`;
}

function buildProjectSrcDoc(files, title) {
  let html = files['index.html'] || files['index.htm'];
  const safeTitle = String(title || '').replace(/[<&>"']/g, '');

  if (!html) {
    html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
</head>
<body>
</body>
</html>`;
  }

  // Collect all CSS files
  const cssFiles = [];
  if (files['style.css']) cssFiles.push(files['style.css']);
  if (files['styles.css']) cssFiles.push(files['styles.css']);
  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith('.css') && path !== 'style.css' && path !== 'styles.css') {
      cssFiles.push(content);
    }
  }
  const css = cssFiles.join('\n\n');

  // Collect all JS files
  const jsFiles = [];
  if (files['app.js']) jsFiles.push(files['app.js']);
  if (files['main.js']) jsFiles.push(files['main.js']);
  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith('.js') && path !== 'app.js' && path !== 'main.js') {
      jsFiles.push(content);
    }
  }
  const js = jsFiles.join('\n\n');

  // Inject CSP and styles into head
  let headAdditions = `${CSP_META}\n`;
  if (css) {
    headAdditions += `<style>\n${css}\n</style>\n`;
  }

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${headAdditions}</head>`);
  } else {
    html = `${headAdditions}${html}`;
  }

  // Inject harness script before </body>
  const harness = buildHarnessScript(js);
  if (html.includes('</body>')) {
    html = html.replace('</body>', `${harness}\n</body>`);
  } else {
    html += `\n${harness}`;
  }

  return html;
}

export default function GamePlayer({ gameId }) {
  const frame = useRef(null);
  const [state, setState] = useState({ loading: true, error: null, game: null, session: null });

  const srcDoc = useMemo(() => {
    if (!state.game) return '';
    if (state.game.files && typeof state.game.files === 'object' && Object.keys(state.game.files).length > 0) {
      return buildProjectSrcDoc(state.game.files, state.game.title);
    }
    return buildLegacySrcDoc(state.game.sourceCode, state.game.title);
  }, [state.game]);

  useEffect(() => {
    let alive = true;
    api.launch(gameId)
      .then((data) => {
        if (alive) setState({ loading: false, error: null, game: data.game, session: data.playSession });
      })
      .catch((error) => {
        if (alive) setState({ loading: false, error, game: null, session: null });
      });
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

  return (
    <div className="player-shell">
      <iframe
        ref={frame}
        title={state.game.title}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        srcDoc={srcDoc}
      />
    </div>
  );
}
