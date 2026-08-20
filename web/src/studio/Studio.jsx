import React, { useEffect, useRef, useState, useMemo } from 'react';
import { FileSystemService, DEFAULT_FILES } from './filesystem.js';
import { EditorService } from './editor.js';
import { PreviewService } from './preview.js';
import { RuntimeService } from './runtime.js';
import { detectLanguage } from './languages.js';
import Link from '../components/Link';
import Status from '../components/Status';
import './studio.css';

export default function Studio({
  initialTitle = '',
  initialDescription = '',
  initialFiles = null,
  initialSourceCode = '',
  status = 'draft',
  saving = false,
  error = null,
  message = '',
  onSave,
  onPublish,
  onUnpublish,
  isEdit = false
}) {
  const [title, setTitle] = useState(initialTitle || 'Untitled Game');
  const [description, setDescription] = useState(initialDescription || '');
  const [activeFile, setActiveFile] = useState('app.js');
  const [openTabs, setOpenTabs] = useState(['index.html', 'style.css', 'app.js']);
  const [view, setView] = useState('code');
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [statusText, setStatusText] = useState('Ready');
  const [fileList, setFileList] = useState([]);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileError, setNewFileError] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const editorMountRef = useRef(null);
  const iframeRef = useRef(null);
  const consoleRef = useRef(null);

  // Initialize virtual filesystem
  const fs = useMemo(() => {
    let files = initialFiles;
    if (!files && initialSourceCode) {
      // Legacy game conversion
      files = {
        ...DEFAULT_FILES,
        'app.js': initialSourceCode
      };
    }
    return new FileSystemService(files, initialTitle || 'ArcadeForge Game');
  }, [initialFiles, initialSourceCode, initialTitle]);

  const previewServiceRef = useRef(null);
  const editorServiceRef = useRef(null);
  const runtimeServiceRef = useRef(null);

  // Sync title & description when initial values update from API
  useEffect(() => {
    if (initialTitle) setTitle(initialTitle);
    if (initialDescription) setDescription(initialDescription);
  }, [initialTitle, initialDescription]);

  // Sync filesystem when initialFiles or initialSourceCode load
  useEffect(() => {
    if (initialFiles && Object.keys(initialFiles).length > 0) {
      fs.loadFromFiles(initialFiles, initialTitle || 'ArcadeForge Game');
      const files = fs.listFiles();
      setFileList(files);
      const target = files.includes('app.js') ? 'app.js' : files[0] || 'index.html';
      setActiveFile(target);
      setOpenTabs(files.slice(0, 4));
    } else if (initialSourceCode) {
      const legacyFiles = { ...DEFAULT_FILES, 'app.js': initialSourceCode };
      fs.loadFromFiles(legacyFiles, initialTitle || 'ArcadeForge Game');
      const files = fs.listFiles();
      setFileList(files);
      setActiveFile('app.js');
      setOpenTabs(['index.html', 'style.css', 'app.js']);
    } else {
      setFileList(fs.listFiles());
    }
  }, [fs, initialFiles, initialSourceCode, initialTitle]);

  // Initialize preview & runtime services
  useEffect(() => {
    const preview = new PreviewService({
      iframe: iframeRef.current,
      consoleOutput: consoleRef.current,
      onStatus: setStatusText
    });
    preview.attachMessageListener();
    previewServiceRef.current = preview;

    const runtime = new RuntimeService({
      onStatus: setStatusText,
      onOutput(type, msg) {
        preview.log(type, msg);
      }
    });
    runtimeServiceRef.current = runtime;

    return () => {
      preview.destroy();
    };
  }, []);

  // Initialize EditorService and mount active file
  useEffect(() => {
    if (!editorMountRef.current) return;

    const editor = new EditorService({
      mountEl: editorMountRef.current,
      onChange(content) {
        if (activeFile) {
          fs.writeFile(activeFile, content);
          setStatusText('Modified locally');
        }
      },
      onCursorChange({ line, column }) {
        setCursor({ line, column });
      }
    });

    editorServiceRef.current = editor;
    const content = fs.readFile(activeFile);
    editor.mount(activeFile, content);

    return () => {
      editor.destroy();
      editorServiceRef.current = null;
    };
  }, [fs]); // Only recreate when fs changes

  // Update editor when active file changes
  const switchFile = (fileName) => {
    if (!fs.exists(fileName)) return;
    setActiveFile(fileName);

    if (!openTabs.includes(fileName)) {
      setOpenTabs(prev => [...prev, fileName]);
    }

    const content = fs.readFile(fileName);
    if (editorServiceRef.current) {
      editorServiceRef.current.loadFile(fileName, content);
    }
    setView('code');
  };

  const closeTab = (e, tabName) => {
    e.stopPropagation();
    const remaining = openTabs.filter(t => t !== tabName);
    setOpenTabs(remaining);
    if (activeFile === tabName) {
      const nextActive = remaining[0] || null;
      if (nextActive) {
        switchFile(nextActive);
      }
    }
  };

  const handleCreateFile = () => {
    setNewFileError('');
    if (!newFileName.trim()) {
      setNewFileError('Filename cannot be empty.');
      return;
    }
    try {
      const normalized = FileSystemService.normalizePath(newFileName.trim());
      fs.createFile(normalized, '');
      setFileList(fs.listFiles());
      setShowNewFileModal(false);
      setNewFileName('');
      switchFile(normalized);
    } catch (err) {
      setNewFileError(err.message || 'Could not create file.');
    }
  };

  const handleDeleteFile = (e, fileName) => {
    e.stopPropagation();
    if (fileName === 'index.html' || fileName === 'app.js') {
      if (!window.confirm(`"${fileName}" is a core game file. Are you sure you want to delete it?`)) {
        return;
      }
    } else if (!window.confirm(`Delete "${fileName}"?`)) {
      return;
    }

    fs.deleteFile(fileName);
    const remaining = fs.listFiles();
    setFileList(remaining);
    setOpenTabs(prev => prev.filter(t => t !== fileName));

    if (activeFile === fileName) {
      const next = remaining[0] || 'index.html';
      switchFile(next);
    }
  };

  const handleRun = async () => {
    if (!activeFile) return;
    const preview = previewServiceRef.current;
    const runtime = runtimeServiceRef.current;
    if (!preview || !runtime) return;

    preview.clearConsole();
    try {
      const result = await runtime.run(activeFile, fs.snapshot());
      if (result.type === 'preview') {
        preview.render(fs.snapshot());
      }
      setView('preview');
    } catch (err) {
      preview.log('error', err.message || String(err));
      setStatusText('Runtime error');
      setView('preview');
    }
  };

  const handleSave = (e) => {
    if (e) e.preventDefault();
    if (onSave) {
      onSave({
        title,
        description,
        files: fs.snapshot()
      });
    }
  };

  return (
    <div className="studio-root">
      {/* Top Header Bar */}
      <header className="studio-topbar">
        <div className="studio-topbar-left">
          <Link to="/dashboard" className="studio-btn studio-btn-ghost">
            ← Studio
          </Link>
          <span className={`studio-badge ${status}`}>{status}</span>
        </div>

        <div className="studio-topbar-center">
          <input
            type="text"
            className="studio-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Game title"
            maxLength={100}
          />
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={() => setShowDetailsModal(true)}
            title="Edit description & metadata"
          >
            Info
          </button>
        </div>

        <div className="studio-topbar-right">
          <button
            type="button"
            className="studio-btn studio-btn-accent"
            onClick={handleRun}
            title="Run active file"
          >
            ▶ Run
          </button>

          <button
            type="button"
            className="studio-btn studio-btn-primary"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>

          {isEdit && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              disabled={saving}
              onClick={status === 'published' ? onUnpublish : onPublish}
            >
              {status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
          )}
        </div>
      </header>

      {/* Status Banners */}
      {error && (
        <div style={{ padding: '0 16px', background: '#090c12' }}>
          <Status kind="error">{error.message || String(error)}</Status>
        </div>
      )}
      {message && (
        <div style={{ padding: '0 16px', background: '#090c12' }}>
          <Status kind="success">{message}</Status>
        </div>
      )}

      {/* Main Workspace with 3 responsive sections */}
      <main className="studio-workspace" data-view={view}>
        {/* View 1: Files Explorer */}
        <section className="studio-explorer">
          <div className="studio-explorer-header">
            <span>EXPLORER</span>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              style={{ padding: '2px 8px', fontSize: '11px' }}
              onClick={() => {
                setNewFileError('');
                setNewFileName('');
                setShowNewFileModal(true);
              }}
            >
              + File
            </button>
          </div>

          <div className="studio-explorer-list">
            {fileList.map((fileName) => {
              const lang = detectLanguage(fileName);
              return (
                <button
                  key={fileName}
                  type="button"
                  className={`studio-file-row ${fileName === activeFile ? 'active' : ''}`}
                  onClick={() => switchFile(fileName)}
                >
                  <span>{fileName}</span>
                  <button
                    type="button"
                    className="studio-file-del"
                    title={`Delete ${fileName}`}
                    onClick={(e) => handleDeleteFile(e, fileName)}
                  >
                    ×
                  </button>
                </button>
              );
            })}
          </div>
        </section>

        {/* View 2: Code Editor */}
        <section className="studio-editor-pane">
          <div className="studio-editor-tabs">
            {openTabs.map((tabName) => (
              <button
                key={tabName}
                type="button"
                className={`studio-tab ${tabName === activeFile ? 'active' : ''}`}
                onClick={() => switchFile(tabName)}
              >
                <span>{tabName}</span>
                {openTabs.length > 1 && (
                  <span
                    className="studio-tab-close"
                    onClick={(e) => closeTab(e, tabName)}
                  >
                    ×
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="studio-editor-statusbar">
            <div>
              <span style={{ fontWeight: 600, color: '#f4f6fb' }}>{activeFile}</span>
              <span style={{ marginLeft: '12px', color: '#76e7a6' }}>{statusText}</span>
            </div>
            <span>Ln {cursor.line}, Col {cursor.column}</span>
          </div>

          <div className="studio-codemirror-mount" ref={editorMountRef} />
        </section>

        {/* View 3: Live Preview & Console */}
        <section className="studio-preview-pane">
          <div className="studio-preview-header">
            <div className="studio-live-tag">
              <span className="studio-live-dot"></span>
              <span>LIVE PREVIEW</span>
            </div>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              style={{ padding: '2px 8px', fontSize: '11px' }}
              onClick={handleRun}
            >
              Reload
            </button>
          </div>

          <iframe
            ref={iframeRef}
            className="studio-iframe"
            title="ArcadeForge Live Preview"
          />

          <div className="studio-console">
            <div className="studio-console-header">
              <span>CONSOLE OUTPUT</span>
              <button
                type="button"
                className="studio-btn studio-btn-ghost"
                style={{ padding: '1px 6px', fontSize: '10px' }}
                onClick={() => previewServiceRef.current?.clearConsole()}
              >
                Clear
              </button>
            </div>
            <div className="studio-console-output" ref={consoleRef} />
          </div>
        </section>
      </main>

      {/* Mobile / Tablet Bottom Navigation */}
      <nav className="studio-mobile-nav">
        <button
          type="button"
          className={`studio-nav-btn ${view === 'files' ? 'active' : ''}`}
          onClick={() => setView('files')}
        >
          <span>▤</span>
          <small>Files</small>
        </button>

        <button
          type="button"
          className={`studio-nav-btn ${view === 'code' ? 'active' : ''}`}
          onClick={() => setView('code')}
        >
          <span>⌨</span>
          <small>Code</small>
        </button>

        <button
          type="button"
          className={`studio-nav-btn ${view === 'preview' ? 'active' : ''}`}
          onClick={() => {
            previewServiceRef.current?.render(fs.snapshot());
            setView('preview');
          }}
        >
          <span>▷</span>
          <small>Preview</small>
        </button>
      </nav>

      {/* Modal: New File */}
      {showNewFileModal && (
        <div className="studio-modal-backdrop" onClick={() => setShowNewFileModal(false)}>
          <div className="studio-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New File</h3>
            <p>Enter filename with extension (e.g. <code>game.js</code>, <code>levels.json</code>, <code>theme.css</code>):</p>
            <input
              type="text"
              className="studio-title-input"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="e.g. player.js"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFile();
              }}
            />
            {newFileError && <Status kind="error">{newFileError}</Status>}
            <div className="studio-modal-actions">
              <button
                type="button"
                className="studio-btn studio-btn-ghost"
                onClick={() => setShowNewFileModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={handleCreateFile}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Game Info & Description */}
      {showDetailsModal && (
        <div className="studio-modal-backdrop" onClick={() => setShowDetailsModal(false)}>
          <div className="studio-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Game Details</h3>
            <label className="field">
              <span>Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                rows={5}
                placeholder="Describe your game gameplay, controls, and features…"
              />
            </label>
            <p className="muted" style={{ fontSize: '12px' }}>
              Published games are free to play. Save changes when done.
            </p>
            <div className="studio-modal-actions">
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={() => setShowDetailsModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
