import { useState } from 'react';
import { List } from './pages/List';
import { Editor } from './pages/Editor';
import { Preview } from './pages/Preview';

type View = 'list' | 'editor' | 'preview';

export default function App() {
  const [view, setView] = useState<View>('list');
  const [activeId, setActiveId] = useState<string | null>(null);

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
