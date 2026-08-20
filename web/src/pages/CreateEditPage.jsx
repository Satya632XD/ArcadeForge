import React, { useEffect, useState } from 'react';
import Studio from '../studio/Studio';
import Status from '../components/Status';
import { api } from '../api/client';
import { go } from '../api/router';

export default function CreateEditPage({ id }) {
  const edit = Boolean(id);
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(edit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('draft');

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.game(id)
      .then(({ game: fetchedGame }) => {
        setGame(fetchedGame);
        setStatus(fetchedGame.status || 'draft');
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave({ title, description, files }) {
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      if (edit) {
        const data = await api.updateGame(id, { title, description, files });
        setGame(data.game);
        setStatus(data.game.status);
        setMessage('Game saved successfully.');
      } else {
        const data = await api.createGame({ title, description, files });
        setMessage('Game created.');
        go(`/edit/${data.game.id}`);
      }
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!id) return;
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      await api.publish(id);
      setStatus('published');
      setMessage('Game published to Discover catalog.');
    } catch (pubError) {
      setError(pubError);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpublish() {
    if (!id) return;
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      await api.unpublish(id);
      setStatus('draft');
      setMessage('Game reverted to draft.');
    } catch (unpubError) {
      setError(unpubError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container page" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div className="status info">Loading Studio…</div>
      </div>
    );
  }

  if (error && edit && !game) {
    return (
      <div className="container page">
        <Status kind="error">{error.message || 'Failed to load game'}</Status>
      </div>
    );
  }

  return (
    <Studio
      initialTitle={game?.title || ''}
      initialDescription={game?.description || ''}
      initialFiles={game?.files || null}
      initialSourceCode={game?.sourceCode || ''}
      status={status}
      saving={saving}
      error={error}
      message={message}
      onSave={handleSave}
      onPublish={handlePublish}
      onUnpublish={handleUnpublish}
      isEdit={edit}
    />
  );
}
