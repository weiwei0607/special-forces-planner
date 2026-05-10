import { useState, useEffect } from 'react';
import { List } from './pages/List';
import { Editor } from './pages/Editor';
import { Preview } from './pages/Preview';
import { db, generateId, type Itinerary } from './db';

type View = 'list' | 'editor' | 'preview';

function loadSharedItinerary(): Itinerary | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;
  try {
    const encoded = hash.slice('#share='.length);
    const json = decodeURIComponent(atob(encoded));
    const it: Itinerary = JSON.parse(json);
    // Give it a fresh id so it doesn't overwrite an existing local one
    it.id = generateId();
    it.createdAt = Date.now();
    it.updatedAt = Date.now();
    return it;
  } catch {
    return null;
  }
}

export default function App() {
  const [view, setView] = useState<View>('list');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shareLoaded, setShareLoaded] = useState(false);

  useEffect(() => {
    if (shareLoaded) return;
    setShareLoaded(true);
    const shared = loadSharedItinerary();
    if (!shared) return;
    // Save and open preview
    db.itineraries.put(shared).then(() => {
      setActiveId(shared.id);
      setView('preview');
      window.history.replaceState(null, '', window.location.pathname);
    });
  }, [shareLoaded]);

  const openEditor = (id?: string) => {
    setActiveId(id || null);
    setView('editor');
  };

  const openPreview = (id: string) => {
    setActiveId(id);
    setView('preview');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {view === 'list' && <List onNew={() => openEditor()} onOpen={(id) => openEditor(id)} onPreview={(id) => openPreview(id)} />}
      {view === 'editor' && <Editor id={activeId} onBack={() => setView('list')} onPreview={(id) => openPreview(id)} />}
      {view === 'preview' && activeId && <Preview id={activeId} onBack={() => setView('editor')} />}
    </div>
  );
}
